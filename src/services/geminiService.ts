import { GoogleGenAI } from "@google/genai";
import { useConfigStore } from "../stores/useConfigStore";
import { requestScheduler } from "./requestScheduler";

export const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

// Fallback chain: when a model hits quota, try the next one
export const MODEL_FALLBACK_CHAIN: string[] = [
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
];

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getApiKey(config?: { apiKey?: string }): string {
  // Priority: 1. Explicit config → 2. Store (user-set) → 3. Env var
  if (config?.apiKey) return config.apiKey;
  const storeApiKey = useConfigStore.getState().config?.apiKey;
  if (storeApiKey) return storeApiKey;
  
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 Gemini API Key。请在设置中填写，或在 .env 文件中设置 GEMINI_API_KEY。');
  }
  return apiKey;
}

export function createAI(config?: { apiKey?: string }) {
  const apiKey = getApiKey(config);
  return new GoogleGenAI({ apiKey });
}

export async function generateAndParseJsonWithRetry<T>(
  ai: any,
  params: any,
  options?: {
    transportRetries?: number;
    baseDelayMs?: number;
    parseRetries?: number;
    parseDelayMs?: number;
    responseSchema?: any;
    responseMimeType?: string;
    tools?: any[];
    role?: string;
  },
  priority: number = 0
): Promise<T> {
  const transportRetries = options?.transportRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 2000;
  const parseRetries = options?.parseRetries ?? 2;
  const parseDelayMs = options?.parseDelayMs ?? 1200;

  // Build fallback model list: start with the requested model, then add alternatives
  const requestedModel = params.model || GEMINI_MODEL;
  const modelsToTry = [requestedModel, ...MODEL_FALLBACK_CHAIN.filter(m => m !== requestedModel)];

  let lastError: unknown;

  for (const model of modelsToTry) {
    let lastParseError: unknown;

    for (let attempt = 1; attempt <= parseRetries; attempt++) {
      let responseText: string;
      try {
        responseText = await withRetry(async () => {
          const tools = options?.tools || params.config?.tools || params.tools;
          const hasTools = !!tools;

          // When tools (e.g. googleSearch) are present, some models reject
          // responseMimeType: "application/json" — so omit it and rely on
          // parseJsonResponse to extract JSON from freeform text.
          const responseMimeType = hasTools ? undefined : (options?.responseMimeType || params.config?.responseMimeType || (options?.responseSchema ? 'application/json' : undefined));
          const responseSchema = hasTools ? undefined : (options?.responseSchema || params.config?.responseSchema);

          // Build clean config for the SDK (params.config is what the SDK reads)
          const mergedConfig = {
            ...(params.config || {}),
            responseMimeType,
            responseSchema,
            tools,
          };

          const mergedParams = {
            ...params,
            model,
            config: mergedConfig,
          };
          // Remove stale top-level tools/generationConfig to avoid confusion
          delete mergedParams.tools;
          delete mergedParams.generationConfig;

          const result = await generateContentWithUsage(ai, mergedParams, priority);
          return result.text;
        }, transportRetries, baseDelayMs);
      } catch (transportErr) {
        // On quota error, try the next fallback model
        if (transportErr instanceof QuotaError) {
          console.warn(`[ModelFallback] ${model} quota exhausted, trying next model...`);
          lastError = transportErr;
          break; // break parse retry loop, continue to next model
        }
        throw transportErr;
      }

      try {
        return parseJsonResponse<T>(responseText);
      } catch (error) {
        lastParseError = error;
        if (attempt >= parseRetries) break;

        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Gemini JSON parse failed, retrying generation (${attempt}/${parseRetries}): ${msg}`);
        await delay(parseDelayMs * attempt);
      }
    }

    // If we got here from a parse error (not quota), throw it
    if (lastParseError && !(lastError instanceof QuotaError)) {
      throw new Error(
        lastParseError instanceof Error
          ? lastParseError.message
          : 'Failed to parse Gemini JSON response after retries.'
      );
    }
  }

  // All models exhausted
  throw new Error('API 配额已耗尽 (Free tier limits hit)。所有备选模型均不可用，请等待几分钟后重试。');
}

export async function remoteLog(type: string, data: any) {
  try {
    const isDebug = useConfigStore.getState().debugMode;
    if (!isDebug) return;

    await fetch('/api/diagnostics/logs/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
  } catch (e) {
    console.error('Failed to send remote log:', e);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 3000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));

      // Distinguish quota errors (non-retryable) from transient errors (retryable)
      const isQuota = errorStr.includes('429') || 
                      errorStr.includes('RESOURCE_EXHAUSTED') || 
                      errorStr.toLowerCase().includes('quota') ||
                      error?.status === 429;
      
      const isTransient = errorStr.includes('503') ||
                          errorStr.includes('500') ||
                          errorStr.toLowerCase().includes('unavailable') ||
                          error?.status === 503 ||
                          error?.status === 500;

      // Quota errors: fail fast — retrying wastes more quota
      if (isQuota) {
        if (useConfigStore.getState().debugMode) {
          remoteLog('quota_exhausted_failure', { error: errorStr, attempt });
        }
        useConfigStore.getState().setServiceStatus('quota_exhausted');
        const tier = useConfigStore.getState().config?.tier || 'free';
        const cooldownDuration = tier === 'paid' ? 3000 : 8000;
        useConfigStore.getState().setCooldownUntil(Date.now() + cooldownDuration);
        throw new QuotaError(errorStr);
      }

      // Transient errors: retry with exponential backoff
      if (isTransient && attempt < maxRetries) {
        const waitTime = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`Retryable error hit (${error?.status || 'AI Error'}). Retrying in ${Math.round(waitTime)}ms... (Attempt ${attempt}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      
      if (attempt >= maxRetries) {
        useConfigStore.getState().setServiceStatus('error');
        if (isTransient) {
          throw new Error('AI 模型当前负载过高，请稍后重试。建议使用「标准」模式减少 API 调用次数。');
        }
        throw error;
      }
      // Non-retryable, non-quota error — throw immediately
      throw error;
    }
  }
  throw lastError;
}

// Custom error class to distinguish quota errors for fallback logic
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
  }
}

export function extractJsonBlock(raw: string): string {
  let cleaned = raw.trim();
  
  // 1. Try to find triple backtick blocks
  const tripleBacktickMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (tripleBacktickMatch?.[1]) {
    cleaned = tripleBacktickMatch[1].trim();
  } else {
    // Also try single backticks if the entire string is wrapped in them
    const singleBacktickMatch = cleaned.match(/^`\s*([\s\S]*?)\s*`$/);
    if (singleBacktickMatch?.[1]) {
      cleaned = singleBacktickMatch[1].trim();
    }
  }

  // 2. Find the start of the JSON object or array
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  
  let start = -1;
  let opener = '';
  let closer = '';
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    opener = '{';
    closer = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    opener = '[';
    closer = ']';
  }
  
  if (start === -1) {
    throw new Error("Gemini returned a non-JSON response (No opener found).");
  }

  // 3. Robust balanced brace counting to find the actual end
  let balance = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === opener) {
        balance++;
      } else if (char === closer) {
        balance--;
        if (balance === 0) {
          // Found the matching closing brace!
          return cleaned.slice(start, i + 1);
        }
      }
    }
  }
  
  // Fallback to simple slice if balancing fails (e.g. truncated)
  const lastCloser = cleaned.lastIndexOf(closer);
  if (lastCloser > start) {
    return cleaned.slice(start, lastCloser + 1);
  }
  
  throw new Error("Gemini returned a non-JSON response (Mismatched braces).");
}

function sanitizeJsonControlCharacters(jsonText: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];
    const code = char.charCodeAt(0);

    if (escape) {
      result += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escape = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString && code < 0x20) {
      switch (char) {
        case '\n':
          result += '\\n';
          break;
        case '\r':
          result += '\\r';
          break;
        case '\t':
          result += '\\t';
          break;
        case '\b':
          result += '\\b';
          break;
        case '\f':
          result += '\\f';
          break;
        default:
          result += `\\u${code.toString(16).padStart(4, '0')}`;
          break;
      }
      continue;
    }

    result += char;
  }

  return result.replace(/^\uFEFF/, '');
}

export function parseJsonResponse<T>(raw: string): T {
  try {
    const extracted = extractJsonBlock(raw);
    let parsed: any;

    try {
      parsed = JSON.parse(extracted);
    } catch {
      parsed = JSON.parse(sanitizeJsonControlCharacters(extracted));
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.analysis) return parsed.analysis as T;
      if (parsed.data) return parsed.data as T;
      if (parsed.stockInfo && parsed.stockInfo.symbol) return parsed as T;
      const keys = Object.keys(parsed);
      if (keys.length === 1 && parsed[keys[0]] && typeof parsed[keys[0]] === 'object' && parsed[keys[0]].stockInfo) {
        return parsed[keys[0]] as T;
      }
    }
    return parsed as T;
  } catch (error) {
    console.error("Failed to parse Gemini JSON response. Raw response:", raw);
    throw new Error(
      error instanceof Error
        ? `Failed to parse Gemini JSON response: ${error.message}`
        : "Failed to parse Gemini JSON response."
    );
  }
}


export async function generateContentWithUsage(ai: any, params: any, priority: number = 0) {
  const isDebug = useConfigStore.getState().debugMode;
  if (isDebug) {
    await remoteLog('ai_request_params', params);
  }

  // Clear previous error status on new request
  if (useConfigStore.getState().serviceStatus !== 'available') {
    useConfigStore.getState().setServiceStatus('available');
  }

  const result = await requestScheduler.schedule(async () => {
    return await ai.models.generateContent(params);
  }, priority);
  
  if (isDebug) {
    await remoteLog('ai_response_raw', {
      text: result.text,
      usage: result.usageMetadata,
      candidates: result.candidates?.map((c: any) => ({
        index: c.index,
        finishReason: c.finishReason,
        safetyRatings: c.safetyRatings
      }))
    });
  }

  if (result.usageMetadata) {
    useConfigStore.getState().addTokenUsage({
      promptTokens: result.usageMetadata.promptTokenCount || 0,
      candidatesTokens: result.usageMetadata.candidatesTokenCount || 0,
      totalTokens: result.usageMetadata.totalTokenCount || 0,
    });
  }
  return result;
}

export type ModelStatus = 'available' | 'quota_exhausted' | 'unavailable';
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  status: ModelStatus;
  statusMessage?: string;
}

export async function fetchAvailableModelsList(config?: any): Promise<ModelInfo[]> {
  const ai = createAI(config);
  
  const modelsToCheck = [
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Unlimited)', description: 'Paid 层级无限制 RPD，4000 RPM 的顶级高频模型。' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (Ultra Fast)', description: 'Optimized for speed and low-latency tasks.' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast & Balanced)', description: 'Best for general analysis and quick summaries.' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Advanced Reasoning)', description: 'Best for complex financial logic and deep analysis.' }
  ];

  const results: ModelInfo[] = [];

  for (const m of modelsToCheck) {
    try {
      await requestScheduler.schedule(async () => {
        return await ai.models.generateContent({
          model: m.id,
          contents: "ping",
        });
      });
      results.push({ ...m, status: 'available' });
    } catch (e: any) {
      const msg = e?.message || String(e);
      const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('quota');
      if (isQuota) {
        results.push({ ...m, status: 'quota_exhausted', statusMessage: '配额已耗尽，请稍后重试' });
      } else {
        console.warn(`Model ${m.id} skipped:`, msg);
        results.push({ ...m, status: 'unavailable', statusMessage: msg });
      }
    }
  }

  if (results.every(m => m.status !== 'available')) {
    throw new Error("无可用模型 — 所有模型配额已耗尽或不可用，请稍后重试或检查计费设置。");
  }

  return results;
}
