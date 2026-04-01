import { create } from 'zustand';
import { Scenario, SensitivityFactor, ExpectationGap, CalculationResult, Catalyst, AgentDiscussion } from '../types';

interface ScenarioState {
  scenarios: Scenario[];
  valuationMatrix: Scenario[];
  sensitivityFactors: SensitivityFactor[];
  expectationGap: ExpectationGap | null;
  calculations: CalculationResult[];
  stressTestLogic: string;
  catalystList: Catalyst[];
  verificationMetrics: AgentDiscussion['verificationMetrics'];
  capitalFlow: AgentDiscussion['capitalFlow'] | null;
  positionManagement: AgentDiscussion['positionManagement'] | null;
  timeDimension: AgentDiscussion['timeDimension'] | null;
  dataFreshnessStatus: "Fresh" | "Stale" | "Warning" | null;
  backtestResult: any;

  setScenarios: (scenarios: Scenario[]) => void;
  setValuationMatrix: (matrix: Scenario[]) => void;
  setSensitivityFactors: (factors: SensitivityFactor[]) => void;
  setExpectationGap: (gap: ExpectationGap | null) => void;
  setCalculations: (calculations: CalculationResult[]) => void;
  setStressTestLogic: (logic: string) => void;
  setCatalystList: (list: Catalyst[]) => void;
  setVerificationMetrics: (metrics: AgentDiscussion['verificationMetrics']) => void;
  setCapitalFlow: (flow: AgentDiscussion['capitalFlow'] | null) => void;
  setPositionManagement: (management: AgentDiscussion['positionManagement'] | null) => void;
  setTimeDimension: (dimension: AgentDiscussion['timeDimension'] | null) => void;
  setDataFreshnessStatus: (status: "Fresh" | "Stale" | "Warning" | null) => void;
  setBacktestResult: (result: any) => void;
  setScenarioResults: (discussion: AgentDiscussion) => void;
  resetScenario: () => void;
}

const initialState = {
  scenarios: [] as Scenario[],
  valuationMatrix: [] as Scenario[],
  sensitivityFactors: [] as SensitivityFactor[],
  expectationGap: null as ExpectationGap | null,
  calculations: [] as CalculationResult[],
  stressTestLogic: '',
  catalystList: [] as Catalyst[],
  verificationMetrics: [] as AgentDiscussion['verificationMetrics'],
  capitalFlow: null as AgentDiscussion['capitalFlow'] | null,
  positionManagement: null as AgentDiscussion['positionManagement'] | null,
  timeDimension: null as AgentDiscussion['timeDimension'] | null,
  dataFreshnessStatus: null as "Fresh" | "Stale" | "Warning" | null,
  backtestResult: null as any,
};

export const useScenarioStore = create<ScenarioState>((set) => ({
  ...initialState,

  setScenarios: (scenarios) => set({ scenarios }),
  setValuationMatrix: (valuationMatrix) => set({ valuationMatrix }),
  setSensitivityFactors: (sensitivityFactors) => set({ sensitivityFactors }),
  setExpectationGap: (expectationGap) => set({ expectationGap }),
  setCalculations: (calculations) => set({ calculations }),
  setStressTestLogic: (stressTestLogic) => set({ stressTestLogic }),
  setCatalystList: (catalystList) => set({ catalystList }),
  setVerificationMetrics: (verificationMetrics) => set({ verificationMetrics }),
  setCapitalFlow: (capitalFlow) => set({ capitalFlow }),
  setPositionManagement: (positionManagement) => set({ positionManagement }),
  setTimeDimension: (timeDimension) => set({ timeDimension }),
  setDataFreshnessStatus: (dataFreshnessStatus) => set({ dataFreshnessStatus }),
  setBacktestResult: (backtestResult) => set({ backtestResult }),
  setScenarioResults: (discussion) => set({
    scenarios: discussion.scenarios || [],
    valuationMatrix: discussion.valuationMatrix || [],
    sensitivityFactors: discussion.sensitivityFactors || [],
    expectationGap: discussion.expectationGap || null,
    calculations: discussion.calculations || [],
    stressTestLogic: discussion.stressTestLogic || '',
    catalystList: discussion.catalystList || [],
    verificationMetrics: discussion.verificationMetrics || [],
    capitalFlow: discussion.capitalFlow || null,
    positionManagement: discussion.positionManagement || null,
    timeDimension: discussion.timeDimension || null,
    dataFreshnessStatus: discussion.dataFreshnessStatus || null,
    backtestResult: discussion.backtestResult || null,
  }),
  resetScenario: () => set(initialState),
}));
