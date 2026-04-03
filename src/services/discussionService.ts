import { createAI, withRetry, parseJsonResponse, generateContentWithUsage, GEMINI_MODEL, delay } from "./geminiService";
import { StockAnalysis, AgentMessage, AgentDiscussion, GeminiConfig, AnalysisLevel, AgentRole, ExpertOutput } from "../types";
import { getCommoditiesData } from "./marketService";
import { getPreviousStockAnalysis } from "./adminService";
import { performBacktest } from "./backtestService";
import { AgentDiscussionSchema, validateResponse } from "./schemas";
import { getDiscussionPrompt } from "./prompts";
import { buildTopology } from "./discussion/orchestrator";
import { getExpertPrompt, getExpertResponseSchema } from "./discussion/expertPrompts";
import { aggregateResults } from "./discussion/resultAggregator";
import { normalizeCoreVariablesByPriority } from "./coreVariablePriority";

// Iteration count per analysis level (how many times the middle cycle repeats)
const ITERATION_COUNT: Record<AnalysisLevel, number> = {
  quick: 0,
  standard: 1,
  deep: 2,
};

export interface MultiRoundProgress {
  currentRound: number;
  totalRounds: number;
  currentExpert: string;
  messages: AgentMessage[];
}

function hasQuantData(text: string): boolean {
  return /\d/.test(text);
}

function hasSourceHints(text: string): boolean {
  return /(API|Source|来源|Wind|东方财富|同花顺|交易所|Reuters|Bloomberg|Google Search|路透|彭博)/i.test(text);
}

function isLowQualityExpertContent(role: AgentRole, content: string): boolean {
  const t = (content || '').trim();
  if (t.length < 8) return true;

  // For SA/CS/DR, enforce stronger data density + source attribution
  if (role === 'Sentiment Analyst' || role === 'Contrarian Strategist' || role === 'Deep Research Specialist') {
    if (!hasQuantData(t) && !hasSourceHints(t)) return true;
  }

  return false;
}

export async function startMultiRoundDiscussion(
  analysis: StockAnalysis,
  level: AnalysisLevel,
  config?: GeminiConfig,
  onProgress?: (progress: MultiRoundProgress) => void,
  abortSignal?: AbortSignal,
): Promise<AgentDiscussion> {
  const ai = createAI(config);
  const commoditiesData = await getCommoditiesData();
  const previousAnalysis = await getPreviousStockAnalysis(analysis.stockInfo.symbol);
  const backtest = performBacktest(analysis, previousAnalysis);

  const iterations = ITERATION_COUNT[level];

  // Build iterative topology:
  // DR → [TA+FA → SA+RM+CS → Reviewer] × iterations → CS
  const topology = buildTopology({
    level,
    assetType: 'stock',
    maxConcurrency: 3,
  });

  // Expand middle rounds for iterations > 1
  const expandedTopology = buildIterativeTopology(topology, iterations);
  const totalRounds = expandedTopology.length;

  const allMessages: AgentMessage[] = [];
  const expertResults = new Map<AgentRole, ExpertOutput>();
  let roundNum = 0;

  for (const round of expandedTopology) {
    if (abortSignal?.aborted) break;
    roundNum++;

    // Helper to call a single expert
    const callExpert = async (role: AgentRole): Promise<ExpertOutput | null> => {
      if (abortSignal?.aborted) return null;

      onProgress?.({
        currentRound: roundNum,
        totalRounds,
        currentExpert: role,
        messages: [...allMessages],
      });

      const prompt = getExpertPrompt(role, analysis, allMessages, commoditiesData, backtest);

      const invokeExpert = async (inputPrompt: string) => {
        const responseText = await withRetry(async () => {
          const result = await generateContentWithUsage(ai, {
            model: config?.model || GEMINI_MODEL,
            contents: inputPrompt,
            config: {
              responseMimeType: "application/json",
              tools: [{ googleSearch: {} }],
            },
          });
          return result.text;
        }, 5, 3000);

        return parseJsonResponse<any>(responseText);
      };
      let parsed = await invokeExpert(prompt);
      let content = String(parsed?.content || '');

      // One-shot corrective retry when content quality is insufficient
      if (!abortSignal?.aborted && isLowQualityExpertContent(role, content)) {
        const correction = `\n\n【上次输出不合格，必须重答】\n` +
          `- 你的输出缺少足够量化数据或来源标注。\n` +
          `- 本次必须包含至少3个具体数字（价格/比例/概率/涨跌幅等）\n` +
          `- 必须显式标注来源优先级（API > Google Search > Other）和数据日期\n` +
          `- 仅返回 JSON，且 content 必须完整详实。`;

        parsed = await invokeExpert(prompt + correction);
        content = String(parsed?.content || '');
      }

      const message: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        role,
        content,
        timestamp: new Date().toISOString(),
        type: 'discussion',
        round: roundNum,
      };

      const output: ExpertOutput = {
        role,
        message,
        structuredData: {
          coreVariables: parsed?.coreVariables,
          quantifiedRisks: parsed?.quantifiedRisks,
          tradingPlan: parsed?.tradingPlan,
          scenarios: parsed?.scenarios,
        },
      };

      return output;
    };

    let results: (ExpertOutput | null)[];
    // Always run experts sequentially to avoid API rate limits (503)
    results = [];
    for (let i = 0; i < round.experts.length; i++) {
      if (abortSignal?.aborted) break;
      // Add inter-call delay to space out requests (skip before first call)
      if (i > 0) await delay(400);
      results.push(await callExpert(round.experts[i]));
    }

    for (const output of results) {
      if (output) {
        allMessages.push(output.message);
        expertResults.set(output.role, output);
      }
    }
  }

  const multiRoundResult = aggregateResults(expertResults, backtest, allMessages);

  // Final synthesis: use the standard discussion prompt with multi-round history
  // to generate complete dashboard data (expectedValueOutcome, dataVerification, etc.)
  if (!abortSignal?.aborted) {
    onProgress?.({
      currentRound: totalRounds,
      totalRounds,
      currentExpert: '综合研判引擎',
      messages: [...allMessages],
    });

    try {
      const synthesis = await startAgentDiscussion(analysis, config, allMessages, {
        commoditiesData,
        backtest,
      });
      // Merge: multi-round messages + synthesis structured data
      const merged = {
        ...synthesis,
        messages: multiRoundResult.messages, // keep all multi-round messages
        finalConclusion: synthesis.finalConclusion || multiRoundResult.finalConclusion,
        tradingPlan: synthesis.tradingPlan || multiRoundResult.tradingPlan,
        coreVariables: multiRoundResult.coreVariables || synthesis.coreVariables,
        quantifiedRisks: multiRoundResult.quantifiedRisks || synthesis.quantifiedRisks,
        scenarios: synthesis.scenarios || multiRoundResult.scenarios,
        controversialPoints: multiRoundResult.controversialPoints || synthesis.controversialPoints,
        backtestResult: multiRoundResult.backtestResult || synthesis.backtestResult,
      };

      merged.coreVariables = normalizeCoreVariablesByPriority(merged.coreVariables, analysis);
      return merged;
    } catch (err) {
      console.error('Synthesis step failed, using multi-round results:', err);
      return {
        ...multiRoundResult,
        coreVariables: normalizeCoreVariablesByPriority(multiRoundResult.coreVariables, analysis),
      };
    }
  }

  return {
    ...multiRoundResult,
    coreVariables: normalizeCoreVariablesByPriority(multiRoundResult.coreVariables, analysis),
  };
}

/**
 * Expand topology for iterative multi-round discussions.
 * Keeps only last round (CS) fixed,
 * repeats all other rounds (including DR) N times.
 * Pattern: [DR → TA+FA → SA+RM+CS → Reviewer] × N → CS
 */
function buildIterativeTopology(
  topology: { round: number; experts: AgentRole[]; parallel: boolean; dependsOn: number[] }[],
  iterations: number,
) {
  if (iterations <= 1 || topology.length <= 2) return topology;

  const last = topology[topology.length - 1];
  const cycle = topology.slice(0, -1); // Everything except CS

  const expanded: typeof topology = [];
  for (let i = 0; i < iterations; i++) {
    for (const round of cycle) {
      expanded.push({ ...round });
    }
  }
  expanded.push(last);

  // Re-number rounds
  return expanded.map((round, idx) => ({
    ...round,
    round: idx + 1,
  }));
}

export async function startAgentDiscussion(
  analysis: StockAnalysis,
  config?: GeminiConfig,
  history?: AgentMessage[],
  prefetched?: {
    commoditiesData?: any[];
    backtest?: ReturnType<typeof performBacktest> | null;
  }
): Promise<AgentDiscussion> {
  const ai = createAI(config);
  const historyContext = history ? `\n\n**PREVIOUS DISCUSSION HISTORY**:\n${JSON.stringify(history)}` : "";
  const commoditiesData = prefetched?.commoditiesData ?? await getCommoditiesData();
  const resolvedBacktest = prefetched?.backtest ?? await (async () => {
    const previousAnalysis = await getPreviousStockAnalysis(analysis.stockInfo.symbol);
    return performBacktest(analysis, previousAnalysis);
  })();

  const memoryContext = resolvedBacktest ? `
    **MEMORY & FEEDBACK LOOP (LEARNING FROM PAST)**:
    - 我们在 ${resolvedBacktest.previousDate} 对该股票进行过深度分析。
    - 当时价格为 ${resolvedBacktest.previousPrice}，当前价格为 ${resolvedBacktest.currentPrice}（变动: ${resolvedBacktest.returnSincePrev}）。
    - 当时给出的建议是 ${resolvedBacktest.previousRecommendation}，目标价为 ${resolvedBacktest.previousTarget}，止损价为 ${resolvedBacktest.previousStopLoss}。
    - **当前状态**: ${resolvedBacktest.status}（预测得分/准确率: ${resolvedBacktest.accuracy}/100）。
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
  if (resolvedBacktest) {
    parsed.backtestResult = {
      previousDate: resolvedBacktest.previousDate,
      previousRecommendation: resolvedBacktest.previousRecommendation,
      actualReturn: resolvedBacktest.returnSincePrev,
      learningPoint: resolvedBacktest.learningPoint
    };
  }

  // Add unique IDs to messages for stable React keys
  if (parsed.messages) {
    parsed.messages = parsed.messages.map((msg, idx) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  parsed.coreVariables = normalizeCoreVariablesByPriority(parsed.coreVariables, analysis);

  return parsed;
}
