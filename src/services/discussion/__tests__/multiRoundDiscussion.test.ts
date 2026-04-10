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
    generateAndParseJsonWithRetry: vi.fn(),
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
    content,
    messages: [], // Required for AgentDiscussion validation
    ...extra
  };
}

describe('startMultiRoundDiscussion', () => {
  let callCount: number;

  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;

    // Mock fetch for /api/stock/commodities and /api/admin/history
    (global.fetch as any).mockImplementation((url: string) => {
      const resp = {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [],
        text: async () => '[]',
      };
      return Promise.resolve(resp);
    });

    // Mock AI - use generateAndParseJsonWithRetry directly
    (geminiService.generateAndParseJsonWithRetry as any).mockImplementation(() => {
      callCount++;
      return Promise.resolve(mockExpertResponse(`Expert response #${callCount}`));
    });

    // Also mock generateContentWithUsage for synthesis step if needed
    (geminiService.generateContentWithUsage as any).mockImplementation(() => {
      return Promise.resolve({
        text: JSON.stringify({ 
          finalConclusion: 'Final synthesis result',
          messages: []
        }),
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
      });
    });
  });

  it('deep mode calls 14 experts (12 + Bull/Bear revision) + synthesis', async () => {
    const progressUpdates: MultiRoundProgress[] = [];

    const result = await startMultiRoundDiscussion(
      mockAnalysis,
      'deep',
      undefined,
      (progress) => progressUpdates.push({ ...progress, messages: [...progress.messages] }),
    );

    // Deep topology: 14 rounds (12 experts + Bull/Bear revision rounds) + 1 synthesis = 15
    expect(callCount).toBe(15);

    // All multi-round messages should be in the result
    expect(result.messages).toHaveLength(14);

    // Each message should have content
    result.messages.forEach((msg) => {
      expect(msg.content).toBeTruthy();
      expect(msg.role).toBeTruthy();
    });

    // Progress should have been called for each expert + 1 synthesis
    expect(progressUpdates.length).toBe(15);

    // First expert should be Deep Research Specialist
    expect(progressUpdates[0].currentExpert).toBe('Deep Research Specialist');

    // Last progress update should be the synthesis step
    expect(progressUpdates[progressUpdates.length - 1].currentExpert).toBe('综合研判引擎');

    // Final result should have finalConclusion from Chief Strategist
    expect(result.finalConclusion).toBeTruthy();
  });

  it('standard mode runs single iteration (no repetition)', async () => {
    const result = await startMultiRoundDiscussion(mockAnalysis, 'standard');

    // Standard topology: DR + TA + FA + Bull + Bear + RM + Reviewer + CS = 8 expert calls + 1 synthesis = 9
    expect(callCount).toBe(9);
    expect(result.messages).toHaveLength(8);
  });

  it('messages accumulate across rounds (each expert sees previous messages)', async () => {
    const prompts: string[] = [];

    (geminiService.generateAndParseJsonWithRetry as any).mockImplementation((_ai: any, params: any) => {
      prompts.push(params.contents);
      callCount++;
      return Promise.resolve(mockExpertResponse(`Response #${callCount}`));
    });

    await startMultiRoundDiscussion(mockAnalysis, 'standard');

    // The last multi-round expert (Chief Strategist, second-to-last prompt before synthesis)
    // should see previous expert messages in the prompt
    const csPrompt = prompts[prompts.length - 2];
    expect(csPrompt).toMatch(/(PREVIOUS DISCUSSION|前轮专家分析)/i);
    // Should contain previous responses
    expect(csPrompt).toContain('Response #');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();

    // Abort after first call
    (geminiService.generateAndParseJsonWithRetry as any).mockImplementation(() => {
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
    (geminiService.generateAndParseJsonWithRetry as any).mockImplementation((_ai: any, params: any, options: any) => {
      // Verify config uses googleSearch, not responseSchema
      const tools = options?.tools || params.config?.tools;
      const schema = options?.responseSchema || params.config?.responseSchema;
      
      expect(tools).toEqual([{ googleSearch: {} }]);
      expect(schema).toBeDefined();
      expect(options?.responseMimeType || params.config?.responseMimeType).toBe('application/json');
      callCount++;
      return Promise.resolve(mockExpertResponse(`Response #${callCount}`));
    });

    await startMultiRoundDiscussion(mockAnalysis, 'standard');
    expect(callCount).toBeGreaterThan(0);
  });

  it('round numbers are assigned to messages', async () => {
    const result = await startMultiRoundDiscussion(mockAnalysis, 'standard');

    // Standard: 6 rounds (sequential)
    const rounds = result.messages.map((m) => m.round);
    expect(rounds[0]).toBe(1); // DR
    expect(rounds[1]).toBe(2); // TA
    expect(rounds[2]).toBe(3); // FA
    expect(rounds[3]).toBe(4); // RM
    expect(rounds[4]).toBe(5); // Reviewer
    expect(rounds[5]).toBe(6); // CS
  });

  it('handles expert structured data extraction', async () => {
    const m = geminiService.generateAndParseJsonWithRetry as any;
    m.mockImplementation((_ai: any, params: any, options: any) => {
      const role = options?.role;
      
      if (role === 'Deep Research Specialist') {
        return Promise.resolve(mockExpertResponse('DR analysis', {
          coreVariables: [{ name: 'Revenue', value: '100B', source: 'Test', dataDate: '2026-04-07' }],
        }));
      }
      if (role === 'Risk Manager') {
        return Promise.resolve(mockExpertResponse('Risk analysis', {
          quantifiedRisks: [{ name: 'Market Risk', probability: 30 }],
        }));
      }
      if (role === 'Chief Strategist') {
        return Promise.resolve(mockExpertResponse('Final plan', {
          tradingPlan: { entryPrice: '100', targetPrice: '120' },
          scenarios: [{ case: 'Bull', probability: 60 }],
        }));
      }
      if (!role) {
        // Synthesis call usually doesn't have a role in options yet (or it's the 3rd arg)
        return Promise.resolve({
          finalConclusion: 'Final Synth',
          messages: []
        });
      }
      return Promise.resolve(mockExpertResponse(`${role} analysis`));
    });

    const result = await startMultiRoundDiscussion(mockAnalysis, 'standard');

    expect(result.coreVariables).toBeDefined();
    expect(result.tradingPlan).toBeDefined();
    expect(result.scenarios).toBeDefined();
  });
});
