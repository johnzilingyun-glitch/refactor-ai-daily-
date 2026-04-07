import { GoogleGenAI } from "@google/genai";
import { createAI, withRetry, generateContentWithUsage, GEMINI_MODEL, generateAndParseJsonWithRetry } from "./geminiService";
import { useConfigStore } from "../stores/useConfigStore";
import { getAnalyzeStockPrompt, getChatMessagePrompt, getStockReportPrompt, getDiscussionReportPrompt, getChatReportPrompt } from "./prompts";
import { Market, StockAnalysis, AgentMessage, Scenario, AgentDiscussion, GeminiConfig } from "../types";
import { getHistoryContext, saveAnalysisToHistory } from "./adminService";
import { getBeijingDate } from "./dateUtils";
import { getCommoditiesData } from "./marketService";
import { calculateQualityScore } from "./dataQualityService";
import { StockAnalysisSchema, validateResponse } from "./schemas";

export async function analyzeStock(symbol: string, market: Market, config?: GeminiConfig): Promise<StockAnalysis> {
  const ai = createAI(config);
  const history = await getHistoryContext();
  const now = new Date();
  const beijingDate = getBeijingDate(now);
  const beijingShortDate = beijingDate.split(/[-/]/).slice(1).join('/');

  let realtimeData: any = null;
  const isDebug = useConfigStore.getState().debugMode;
  const res = await fetch(`/api/stock/realtime?symbol=${encodeURIComponent(symbol)}&market=${market}${isDebug ? '&debug=true' : ''}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `无法获取股票信息，请检查代码或拼写。`);
  }
  realtimeData = await res.json();
  const symMatch = (realtimeData.symbol || '').toUpperCase();
  if (market === 'A-Share' && !(symMatch.endsWith('.SS') || symMatch.endsWith('.SZ') || symMatch.endsWith('.BJ'))) {
    throw new Error(`请核实查询代码及范围：无法在 A 股 中找到 "${symbol}"。你可能输入了非A股代码。`);
  }
  if (market === 'HK-Share' && !symMatch.endsWith('.HK')) {
    throw new Error(`请核实查询代码及范围：无法在 港股 中找到 "${symbol}"。你可能输入了非港股代码。`);
  }

  const language = useConfigStore.getState().language;
  const commoditiesData = await getCommoditiesData();
  const prompt = getAnalyzeStockPrompt(symbol, market, realtimeData, commoditiesData, history, beijingDate, beijingShortDate, now, language);

  const raw = await generateAndParseJsonWithRetry<StockAnalysis>(
    ai,
    {
      model: config?.model || GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    },
    {
      transportRetries: 4,
      baseDelayMs: 2500,
      parseRetries: 2,
      parseDelayMs: 1200,
    }
  );
  const analysis = validateResponse(StockAnalysisSchema, raw, 'StockAnalysis') as StockAnalysis;
  
  // Calculate and associate data quality metadata
  analysis.dataQuality = calculateQualityScore(analysis.stockInfo);
  analysis.stockInfo.dataQuality = analysis.dataQuality;

  analysis.id = `stock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return analysis;
}

export async function sendChatMessage(userMessage: string, analysis: StockAnalysis, config?: GeminiConfig): Promise<string> {
  const ai = createAI(config);
  const commoditiesData = await getCommoditiesData();
  const language = useConfigStore.getState().language;
  const prompt = getChatMessagePrompt(userMessage, analysis, commoditiesData, language);

  const response = await withRetry(async () => {
    const result = await generateContentWithUsage(ai, {
      model: config?.model || GEMINI_MODEL,
      contents: prompt
    });
    return result.text;
  });

  return response;
}

export async function getStockReport(analysis: StockAnalysis, config?: GeminiConfig): Promise<string> {
  const ai = createAI(config);
  const language = useConfigStore.getState().language;
  const prompt = getStockReportPrompt(analysis, language);

  const response = await withRetry(async () => {
    const result = await generateContentWithUsage(ai, {
      model: config?.model || GEMINI_MODEL,
      contents: prompt
    });
    return result.text;
  });

  return response;
}

export async function getChatReport(stockName: string, chatHistory: { role: string; content: string }[], config?: GeminiConfig): Promise<string> {
  const ai = createAI(config);
  const language = useConfigStore.getState().language;
  const prompt = getChatReportPrompt(stockName, chatHistory, language);

  const response = await withRetry(async () => {
    const result = await generateContentWithUsage(ai, {
      model: config?.model || GEMINI_MODEL,
      contents: prompt
    });
    return result.text;
  });

  return response;
}

export async function getDiscussionReport(
  analysis: StockAnalysis, 
  discussion: AgentMessage[], 
  scenarios?: Scenario[], 
  backtestResult?: any,
  config?: GeminiConfig
): Promise<string> {
  const ai = createAI(config);
  const language = useConfigStore.getState().language;
  const commoditiesData = await getCommoditiesData();
  const prompt = getDiscussionReportPrompt(analysis, discussion, commoditiesData, scenarios ?? [], backtestResult, language);

  const response = await withRetry(async () => {
    const result = await generateContentWithUsage(ai, {
      model: config?.model || GEMINI_MODEL,
      contents: prompt
    });
    return result.text;
  });

  return response;
}
