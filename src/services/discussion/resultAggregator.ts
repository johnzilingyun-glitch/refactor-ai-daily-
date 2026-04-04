import type { AgentRole, AgentMessage, AgentDiscussion, ExpertOutput } from '../../types';
import type { BacktestResult } from '../backtestService';

export function aggregateResults(
  roundResults: Map<AgentRole, ExpertOutput>,
  backtest: BacktestResult | null,
  allMessages?: AgentMessage[],
): AgentDiscussion {
  // Use allMessages if provided (multi-round), otherwise extract from Map (single-round)
  const messages = allMessages
    ? allMessages.map((msg, idx) => ({
        ...msg,
        id: msg.id || `msg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 11)}`,
      }))
    : Array.from(roundResults.values()).map((output, idx) => ({
        ...output.message,
        id: output.message.id || `msg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 11)}`,
      }));

  // Extract structured data from specific experts
  const deepResearch = roundResults.get('Deep Research Specialist');
  const riskManager = roundResults.get('Risk Manager');
  const chiefStrategist = roundResults.get('Chief Strategist');
  const contrarian = roundResults.get('Contrarian Strategist');

  const discussion: AgentDiscussion = {
    messages,
    finalConclusion: chiefStrategist?.message.content ?? '',
    coreVariables: deepResearch?.structuredData?.coreVariables,
    quantifiedRisks: riskManager?.structuredData?.quantifiedRisks,
    tradingPlan: chiefStrategist?.structuredData?.tradingPlan,
    scenarios: chiefStrategist?.structuredData?.scenarios,
    expectedValueOutcome: chiefStrategist?.structuredData?.expectedValueOutcome,
    sensitivityMatrix: chiefStrategist?.structuredData?.sensitivityMatrix,
    controversialPoints: contrarian?.structuredData
      ? (contrarian.message.content ? [contrarian.message.content.slice(0, 200)] : [])
      : undefined,
  };

  if (backtest) {
    discussion.backtestResult = {
      previousDate: backtest.previousDate,
      previousRecommendation: backtest.previousRecommendation,
      actualReturn: backtest.returnSincePrev,
      learningPoint: backtest.learningPoint,
    };
  }

  return discussion;
}
