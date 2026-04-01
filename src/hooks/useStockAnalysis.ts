import { useCallback } from 'react';
import { useConfigStore } from '../stores/useConfigStore';
import { useUIStore } from '../stores/useUIStore';
import { useMarketStore } from '../stores/useMarketStore';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useDiscussionStore } from '../stores/useDiscussionStore';
import { useScenarioStore } from '../stores/useScenarioStore';
import { analyzeStock, sendChatMessage, startAgentDiscussion, saveAnalysisToHistory, getHistoryContext } from '../services/aiService';
import { StockAnalysis, AgentMessage, Market } from '../types';

export function useStockAnalysis() {
  const geminiConfig = useConfigStore(s => s.config);
  const { setLoading, setAnalysisError, setIsDiscussing, setShowDiscussion, resetErrors } = useUIStore();
  const { setAnalysis, setSymbol, setMarket, symbol, market, analysis, resetAnalysis } = useAnalysisStore();
  const { setDiscussionResults: setDiscussionStoreResults, resetDiscussion } = useDiscussionStore();
  const { setScenarioResults, resetScenario } = useScenarioStore();
  const { setHistoryItems, setOptimizationLogs } = useMarketStore();

  const fetchAdminData = useCallback(async () => {
    try {
      const [history, logsRes] = await Promise.all([
        getHistoryContext(),
        fetch('/api/logs/optimization')
      ]);
      setHistoryItems(history);
      
      if (!logsRes.ok) {
        console.error(`Failed to fetch optimization logs: ${logsRes.status} ${logsRes.statusText}`);
      } else {
        try {
          const logs = await logsRes.json();
          setOptimizationLogs(logs);
        } catch (e) {
          console.error('Failed to parse optimization logs JSON:', e);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
  }, [setHistoryItems, setOptimizationLogs]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !symbol.trim()) return;

    setLoading(true);
    resetAnalysis();
    resetDiscussion();
    resetScenario();
    resetErrors();

    try {
      const result = await analyzeStock(symbol, market, geminiConfig);
      setAnalysis(result);

      setShowDiscussion(false);
      setIsDiscussing(true);

      try {
        const discussion = await startAgentDiscussion(result, geminiConfig);
        setDiscussionStoreResults(discussion);
        setScenarioResults(discussion);

        const finalAnalysis: StockAnalysis = {
          ...result,
          ...discussion,
          discussion: discussion.messages,
          tradingPlan: discussion.tradingPlan || result.tradingPlan,
          verificationMetrics: discussion.verificationMetrics || result.verificationMetrics,
          capitalFlow: discussion.capitalFlow || result.capitalFlow
        };
        setAnalysis(finalAnalysis);

        await saveAnalysisToHistory('stock', finalAnalysis);
        void fetchAdminData();
      } catch (err) {
        console.error('Agent discussion failed:', err);
      } finally {
        setIsDiscussing(false);
      }
    } catch (err) {
      console.error(err);
      setAnalysisError(err instanceof Error ? err.message : '分析股票失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [symbol, market, geminiConfig, setLoading, resetAnalysis, resetDiscussion, resetScenario, resetErrors, setAnalysis, setShowDiscussion, setIsDiscussing, setDiscussionStoreResults, setScenarioResults, setAnalysisError, fetchAdminData]);

  const resetToHome = useCallback(() => {
    resetAnalysis();
    resetDiscussion();
    resetScenario();
  }, [resetAnalysis, resetDiscussion, resetScenario]);

  return { handleSearch, resetToHome, fetchAdminData };
}
