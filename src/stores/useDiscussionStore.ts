import { create } from 'zustand';
import { AgentMessage, TradingPlanVersion, AnalystWeight, AgentDiscussion } from '../types';

interface DiscussionState {
  discussionMessages: AgentMessage[];
  controversialPoints: string[];
  tradingPlanHistory: TradingPlanVersion[];
  analystWeights: AnalystWeight[];

  setDiscussionMessages: (messages: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => void;
  setControversialPoints: (points: string[]) => void;
  setTradingPlanHistory: (history: TradingPlanVersion[] | ((prev: TradingPlanVersion[]) => TradingPlanVersion[])) => void;
  setAnalystWeights: (weights: AnalystWeight[]) => void;
  setDiscussionResults: (discussion: AgentDiscussion) => void;
  resetDiscussion: () => void;
}

const initialState = {
  discussionMessages: [] as AgentMessage[],
  controversialPoints: [] as string[],
  tradingPlanHistory: [] as TradingPlanVersion[],
  analystWeights: [] as AnalystWeight[],
};

export const useDiscussionStore = create<DiscussionState>((set) => ({
  ...initialState,

  setDiscussionMessages: (updater) => set((state) => ({
    discussionMessages: typeof updater === 'function' ? updater(state.discussionMessages) : updater,
  })),
  setControversialPoints: (controversialPoints) => set({ controversialPoints }),
  setTradingPlanHistory: (updater) => set((state) => ({
    tradingPlanHistory: typeof updater === 'function' ? updater(state.tradingPlanHistory) : updater,
  })),
  setAnalystWeights: (analystWeights) => set({ analystWeights }),
  setDiscussionResults: (discussion) => set({
    discussionMessages: discussion.messages,
    controversialPoints: discussion.controversialPoints || [],
    tradingPlanHistory: discussion.tradingPlanHistory || [],
    analystWeights: discussion.analystWeights || [],
  }),
  resetDiscussion: () => set(initialState),
}));
