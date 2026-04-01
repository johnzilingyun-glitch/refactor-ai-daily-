# 领域模块实现规格书

> 日期：2026-04-01
> 范围：11 个领域模块的可直接编码规格
> 前置依赖：P1-P5 重构完成后实施
> 约定：所有新类型追加至 `src/types.ts`，新 store 独立文件

---

## OPT-1：讨论编排 — 条件拓扑引擎

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/discussion/orchestrator.ts` | ~180 | 拓扑编排引擎 |
| `src/services/discussion/expertPrompts.ts` | ~450 | 8 位专家独立 prompt |
| `src/services/discussion/resultAggregator.ts` | ~100 | 多轮结果聚合为 AgentDiscussion |
| `src/services/discussion/skipRules.ts` | ~60 | 条件跳过逻辑 |
| `src/services/discussionService.ts` | ~60 | 保留入口，调用 orchestrator |

### 核心接口

```typescript
// src/services/discussion/orchestrator.ts

interface DiscussionRound {
  round: number;
  experts: AgentRole[];          // 该轮参与专家
  parallel: boolean;             // 是否并行调用
  dependsOn: number[];           // 依赖的前置轮次
}

interface OrchestratorConfig {
  level: 'quick' | 'standard' | 'deep';
  assetType: 'stock' | 'etf' | 'index' | 'bond';
  skipRoles?: AgentRole[];
  maxConcurrency: number;        // 并行调用数上限（默认 3，防 Gemini 限流）
}

/**
 * 生成执行拓扑：根据 config 决定哪些专家参与、分几轮、是否并行
 */
function buildTopology(config: OrchestratorConfig): DiscussionRound[];

/**
 * 执行编排后的多轮讨论
 * 每轮结束后将前轮输出注入下轮 prompt 的 context
 */
async function executeDiscussion(
  analysis: StockAnalysis,
  geminiConfig: GeminiConfig,
  orchestratorConfig: OrchestratorConfig,
  onRoundComplete?: (round: number, messages: AgentMessage[]) => void  // 实时回调
): Promise<AgentDiscussion>;
```

### 拓扑定义

```typescript
// 深度研究模式的默认拓扑
const DEEP_TOPOLOGY: DiscussionRound[] = [
  { round: 1, experts: ['Deep Research Specialist'], parallel: false, dependsOn: [] },
  { round: 2, experts: ['Technical Analyst', 'Fundamental Analyst', 'Sentiment Analyst'], parallel: true, dependsOn: [1] },
  { round: 3, experts: ['Risk Manager', 'Contrarian Strategist'], parallel: true, dependsOn: [1, 2] },
  { round: 4, experts: ['Professional Reviewer'], parallel: false, dependsOn: [1, 2, 3] },
  { round: 5, experts: ['Chief Strategist'], parallel: false, dependsOn: [1, 2, 3, 4] },
];

// Quick Scan 拓扑
const QUICK_TOPOLOGY: DiscussionRound[] = [
  { round: 1, experts: ['Deep Research Specialist'], parallel: false, dependsOn: [] },
  { round: 2, experts: ['Risk Manager'], parallel: false, dependsOn: [1] },
  { round: 3, experts: ['Chief Strategist'], parallel: false, dependsOn: [1, 2] },
];
```

### expertPrompts.ts 签名

```typescript
/**
 * 为指定专家生成独立 prompt
 * @param role 专家角色
 * @param analysis 原始分析数据
 * @param previousRounds 前轮专家发言（作为 context 注入）
 * @param commoditiesData 大宗商品数据
 * @param backtest 回测结果（可选）
 */
function getExpertPrompt(
  role: AgentRole,
  analysis: StockAnalysis,
  previousRounds: AgentMessage[],
  commoditiesData: any[],
  backtest: BacktestResult | null
): string;

// 每位专家返回的 JSON schema（用于 Gemini responseMimeType）
function getExpertResponseSchema(role: AgentRole): Record<string, any>;
```

### resultAggregator.ts 签名

```typescript
/**
 * 将多轮独立专家输出聚合为完整 AgentDiscussion
 */
function aggregateResults(
  roundResults: Map<AgentRole, ExpertOutput>,
  backtest: BacktestResult | null
): AgentDiscussion;

interface ExpertOutput {
  role: AgentRole;
  message: AgentMessage;
  structuredData?: {
    coreVariables?: CoreVariable[];
    businessModel?: BusinessModel;
    quantifiedRisks?: QuantifiedRisk[];
    scenarios?: Scenario[];
    sensitivityMatrix?: SensitivityMatrixRow[];
    expectedValueOutcome?: ExpectedValueOutcome;
    // ... 各专家特定输出
  };
}
```

### 对现有 discussionService.ts 的变更

```typescript
// 重构后的 discussionService.ts（~60行）
import { executeDiscussion, OrchestratorConfig } from './discussion/orchestrator';

export async function startAgentDiscussion(
  analysis: StockAnalysis,
  config?: GeminiConfig,
  history?: AgentMessage[],
  orchestratorConfig?: OrchestratorConfig   // 新增参数
): Promise<AgentDiscussion> {
  const defaultConfig: OrchestratorConfig = {
    level: 'deep',
    assetType: 'stock',
    maxConcurrency: 3,
  };
  
  return executeDiscussion(
    analysis,
    config ?? useConfigStore.getState().config,
    orchestratorConfig ?? defaultConfig
  );
}
```

---

## OPT-2：回测系统增强

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/backtestService.ts` | ~200（扩展） | 时间序列构建 + 偏差检测 |
| `src/services/expertTracker.ts` | ~120（新建） | 专家历史表现追踪 |

### 新增类型 (src/types.ts)

```typescript
interface BacktestTimeSeries {
  symbol: string;
  entries: BacktestEntry[];
  overallAccuracy: number;
  directionAccuracy: number;
  avgHoldingPeriodDays: number;
  profitFactor: number;            // 总盈利 / 总亏损（>1 为盈利系统）
  maxConsecutiveLosses: number;
  longestWinStreak: number;
  sharpeRatio: number;             // (平均收益 - 无风险利率) / 收益标准差
}

interface BacktestEntry {
  analysisId: string;
  date: string;
  priceAtAnalysis: number;
  recommendation: string;
  score: number;
  targetPrice: number;
  stopLoss: number;
  status: 'Target Hit' | 'Stop Loss Hit' | 'In Progress' | 'Logic Drift';
  accuracy: number;
  holdingDays: number;
  returnPercent: number;
}

interface ExpertTrackRecord {
  role: AgentRole;
  totalCalls: number;
  directionAccuracy: number;
  targetHitRate: number;
  avgOvershoot: number;            // 正=过度乐观, 负=过度悲观
  bestSector: string;
  worstSector: string;
  recentTrend: 'improving' | 'declining' | 'stable';
  last5Accuracy: number[];         // 最近 5 次准确率
}

interface SystematicBias {
  hasBias: boolean;
  biasType: 'bullish_drift' | 'bearish_drift' | 'target_overshoot' | 'stoploss_undershoot' | null;
  severity: 'low' | 'medium' | 'high';
  message: string;
  consecutiveCount: number;
}
```

### 函数签名

```typescript
// src/services/backtestService.ts 新增

function buildBacktestTimeSeries(
  symbol: string,
  currentAnalysis: StockAnalysis,
  allHistory: StockAnalysis[]        // 来自 adminService.getHistoryContext()
): BacktestTimeSeries;

function detectSystematicBias(
  timeSeries: BacktestTimeSeries
): SystematicBias;

// src/services/expertTracker.ts

function buildExpertTrackRecords(
  allHistory: StockAnalysis[]        // 所有历史分析（含 discussion 字段）
): Map<AgentRole, ExpertTrackRecord>;

function calculateDynamicWeights(
  trackRecords: Map<AgentRole, ExpertTrackRecord>,
  baseWeights: AnalystWeight[]
): AnalystWeight[];
// 规则：连续 3 次方向错误 → 权重 × 0.8
//       连续 3 次方向正确 → 权重 × 1.1（上限 0.2）
//       targetHitRate < 30% → 权重 × 0.7
```

### 集成点变更

```typescript
// discussionService.ts (或 orchestrator.ts) 修改

// 执行讨论前新增：
const allHistory = await getHistoryContext();
const stockHistory = allHistory.filter(h => h.stockInfo?.symbol === analysis.stockInfo.symbol);
const timeSeries = buildBacktestTimeSeries(analysis.stockInfo.symbol, analysis, stockHistory);
const bias = detectSystematicBias(timeSeries);
const trackRecords = buildExpertTrackRecords(stockHistory);
const dynamicWeights = calculateDynamicWeights(trackRecords, defaultWeights);

// 注入首席策略师 prompt：
const biasWarning = bias.hasBias 
  ? `⚠️ 系统性偏差警告：${bias.message}\n连续 ${bias.consecutiveCount} 次${bias.biasType}，请特别注意调整。`
  : '';

const weightContext = dynamicWeights
  .map(w => `${w.role}: 权重 ${w.weight.toFixed(2)}${w.weight < 0.15 ? ' (因历史表现下调)' : ''}`)
  .join('\n');
```

---

## OPT-3：数据源韧性 — Circuit Breaker

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `server/middleware/dataSourceHealth.ts` | ~150 | Circuit Breaker + 健康度监控 |
| `server.ts` | 修改 | 注入 monitor 到 symbol 解析链 |

### 核心实现

```typescript
// server/middleware/dataSourceHealth.ts

type SourceName = 'eastmoney_new' | 'eastmoney_old' | 'sina' | 'yahoo';
type SourceStatus = 'healthy' | 'degraded' | 'down';

interface SourceHealth {
  source: SourceName;
  status: SourceStatus;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastSuccess: number | null;       // Unix timestamp
  lastFailure: number | null;
  downSince: number | null;         // Circuit Breaker open 时间
}

class DataSourceMonitor {
  private health = new Map<SourceName, SourceHealth>();
  
  private static FAILURE_THRESHOLD = 3;
  private static RECOVERY_TIMEOUT_MS = 5 * 60 * 1000;  // 5 分钟
  private static DEGRADED_SUCCESS_RATE = 0.7;
  private static LATENCY_WINDOW = 20;  // 最近 20 次取平均
  
  private latencyBuffer = new Map<SourceName, number[]>();
  
  constructor(sources: SourceName[]) {
    for (const s of sources) {
      this.health.set(s, {
        source: s, status: 'healthy',
        successCount: 0, failureCount: 0, consecutiveFailures: 0,
        avgLatencyMs: 0, lastSuccess: null, lastFailure: null, downSince: null
      });
    }
  }
  
  recordSuccess(source: SourceName, latencyMs: number): void;
  recordFailure(source: SourceName): void;
  
  isAvailable(source: SourceName): boolean {
    const h = this.health.get(source)!;
    if (h.status !== 'down') return true;
    // Half-open: 超过恢复时间后允许一次试探
    return Date.now() - (h.downSince ?? 0) > DataSourceMonitor.RECOVERY_TIMEOUT_MS;
  }
  
  getHealthReport(): SourceHealth[] {
    return Array.from(this.health.values());
  }
  
  getSortedAvailable(): SourceName[] {
    return Array.from(this.health.entries())
      .filter(([, h]) => this.isAvailable(h.source))
      .sort((a, b) => a[1].avgLatencyMs - b[1].avgLatencyMs)
      .map(([name]) => name);
  }
}

export const monitor = new DataSourceMonitor([
  'eastmoney_new', 'eastmoney_old', 'sina', 'yahoo'
]);
```

### 新增 API 端点

```typescript
// server.ts 新增
app.get('/api/health/data-sources', (req, res) => {
  res.json(monitor.getHealthReport());
});
```

### server.ts symbol 解析链修改

```typescript
// 现有硬编码顺序 → 动态排序
async function resolveSymbol(query: string, market: Market): Promise<ResolvedSymbol> {
  const sources = monitor.getSortedAvailable()
    .filter(s => s !== 'yahoo');  // yahoo 不做 symbol 解析
  
  for (const source of sources) {
    const startTime = Date.now();
    try {
      const result = await symbolResolvers[source](query, market);
      monitor.recordSuccess(source, Date.now() - startTime);
      return result;
    } catch (e) {
      monitor.recordFailure(source);
      console.warn(`[${source}] 解析失败: ${e.message}`);
    }
  }
  throw new Error(`所有数据源不可用，无法解析 ${query}`);
}
```

### 前端消费

```typescript
// src/services/healthService.ts (~30行，新建)
export async function getDataSourceHealth(): Promise<SourceHealth[]> {
  const res = await fetch('/api/health/data-sources');
  return res.json();
}

// Header 或 TokenUsage 组件中调用，每 60 秒轮询
// 展示: 🟢 Yahoo (45ms) | 🟡 EastMoney (320ms) | 🔴 Sina (down 3min)
```

---

## OPT-4：Prompt 版本管理

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/promptRegistry.ts` | ~120 | 版本注册 + 指标采集 |

### 核心实现

```typescript
// src/services/promptRegistry.ts

interface PromptVersion {
  id: string;                      // "analysis-v4.0"
  name: string;                    // "stock-analysis" | "market-overview" | "discussion" | "quick-scan"
  version: string;                 // "4.0"
  template: (...args: any[]) => string;
  changelog: string;
  createdAt: string;
  isActive: boolean;
}

interface PromptMetrics {
  callCount: number;
  avgTokenUsage: number;
  avgResponseScore: number;
  avgLatencyMs: number;
  errorRate: number;
  lastUsed: string;
}

// 不使用 class — 使用简单对象 + 函数，保持与 Zustand store 风格一致
const registry = new Map<string, PromptVersion[]>();
const metrics = new Map<string, PromptMetrics>();

export function registerPrompt(version: PromptVersion): void {
  const versions = registry.get(version.name) ?? [];
  versions.push(version);
  registry.set(version.name, versions);
}

export function getActivePrompt(name: string): PromptVersion {
  const versions = registry.get(name) ?? [];
  const active = versions.find(v => v.isActive);
  if (!active) throw new Error(`No active prompt for ${name}`);
  return active;
}

export function recordPromptMetrics(
  name: string,
  tokenUsage: number,
  responseScore: number,
  latencyMs: number,
  isError: boolean
): void {
  const m = metrics.get(name) ?? { callCount: 0, avgTokenUsage: 0, avgResponseScore: 0, avgLatencyMs: 0, errorRate: 0, lastUsed: '' };
  m.callCount++;
  m.avgTokenUsage = ((m.avgTokenUsage * (m.callCount - 1)) + tokenUsage) / m.callCount;
  m.avgResponseScore = ((m.avgResponseScore * (m.callCount - 1)) + responseScore) / m.callCount;
  m.avgLatencyMs = ((m.avgLatencyMs * (m.callCount - 1)) + latencyMs) / m.callCount;
  m.errorRate = ((m.errorRate * (m.callCount - 1)) + (isError ? 1 : 0)) / m.callCount;
  m.lastUsed = new Date().toISOString();
  metrics.set(name, m);
}

export function getPromptMetrics(name: string): PromptMetrics | undefined {
  return metrics.get(name);
}

export function getAllVersions(name: string): PromptVersion[] {
  return registry.get(name) ?? [];
}
```

### 集成方式

```typescript
// src/services/prompts.ts 顶部新增注册
import { registerPrompt } from './promptRegistry';

registerPrompt({
  id: 'analysis-v4.0',
  name: 'stock-analysis',
  version: '4.0',
  template: getAnalyzeStockPrompt,
  changelog: '增加行业锚点动态搜索 + 反向验证 + 置信区间自适应',
  createdAt: '2026-04-01',
  isActive: true,
});

registerPrompt({
  id: 'market-overview-v3.0',
  name: 'market-overview',
  version: '3.0',
  template: getMarketOverviewPrompt,
  changelog: '增加商品关联过滤 + 日期验证',
  createdAt: '2026-04-01',
  isActive: true,
});
```

```typescript
// src/services/analysisService.ts 修改
import { getActivePrompt, recordPromptMetrics } from './promptRegistry';

export async function analyzeStock(...) {
  const prompt = getActivePrompt('stock-analysis');
  const startTime = Date.now();
  
  try {
    const result = await generateContentWithUsage(ai, prompt.template(...args), ...);
    recordPromptMetrics('stock-analysis', tokenUsage, result.score ?? 0, Date.now() - startTime, false);
    return result;
  } catch (e) {
    recordPromptMetrics('stock-analysis', 0, 0, Date.now() - startTime, true);
    throw e;
  }
}
```

---

## OPT-5：报告个性化

### 新增类型

```typescript
// src/types.ts 新增
interface ReportPreference {
  detailLevel: 'executive' | 'analyst' | 'trader';
  focusAreas: ReportFocusArea[];
  includeBacktest: boolean;
  includeExpertDebate: boolean;
  maxLength: 'brief' | 'standard' | 'full';
}

type ReportFocusArea = 'fundamental' | 'technical' | 'risk' | 'sentiment' | 'scenario';

// useConfigStore 扩展
interface ConfigState {
  // ... 现有字段
  reportPreference: ReportPreference;
  setReportPreference: (pref: ReportPreference) => void;
}
```

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/reportGenerator.ts` | ~200 | 条件渲染报告 |

### 核心实现

```typescript
// src/services/reportGenerator.ts

const DEFAULT_PREFERENCE: ReportPreference = {
  detailLevel: 'analyst',
  focusAreas: ['fundamental', 'technical', 'risk', 'scenario'],
  includeBacktest: true,
  includeExpertDebate: true,
  maxLength: 'standard',
};

export function generateReport(
  analysis: StockAnalysis,
  discussion: AgentDiscussion | undefined,
  preference: ReportPreference = DEFAULT_PREFERENCE
): string {
  const sections: string[] = [];
  
  // 所有级别共有
  sections.push(renderHeader(analysis));
  sections.push(renderDecisionSummary(analysis));
  sections.push(renderTradingPlan(analysis.tradingPlan));
  
  if (preference.detailLevel === 'trader') {
    sections.push(renderPriceDistances(analysis));
    if (preference.focusAreas.includes('scenario'))
      sections.push(renderScenariosCompact(analysis.scenarios));
    return joinSections(sections, preference.maxLength);
  }
  
  // executive + analyst
  if (preference.focusAreas.includes('scenario'))
    sections.push(renderScenarios(analysis.scenarios));
  if (preference.focusAreas.includes('risk'))
    sections.push(renderRiskMatrix(analysis.quantifiedRisks));
  
  if (preference.detailLevel === 'executive')
    return joinSections(sections, preference.maxLength);
  
  // analyst only
  if (preference.focusAreas.includes('fundamental'))
    sections.push(renderFundamentals(analysis));
  if (preference.focusAreas.includes('technical'))
    sections.push(renderTechnicalAnalysis(analysis));
  if (preference.focusAreas.includes('sentiment') && analysis.capitalFlow)
    sections.push(renderCapitalFlow(analysis.capitalFlow));
  if (preference.includeBacktest && analysis.backtestResult)
    sections.push(renderBacktest(analysis.backtestResult));
  if (preference.includeExpertDebate && discussion?.messages)
    sections.push(renderExpertDebate(discussion.messages));
  
  return joinSections(sections, preference.maxLength);
}

function joinSections(sections: string[], maxLength: 'brief' | 'standard' | 'full'): string {
  const joined = sections.join('\n\n---\n\n');
  const limits = { brief: 3000, standard: 12000, full: 28000 };
  const limit = limits[maxLength];
  return joined.length > limit
    ? joined.slice(0, limit) + '\n\n... (已截断)'
    : joined;
}
```

### feishuService.ts 适配

```typescript
// 现有 sendAnalysisToFeishu 修改
export async function sendAnalysisToFeishu(
  analysis: StockAnalysis,
  webhookUrl: string,
  discussion?: AgentDiscussion,
  preference?: ReportPreference         // 新增参数
): Promise<boolean> {
  const report = generateReport(analysis, discussion, preference);
  // ... 现有 Feishu card 构建逻辑，使用 report 内容
}
```

---

## OPT-6：分析粒度分级

### 新增类型

```typescript
// src/types.ts 新增
type AnalysisLevel = 'quick' | 'standard' | 'deep';

// src/stores/useUIStore.ts 扩展
interface UIState {
  // ... 现有字段
  analysisLevel: AnalysisLevel;
  setAnalysisLevel: (level: AnalysisLevel) => void;
}
```

### prompts.ts 新增

```typescript
// src/services/prompts.ts 新增
export const getQuickScanPrompt = (
  symbol: string,
  market: Market,
  realtimeData: any,
  beijingDate: string
): string => `
你是一位资深金融分析师。基于以下实时数据，对 ${symbol} (${market}) 进行快速评估。

**实时数据 (绝对真实)**:
${JSON.stringify(realtimeData, null, 2)}

**日期**: ${beijingDate}

请返回 JSON:
{
  "stockInfo": { "symbol": "${symbol}", "name": "公司名", "price": 数字, "change": 数字, "changePercent": 数字, "market": "${market}", "currency": "CNY/HKD/USD", "lastUpdated": "时间" },
  "score": 0到100的数字,
  "sentiment": "Bullish" 或 "Bearish" 或 "Neutral",
  "recommendation": "Strong Buy" 或 "Buy" 或 "Hold" 或 "Sell" 或 "Strong Sell",
  "summary": "2-3句核心判断",
  "keyRisks": ["风险1"],
  "keyOpportunities": ["机会1"]
}

要求：
1. 基于实时价格、涨跌幅、市场状态快速判断
2. Score 反映短期趋势强度和估值合理性
3. 给出明确的一句话推荐理由
`;
```

### analysisService.ts 修改

```typescript
// src/services/analysisService.ts 新增

export async function quickScan(
  symbol: string,
  market: Market,
  config?: GeminiConfig
): Promise<StockAnalysis> {
  // 仅获取实时数据（不获取 commodities 和 history）
  const realtimeData = await fetch(`/api/stock/realtime?symbol=${encodeURIComponent(symbol)}&market=${market}`)
    .then(r => r.json());
  
  const ai = createAI(config);
  const prompt = getQuickScanPrompt(symbol, market, realtimeData, getBeiJingDate());
  
  const { result, usage } = await generateContentWithUsage(ai, prompt, {
    responseMimeType: 'application/json',
  });
  
  if (usage) useConfigStore.getState().addTokenUsage(usage);
  
  const analysis = parseJsonResponse<StockAnalysis>(result);
  analysis.id = `quick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // Quick Scan 不保存到历史
  return analysis;
}

// 修改现有 analyzeStock 以支持 level
export async function analyzeStock(
  symbol: string,
  market: Market,
  config?: GeminiConfig,
  level: AnalysisLevel = 'standard'     // 新增参数
): Promise<StockAnalysis> {
  if (level === 'quick') return quickScan(symbol, market, config);
  
  // ... 现有 standard 逻辑 ...
  
  // deep 模式在 App.tsx 中触发 — analyzeStock 后自动调用 startAgentDiscussion
}
```

### App.tsx handler 修改

```typescript
// App.tsx handleSearch 修改
const handleSearch = async (e) => {
  e.preventDefault();
  const level = useUIStore.getState().analysisLevel;
  
  setLoading(true);
  const analysis = await analyzeStock(symbol, market, config, level);
  setAnalysis(analysis);
  
  if (level === 'deep') {
    setIsDiscussing(true);
    const discussion = await startAgentDiscussion(analysis, config);
    setDiscussionResults(discussion);
    setIsDiscussing(false);
  }
  
  setLoading(false);
};
```

---

## NEW-1：自选股监控仪表盘

### 新增类型 (src/types.ts)

```typescript
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  addedAt: string;
  notes: string;
  alertThreshold: number;           // 默认 15
  scoreHistory: ScoreSnapshot[];
  lastQuickScan: QuickScanResult | null;
  alertHistory: WatchlistAlert[];
}

interface ScoreSnapshot {
  date: string;
  score: number;
  price: number;
  recommendation: string;
}

interface QuickScanResult {
  score: number;
  sentiment: string;
  recommendation: string;
  summary: string;
  timestamp: string;
}

interface WatchlistAlert {
  id: string;
  type: 'score_drop' | 'score_rise' | 'price_target' | 'stop_loss';
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
}
```

### Store (src/stores/useWatchlistStore.ts)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
  items: WatchlistItem[];
  isScanning: boolean;
  lastScanTime: string | null;
  scanProgress: { current: number; total: number } | null;
  
  addItem: (symbol: string, name: string, market: Market) => void;
  removeItem: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  setAlertThreshold: (id: string, threshold: number) => void;
  addScoreSnapshot: (id: string, snapshot: ScoreSnapshot) => void;
  setLastQuickScan: (id: string, result: QuickScanResult) => void;
  addAlert: (id: string, alert: WatchlistAlert) => void;
  acknowledgeAlert: (id: string, alertId: string) => void;
  setIsScanning: (scanning: boolean) => void;
  setScanProgress: (progress: { current: number; total: number } | null) => void;
  setLastScanTime: (time: string) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist((set) => ({
    items: [],
    isScanning: false,
    lastScanTime: null,
    scanProgress: null,
    
    addItem: (symbol, name, market) => set(state => ({
      items: [...state.items, {
        id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        symbol, name, market,
        addedAt: new Date().toISOString(),
        notes: '',
        alertThreshold: 15,
        scoreHistory: [],
        lastQuickScan: null,
        alertHistory: [],
      }]
    })),
    
    removeItem: (id) => set(state => ({
      items: state.items.filter(i => i.id !== id)
    })),
    
    // ... 其余 setter 实现类似
  }), { name: 'watchlist-storage' })
);
```

### Service (src/services/watchlistService.ts)

```typescript
import { quickScan } from './analysisService';
import { useWatchlistStore } from '../stores/useWatchlistStore';
import { delay } from './geminiService';

/**
 * 批量扫描自选列表
 * 串行执行，每只间隔 2 秒（防 Gemini 限流）
 * 通过 onProgress 回调报告进度
 */
export async function scanWatchlist(
  config: GeminiConfig,
  onProgress?: (current: number, total: number, item: WatchlistItem) => void
): Promise<WatchlistAlert[]> {
  const store = useWatchlistStore.getState();
  const items = store.items;
  const alerts: WatchlistAlert[] = [];
  
  store.setIsScanning(true);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    store.setScanProgress({ current: i + 1, total: items.length });
    onProgress?.(i + 1, items.length, item);
    
    try {
      const analysis = await quickScan(item.symbol, item.market, config);
      const scanResult: QuickScanResult = {
        score: analysis.score,
        sentiment: analysis.sentiment,
        recommendation: analysis.recommendation,
        summary: analysis.summary,
        timestamp: new Date().toISOString(),
      };
      
      store.setLastQuickScan(item.id, scanResult);
      store.addScoreSnapshot(item.id, {
        date: new Date().toISOString().slice(0, 10),
        score: analysis.score,
        price: analysis.stockInfo.price,
        recommendation: analysis.recommendation,
      });
      
      // 检测告警
      const alert = detectAlert(item, analysis.score);
      if (alert) {
        store.addAlert(item.id, alert);
        alerts.push(alert);
      }
      
      if (i < items.length - 1) await delay(2000);
    } catch (e) {
      console.error(`Watchlist scan failed for ${item.symbol}:`, e);
    }
  }
  
  store.setIsScanning(false);
  store.setScanProgress(null);
  store.setLastScanTime(new Date().toISOString());
  
  return alerts;
}

function detectAlert(item: WatchlistItem, newScore: number): WatchlistAlert | null {
  const history = item.scoreHistory;
  if (history.length === 0) return null;
  
  const prevScore = history[history.length - 1].score;
  const delta = newScore - prevScore;
  
  if (Math.abs(delta) < item.alertThreshold) return null;
  
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    type: delta < 0 ? 'score_drop' : 'score_rise',
    message: `${item.name} (${item.symbol}) Score ${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} 点 (${prevScore} → ${newScore})`,
    triggeredAt: new Date().toISOString(),
    acknowledged: false,
  };
}
```

### UI 组件

```typescript
// src/components/dashboard/WatchlistPanel.tsx

interface WatchlistPanelProps {
  onAnalyze: (symbol: string, market: Market) => void;  // 触发深度分析
}

// 子组件:
// - WatchlistHeader: 标题 + 扫描按钮 + 进度条
// - WatchlistRow: symbol, name, Score迷你折线, 推荐, 最后扫描时间, 操作按钮
// - ScoreSparkline: Recharts 迷你折线图 (60px高, 7 日 Score)
// - AlertBadge: 未确认告警数红点
```

---

## NEW-2：行业轮动雷达

### 新增类型

```typescript
interface SectorRotation {
  sector: string;
  capitalFlowTrend: 'inflow' | 'outflow' | 'neutral';
  flowMagnitude: number;            // -100 ~ +100
  momentum30d: number;              // %
  topStocks: { symbol: string; name: string; score: number }[];
  updatedAt: string;
}

interface MarketCycle {
  currentPhase: 'recovery' | 'expansion' | 'overheating' | 'stagflation';
  phaseConfidence: number;
  recommendedSectors: string[];
  avoidSectors: string[];
  logic: string;
}

interface SectorRotationData {
  rotations: SectorRotation[];
  cycle: MarketCycle;
  generatedAt: string;
}
```

### 数据来源策略

```typescript
// src/services/sectorRotationService.ts (~150行)

/**
 * 基于 MarketOverview 历史构建轮动数据
 * 不新增外部 API 调用
 */
export async function buildSectorRotation(
  market: Market,
  config?: GeminiConfig
): Promise<SectorRotationData> {
  // 1. 获取最近 30 天的 MarketOverview 历史
  const history = await getHistoryContext();
  const marketHistory = history
    .filter(h => h.sectorAnalysis && h.id?.startsWith('market'))
    .slice(0, 30);
  
  // 2. 提取所有出现过的板块名称
  const sectorMap = new Map<string, { trends: string[]; dates: string[] }>();
  for (const overview of marketHistory) {
    for (const sector of overview.sectorAnalysis ?? []) {
      const entry = sectorMap.get(sector.name) ?? { trends: [], dates: [] };
      entry.trends.push(sector.trend);
      entry.dates.push(overview.id ?? '');
      sectorMap.set(sector.name, entry);
    }
  }
  
  // 3. 使用 Gemini Quick Prompt 判断美林时钟象限 + 资金流向
  const cyclePrompt = getSectorCyclePrompt(sectorMap, market);
  const ai = createAI(config);
  const { result } = await generateContentWithUsage(ai, cyclePrompt, {
    responseMimeType: 'application/json',
  });
  
  return parseJsonResponse<SectorRotationData>(result);
}
```

### UI 集成

MarketOverview 组件新增 tab "行业轮动"，与"大盘指数"/"板块分析"/"新闻"平级。

---

## NEW-3：策略回溯时间线

### UI 组件规格

```typescript
// src/components/analysis/StrategyTimeline.tsx

interface StrategyTimelineProps {
  timeSeries: BacktestTimeSeries;
  currentAnalysis: StockAnalysis;
}

// 子组件:
// TimelineChart — Recharts ComposedChart
//   - Line: 实际价格走势（数据源: timeSeries.entries[].priceAtAnalysis + 当前价格）
//   - Scatter: 分析节点（x=date, y=priceAtAnalysis, color=recommendation映射）
//     颜色映射: Strong Buy=#16a34a, Buy=#22c55e, Hold=#f59e0b, Sell=#ef4444, Strong Sell=#dc2626
//   - ReferenceLine: 每个节点的 targetPrice (绿虚线) 和 stopLoss (红虚线)
//
// TimelineDetail — 点击 Scatter 节点展开
//   - Score badge + Recommendation badge
//   - 目标价/止损/实际回报
//   - Status badge (✅ Target Hit / ❌ Stop Loss Hit / ⏳ In Progress)
//   - 争议点摘要（如有 controversialPoints）
//
// ExpertAccuracyChart — Recharts BarChart (堆叠柱状图)
//   - 每位专家一列，高度=directionAccuracy
//   - 叠加 targetHitRate 为深色
//   - 底部标签: 专家角色名
```

### 显示条件

仅当 `timeSeries.entries.length >= 2` 时显示。位于 AnalysisResult 内，ScenarioPanel 之后。

---

## NEW-4：多股比较分析

### 新增类型

```typescript
interface ComparisonRequest {
  stocks: { symbol: string; market: Market }[];  // 2-3 只
  level: 'quick' | 'standard';                   // 对比精度
}

interface ComparisonResult {
  stocks: ComparisonStock[];
  sharedIndustry: string;
  comparisonTable: ComparisonRow[];
  verdict: string;                                // 一句话排序结论
  generatedAt: string;
}

interface ComparisonStock {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  score: number;
  sentiment: string;
  recommendation: string;
  pe?: string;
  pb?: string;
  roe?: string;
  moatStrength?: 'Wide' | 'Narrow' | 'None';
  riskLevel: 'Low' | 'Medium' | 'High';
}

interface ComparisonRow {
  dimension: string;               // "估值(PE)", "成长性", "护城河"
  values: string[];                // 每只股票对应值
  winner: number;                  // 胜出股票的索引
}
```

### Service

```typescript
// src/services/comparisonService.ts (~150行)

export async function compareStocks(
  request: ComparisonRequest,
  config?: GeminiConfig
): Promise<ComparisonResult> {
  // 1. 并行 Quick Scan
  const scanResults = await Promise.all(
    request.stocks.map(s => quickScan(s.symbol, s.market, config))
  );
  
  // 2. 单次 Gemini 调用生成对比
  const comparisonPrompt = getComparisonPrompt(scanResults);
  const ai = createAI(config);
  const { result } = await generateContentWithUsage(ai, comparisonPrompt, {
    responseMimeType: 'application/json',
    tools: [{ googleSearch: {} }],
  });
  
  return parseJsonResponse<ComparisonResult>(result);
}
```

### UI

Header 新增 `对比` 按钮。点击后搜索栏变为多股输入模式（逗号分隔或多个输入框）。结果页使用表格 + Recharts RadarChart。

---

## NEW-5：决策日志与复盘

### 新增类型

```typescript
interface DecisionEntry {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  analysisId: string;
  action: 'buy' | 'hold' | 'sell' | 'add' | 'reduce' | 'watch';
  reasoning: string;
  priceAtDecision: number;
  confidence: number;               // 0-100
  createdAt: string;
  reviewDate: string;               // createdAt + 30 天
  priceAtReview?: number;
  actualReturn?: number;
  outcome?: 'correct' | 'incorrect' | 'neutral';
  reflection?: string;
  lessonsLearned?: string[];
  biasDetected?: string;
}

interface DecisionStats {
  totalDecisions: number;
  correctRate: number;
  avgConfidence: number;
  overconfidenceBias: number;       // confidence - correctRate（正=过度自信）
  mostCommonBias: string | null;
  bestAction: string;
  worstAction: string;
  avgReturnByAction: Record<string, number>;
}
```

### Store

```typescript
// src/stores/useDecisionStore.ts (~100行)

interface DecisionState {
  entries: DecisionEntry[];
  
  addEntry: (entry: Omit<DecisionEntry, 'id' | 'createdAt' | 'reviewDate'>) => void;
  updateReview: (id: string, priceAtReview: number, outcome: DecisionEntry['outcome'], reflection: string) => void;
  markBias: (id: string, bias: string) => void;
  getStats: () => DecisionStats;
  getPendingReviews: () => DecisionEntry[];
}

// persist → localStorage 'decision-storage'
```

### 偏差检测 Service

```typescript
// src/services/biasDetector.ts (~120行)

interface BiasPattern {
  name: string;
  detect: (entries: DecisionEntry[]) => boolean;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

const BIAS_PATTERNS: BiasPattern[] = [
  {
    name: 'overconfidence',
    detect: (entries) => {
      const reviewed = entries.filter(e => e.outcome);
      if (reviewed.length < 5) return false;
      const avgConf = reviewed.reduce((s, e) => s + e.confidence, 0) / reviewed.length;
      const correctRate = reviewed.filter(e => e.outcome === 'correct').length / reviewed.length;
      return (avgConf / 100) - correctRate > 0.2;
    },
    message: '过度自信偏差：你的自评置信度显著高于实际正确率。建议在高置信度决策时降低仓位 20%。',
    severity: 'warning',
  },
  {
    name: 'loss_aversion',
    detect: (entries) => {
      const holds = entries.filter(e => e.action === 'hold' && e.outcome === 'incorrect' && (e.actualReturn ?? 0) < -10);
      return holds.length >= 3;
    },
    message: '损失厌恶偏差：你在亏损超过 10% 时倾向于持有而非止损。建议严格执行交易计划止损线。',
    severity: 'critical',
  },
  {
    name: 'recency_bias',
    detect: (entries) => {
      const buys = entries.filter(e => e.action === 'buy');
      if (buys.length < 5) return false;
      const incorrectBuys = buys.filter(e => e.outcome === 'incorrect').length;
      return incorrectBuys / buys.length > 0.6;
    },
    message: '追涨偏差：你的买入决策错误率超过 60%。建议在 Score ≥ 70 且风险经理未反对时才买入。',
    severity: 'warning',
  },
];

export function detectBiases(entries: DecisionEntry[]): BiasPattern[] {
  return BIAS_PATTERNS.filter(p => p.detect(entries));
}
```

### UI 集成

- **入口 1**：分析结果底部 `📝 记录决策` 按钮 → DecisionModal
- **入口 2**：AdminPanel 新增 "决策日志" tab → DecisionJournal 组件
  - 时间线列表 + Stats 卡片
  - 到期未复盘项高亮
  - 偏差警告 Banner
- **飞书提醒**：每日 8:00 检查到期决策 → 推送复盘提醒

---

## 四、完整文件清单汇总

### 新增文件 (24 个)

```
src/services/
  discussion/
    orchestrator.ts         (OPT-1)
    expertPrompts.ts        (OPT-1)
    resultAggregator.ts     (OPT-1)
    skipRules.ts            (OPT-1)
  expertTracker.ts          (OPT-2)
  promptRegistry.ts         (OPT-4)
  reportGenerator.ts        (OPT-5)
  watchlistService.ts       (NEW-1)
  sectorRotationService.ts  (NEW-2)
  comparisonService.ts      (NEW-4)
  healthService.ts          (OPT-3, 前端)
  biasDetector.ts           (NEW-5)

src/stores/
  useWatchlistStore.ts      (NEW-1)
  useDecisionStore.ts       (NEW-5)

src/components/
  dashboard/
    WatchlistPanel.tsx       (NEW-1)
    ScoreSparkline.tsx       (NEW-1)
    SectorRadar.tsx          (NEW-2)
  analysis/
    StrategyTimeline.tsx     (NEW-3)
    ComparisonView.tsx       (NEW-4)
    DecisionModal.tsx        (NEW-5)
  admin/
    DecisionJournal.tsx      (NEW-5)

server/
  middleware/
    dataSourceHealth.ts      (OPT-3)
```

### 修改文件 (10 个)

```
src/types.ts                — 新增 15+ 类型/接口
src/services/discussionService.ts — 简化为入口层
src/services/analysisService.ts   — 新增 quickScan, level 参数
src/services/prompts.ts           — 新增 getQuickScanPrompt, 注册到 registry
src/services/feishuService.ts     — 新增 preference 参数
src/stores/useConfigStore.ts      — 新增 reportPreference
src/stores/useUIStore.ts          — 新增 analysisLevel
src/App.tsx                       — handleSearch 支持 level
server.ts                         — 注入 monitor, 新增 health 端点
```

---

*实现规格书完毕。每个模块均包含类型定义、函数签名、文件清单和集成点。可按 P6→P7 路线图顺序编码。*
