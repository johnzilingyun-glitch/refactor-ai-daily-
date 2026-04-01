import { createAI, withRetry, parseJsonResponse, generateContentWithUsage, GEMINI_MODEL } from "./geminiService";
import { StockAnalysis, AgentMessage, AgentDiscussion, GeminiConfig } from "../types";
import { getCommoditiesData } from "./marketService";
import { getPreviousStockAnalysis } from "./adminService";
import { performBacktest } from "./backtestService";
import { AgentDiscussionSchema, validateResponse } from "./schemas";
import { getDiscussionPrompt } from "./prompts";

export async function startAgentDiscussion(
  analysis: StockAnalysis,
  config?: GeminiConfig,
  history?: AgentMessage[]
): Promise<AgentDiscussion> {
  const ai = createAI(config);
  const historyContext = history ? `\n\n**PREVIOUS DISCUSSION HISTORY**:\n${JSON.stringify(history)}` : "";
  const commoditiesData = await getCommoditiesData();
  const previousAnalysis = await getPreviousStockAnalysis(analysis.stockInfo.symbol);
  const backtest = performBacktest(analysis, previousAnalysis);

  const memoryContext = backtest ? `
    **MEMORY & FEEDBACK LOOP (LEARNING FROM PAST)**:
    - 我们在 ${backtest.previousDate} 对该股票进行过深度分析。
    - 当时价格为 ${backtest.previousPrice}，当前价格为 ${backtest.currentPrice}（变动: ${backtest.returnSincePrev}）。
    - 当时给出的建议是 ${backtest.previousRecommendation}，目标价为 ${backtest.previousTarget}，止损价为 ${backtest.previousStopLoss}。
    - **当前状态**: ${backtest.status}（预测得分/准确率: ${backtest.accuracy}/100）。
    - **强制指令**: 深度研究专家和首席策略师必须在讨论中明确引用上述历史业绩情况。如果是"预测被打脸"或"逻辑漂移"，必须解释原因并修正逻辑；如果是"目标达成"，则讨论是否该止盈或提高目标价。
  ` : "";

  const prompt = getDiscussionPrompt(analysis, commoditiesData, memoryContext, historyContext);

  const response = await withRetry(async () => {
    const result = await generateContentWithUsage(ai, {
      model: config?.model || GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });
    return result.text;
  });

  const raw = parseJsonResponse<AgentDiscussion>(response);
  const parsed = validateResponse(AgentDiscussionSchema, raw, 'AgentDiscussion') as AgentDiscussion;

  // Inject backtest results back into the response for UI display
  if (backtest) {
    parsed.backtestResult = {
      previousDate: backtest.previousDate,
      previousRecommendation: backtest.previousRecommendation,
      actualReturn: backtest.returnSincePrev,
      learningPoint: backtest.learningPoint
    };
  }

  // Add unique IDs to messages for stable React keys
  if (parsed.messages) {
    parsed.messages = parsed.messages.map((msg, idx) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  return parsed;
}
