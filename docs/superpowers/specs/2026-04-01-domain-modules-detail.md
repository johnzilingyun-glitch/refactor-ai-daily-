# 领域模块细化设计文档

> 日期：2026-04-01
> 关联文档：`2026-04-01-incremental-refactor-design.md` §11
> 范围：6 项可优化模块 (OPT) + 5 项新增模块 (NEW) 的详细实现设计

---

## 一、可优化模块详细设计

### OPT-1：专家讨论编排 — 条件拓扑引擎

#### 1.1 现状分析

当前 `discussionService.ts` 第 42-120 行定义 8 位专家的 prompt，然后在单次 Gemini 调用中一次性生成所有专家发言。整体为**单轮单调用**模式（非真正的多轮顺序对话），8 位专家的"顺序讨论"实际是 prompt 指令中要求 AI 模拟的顺序。

**核心限制**：
- 无法真正并行化 — 因为是单次 API 调用
- 无法条件跳过 — prompt 固定要求 8 位全部发言
- 单次调用 token 消耗集中 — 一次请求 ~8000 token 输出

#### 1.2 优化方案：多轮调用 + 条件编排

```
           ┌── Round 1 ──────────────────────────────────┐
           │  深研专家 (#1)                                │
           │  Input: stockAnalysis + commodities + history │
           │  Output: coreVariables + fundamentalTables    │
           └─────────────┬───────────────────────────────┘
                         │ coreVariables 注入
           ┌─────────────┼─────────────┐
     Round 2a            │       Round 2b          ← 可并行
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ 技术 (#2)     │  │ 基本面 (#3)  │  │ 情绪 (#4)    │
  │ Input: #1 out │  │ Input: #1 out│  │ Input: #1 out│
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                  │
         └────────┬────────┘                  │
                  │                           │
           ┌──────┴──────────────────────────┘
     Round 3: 并行
  ┌──────────────┐  ┌──────────────┐
  │ 风险 (#5)     │  │ 逆向 (#6)    │     ← 可并行
  │ Input: #1-#4  │  │ Input: #1-#4  │
  └──────┬───────┘  └──────┬───────┘
         └────────┬────────┘
           ┌──────┴──────────────────┐
     Round 4: │ 评审 (#7)              │
           │ Input: #1-#6            │
           └──────┬──────────────────┘
           ┌──────┴──────────────────┐
     Round 5: │ 首席策略师 (#8)        │
           │ Input: #1-#7 + backtest │
           └─────────────────────────┘
```

**从 1 轮大调用 → 5 轮小调用**：
- Round 1: 1 次调用
- Round 2: 3 次并行调用 (`Promise.all`)
- Round 3: 2 次并行调用 (`Promise.all`)
- Round 4: 1 次调用
- Round 5: 1 次调用
- **总调用数**: 8 次（与现在单次相同 token 量，但延迟更低，且可条件跳过）

#### 1.3 条件跳过策略

```typescript
interface DiscussionConfig {
  // 分析级别决定参与专家
  level: 'quick' | 'standard' | 'deep';
  // 标的类型决定跳过规则
  assetType: 'stock' | 'etf' | 'index' | 'bond';
  // 自定义跳过
  skipRoles?: AgentRole[];
}

const SKIP_RULES: Record<string, AgentRole[]> = {
  'etf':   ['Deep Research Specialist', 'Fundamental Analyst'],  // ETF 无需深研和基本面
  'index': ['Deep Research Specialist', 'Fundamental Analyst', 'Sentiment Analyst'],
  'bond':  ['Technical Analyst', 'Sentiment Analyst'],
};

// quick 模式仅执行: #1(深研) + #5(风险) + #8(首席) = 3 次调用
const LEVEL_RULES: Record<string, AgentRole[]> = {
  'quick':    ['Deep Research Specialist', 'Risk Manager', 'Chief Strategist'],
  'standard': undefined,  // 使用资产类型规则
  'deep':     undefined,  // 全员参与
};
```

#### 1.4 实现文件

```
src/services/
  discussion/
    orchestrator.ts      (~150行) — 拓扑编排引擎，管理调用顺序和并行
    expertPrompts.ts     (~400行) — 各专家独立 prompt（从 discussionService.ts 拆出）
    resultAggregator.ts  (~100行) — 汇总各专家输出为 AgentDiscussion
    skipRules.ts         (~50行)  — 条件跳过逻辑
  discussionService.ts   (~200行) — 保留为入口，调用 orchestrator
```

#### 1.5 性能影响估算

| 场景 | 当前 | 优化后 | 节省 |
|------|------|--------|------|
| 深度分析（全员） | ~8000 token, ~45s | ~8000 token, ~30s | 延迟 -33% |
| Quick Scan（3 人） | 不支持 | ~3000 token, ~12s | token -62% |
| ETF 分析（跳过 2 人） | ~8000 token | ~6000 token, ~25s | token -25% |

---

### OPT-2：回测系统增强 — 时间序列 + 专家追踪

#### 2.1 现状分析

`backtestService.ts` 仅比较最近一次历史分析与当前分析，输出单一 `BacktestResult`。准确率评分 (0-100) 基于方向匹配和目标达成，无时间衰减，不追踪各专家历史表现。

#### 2.2 新增类型

```typescript
// src/types.ts 新增
interface BacktestTimeSeries {
  symbol: string;
  entries: BacktestEntry[];
  overallAccuracy: number;        // 所有历史分析的综合准确率
  directionAccuracy: number;      // 方向判断准确率
  avgHoldingPeriod: number;       // 平均持有周期（天）
  profitFactor: number;           // 总盈利 / 总亏损
  maxDrawdown: number;            // 最大回撤 %
  consecutiveFailures: number;    // 连续失败次数（系统性偏差检测）
}

interface BacktestEntry {
  analysisId: string;
  date: string;
  priceAtAnalysis: number;
  recommendation: string;
  targetPrice: number;
  stopLoss: number;
  score: number;
  // 30 天后回填
  priceAfter7d?: number;
  priceAfter30d?: number;
  status: BacktestResult['status'];
  accuracy: number;
}

interface ExpertTrackRecord {
  role: AgentRole;
  totalCalls: number;
  directionAccuracy: number;      // 该专家推荐方向的正确率
  targetHitRate: number;          // 目标价命中率
  avgOvershoot: number;           // 平均过度乐观程度 (>0=过度乐观)
  bestSector: string;             // 最擅长行业
  worstSector: string;            // 最不擅长行业
  recentTrend: 'improving' | 'declining' | 'stable';
}
```

#### 2.3 实现变更

```typescript
// src/services/backtestService.ts 新增函数

/**
 * 构建某 symbol 的完整回测时间序列
 * 从 data/history/ 读取所有同 symbol 历史分析
 */
export function buildBacktestTimeSeries(
  symbol: string,
  currentAnalysis: StockAnalysis,
  allHistory: StockAnalysis[]
): BacktestTimeSeries;

/**
 * 基于历史分析中各专家的准确率，动态调整 analystWeights
 * 连续 3 次方向错误的专家权重下调 20%
 */
export function calculateDynamicWeights(
  timeSeries: BacktestTimeSeries,
  expertMessages: AgentMessage[]
): AnalystWeight[];

/**
 * 检测系统性偏差
 * 如"连续 3 次看多但股价下跌" → 生成偏差警告注入讨论 prompt
 */
export function detectSystematicBias(
  timeSeries: BacktestTimeSeries
): { hasBias: boolean; biasType: string; warning: string } | null;
```

#### 2.4 集成点

- `discussionService.ts` 调用 `buildBacktestTimeSeries` 获取完整历史
- `calculateDynamicWeights` 结果注入首席策略师 prompt：`"基于历史表现，技术分析师权重下调至 0.6（近 3 次方向预判准确率仅 40%）"`
- `detectSystematicBias` 结果以 `⚠️ 系统性偏差警告` 形式注入深研专家 prompt
- UI `StrategyTimeline` 组件 (NEW-3) 消费 `BacktestTimeSeries` 数据

---

### OPT-3：数据源韧性 — Circuit Breaker + 健康度监控

#### 3.1 实现

```typescript
// server/middleware/dataSourceHealth.ts (~120行)

interface SourceHealth {
  source: 'eastmoney_new' | 'eastmoney_old' | 'sina' | 'yahoo';
  status: 'healthy' | 'degraded' | 'down';
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  lastChecked: Date;
}

class DataSourceMonitor {
  private health: Map<string, SourceHealth>;
  
  // Circuit Breaker 参数
  private readonly FAILURE_THRESHOLD = 3;       // 连续失败 3 次 → down
  private readonly RECOVERY_TIMEOUT = 5 * 60000; // 5 分钟后尝试恢复
  private readonly DEGRADED_THRESHOLD = 0.7;    // 成功率 < 70% → degraded
  
  recordSuccess(source: string, latencyMs: number): void;
  recordFailure(source: string, error: Error): void;
  isAvailable(source: string): boolean;  // down 时返回 false
  getHealthReport(): SourceHealth[];     // 暴露给前端 API
}

export const monitor = new DataSourceMonitor();
```

#### 3.2 前端集成

```typescript
// 新增 API 端点
// GET /api/health/data-sources → SourceHealth[]

// UI: Header 或 TokenUsage 组件旁添加数据源状态指示
// 🟢 Yahoo Finance (45ms)  🟡 EastMoney (320ms)  🔴 Sina (down)
```

#### 3.3 server.ts 路由变更

现有 symbol 解析链改为：
```typescript
async function resolveSymbol(query: string, market: Market): Promise<ResolvedSymbol> {
  // 按健康度排序的解析链
  const sources = ['eastmoney_new', 'eastmoney_old', 'sina']
    .filter(s => monitor.isAvailable(s))
    .sort((a, b) => monitor.getLatency(a) - monitor.getLatency(b));
  
  for (const source of sources) {
    try {
      const result = await resolvers[source](query, market);
      monitor.recordSuccess(source, result.latency);
      return result;
    } catch (e) {
      monitor.recordFailure(source, e);
    }
  }
  throw new Error('所有数据源不可用');
}
```

---

### OPT-4：Prompt 版本管理

#### 4.1 Prompt Registry

```typescript
// src/services/promptRegistry.ts (~100行)

interface PromptVersion {
  id: string;                      // "market-overview-v3.2"
  name: string;                    // 人类可读名称
  version: string;                 // semver
  template: (...args: any[]) => string;
  changelog: string;               // 变更说明
  createdAt: string;
  isActive: boolean;               // 当前激活版本
  metrics?: PromptMetrics;
}

interface PromptMetrics {
  callCount: number;
  avgTokenUsage: number;
  avgResponseScore: number;        // 产出分析的平均 score
  avgLatency: number;
  errorRate: number;
  lastUsed: string;
}

class PromptRegistry {
  private versions: Map<string, PromptVersion[]>;
  
  register(prompt: PromptVersion): void;
  getActive(name: string): PromptVersion;
  setActive(name: string, version: string): void;
  recordMetrics(name: string, metrics: Partial<PromptMetrics>): void;
  getHistory(name: string): PromptVersion[];
  
  // A/B 测试：随机选择版本（按权重）
  selectForAB(name: string): PromptVersion;
}
```

#### 4.2 与 optimization_log.json 关联

```typescript
// 每次 prompt 变更自动记录
promptRegistry.register({
  id: 'analysis-v4.0',
  changelog: '增加行业锚点动态搜索要求',
  ...
});
// → 自动写入 optimization_log.json:
// { field: "prompt:analysis", oldValue: "v3.9", newValue: "v4.0", description: "增加行业锚点动态搜索要求" }
```

#### 4.3 实施节奏

- **Phase 1**（随 P4 实施）：仅 Registry + 版本追踪，无 A/B
- **Phase 2**（后续迭代）：添加 A/B 随机选择 + metrics 自动采集
- **Phase 3**（成熟期）：基于 metrics 自动推荐最优 prompt 版本

---

### OPT-5：报告个性化

#### 5.1 偏好配置

```typescript
// src/types.ts 新增
interface ReportPreference {
  detailLevel: 'executive' | 'analyst' | 'trader';
  focusAreas: ('fundamental' | 'technical' | 'risk' | 'sentiment' | 'scenario')[];
  includeBacktest: boolean;
  includeExpertDebate: boolean;       // 是否包含专家争议全文
  maxLength: 'brief' | 'standard' | 'full';
}

// 默认配置
const DEFAULT_PREFERENCE: ReportPreference = {
  detailLevel: 'analyst',
  focusAreas: ['fundamental', 'technical', 'risk', 'scenario'],
  includeBacktest: true,
  includeExpertDebate: true,
  maxLength: 'standard'
};
```

#### 5.2 报告生成器适配

```typescript
// src/services/reportGenerator.ts (~200行，新文件)

function generateReport(
  analysis: StockAnalysis,
  discussion: AgentDiscussion,
  preference: ReportPreference
): string {
  const sections: string[] = [];
  
  // 所有级别都包含：决策摘要 + 交易计划
  sections.push(renderDecisionSummary(analysis));
  sections.push(renderTradingPlan(analysis.tradingPlan));
  
  if (preference.detailLevel !== 'executive') {
    // analyst + trader
    if (preference.focusAreas.includes('scenario'))
      sections.push(renderScenarios(analysis.scenarios));
    if (preference.focusAreas.includes('risk'))
      sections.push(renderRiskMatrix(analysis.quantifiedRisks));
  }
  
  if (preference.detailLevel === 'analyst') {
    // 仅 analyst 级别
    if (preference.focusAreas.includes('fundamental'))
      sections.push(renderFundamentals(analysis));
    if (preference.includeExpertDebate)
      sections.push(renderExpertDebate(discussion.messages));
    if (preference.includeBacktest)
      sections.push(renderBacktest(analysis.backtestResult));
  }
  
  if (preference.detailLevel === 'trader') {
    // trader 专属：实时价格距离%
    sections.push(renderPriceDistances(analysis));
  }
  
  return sections.join('\n\n---\n\n');
}
```

#### 5.3 飞书卡片适配

| 级别 | 卡片元素数 | 预估字符 | 适用场景 |
|------|-----------|---------|---------|
| executive | 3（摘要+交易+风险） | ~2000 | 晨会快速过会 |
| analyst | 8（全量） | ~12000 | 研究报告存档 |
| trader | 4（交易+价距+场景+止损） | ~3000 | 盘中实时查看 |

#### 5.4 存储位置

`useConfigStore` 新增 `reportPreference: ReportPreference` 字段，持久化到 localStorage。SettingsModal 新增"报告偏好"配置区。

---

### OPT-6：分析粒度分级

#### 6.1 三级分析定义

```typescript
// src/types.ts 新增
type AnalysisLevel = 'quick' | 'standard' | 'deep';

interface AnalysisConfig {
  level: AnalysisLevel;
  // quick:    仅 analysisService → StockInfo + Score + Summary
  // standard: analysisService → 完整 StockAnalysis（40+ 字段）
  // deep:     standard + discussionService（8 专家讨论 + 回测）
}
```

#### 6.2 级别对应的服务调用

| | Quick Scan | Standard | Deep Research |
|---|-----------|----------|---------------|
| **realtime data** | ✅ | ✅ | ✅ |
| **commodities** | ❌ | ✅ | ✅ |
| **history context** | ❌ | ✅（最近 1 次） | ✅（最近 3 次） |
| **prompt 复杂度** | 简化版（~50 行） | 完整版（~200 行） | 完整版 + 额外指令 |
| **专家讨论** | ❌ | ❌ | ✅（8 专家） |
| **回测** | ❌ | ❌ | ✅ |
| **保存历史** | ❌ | ✅ | ✅ |
| **预估 token** | ~500 | ~3000 | ~8000 |
| **预估延迟** | ~3s | ~15s | ~45s |
| **输出字段** | 8 个 | 40+ 个 | 40+ 个 + discussion |

#### 6.3 Quick Scan 专用 Prompt

```typescript
// src/services/prompts.ts 新增
export const getQuickScanPrompt = (symbol: string, market: Market, realtimeData: any) => `
你是一位资深金融分析师，对以下股票进行快速扫描评估。

实时数据：${JSON.stringify(realtimeData)}

请返回简洁的 JSON：
{
  "stockInfo": { "symbol": "${symbol}", "name": "...", "price": ..., "change": ..., "changePercent": ..., "market": "${market}", "currency": "...", "lastUpdated": "..." },
  "score": 0-100,
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "summary": "2-3 句核心判断",
  "keyRisks": ["风险1"],
  "keyOpportunities": ["机会1"]
}

要求：
1. 基于实时价格、涨跌幅、市场状态给出判断
2. 无需深度分析，仅做整体评估
3. Score 反映短期趋势强度
`;
```

#### 6.4 UI 集成

Header 搜索栏旁添加分级选择器：
```
[🔍 搜索] [⚡快扫 | 📊标准 | 🔬深研]
```

`useUIStore` 新增 `analysisLevel: AnalysisLevel` 字段（默认 `'standard'`）。

---

## 二、新增模块详细设计

### NEW-1：自选股监控仪表盘（Watchlist Dashboard）

#### 1.1 数据模型

```typescript
// src/types.ts 新增
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  addedAt: string;
  notes: string;                    // 用户备注
  alertThreshold: number;           // Score 变化超过此值时告警（默认 15）
  scoreHistory: ScoreSnapshot[];
  lastQuickScan?: QuickScanResult;
  alertHistory: WatchlistAlert[];
}

interface ScoreSnapshot {
  date: string;                     // "2026-04-01"
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

#### 1.2 Store

```typescript
// src/stores/useWatchlistStore.ts (~80行)
interface WatchlistState {
  items: WatchlistItem[];
  isScanning: boolean;
  lastScanTime: string | null;
  
  addItem: (symbol: string, name: string, market: Market) => void;
  removeItem: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  updateScore: (id: string, snapshot: ScoreSnapshot) => void;
  setLastQuickScan: (id: string, result: QuickScanResult) => void;
  addAlert: (id: string, alert: WatchlistAlert) => void;
  acknowledgeAlert: (id: string, alertId: string) => void;
}

// persist → localStorage 'watchlist-storage'
```

#### 1.3 自动扫描服务

```typescript
// src/services/watchlistService.ts (~100行)

/**
 * 对自选列表执行批量 Quick Scan
 * 串行执行（避免 Gemini API 限流）每只间隔 2 秒
 */
async function scanWatchlist(
  items: WatchlistItem[],
  config: GeminiConfig
): AsyncGenerator<{ itemId: string; result: QuickScanResult }> {
  for (const item of items) {
    const realtimeData = await fetchRealtimeData(item.symbol, item.market);
    const result = await quickScan(item.symbol, item.market, realtimeData, config);
    yield { itemId: item.id, result };
    await delay(2000);  // 限流保护
  }
}

/**
 * 检测 Score 异常变化并生成告警
 */
function detectAlerts(item: WatchlistItem, newScore: number): WatchlistAlert | null {
  const prevScore = item.scoreHistory[item.scoreHistory.length - 1]?.score;
  if (!prevScore) return null;
  
  const delta = newScore - prevScore;
  if (Math.abs(delta) >= item.alertThreshold) {
    return {
      id: crypto.randomUUID(),
      type: delta < 0 ? 'score_drop' : 'score_rise',
      message: `${item.name} Score ${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} 点（${prevScore} → ${newScore}）`,
      triggeredAt: new Date().toISOString(),
      acknowledged: false
    };
  }
  return null;
}
```

#### 1.4 UI 组件

```
src/components/dashboard/
  WatchlistPanel.tsx    (~300行)
  ├─ WatchlistHeader    — "自选股" 标题 + "批量扫描" 按钮 + "添加" 按钮
  ├─ WatchlistTable     — symbol/名称/Score(迷你折线图)/推荐/最后更新/操作
  ├─ ScoreSparkline     — Recharts 迷你折线图（7 日 Score 趋势）
  └─ AlertBadge         — 未确认告警数量徽章
```

**交互流**：
1. 用户搜索股票 → 分析结果页出现 `⭐ 加入自选` 按钮
2. 自选面板在 MarketOverview 下方展示（作为 tab 或独立区域）
3. 点击自选股 → 直接触发 Standard 分析
4. `批量扫描` → 逐只 Quick Scan → 实时更新 Score + 检测告警 → 飞书推送异常

#### 1.5 飞书告警推送

```typescript
// 告警推送到飞书（复用现有 feishu 通道）
const alertCard = {
  msg_type: "interactive",
  card: {
    header: { title: "⚠️ 自选股异常", template: "red" },
    elements: [
      { tag: "div", text: `**${item.name}** (${item.symbol})\nScore 急降 ${delta} 点\n当前评分: ${newScore}/100\n建议: 立即查看深度分析` }
    ]
  }
};
```

---

### NEW-2：行业轮动雷达（Sector Rotation Radar）

#### 2.1 数据模型

```typescript
// src/types.ts 新增
interface SectorRotation {
  sector: string;                   // "新能源"、"半导体"、"消费"
  capitalFlowTrend: 'inflow' | 'outflow' | 'neutral';
  flowMagnitude: number;            // 相对流入/出强度 (-100 ~ +100)
  clockQuadrant: 'recovery' | 'expansion' | 'overheating' | 'stagflation';
  momentum30d: number;              // 30 日涨幅 %
  topStocks: { symbol: string; name: string; score: number }[];
  updatedAt: string;
}

interface MarketCycle {
  currentPhase: 'recovery' | 'expansion' | 'overheating' | 'stagflation';
  phaseConfidence: number;          // 0-100
  recommendedSectors: string[];
  avoidSectors: string[];
  logic: string;
}
```

#### 2.2 数据来源

基于已有 `MarketOverview.sectorAnalysis` 的历史数据构建。每次成功获取 MarketOverview 时：
1. 提取 `sectorAnalysis` 数组
2. 与前一天的 sectorAnalysis 对比 → 计算趋势变化
3. 与 30 天历史对比 → 计算 `momentum30d` 和 `flowMagnitude`
4. 使用 Gemini Quick Prompt 判断美林时钟象限

**不新增外部 API 调用** — 完全基于已有 MarketOverview 历史数据。

#### 2.3 UI 组件

```
src/components/dashboard/
  SectorRadar.tsx       (~250行)
  ├─ CycleIndicator     — 美林时钟四象限图（当前位置高亮）
  ├─ SectorFlowTable    — 板块名/资金流向箭头/30d涨幅/推荐股
  └─ RotationArrow      — 资金从 A→B 板块流动的可视化箭头
```

集成位置：MarketOverview 组件内新增 tab "行业轮动"。

---

### NEW-3：策略回溯时间线（Strategy Timeline）

#### 3.1 数据来源

完全复用 `data/history/` 现有文件 + OPT-2 的 `BacktestTimeSeries`。

#### 3.2 UI 组件

```
src/components/analysis/
  StrategyTimeline.tsx  (~350行)
  ├─ TimelineChart      — Recharts ComposedChart
  │  ├─ Line: 实际价格走势（灰色）
  │  ├─ Scatter: 各次分析节点（颜色=推荐级别）
  │  ├─ ReferenceLine: 目标价（绿虚线）和止损价（红虚线）
  │  └─ Area: 置信区间（浅蓝填充）
  │
  ├─ TimelineDetail     — 点击节点展开详情
  │  ├─ Score + 推荐 + 目标/止损
  │  ├─ 争议点摘要
  │  └─ 回测结果标签（✅ Target Hit / ❌ Stop Loss Hit / ⏳ In Progress）
  │
  └─ ExpertAccuracy     — 各专家历史准确率堆叠柱状图
     ├─ 方向准确率
     └─ 目标命中率
```

#### 3.3 数据流

```
data/history/ → adminService.getPreviousStockAnalysis(symbol)
  → 筛选同 symbol 所有历史 → backtestService.buildBacktestTimeSeries()
  → 传入 <StrategyTimeline timeSeries={...} />
```

#### 3.4 集成位置

分析结果页（AnalysisResult 组件内），在 ScenarioPanel 和 AnalysisGrid 之间。仅当同一 symbol 有 ≥2 条历史分析时显示。

---

### NEW-4：多股比较分析（Comparative Analysis）

#### 4.1 数据模型

```typescript
// src/types.ts 新增
interface ComparisonResult {
  stocks: ComparisonStock[];
  sharedIndustry: string;
  verdict: string;                  // 首席策略师一句话排序结论
  generatedAt: string;
}

interface ComparisonStock {
  symbol: string;
  name: string;
  market: Market;
  quickScan: QuickScanResult;
  // 核心对比维度
  pe?: string;
  pb?: string;
  roe?: string;
  moatStrength?: 'Wide' | 'Narrow' | 'None';
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendation: string;
  score: number;
}
```

#### 4.2 服务

```typescript
// src/services/comparisonService.ts (~150行)

async function compareStocks(
  symbols: { symbol: string; market: Market }[],  // 2-3 只
  config: GeminiConfig
): Promise<ComparisonResult> {
  // 1. 并行 Quick Scan 所有股票
  const scans = await Promise.all(
    symbols.map(s => quickScanWithData(s.symbol, s.market, config))
  );
  
  // 2. 单次 Gemini 调用生成比较分析
  // Prompt 包含所有股票的 QuickScan 结果
  // 要求输出行业排序 + 核心差异
  const comparison = await generateComparison(scans, config);
  
  return comparison;
}
```

#### 4.3 UI

Header 搜索栏新增 `对比` 模式按钮。选中后支持输入 2-3 个 symbol，提交后展示对比表格 + 雷达图。

---

### NEW-5：决策日志与复盘系统（Decision Journal）

#### 5.1 数据模型

```typescript
// src/types.ts 新增
interface DecisionEntry {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  analysisId: string;               // 关联的 StockAnalysis ID
  
  // 决策信息
  action: 'buy' | 'hold' | 'sell' | 'add' | 'reduce' | 'watch';
  reasoning: string;                // 用户填写决策理由
  priceAtDecision: number;
  confidence: number;               // 用户自评置信度 0-100
  createdAt: string;
  
  // 自动回填（30 天后）
  reviewDate: string;               // createdAt + 30 天
  priceAtReview?: number;
  actualReturn?: number;            // %
  outcome?: 'correct' | 'incorrect' | 'neutral';
  
  // 用户复盘
  reflection?: string;              // 复盘心得
  lessonsLearned?: string[];
  biasDetected?: string;            // 系统检测到的行为偏差
}

interface DecisionStats {
  totalDecisions: number;
  correctRate: number;              // 正确决策占比
  avgConfidence: number;            // 平均用户自评置信度
  overconfidenceBias: number;       // 置信度 vs 实际正确率的差值
  mostCommonBias: string;           // 最常见行为偏差
  bestPerformingAction: string;     // 收益率最高的操作类型
  worstPerformingAction: string;
}
```

#### 5.2 Store

```typescript
// src/stores/useDecisionStore.ts (~80行)
interface DecisionState {
  entries: DecisionEntry[];
  stats: DecisionStats | null;
  
  addEntry: (entry: Omit<DecisionEntry, 'id' | 'createdAt' | 'reviewDate'>) => void;
  updateReview: (id: string, priceAtReview: number, reflection: string) => void;
  calculateStats: () => void;
  getPendingReviews: () => DecisionEntry[];  // 已到期未复盘的决策
}
// persist → localStorage 'decision-storage'
```

#### 5.3 行为偏差检测

```typescript
// src/services/biasDetector.ts (~100行)

const BIAS_PATTERNS = {
  overconfidence: {
    detect: (entries: DecisionEntry[]) => {
      const avgConf = avg(entries.map(e => e.confidence));
      const actualRate = entries.filter(e => e.outcome === 'correct').length / entries.length;
      return avgConf / 100 - actualRate > 0.2;  // 置信度比实际高 20%+
    },
    message: '过度自信偏差：你的自评置信度显著高于实际正确率。建议降低仓位。'
  },
  lossTolerance: {
    detect: (entries: DecisionEntry[]) => {
      // 检测"亏损时不止损"模式
      const losses = entries.filter(e => e.action === 'hold' && (e.actualReturn ?? 0) < -10);
      return losses.length >= 3;
    },
    message: '损失厌恶偏差：你在亏损超过 10% 时倾向于持有而非止损。'
  },
  recencyBias: {
    detect: (entries: DecisionEntry[]) => {
      // 检测"追涨"模式 — 在股价连续上涨后买入
      const buys = entries.filter(e => e.action === 'buy');
      const chasingCount = buys.filter(e => e.outcome === 'incorrect').length;
      return chasingCount / buys.length > 0.5;
    },
    message: '近因偏差：你倾向于在股价上涨后买入（追涨），这些决策的错误率较高。'
  }
};
```

#### 5.4 UI 集成

**入口 1**：分析结果页底部新增 `📝 记录决策` 按钮
- 点击弹出 Modal：操作类型选择 + 理由文本框 + 置信度滑块

**入口 2**：AdminPanel 新增 "决策日志" tab
- 展示所有决策条目（时间线形式）
- 到期未复盘的高亮提醒
- 底部统计卡：正确率、过度自信偏差、最常见错误

**入口 3**：飞书推送待复盘提醒
- 每日定时检查是否有到期决策 → 飞书推送提醒

---

## 三、实施优先级与路线图

### 融合后的完整路线图

```
=== Phase 1: 基础加固 (P1, 现有) ===
P1.1-P1.3  安全加固

=== Phase 2: 组件拆分 (P2, 现有) ===
P2.1-P2.11 组件 + Hooks 提取

=== Phase 3: 状态管理 (P3, 现有) ===
P3.1-P3.3  Store 拆分 + 性能优化

=== Phase 4: 服务层 (P4, 现有 + OPT 融合) ===
P4.1  讨论 Prompt 提取
P4.2  OPT-1 讨论编排重构（条件拓扑 + 并行化）      ← 融合
P4.3  请求去重
P4.4  server.ts 路由拆分
P4.5  OPT-3 数据源 Circuit Breaker                   ← 融合

=== Phase 5: 测试与文档 (P5, 现有) ===
P5.1-P5.3  组件测试 + 架构文档 + strict mode

=== Phase 6: 领域增强 (NEW) ===
P6.1  OPT-6 分析粒度分级（Quick/Standard/Deep）      ← 后续模块基础
P6.2  NEW-1 自选股监控仪表盘                          ← 用户粘性最高
P6.3  OPT-2 回测系统增强（时间序列 + 专家追踪）
P6.4  NEW-3 策略回溯时间线（依赖 OPT-2）
P6.5  NEW-5 决策日志与复盘系统

=== Phase 7: 高级功能 (后续) ===
P7.1  OPT-4 Prompt 版本管理
P7.2  OPT-5 报告个性化
P7.3  NEW-2 行业轮动雷达
P7.4  NEW-4 多股比较分析
```

### 优先级矩阵

| 模块 | 用户价值 | 实现复杂度 | 依赖前置 | 建议阶段 |
|------|---------|-----------|---------|---------|
| OPT-6 分析分级 | ★★★★★ | ★★☆ | P4 prompt 提取 | P6.1 |
| NEW-1 自选股 | ★★★★★ | ★★★ | OPT-6 Quick Scan | P6.2 |
| OPT-2 回测增强 | ★★★★☆ | ★★☆ | P4 server 拆分 | P6.3 |
| NEW-3 策略时间线 | ★★★★☆ | ★★☆ | OPT-2 | P6.4 |
| NEW-5 决策日志 | ★★★★☆ | ★★★ | P3 store 拆分 | P6.5 |
| OPT-1 讨论编排 | ★★★☆☆ | ★★★★ | P4 prompt 提取 | P4.2 |
| OPT-3 数据源韧性 | ★★★☆☆ | ★★☆ | P4 server 拆分 | P4.5 |
| OPT-4 Prompt 版本 | ★★☆☆☆ | ★★☆ | P4 prompt 提取 | P7.1 |
| OPT-5 报告个性化 | ★★★☆☆ | ★★☆ | P2 SettingsModal | P7.2 |
| NEW-2 行业轮动 | ★★★☆☆ | ★★★ | MarketOverview 历史 | P7.3 |
| NEW-4 多股对比 | ★★☆☆☆ | ★★★ | OPT-6 Quick Scan | P7.4 |

---

*细化设计完毕。所有模块均包含类型定义、服务层实现方案、UI 组件结构和集成点。*
