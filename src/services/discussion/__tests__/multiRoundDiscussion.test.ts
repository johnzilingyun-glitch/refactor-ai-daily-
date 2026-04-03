import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMultiRoundDiscussion } from '../../discussionService';
import type { MultiRoundProgress } from '../../discussionService';
import * as geminiService from '../../geminiService';
import { StockAnalysis, AgentMessage } from '../../../types';

// Mock geminiService
vi.mock('../../geminiService', async () => {
  const actual = await vi.importActual('../../geminiService');
  return {
    ...actual as any,
    generateContentWithUsage: vi.fn(),
    delay: vi.fn().mockResolvedValue(undefined), // Skip delays in tests
  };
});

const mockAnalysis: StockAnalysis = {
  stockInfo: {
    symbol: '600519.SS',
    name: '贵州茅台',
    price: 1800,
    change: 10,
    changePercent: 0.56,
    market: 'A-Share',
    currency: 'CNY',
    lastUpdated: '2026-03-30 15:00:00 CST',
    previousClose: 1790,
  },
  summary: 'Test summary',
  technicalAnalysis: 'Test technical',
  fundamentalAnalysis: 'Test fundamental',
  sentiment: 'Bullish',
  score: 85,
  recommendation: 'Buy',
  keyRisks: [],
  keyOpportunities: [],
  news: [],
};

function mockExpertResponse(content: string, extra?: Record<string, any>) {
  return {
    text: JSON.stringify({ content, ...extra }),
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
  };
}

describe('startMultiRoundDiscussion', () => {
  let callCount: number;

  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;

    // Mock fetch for /api/stock/commodities and /api/admin/history
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('commodities')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('history')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => null });
    });

    // Mock AI - each call returns a unique expert response
    (geminiService.generateContentWithUsage as any).mockImplementation(() => {
      callCount++;
      return Promise.resolve(mockExpertResponse(`Expert response #${callCount}`));
    });
  });

  it('deep mode calls experts following [DR → TA+FA → SA+RM+CS → Reviewer] ×3 → CS pattern', async () => {
    const progressUpdates: MultiRoundProgress[] = [];

    const result = await startMultiRoundDiscussion(
      mockAnalysis,
      'deep',
      undefined,
      (progress) => progressUpdates.push({ ...progress, messages: [...progress.messages] }),
    );

    // Deep topology: [DR(1) + TA+FA(2) + SA+RM+CS(3) + Reviewer(1)] × 3 + CS(1)
    // = 7 * 3 + 1 = 22 expert calls + 1 synthesis call = 23 total AI calls
    expect(callCount).toBe(23);

    // All multi-round messages should be in the result
    expect(result.messages).toHaveLength(22);

    // Each message should have content
    result.messages.forEach((msg) => {
      expect(msg.content).toBeTruthy();
      expect(msg.role).toBeTruthy();
    });

    // Progress should have been called for each expert + 1 synthesis
    expect(progressUpdates.length).toBe(23);

    // First expert should be Deep Research Specialist
    expect(progressUpdates[0].currentExpert).toBe('Deep Research Specialist');

    // Last progress update should be the synthesis step
    expect(progressUpdates[progressUpdates.length - 1].currentExpert).toBe('综合研判引擎');

    // Final result should have finalConclusion from Chief Strategist
    expect(result.finalConclusion).toBeTruthy();
  });

  it('standard mode runs single iteration (no repetition)', async () => {
    const result = await startMultiRoundDiscussion(mockAnalysis, 'standard');

    // Standard topology: DR + [TA+FA+RM + Reviewer] + CS = 1 + 3 + 1 + 1 = 6
    // No repetition since ITERATION_COUNT.standard = 1
    // Standard topology has 4 rounds: DR(1), TA+FA+RM(3), Reviewer(1), CS(1) = 6 calls + 1 synthesis = 7
    expect(callCount).toBe(7);
    expect(result.messages).toHaveLength(6);
  });

  it('messages accumulate across rounds (each expert sees previous messages)', async () => {
    const prompts: string[] = [];

    (geminiService.generateContentWithUsage as any).mockImplementation((_ai: any, params: any) => {
      prompts.push(params.contents);
      callCount++;
      return Promise.resolve(mockExpertResponse(`Response #${callCount}`));
    });

    await startMultiRoundDiscussion(mockAnalysis, 'standard');

    // The last multi-round expert (Chief Strategist, second-to-last prompt before synthesis)
    // should see previous expert messages in the prompt
    const csPrompt = prompts[prompts.length - 2];
    expect(csPrompt).toContain('前轮专家发言');
    // Should contain previous responses
    expect(csPrompt).toContain('Response #');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();

    // Abort after first call
    (geminiService.generateContentWithUsage as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        controller.abort();
      }
      return Promise.resolve(mockExpertResponse(`Response #${callCount}`));
    });

    const result = await startMultiRoundDiscussion(
      mockAnalysis,
      'deep',
      undefined,
      undefined,
      controller.signal,
    );

    // Should have stopped early
    expect(callCount).toBeLessThan(22);
    expect(result.messages.length).toBeLessThan(22);
  });

  it('uses googleSearch tool instead of responseSchema', async () => {
    (geminiService.generateContentWithUsage as any).mockImplementation((_ai: any, params: any) => {
      // Verify config uses googleSearch, not responseSchema
      expect(params.config.tools).toEqual([{ googleSearch: {} }]);
      expect(params.config.responseSchema).toBeUndefined();
      expect(params.config.responseMimeType).toBe('application/json');
      callCount++;
      return Promise.resolve(mockExpertResponse(`Response #${callCount}`));
    });

    await startMultiRoundDiscussion(mockAnalysis, 'standard');
    expect(callCount).toBeGreaterThan(0);
  });

  it('round numbers are assigned to messages', async () => {
    const result = await startMultiRoundDiscussion(mockAnalysis, 'standard');

    // Standard: 4 rounds
    // Round 1: DR (1 expert)
    // Round 2: TA+FA+RM (3 experts)
    // Round 3: Reviewer (1 expert)
    // Round 4: CS (1 expert)
    const rounds = result.messages.map((m) => m.round);
    expect(rounds[0]).toBe(1); // DR
    expect(rounds[1]).toBe(2); // TA
    expect(rounds[2]).toBe(2); // FA
    expect(rounds[3]).toBe(2); // RM
    expect(rounds[4]).toBe(3); // Reviewer
    expect(rounds[5]).toBe(4); // CS
  });

  it('handles expert structured data extraction', async () => {
    (geminiService.generateContentWithUsage as any).mockImplementation((_ai: any, params: any) => {
      callCount++;
      const prompt = params.contents as string;

      if (prompt.includes('Deep Research Specialist') && !prompt.includes('前轮专家发言')) {
        return Promise.resolve(mockExpertResponse('DR analysis', {
          coreVariables: [{ name: 'Revenue', value: '100B' }],
        }));
      }
      if (prompt.includes('Risk Manager') && !prompt.includes('首席策略师')) {
        return Promise.resolve(mockExpertResponse('Risk analysis', {
          quantifiedRisks: [{ name: 'Market Risk', probability: 30 }],
        }));
      }
      if (prompt.includes('Chief Strategist')) {
        return Promise.resolve(mockExpertResponse('Final plan', {
          tradingPlan: { entryPrice: '100', targetPrice: '120' },
          scenarios: [{ case: 'Bull', probability: 60 }],
        }));
      }
      return Promise.resolve(mockExpertResponse(`Response #${callCount}`));
    });

    const result = await startMultiRoundDiscussion(mockAnalysis, 'standard');

    expect(result.coreVariables).toBeDefined();
    expect(result.tradingPlan).toBeDefined();
    expect(result.scenarios).toBeDefined();
  });
});
