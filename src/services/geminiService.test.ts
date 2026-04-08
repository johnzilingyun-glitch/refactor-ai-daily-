import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContentWithUsage, fetchAvailableModelsList, generateAndParseJsonWithRetry, QuotaError } from './geminiService';
import { useConfigStore } from '../stores/useConfigStore';
import { GoogleGenAI } from '@google/genai';
import { requestScheduler } from './requestScheduler';

// Mock requestScheduler to execute tasks immediately without delays
vi.mock('./requestScheduler', () => ({
  requestScheduler: {
    schedule: vi.fn().mockImplementation(async (task: () => Promise<any>) => task()),
    reset: vi.fn(),
  },
}));

// Mock zustand store
vi.mock('../stores/useConfigStore', () => ({
  useConfigStore: {
    getState: vi.fn(),
  },
}));

// Mock GoogleGenAI
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(function() {
      const generateContent = vi.fn().mockImplementation(async ({ model }) => {
        if (model === 'gemini-3-flash-preview') {
          return { text: 'ok' }; // success
        }
        if (model === 'gemini-3.1-pro-preview') {
          throw new Error('429 RESOURCE_EXHAUSTED Quota exceeded'); // fake quota error
        }
        throw new Error('404 Not Found'); // other models fail
      });
      return {
        models: { generateContent }
      };
    })
  };
});

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useConfigStore.getState as any).mockReturnValue({
      serviceStatus: 'available',
      setServiceStatus: vi.fn(),
      cooldownUntil: 0,
      setCooldownUntil: vi.fn(),
      debugMode: false,
    });
  });

  describe('generateContentWithUsage', () => {
    it('should add token usage to the store when available', async () => {
      const mockAddTokenUsage = vi.fn();
      (useConfigStore.getState as any).mockReturnValue({
        addTokenUsage: mockAddTokenUsage,
        serviceStatus: 'available',
        setServiceStatus: vi.fn(),
        cooldownUntil: 0,
        setCooldownUntil: vi.fn(),
        debugMode: false,
      });

      const mockAi = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: 'response',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          })
        }
      };

      const result = await generateContentWithUsage(mockAi, { model: 'test', contents: 'hello' });
      
      expect(result.text).toBe('response');
      expect(mockAddTokenUsage).toHaveBeenCalledWith({
        promptTokens: 10,
        candidatesTokens: 20,
        totalTokens: 30
      });
    });

    it('should not break if usageMetadata is missing', async () => {
      const mockAddTokenUsage = vi.fn();
      (useConfigStore.getState as any).mockReturnValue({
        addTokenUsage: mockAddTokenUsage,
        serviceStatus: 'available',
        setServiceStatus: vi.fn(),
        cooldownUntil: 0,
        setCooldownUntil: vi.fn(),
        debugMode: false,
      });

      const mockAi = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: 'response no metadata'
          })
        }
      };

      const result = await generateContentWithUsage(mockAi, { model: 'test', contents: 'hello' });
      
      expect(result.text).toBe('response no metadata');
      expect(mockAddTokenUsage).not.toHaveBeenCalled();
    });
  });

  describe('fetchAvailableModelsList', () => {
    it('should return only models that respond successfully to ping', async () => {
      const availableModels = await fetchAvailableModelsList({ apiKey: 'test_key' });
      
      // All models are returned with status flags
      expect(availableModels.length).toBeGreaterThan(0);
      // Only 'gemini-3-flash-preview' succeeds based on mock
      const available = availableModels.filter(m => m.status === 'available');
      expect(available.length).toBe(1);
      expect(available[0].id).toBe('gemini-3-flash-preview');
    });

    it('should throw an error if no models are available', async () => {
      vi.mocked(GoogleGenAI).mockImplementationOnce(function() {
        return {
          models: {
            generateContent: vi.fn().mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'))
          }
        };
      } as any);

      await expect(fetchAvailableModelsList({ apiKey: 'test_key' })).rejects.toThrow('无可用模型');
    });
  });

  describe('generateAndParseJsonWithRetry', () => {
    it('should strip responseMimeType when tools are present in params.config', async () => {
      const capturedParams: any[] = [];
      const mockAi = {
        models: {
          generateContent: vi.fn().mockImplementation(async (p: any) => {
            capturedParams.push(JSON.parse(JSON.stringify(p)));
            return { text: '{"result": "ok"}' };
          })
        }
      };

      await generateAndParseJsonWithRetry(mockAi, {
        model: 'gemini-3.1-flash-lite-preview',
        contents: 'test prompt',
        config: {
          responseMimeType: 'application/json',
          tools: [{ googleSearch: {} }]
        }
      });

      expect(capturedParams.length).toBe(1);
      const sentConfig = capturedParams[0].config;
      // responseMimeType must be stripped when tools are present
      expect(sentConfig.responseMimeType).toBeUndefined();
      expect(sentConfig.responseSchema).toBeUndefined();
      // tools must still be present
      expect(sentConfig.tools).toEqual([{ googleSearch: {} }]);
    });

    it('should keep responseMimeType when no tools are present', async () => {
      const capturedParams: any[] = [];
      const mockAi = {
        models: {
          generateContent: vi.fn().mockImplementation(async (p: any) => {
            capturedParams.push(JSON.parse(JSON.stringify(p)));
            return { text: '{"result": "ok"}' };
          })
        }
      };

      await generateAndParseJsonWithRetry(mockAi, {
        model: 'gemini-3.1-flash-lite-preview',
        contents: 'test prompt',
        config: {
          responseMimeType: 'application/json',
        }
      });

      expect(capturedParams.length).toBe(1);
      const sentConfig = capturedParams[0].config;
      expect(sentConfig.responseMimeType).toBe('application/json');
    });

    it('should strip responseMimeType when tools come via options', async () => {
      const capturedParams: any[] = [];
      const mockAi = {
        models: {
          generateContent: vi.fn().mockImplementation(async (p: any) => {
            capturedParams.push(JSON.parse(JSON.stringify(p)));
            return { text: '{"result": "ok"}' };
          })
        }
      };

      await generateAndParseJsonWithRetry(mockAi, {
        model: 'gemini-3.1-flash-lite-preview',
        contents: 'test prompt',
      }, {
        responseMimeType: 'application/json',
        tools: [{ googleSearch: {} }],
      });

      expect(capturedParams.length).toBe(1);
      const sentConfig = capturedParams[0].config;
      expect(sentConfig.responseMimeType).toBeUndefined();
      expect(sentConfig.tools).toEqual([{ googleSearch: {} }]);
    });

    it('should fallback to next model on QuotaError', async () => {
      const modelsUsed: string[] = [];
      const mockAi = {
        models: {
          generateContent: vi.fn().mockImplementation(async (p: any) => {
            modelsUsed.push(p.model);
            if (p.model === 'gemini-3.1-flash-lite-preview') {
              throw { message: '429 RESOURCE_EXHAUSTED', status: 429 };
            }
            return { text: '{"result": "fallback_ok"}' };
          })
        }
      };

      (useConfigStore.getState as any).mockReturnValue({
        serviceStatus: 'available',
        setServiceStatus: vi.fn(),
        cooldownUntil: 0,
        setCooldownUntil: vi.fn(),
        debugMode: false,
        config: { tier: 'free' },
      });

      const result = await generateAndParseJsonWithRetry(mockAi, {
        model: 'gemini-3.1-flash-lite-preview',
        contents: 'test',
      });

      expect(result).toEqual({ result: 'fallback_ok' });
      // First model was tried, then fallback
      expect(modelsUsed[0]).toBe('gemini-3.1-flash-lite-preview');
      expect(modelsUsed.length).toBeGreaterThan(1);
    });
  });
});
