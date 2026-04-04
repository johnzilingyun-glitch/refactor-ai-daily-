import { GoogleGenAI } from "@google/genai";
import { createAI, withRetry, generateContentWithUsage, GEMINI_MODEL, generateAndParseJsonWithRetry } from "./geminiService";
import { getMarketOverviewPrompt, getDailyReportPrompt } from "./prompts";
import { MarketOverview, GeminiConfig, Market } from "../types";
import { getHistoryContext, saveAnalysisToHistory } from "./adminService";
import { getBeijingDate } from "./dateUtils";
import { MarketOverviewSchema, validateResponse } from "./schemas";

export async function getMarketOverview(config?: GeminiConfig, market: Market = "A-Share", forceRefresh: boolean = false): Promise<MarketOverview> {
  const now = new Date();
  const today = getBeijingDate(now);
  
  const ai = createAI(config);
  const history = await getHistoryContext();
  const beijingDate = today;

  let indicesData = [];
  try {
    const res = await fetch(`/api/stock/indices?market=${market}`);
    if (res.ok) {
      indicesData = await res.json();
    }
  } catch (e) {
    console.warn('Indices tool failed, falling back to search:', e);
  }

  const commoditiesData = await getCommoditiesData();
  const prompt = getMarketOverviewPrompt(indicesData, commoditiesData, history, beijingDate, now, market);

  const raw = await generateAndParseJsonWithRetry<MarketOverview>(ai, {
    model: config?.model || GEMINI_MODEL,
    contents: prompt,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    }
  });

  const overview = validateResponse(MarketOverviewSchema, raw, 'MarketOverview') as MarketOverview;
  overview.id = `market-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  if (overview.indices && overview.indices.length > 0) {
    await saveAnalysisToHistory('market', overview);
  }

  return overview;
}

export async function getCommoditiesData(): Promise<any[]> {
  try {
    const res = await fetch('/api/stock/commodities');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Commodities fetch failed:', e);
  }
  return [];
}

export async function getDailyReport(marketOverview: MarketOverview, config?: GeminiConfig): Promise<string> {
  const ai = createAI(config);
  const now = new Date();
  const beijingDate = getBeijingDate(now);
  const commoditiesData = await getCommoditiesData();
  const prompt = getDailyReportPrompt(marketOverview, commoditiesData, now, beijingDate);

  const response = await withRetry(async () => {
    const result = await generateContentWithUsage(ai, {
      model: config?.model || GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return result.text;
  });

  return response;
}
