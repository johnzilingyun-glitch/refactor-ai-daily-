import { create } from 'zustand';
import { GeminiConfig } from '../types';

interface ConfigState {
  geminiConfig: GeminiConfig;
  setGeminiConfig: (config: GeminiConfig) => void;
  config: GeminiConfig;
  setConfig: (config: GeminiConfig) => void;
  tokenUsage: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  addTokenUsage: (usage: { promptTokens?: number, candidatesTokens?: number, totalTokens?: number }) => void;
  availableModels: { id: string, name: string, description: string, status?: string, statusMessage?: string }[];
  setAvailableModels: (models: { id: string, name: string, description: string, status?: string, statusMessage?: string }[]) => void;
  feishuWebhookUrl: string;
  setFeishuWebhookUrl: (webhook: string) => void;
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  serviceStatus: 'available' | 'quota_exhausted' | 'error';
  setServiceStatus: (status: 'available' | 'quota_exhausted' | 'error') => void;
  lastErrorStatus: string | null;
  setLastErrorStatus: (status: string | null) => void;
  language: 'en' | 'zh-CN';
  setLanguage: (lang: 'en' | 'zh-CN') => void;
}

export const useConfigStore = create<ConfigState>((set) => {
  const initialConfig = (() => {
    try {
      const saved = localStorage.getItem('gemini_config');
      return saved ? JSON.parse(saved) : { model: 'gemini-3-flash-preview' };
    } catch (e) {
      console.error('Failed to parse gemini_config from localStorage:', e);
      return { model: 'gemini-3-flash-preview' };
    }
  })();

  return {
    geminiConfig: initialConfig,
    config: initialConfig,
    tokenUsage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
    availableModels: [],
    setAvailableModels: (models) => set({ availableModels: models }),
    addTokenUsage: (usage) => set((state) => ({
      tokenUsage: {
        promptTokens: state.tokenUsage.promptTokens + (usage.promptTokens || 0),
        candidatesTokens: state.tokenUsage.candidatesTokens + (usage.candidatesTokens || 0),
        totalTokens: state.tokenUsage.totalTokens + (usage.totalTokens || 0),
      }
    })),
    setGeminiConfig: (config) => {
      localStorage.setItem('gemini_config', JSON.stringify(config));
      set({ geminiConfig: config, config: config });
    },
    setConfig: (config) => {
      localStorage.setItem('gemini_config', JSON.stringify(config));
      set({ geminiConfig: config, config: config });
    },
    feishuWebhookUrl: localStorage.getItem('feishu_webhook') || '',
    setFeishuWebhookUrl: (webhook: string) => {
      localStorage.setItem('feishu_webhook', webhook);
      set({ feishuWebhookUrl: webhook });
    },
    debugMode: localStorage.getItem('debug_mode') === 'true',
    setDebugMode: (enabled: boolean) => {
      localStorage.setItem('debug_mode', String(enabled));
      set({ debugMode: enabled });
    },
    serviceStatus: 'available',
    setServiceStatus: (status) => set({ serviceStatus: status }),
    lastErrorStatus: null,
    setLastErrorStatus: (status) => set({ lastErrorStatus: status }),
    language: (localStorage.getItem('app_language') as 'en' | 'zh-CN') || 'en',
    setLanguage: (lang: 'en' | 'zh-CN') => {
      localStorage.setItem('app_language', lang);
      set({ language: lang });
    },
  };
});
