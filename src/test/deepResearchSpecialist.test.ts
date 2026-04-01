import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startAgentDiscussion } from '../services/discussionService';
import * as geminiService from '../services/geminiService';
import { StockAnalysis } from '../types';

// Mock geminiService
vi.mock('../services/geminiService', async () => {
  const actual = await vi.importActual('../services/geminiService');
  return {
    ...actual as any,
    generateContentWithUsage: vi.fn(),
  };
});

describe('Deep Research Specialist Prompt Requirements', () => {
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
      previousClose: 1790
    },
    summary: 'Test summary',
    technicalAnalysis: 'Test technical',
    fundamentalAnalysis: 'Test fundamental',
    sentiment: 'Bullish',
    score: 85,
    recommendation: 'Buy',
    keyRisks: [],
    keyOpportunities: [],
    news: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for commodities API
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => []
    });

    // Mock AI response
    (geminiService.generateContentWithUsage as any).mockResolvedValue({
      text: JSON.stringify({
        messages: [],
        dataVerification: [],
        finalConclusion: 'Test conclusion',
        tradingPlan: {},
        scenarios: [],
        sensitivityFactors: [],
        expectationGap: {},
        controversialPoints: [],
        calculations: []
      })
    });
  });

  it('should contain dynamic indicator selection and cross-verification instructions', async () => {
    await startAgentDiscussion(mockAnalysis);

    const lastCall = (geminiService.generateContentWithUsage as any).mock.calls[0];
    const prompt = lastCall[1].contents;

    expect(prompt).toContain('动态指标选择');
    expect(prompt).toContain('多源数据交叉验证 (MANDATORY)');
    expect(prompt).toContain('对比至少两个不同来源的数据');
    expect(prompt).toContain('拒绝死板的固定模板');
    expect(prompt).toContain('深度逻辑溯源');
  });
});
