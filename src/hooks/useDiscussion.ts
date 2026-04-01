import { useCallback } from 'react';
import { useConfigStore } from '../stores/useConfigStore';
import { useUIStore, selectIsReviewing, selectIsDiscussing } from '../stores/useUIStore';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useDiscussionStore } from '../stores/useDiscussionStore';
import { useScenarioStore } from '../stores/useScenarioStore';
import { startAgentDiscussion, saveAnalysisToHistory } from '../services/aiService';
import { StockAnalysis, AgentMessage } from '../types';

export function useDiscussion(fetchAdminData: () => Promise<void>) {
  const geminiConfig = useConfigStore(s => s.config);
  const { setIsReviewing } = useUIStore();
  const isReviewing = useUIStore(selectIsReviewing);
  const isDiscussing = useUIStore(selectIsDiscussing);
  const { analysis, setAnalysis } = useAnalysisStore();
  const {
    discussionMessages, setDiscussionMessages,
    setControversialPoints, setTradingPlanHistory,
  } = useDiscussionStore();
  const {
    setScenarios, setSensitivityFactors,
    setVerificationMetrics, setCapitalFlow, setPositionManagement,
    setTimeDimension,
  } = useScenarioStore();

  const handleDiscussionQuestion = useCallback(async (question: string) => {
    if (!analysis || isReviewing || isDiscussing) return;

    setIsReviewing(true);
    const userMsg: AgentMessage = {
      id: `user-q-${Date.now()}`,
      role: "Moderator",
      content: question,
      timestamp: new Date().toISOString(),
      type: "user_question"
    };

    const updatedMessages = [...discussionMessages, userMsg];
    setDiscussionMessages(updatedMessages);

    try {
      const discussion = await startAgentDiscussion(analysis, geminiConfig, updatedMessages);

      setDiscussionMessages(discussion.messages);
      if (discussion.scenarios) setScenarios(discussion.scenarios);
      if (discussion.sensitivityFactors) setSensitivityFactors(discussion.sensitivityFactors);
      if (discussion.controversialPoints) setControversialPoints(discussion.controversialPoints);
      if (discussion.verificationMetrics) setVerificationMetrics(discussion.verificationMetrics);
      if (discussion.capitalFlow) setCapitalFlow(discussion.capitalFlow);
      if (discussion.positionManagement) setPositionManagement(discussion.positionManagement);
      if (discussion.timeDimension) setTimeDimension(discussion.timeDimension);
      if (discussion.tradingPlanHistory) setTradingPlanHistory(discussion.tradingPlanHistory);

      const finalAnalysis: StockAnalysis = {
        ...analysis,
        ...discussion,
        discussion: discussion.messages,
        finalConclusion: discussion.finalConclusion || analysis.finalConclusion,
        tradingPlan: discussion.tradingPlan || analysis.tradingPlan
      };
      setAnalysis(finalAnalysis);

      await saveAnalysisToHistory('stock', finalAnalysis);
      void fetchAdminData();
    } catch (err) {
      console.error('Reviewer failed:', err);
      setDiscussionMessages([...updatedMessages, {
        id: `error-${Date.now()}`,
        role: "Professional Reviewer",
        content: `⚠️ 评审专家暂时无法回答：${err instanceof Error ? err.message : '未知错误'}`,
        timestamp: new Date().toISOString(),
        type: "review"
      }]);
    } finally {
      setIsReviewing(false);
    }
  }, [analysis, isReviewing, isDiscussing, geminiConfig, discussionMessages, setDiscussionMessages, setIsReviewing, setScenarios, setSensitivityFactors, setControversialPoints, setVerificationMetrics, setCapitalFlow, setPositionManagement, setTimeDimension, setTradingPlanHistory, setAnalysis, fetchAdminData]);

  return { handleDiscussionQuestion };
}
