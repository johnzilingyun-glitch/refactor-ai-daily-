# 渐进式重构设计文档

> 日期：2026-04-01
> 项目：每日股票智能分析 (local_daily_ai)
> 方案：方案 A — 渐进式重构
> 状态：待实施（已合并架构师评审 7 项关键修正）

---

## 1. 现状评估

### 1.1 架构评分

| 维度 | 得分 | 等级 | 说明 |
|------|------|------|------|
| 架构设计 | 5/10 | D+ | 单体组件，需拆分 |
| 类型安全 | 8/10 | B+ | 类型定义完善，但使用不严格 |
| 测试覆盖 | 4/10 | F | 仅有工具类测试，无 UI 组件测试 |
| 代码组织 | 4/10 | F | God component + God store 反模式 |
| 性能 | 6/10 | D | 无 memoization，大量不必要重渲染 |
| 错误处理 | 7/10 | C+ | 服务层良好，UI 层薄弱 |
| 文档 | 3/10 | F | 缺乏架构文档 |
| 可维护性 | 5/10 | D+ | 难以扩展，状态耦合严重 |
| 安全性 | 4/10 | F | API Key 硬编码，无 auth |
| **综合** | **5.2/10** | **D** | 功能完整的原型，非生产级 |

### 1.2 核心问题

1. **God Component**: `App.tsx` ~2500 行，包含全部 UI + 逻辑
2. **God Store**: `useAnalysisStore` 25+ 个字段
3. **安全隐患**: API Key 硬编码在 `geminiService.ts`
4. **无 Error Boundary**: 渲染错误导致白屏
5. **无 API 校验**: Gemini 返回 JSON 直接使用无 runtime 校验
6. **性能问题**: 缺少 useMemo/useCallback/React.memo
7. **HTTP 混用**: fetch() 与 axios 并存
8. **Prompt 硬编码**: 5000+ 字符 prompt 嵌入函数中
9. **server.ts 800 行**: 路由逻辑未拆分
10. **测试覆盖不足**: UI 组件几乎无测试

---

## 2. 重构路线图

### 总览

| 阶段 | 目标 | 风险 | 验收标准 |
|------|------|------|----------|
| **P1** | 安全加固 | 极低 | `npx vitest run` 全绿、.env 生效、三层 ErrorBoundary 工作 |
| **P2** | App.tsx 组件拆分 + Hooks 提取 | 低 | App.tsx ≤250 行、UI 无回归 |
| **P3** | 状态管理优化 | 中 | 3 个 store、并发状态正确建模 |
| **P4** | 服务层清理 | 低 | prompt 提取、请求去重、路由拆分 |
| **P5** | 测试与文档 | 极低 | 覆盖率 ≥60%、架构文档完成、strict mode |

### 关键原则

- 每阶段独立可验证、可回退
- 不修改任何业务逻辑或 UI 样式
- 每阶段完成后运行测试确保零回归
- 每阶段独立 git commit

---

## 3. P1：安全加固

### 3.1 移除硬编码 API Key

**背景**：所有 Gemini API 调用均发生在浏览器端（前端直连），`process.env` 在浏览器不可用，当前依赖 Vite `define` 替换机制。`.gitignore` 已包含 `.env*`。

**文件变更**:
- 创建 `.env`（含 `VITE_GEMINI_API_KEY=`）
- 创建 `.env.example`（含注释说明）
- 修改 `src/services/geminiService.ts`：
  - 移除硬编码 fallback key `AIzaSyA06MlY8alZiQQLVPvWw1iIWBty7mTP1hQ`
  - 移除 `process.env.GEMINI_API_KEY` 分支
  - 改为 `import.meta.env.VITE_GEMINI_API_KEY`（Vite 客户端环境变量）
  - 无 key 时抛出明确错误而非静默使用 fallback

**逻辑**:
```
API Key 优先级:
  1. useConfigStore.config.apiKey（SettingsModal 用户输入，运行时最高优先）
  2. import.meta.env.VITE_GEMINI_API_KEY（.env 文件，构建时注入）
  3. 无 key → 抛出错误，UI 显示「请在设置中配置 API Key」
```

**安全原则**：绝不在源码中保留任何硬编码 API Key。

### 3.2 三层 Error Boundary

**新文件**: `src/components/ErrorBoundary.tsx`

**功能**:
- 捕获子组件渲染错误
- 显示友好中文提示 + 重试按钮
- 样式使用 `premium-card` 类
- 接受 `fallback` prop 实现不同层级不同 UI
- 错误信息在 production 隐藏堆栈

**三层隔离策略**（共用同一个 ErrorBoundary 组件，参数化 fallback）:
```
Layer 1: App 根级
  └─ 捕获全局致命错误 → 显示「系统异常，请刷新页面」
Layer 2: AnalysisResult 聚合层
  └─ 捕获分析区域错误 → 不影响 Header / MarketOverview / TokenUsage
Layer 3: 各 ReactMarkdown 渲染区（ScenarioPanel、AnalysisGrid）
  └─ 捕获单卡片渲染错误 → 显示「内容渲染失败」+ 原始文本 fallback
```

**金融系统原则**：ScenarioPanel 崩溃不应导致大盘概览和 Header 不可用。

### 3.3 Zod Schema 校验（宽松外壳 + 严格核心）

**新依赖**: `zod`

**新文件**: `src/schemas/stockAnalysis.ts`

**背景**：`StockAnalysis` 类型含 40+ 字段（含嵌套 `AgentDiscussion`、`TradingPlan`、`Scenario[]` 等）。Gemini API 返回 JSON 结构不稳定，全字段强校验会导致大量误报 parse error。

**二层校验策略**:
```typescript
// Layer 1: 宽松 — 确保返回值是 object
const RawResponseSchema = z.object({}).passthrough();

// Layer 2: 严格 — 仅校验影响 UI 渲染和金融决策的关键字段
const CoreFieldsSchema = z.object({
  stockInfo: z.object({
    name: z.string(),
    symbol: z.string(),
    price: z.number(),
    market: z.enum(["A-Share", "HK-Share", "US-Share"]),
  }).passthrough().optional(),
  summary: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  scenarios: z.array(z.object({
    name: z.string(),
    probability: z.number(),
    targetPrice: z.number(),
  }).passthrough()).optional(),
}).passthrough();
```

**关键决策：校验失败不阻断渲染**：
- Core 校验通过 → 正常展示
- Core 校验失败 → 仍展示原始数据 + UI 显示 `⚠️ 数据质量降级` 标记
- Raw 校验失败（非 object）→ 拒绝并报错

**金融系统原则**：宁可展示不完美数据，也不可拒绝展示。数据缺失用降级标记提醒用户。

**集成点**: `geminiService.ts` 的 `safeParseJSON` 之后增加 `.safeParse()`，结果附带 `dataQualityFlag`

---

## 4. P2：App.tsx 组件拆分

### 4.1 目标文件结构

```
src/components/
  layout/
    Header.tsx           (~180 行)
    ErrorNotice.tsx       (~30 行)
  dashboard/
    TokenUsage.tsx        (~80 行)
    MarketOverview.tsx    (~400 行)
  analysis/
    StockHeader.tsx       (~120 行)
    AnalysisGrid.tsx      (~200 行)
    ScenarioPanel.tsx     (~300 行)
    AnalysisResult.tsx    (~150 行，聚合层)
  admin/
    AdminPanel.tsx        (~120 行)
  shared/
    DetailModal.tsx       (~150 行)
  ErrorBoundary.tsx       (P1 已创建)
```

### 4.2 提取规则

1. **纯提取**：不改逻辑，保持原有行为
2. **分类策略**：
   - 纯展示组件（ErrorNotice、TokenUsage）→ 通过 **props** 接收数据
   - 业务组件（MarketOverview、ScenarioPanel、AnalysisGrid 等）→ 组件内部直接 **useXxxStore()** 读取状态
   - 这样 P3 拆分 store 时只需改 import 路径，不需废弃 prop 接口
3. **逐个提取**：一次一个组件，每次跑测试
4. **提取顺序**（从简单到复杂）：
   - ① ErrorNotice（~30行，无依赖）
   - ② TokenUsage（~80行，仅接收 tokenUsage prop）
   - ③ Header（~180行，搜索 + 按钮 + 事件回调）
   - ④ MarketOverview（~400行，最大块，包含指数/板块/新闻）
   - ⑤ StockHeader（~120行，股票信息头）
   - ⑥ ScenarioPanel（~300行，场景分析 + 交易计划）
   - ⑦ AnalysisGrid（~200行，维度分析表格）
   - ⑧ AnalysisResult（~150行，聚合 ⑤⑥⑦）
   - ⑨ AdminPanel（~120行，日志 + 历史）
   - ⑩ DetailModal（~150行，弹窗详情）

### 4.3 P2.11：Custom Hooks 提取（新增）

250+ 行 handler 逻辑才是 App.tsx 的真正复杂度来源，而非 JSX 模板。

**目标文件结构**：
```
src/hooks/
  useStockAnalysis.ts    ← handleSearch, handleChat, handleExportFullReport
  useDiscussion.ts       ← handleDiscussionQuestion, discussion 相关逻辑
  useMarketData.ts       ← fetchMarketOverview, auto-refresh 逻辑
  useReporting.ts        ← handleSendStockReport, handleTriggerDailyReport, sendReport
```

### 4.4 App.tsx 最终结构 (~250行)

```tsx
export default function App() {
  // Custom hooks (~20行)
  const { handleSearch, handleChat, handleExportFullReport } = useStockAnalysis();
  const { handleDiscussionQuestion } = useDiscussion();
  const { fetchMarketOverview } = useMarketData();
  const { handleSendReport, handleTriggerDaily } = useReporting();
  
  // Store selectors (~20行)
  const tokenUsage = useConfigStore(s => s.tokenUsage);
  const { loading, showDiscussion, showAdminPanel, isSettingsOpen } = useUIStore();
  const analysis = useAnalysisStore(s => s.analysis);
  
  // Render (~200行)
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 ...">
        <Header />
        <TokenUsage tokenUsage={tokenUsage} />
        
        <ErrorBoundary fallback="分析数据加载异常">
          <AnimatePresence mode="wait">
            {analysis ? <AnalysisResult /> : <MarketOverview />}
          </AnimatePresence>
        </ErrorBoundary>
        
        <SettingsModal />
        {showAdminPanel && <AdminPanel />}
        
        <AnimatePresence>
          {showDiscussion && <DiscussionPanel />}
        </AnimatePresence>
        
        <DetailModal />
      </div>
    </ErrorBoundary>
  );
}
```

App.tsx 从 2500 → **~250 行**（比原方案 500 行再减 50%）。

---

## 5. P3：状态管理优化

### 5.1 Store 拆分

**useAnalysisStore** (保留，精简):
```typescript
interface AnalysisState {
  symbol: string;
  market: Market;
  analysis: StockAnalysis | null;
  chatMessage: string;
  chatHistory: ChatMessage[];
  // actions
  setSymbol, setMarket, setAnalysis, setChatMessage, setChatHistory, resetAnalysis
}
```

**useDiscussionStore** (新建):
```typescript
interface DiscussionState {
  discussionMessages: AgentMessage[];
  controversialPoints: string[];
  tradingPlanHistory: TradingPlanVersion[];
  analystWeights: AnalystWeight[] | null;
  // actions
  setDiscussionMessages, setControversialPoints, setTradingPlanHistory, setAnalystWeights
  setDiscussionResults // 复合 setter
  resetDiscussion
}
```

**useScenarioStore** (新建):
```typescript
interface ScenarioState {
  scenarios: Scenario[];
  sensitivityFactors: SensitivityFactor[];
  expectationGap: ExpectationGap | null;
  calculations: CalculationResult[];
  stressTestLogic: string | null;
  catalystList: Catalyst[];
  verificationMetrics: VerificationMetric[];
  capitalFlow: CapitalFlow | null;
  positionManagement: PositionManagement | null;
  timeDimension: TimeDimension | null;
  dataFreshnessStatus: string | null;
  backtestResult: BacktestResult | null;
  // actions
  setScenarios, ... resetScenario
}
```

### 5.2 性能优化

| 组件 | 优化方式 | 预期影响 |
|------|---------|----------|
| Header | `React.memo()` | 避免分析结果变化时重渲染 |
| TokenUsage | `React.memo()` | 仅 tokenUsage 变化时更新 |
| MarketOverview | `React.memo()` | 独立于分析状态 |
| ScenarioPanel | `useMemo()` 包裹场景计算 | 减少子项重计算 |
| AnalysisGrid | `React.memo()` | 分析数据不变时跳过 |
| App handlers | `useCallback()` 全部包裹 | 减少子组件 re-render |

### 5.3 useUIStore 优化（分组布尔 + 互斥枚举）

**背景**：应用存在合法并发状态（如 `overviewLoading=true` + `isChatting=true`），单一枚举无法建模。

```typescript
// Before: 17 个平坦布尔
loading, isChatting, isDiscussing, isReviewing, isGeneratingReport, isSendingReport, ...

// After: 分组布尔 + 互斥枚举 + 派生 getter
interface UIState {
  // === 主活动（互斥）===
  analysisActivity: 'idle' | 'analyzing' | 'chatting' | 'discussing' | 'reviewing';
  
  // === 独立异步操作（可与主活动并发）===
  overviewLoading: boolean;
  isGeneratingReport: boolean;
  isSendingReport: boolean;
  isTriggeringReport: boolean;
  
  // === UI 面板状态 ===
  isSettingsOpen: boolean;
  showDiscussion: boolean;
  showAdminPanel: boolean;
  selectedDetail: { type: 'log' | 'history'; data: any } | null;
  
  // === 错误状态 ===
  analysisError: string | null;
  chatError: string | null;
  overviewError: string | null;
  reportStatus: 'idle' | 'success' | 'error';
  
  // === 配置 ===
  autoRefreshInterval: number;
}

// 派生便捷方法（在组件中使用）
const isBusy = useUIStore(s => 
  s.analysisActivity !== 'idle' || s.overviewLoading || s.isGeneratingReport
);
const loading = useUIStore(s => s.analysisActivity === 'analyzing');
```

总字段数 17 → 15，互斥状态用枚举，并发状态保留布尔。

---

## 6. P4：服务层清理

### 6.1 统一 HTTP 客户端

**背景**：`axios` 仅在 `test-backend.ts`（测试文件）使用，生产代码均使用 `fetch`。此项降级为 nice-to-have。

**可选操作**：将 `test-backend.ts` 中 axios 替换为 fetch，然后卸载 axios。

### 6.2 讨论 Prompt 提取

**背景**：`src/services/prompts.ts` **已存在（750+ 行）**，已包含 `getMarketOverviewPrompt()`、`getAnalyzeStockPrompt()`。仅 `discussionService.ts` 第 42-118 行的 8 位专家团队指令为内联 prompt。

**变更**：
- 在 `src/services/prompts.ts` 新增 `getDiscussionPrompt()` 函数
- `discussionService.ts` 第 42-118 行内联 prompt 替换为 `import { getDiscussionPrompt } from './prompts'`
- **不创建新目录** `src/prompts/`（已有 `src/services/prompts.ts` 即可）

### 6.3 discussionService.ts 函数拆分（新增）

**背景**：`discussionService.ts` 是最大的 service 文件（800+ 行），包含专家讨论、芯片解析、交易计划、回测等混合逻辑。

**拆分策略**：保持单文件，但拆分内部函数为明确职责区块：
- 专家讨论触发与编排
- 响应解析与结构化
- 回测集成

### 6.4 请求去重

**新文件**: `src/services/requestDedup.ts`

```typescript
const pending = new Map<string, Promise<any>>();
export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const promise = fn().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
```

### 6.5 server.ts 路由拆分

**背景**：server.ts 实际 ~1100 行（含复杂的 symbol 解析链：Direct → EastMoney(new) → EastMoney(old) → Sina）。

```
server/
  routes/
    stock.ts     (~300行，股票实时数据)
    symbol.ts    (~250行，符号解析链 + 市场验证，新增)
    indices.ts   (~100行，指数 + 商品期货)
    history.ts   (~100行，历史记录 CRUD)
    feishu.ts    (~80行，飞书推送)
  index.ts       (原 server.ts，~200行，Express 启动 + 中间件 + SPA serving)
```

---

## 7. P5：测试与文档

### 7.1 组件测试计划

| 测试文件 | 覆盖内容 | 断言要点 |
|---------|---------|---------|
| `Header.test.tsx` | 搜索表单提交、市场切换、按钮点击 | onSearch 被调用、symbol 正确传递 |
| `TokenUsage.test.tsx` | 数字格式化、进度条宽度 | 显示正确的 toLocaleString() |
| `MarketOverview.test.tsx` | 加载态、市场tab切换、空数据 | 骨架屏显示、切换触发回调 |
| `AnalysisResult.test.tsx` | 条件渲染（有/无交易计划） | 各子组件渲染条件正确 |
| `ErrorBoundary.test.tsx` | 子组件抛错后捕获 | 显示重试按钮、不白屏 |
| `ScenarioPanel.test.tsx` | Bull/Base/Stress 三卡片渲染 | 概率、目标价正确显示 |

### 7.2 架构文档

**新文件**: `docs/architecture.md`

内容：
- 系统架构图（Mermaid）
- 组件关系与数据流
- Store 职责划分
- Service 层 API 调用图
- 8 位 AI 专家角色定义
- 部署与开发指南

### 7.3 TypeScript Strict Mode（分批启用）

**背景**：当前 tsconfig.json 无任何 strict 选项。一次性启用 `strict: true` 预计产生 100-200+ 处类型错误（App.tsx 2500 行 + 18 个 service + 40+ 字段 types.ts）。

**分批策略**：
```json
// 第一批（P5.3a）
{ "compilerOptions": { "strictNullChecks": true } }
// 修复所有 null check 错误后...

// 第二批（P5.3b）
{ "compilerOptions": { "strictNullChecks": true, "noImplicitAny": true } }
// 修复所有 implicit any 后...

// 第三批（P5.3c）
{ "compilerOptions": { "strict": true } }
```

每批独立 commit，避免一次性 100+ 错误阻塞进度。

---

## 8. 实施顺序总结

```
P1.1 移除硬编码 API Key          → git commit
P1.2 添加三层 Error Boundary    → git commit
P1.3 Zod Schema 校验             → git commit
  ↓ vitest 全绿 ✓
P2.1  提取 ErrorNotice           → git commit
P2.2  提取 TokenUsage            → git commit
P2.3  提取 Header                → git commit
P2.4  提取 MarketOverview        → git commit
P2.5  提取 StockHeader           → git commit
P2.6  提取 ScenarioPanel         → git commit
P2.7  提取 AnalysisGrid          → git commit
P2.8  提取 AnalysisResult 聚合   → git commit
P2.9  提取 AdminPanel            → git commit
P2.10 提取 DetailModal           → git commit
P2.11 提取 Custom Hooks (4个)    → git commit
  ↓ vitest 全绿 ✓
P3.1 拆分 useAnalysisStore       → git commit
P3.2 优化 useUIStore             → git commit
P3.3 添加 React.memo/useMemo     → git commit
  ↓ vitest 全绿 ✓
P4.1 提取讨论 Prompt            → git commit
P4.2 discussionService 拆分    → git commit
P4.3 请求去重                    → git commit
P4.4 server.ts 路由拆分        → git commit
  ↓ vitest 全绿 ✓
P5.1 组件测试                    → git commit
P5.2 架构文档                    → git commit
P5.3a strictNullChecks          → git commit
P5.3b noImplicitAny             → git commit
P5.3c strict: true              → git commit
  ↓ vitest 全绿 ✓ DONE
```

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| P2 拆分时 store hook 调用不正确 | 运行时错误 | 每步 TypeScript 编译检查 |
| P3 store 拆分状态不一致 | 数据不同步 | 统一 resetAll() + 集成测试 |
| P4 discussionService 拆分引入 bug | 讨论功能异常 | 先加测试再重构 |
| P5 strict mode 类型错误太多 | 阻塞进度 | 分批启用（strictNullChecks → noImplicitAny → strict） |
| Zod 校验过严导致大量数据被拒 | 用户体验降级 | 宽松外壳 + 核心校验，失败不阻断渲染 |

---

## 10. 新增建议（超越原设计范围）

### 10.1 金融数据新鲜度指示器

在 `MarketOverview` 和 `StockHeader` 添加数据时效标记：
```
🟢 实时 (< 5min)  |  🟡 延迟 (5-30min)  |  🔴 过时 (> 30min)
```
基于 `marketLastUpdatedTimes` 和 `stockInfo.lastUpdated` 计算。工作量极小，用户价值极高。

### 10.2 Gemini 响应缓存

对同一 symbol 在短时间内（5 分钟）的重复分析请求，直接返回缓存结果。避免消耗 token 配额（当前最大用户痛点之一）。
```typescript
const analysisCache = new Map<string, { data: StockAnalysis; timestamp: number }>();
```

### 10.3 关键操作 Undo

`resetToHome()` 会清空整个分析结果。建议在清空前将当前状态存入 `previousState`，支持 Ctrl+Z 恢复。成本极低，防误操作价值极高。

---

---

## 11. 领域架构分析：AI 金融分析系统视角

> 以下分析超越代码结构层面，从顶级股票分析系统架构设计角度审视当前系统的核心能力、领域缺陷和增长空间。

### 11.1 系统定位与核心竞争力

**定位**：机构级多智能体 AI 股票分析平台 — 5 层推理引擎

```
Layer 1: 数据采集层   — Yahoo Finance + EastMoney + Sina（三级 fallback）
Layer 2: 分析生成层   — Gemini AI 个股分析（40+ 字段输出）
Layer 3: 多智能体辩论 — 8 位专家顺序讨论 + 交叉验证
Layer 4: 决策合成层   — 概率加权估值 + 风险调整 + 交易执行计划
Layer 5: 回测闭环层   — 历史决策回溯 + 准确率评分 + 学习注入
```

**核心竞争壁垒**：
1. **8 位专家辩论机制**：非单一 AI 观点，而是结构化对抗（深研 vs 逆向策略师,基本面 vs 风险经理）
2. **量化风险框架**：概率 × 影响 × 时效，非定性描述
3. **回测闭环**：前次分析 → 当前验证 → 准确率评分 → 注入下轮决策
4. **动态行业锚定**：不使用通用大宗商品，Google Search 获取行业特定核心变量

### 11.2 已解决的核心问题

| # | 问题 | 解决方案 | 评价 |
|---|------|---------|------|
| 1 | AI 分析可能产生幻觉数据 | 数据源三级优先级（API > Search > 估算）+ DataQuality 评分 | ★★★★☆ |
| 2 | 单一 AI 视角偏颇 | 8 位专家顺序辩论 + 逆向策略师显式挑战 | ★★★★★ |
| 3 | 交易建议缺乏量化 | P(概率) × ΔPrice 期望值框架 + 分层建仓 | ★★★★☆ |
| 4 | 过往决策无追踪 | backtestService 回测 + 5 档准确率评分 | ★★★☆☆ |
| 5 | 商品数据与个股关联弱 | 动态行业锚定（prompts.ts：行业特定变量 via Google Search） | ★★★★☆ |
| 6 | 多市场数据格式不一致 | 统一 StockInfo 接口 + 市场特定后缀映射 | ★★★☆☆ |

### 11.3 领域级可优化模块（6 项）

#### OPT-1：专家讨论编排 — 从顺序到条件拓扑

**现状**：8 位专家严格顺序执行，每次讨论固定 8 轮。
**问题**：
- 逆向策略师（#6）必须等待前 5 位发言完毕，即使其分析不依赖技术面
- 风险经理（#5）和逆向策略师（#6）输入高度重叠，可并行
- 低波动蓝筹股不需要深研专家的全量行业锚定扫描

**优化方案：条件拓扑编排**
```
                    ┌── 技术分析师 (#2) ──┐
深研专家 (#1) ──────┤                     ├── 风险经理 (#5)
                    └── 基本面分析师 (#3)──┘       │
                           │                       │
                    情绪分析师 (#4)          逆向策略师 (#6)（并行）
                           │                       │
                           └───── 专业评审 (#7) ────┘
                                      │
                                首席策略师 (#8)
```
- **并行化**：#2/#3 可并行，#5/#6 可并行 → 延迟从 8 轮 → ~5 轮
- **条件跳过**：对 ETF/指数基金跳过 #1 深研和 #3 基本面（节省 ~40% token）
- **实现**：P4.2 `discussionService` 拆分时顺带实现

#### OPT-2：回测系统 — 从单次比对到时间序列跟踪

**现状**：仅比较最近一次历史分析的目标价/止损价与当前价格。
**问题**：
- 无法观察"连续 3 次看多但股价持续下跌"的系统性偏差
- 准确率评分 (0-100) 仅基于方向+目标达成，无时间衰减
- 不追踪各专家角色的历史准确率

**优化方案**：
```typescript
// 新增：专家历史表现追踪
interface ExpertTrackRecord {
  role: AgentRole;
  totalCalls: number;
  directionAccuracy: number;    // 方向正确率
  targetHitRate: number;        // 目标价命中率
  avgOvershoot: number;         // 平均过度乐观/悲观程度
  bestPerformingSector: string; // 该专家最擅长的行业
}

// 新增：分析师权重动态调整
// 基于历史表现自动调整 analystWeights，降低持续犯错专家的权重
```

#### OPT-3：数据源韧性 — 从 fallback 到健康度监控

**现状**：symbol resolution 有三级 fallback（EastMoney → Old EM → Sina），但：
- 失败时静默降级，用户不知道数据来源质量
- 无 API 健康度监控 — 某源连续失败仍重复尝试
- Yahoo Finance 限流时无备用数据源

**优化方案**：
```typescript
interface DataSourceHealth {
  source: 'eastmoney' | 'sina' | 'yahoo';
  status: 'healthy' | 'degraded' | 'down';
  successRate: number;        // 过去 1 小时成功率
  avgLatency: number;         // 平均响应时间
  lastFailure: Date | null;
  consecutiveFailures: number;
}

// Circuit Breaker: 连续失败 3 次 → 标记 down → 5 分钟后重试
// UI 层展示当前数据源状态
```

#### OPT-4：Prompt 版本管理

**现状**：`prompts.ts` 750+ 行，`discussionService.ts` 内联 prompt ~80 行。修改 prompt 无版本追踪、无 A/B 测试能力。

**问题**：prompt 是 AI 金融系统的"核心算法"，其变更影响等同于模型变更。当前：
- 无法回退到前一版 prompt
- 无法对比两版 prompt 的分析质量
- optimization_log.json 手工记录，无结构化关联

**优化方案**：
```typescript
// src/services/promptRegistry.ts
interface PromptVersion {
  id: string;                    // "analysis-v3.2"
  template: (...args) => string;
  changelog: string;
  createdAt: string;
  metrics?: {                    // 运行后自动采集
    avgScore: number;            // 产出分析的平均评分
    avgTokenUsage: number;
    userSatisfaction?: number;
  };
}

// 启用 A/B：随机选择 prompt 版本 → 对比 score 分布
```

#### OPT-5：报告个性化 — 从固定模板到用户偏好

**现状**：飞书报告使用固定 Feishu Card 模板，所有用户看到相同内容。

**优化方案**：
```typescript
interface ReportPreference {
  detailLevel: 'executive' | 'analyst' | 'trader';
  // executive: 仅决策摘要 + 交易计划（1 屏信息）
  // analyst:   完整分析 + 专家讨论 + 风险矩阵
  // trader:    仅交易计划 + 入场/止损/目标 + 实时价格距离%
  
  focusAreas: ('fundamental' | 'technical' | 'risk' | 'sentiment')[];
  language: 'zh-CN' | 'en';
  includeBacktest: boolean;
}
```

#### OPT-6：分析粒度分级 — 快速扫描 vs 深度研究

**现状**：每次分析均执行全量 prompt（200+ 行指令），无论是"随便看看"还是"重仓决策"。

**优化方案**：
```
快速扫描（Quick Scan）     — 仅 StockInfo + Score + 1 段 Summary
                           — Token 消耗 ~500，延迟 ~3 秒
                           — 适用场景：筛选自选股、快速排除

标准分析（Standard）       — 当前默认行为（40+ 字段）
                           — Token 消耗 ~3000，延迟 ~15 秒

深度研究（Deep Research）  — 标准 + 8 专家讨论 + 回测
                           — Token 消耗 ~8000，延迟 ~45 秒
                           — 适用场景：重仓决策前的最终确認
```
用户在 Header 搜索时选择分析级别。Quick Scan 不触发讨论服务。

---

### 11.4 领域级可新增模块（5 项）

#### NEW-1：自选股监控仪表盘（Watchlist Dashboard）

**价值**：当前系统是"搜索-分析"单次交互模式，用户无法持续跟踪关注个股。

**功能**：
- 用户添加 5-20 只自选股
- 每日自动执行 Quick Scan → 显示 Score 变化趋势（折线图）
- Score 异常波动时推送飞书提醒（如 70→45 下跌 >15 点）
- 点击进入深度分析

**数据模型**：
```typescript
interface WatchlistItem {
  symbol: string;
  market: Market;
  addedAt: string;
  scoreHistory: { date: string; score: number }[];
  lastAlert: string | null;
  notes: string;               // 用户自定义备注
}
```

**实施优先级**：★★★★★（用户粘性最高的功能）

#### NEW-2：行业轮动雷达（Sector Rotation Radar）

**价值**：当前 `MarketOverview` 提供板块分析，但缺乏系统性的行业轮动视角。

**功能**：
- 基于 MarketOverview 历史数据，追踪各板块 30 日资金流向趋势
- 美林时钟象限定位（衰退/复苏/过热/滞涨 → 推荐行业）
- 资金从 A 板块流出 → B 板块流入的动态箭头
- 与 Quick Scan 联动：推荐轮动目标板块中的高分个股

**数据模型**：
```typescript
interface SectorRotation {
  sector: string;
  capitalFlowTrend: 'inflow' | 'outflow' | 'neutral';
  flowMagnitude: number;        // 资金流入/出量级
  clockQuadrant: 'recovery' | 'expansion' | 'overheating' | 'stagflation';
  topStocks: { symbol: string; score: number }[];
}
```

#### NEW-3：策略回溯时间线（Strategy Timeline）

**价值**：当前回测仅比较"上次分析 vs 当前"。缺乏时间线视角。

**功能**：
- 将同一 symbol 的所有历史分析排列为时间线
- 每个节点显示：Score、推荐、目标价、实际价格走势
- 可视化 8 位专家的争议点变化（如"3 次讨论中风险经理连续警告XX"）
- 误判原因自动标注（"技术分析师 3 次误判支撑位"）

**UI**：Recharts 时间线 + 叠加实际价格走势图

#### NEW-4：多股比较分析（Comparative Analysis）

**价值**：机构分析师常需对同行业 2-3 只股票做横向对比。当前仅支持单股分析。

**功能**：
- 选择 2-3 只同行业股票
- 并行执行 Quick Scan
- 生成对比表：估值（PE/PB/ROE）、Score、护城河宽度、风险评级
- 8 位专家仅需执行 1 轮（共享行业背景），降低 token 消耗
- 输出"行业内推荐排序"

#### NEW-5：决策日志与复盘系统（Decision Journal）

**价值**：投资决策的核心是"做了什么决策 + 基于什么理由 + 结果如何"。当前系统有分析、有历史，但缺乏决策追踪。

**功能**：
- 用户在分析后标记"操作意向"（买入/观望/卖出/加仓/减仓）
- 记录操作意向、操作理由（可关联 AI 分析 ID）
- 30 天后自动评估决策质量（操作意向 vs 实际价格变化）
- 积累个人投资决策数据 → 发现行为偏差（如"持续忽视风险警告"）

**数据模型**：
```typescript
interface DecisionEntry {
  id: string;
  symbol: string;
  analysisId: string;            // 关联的分析 ID
  action: 'buy' | 'hold' | 'sell' | 'add' | 'reduce' | 'watch';
  reasoning: string;             // 用户填写
  priceAtDecision: number;
  createdAt: string;
  reviewAt: string;              // +30 天
  priceAtReview?: number;
  outcome?: 'correct' | 'incorrect' | 'neutral';
  reflection?: string;           // 复盘心得
}
```

**实施优先级**：★★★★☆（形成"分析→决策→复盘"闭环）

---

### 11.5 领域架构目标评分（重构后）

| 维度 | 当前 | 目标 | 关键变化 |
|------|------|------|---------|
| 分析深度 | 8/10 | 9/10 | 分析分级 + 行业锚定增强 |
| 决策支持 | 7/10 | 9/10 | 自选股监控 + 多股对比 + 决策日志 |
| 回测闭环 | 5/10 | 8/10 | 时间序列跟踪 + 专家准确率追踪 |
| 数据韧性 | 6/10 | 8/10 | Circuit Breaker + 健康度监控 |
| 讨论效率 | 6/10 | 8/10 | 条件拓扑编排 + ETF 跳过优化 |
| Prompt 治理 | 3/10 | 7/10 | 版本注册 + A/B 测试 |
| 用户粘性 | 4/10 | 8/10 | 自选股 + 决策日志 + 行业轮动 |

---

*文档结束。已合并架构师代码评审 7 项关键修正 + 领域架构分析 6 项优化 + 5 项新增模块。*

*领域模块详细设计请参阅：[2026-04-01-domain-modules-detail.md](./2026-04-01-domain-modules-detail.md)*

*可进入实施阶段。*
