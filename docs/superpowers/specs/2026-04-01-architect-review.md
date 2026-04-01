# 架构师评审报告：渐进式重构设计文档

> 评审角色：顶级 AI 金融系统架构师 × 首席设计师
> 评审对象：`2026-04-01-incremental-refactor-design.md`
> 评审日期：2026-04-01
> 结论：**设计方向正确，存在 7 项关键缺陷需修正后方可实施**

---

## 一、总体评价

设计文档展现了对项目痛点的准确定位和合理的分阶段策略。但从金融系统工程的视角审视，文档在 **数据完整性验证、并发状态建模、错误隔离粒度** 三个维度存在架构级缺陷，且部分设计项与代码现状不符。

**评分：72/100** — 可执行的草案，非可交付的蓝图。

---

## 二、7 项关键缺陷

### 缺陷 #1：P1.1 API Key 环境变量方案不完整

**问题**：设计文档建议使用 `import.meta.env.VITE_GEMINI_API_KEY`（Vite 客户端环境变量）。但实际代码中 `geminiService.ts` 使用的是 `process.env.GEMINI_API_KEY`（Node.js 服务端变量），且 `getApiKey()` 被 `analysisService.ts`、`discussionService.ts`、`marketService.ts` 在**浏览器端**调用。

`import.meta.env.VITE_*` 仅在 Vite 构建时注入客户端 bundle，而 `process.env` 仅在 Node.js 端可用。当前代码在浏览器端使用 `process.env` 是依赖 Vite 的 `define` 替换机制，并非真正环境变量。

**修正方案**：
```
客户端调用链: SettingsModal 输入 → useConfigStore.config.apiKey → getApiKey() 读 store
服务端调用链: server.ts → dotenv 加载 → process.env.GEMINI_API_KEY
```
实际上所有 Gemini 调用均发生在浏览器端（前端直连 Gemini API），因此：
- 使用 `import.meta.env.VITE_GEMINI_API_KEY` 作为 fallback
- 移除 `process.env.GEMINI_API_KEY` 分支
- API Key 优先级：`useConfigStore 用户输入 > import.meta.env.VITE_GEMINI_API_KEY > 抛出错误`
- **绝不保留硬编码 fallback key**

---

### 缺陷 #2：P4.2 Prompt 提取方案与现状不符

**问题**：设计文档 §6.2 提出创建 `src/prompts/` 目录提取 prompt 文件。但代码库中 **`src/services/prompts.ts` 已经存在（750+ 行）**，已包含 `getMarketOverviewPrompt()`（112 行）和 `getAnalyzeStockPrompt()`（200+ 行）。

真正内联的 prompt 仅存在于 `discussionService.ts` 第 42-118 行（8 位专家团队指令）。

**修正方案**：
- 删除 P4.2 "创建 src/prompts/ 目录" — 已存在
- 改为：将 `discussionService.ts` 中内联的讨论 prompt 提取至 `src/services/prompts.ts` 新增 `getDiscussionPrompt()` 函数
- 工作量从"新建 3 个文件"降为"迁移 1 段 prompt"

---

### 缺陷 #3：P3.3 UIStore 枚举化方案无法建模并发状态

**问题**：设计文档将 15 个布尔替换为单一枚举 `AppActivity = 'idle' | 'analyzing' | 'chatting' | 'discussing' | 'reviewing' | 'reporting'`。

但实际代码存在并发状态组合：
```typescript
// src/App.tsx:1344 — 同时检查 isDiscussing AND isReviewing
{discussionMessages.length > 0 && !isDiscussing && !isReviewing && !analysis.finalConclusion && (
```

金融分析应用中，以下场景合法并发：
- `overviewLoading=true` + `isChatting=true`（后台刷新大盘 + 用户在聊天）
- `isDiscussing=true` + `isGeneratingReport=true`（AI 讨论同时生成报告）
- `loading=true`（主分析）与 `overviewLoading=true`（大盘刷新）完全独立

单一枚举无法建模这些状态。

**修正方案**：采用 **分组布尔 + 派生计算** 模式：
```typescript
interface UIState {
  // === 主活动（互斥）===
  analysisActivity: 'idle' | 'analyzing' | 'chatting' | 'discussing' | 'reviewing';
  
  // === 独立异步操作（可并发）===
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
  
  // === 派生 getter ===
  get isBusy(): boolean;  // analysisActivity !== 'idle' || overviewLoading || isGeneratingReport
}
```
总字段数从 17 → 15，但语义清晰度提升 3 倍。互斥状态用枚举，并发状态保留布尔。

---

### 缺陷 #4：Error Boundary 粒度不足

**问题**：设计文档仅在 App 根级放置**一个** ErrorBoundary。对于金融分析系统，如果 `ScenarioPanel` 中 ReactMarkdown 渲染崩溃（最常见的 crash 场景），整个页面白屏 — 包括用户正在查看的大盘概览和 Header。

**修正方案**：采用 **三层 Error Boundary** 策略：
```
Layer 1: App 根 — 捕获全局致命错误，显示"系统异常"
Layer 2: AnalysisResult 聚合层 — 捕获分析区域错误，不影响大盘/Header
Layer 3: 各 Markdown 渲染区 — 捕获单个卡片渲染错误，显示 fallback 文本
```

实现：共用同一个 `ErrorBoundary` 组件（参数化 `fallback` prop），在不同层级多次使用。

---

### 缺陷 #5：P2→P3 阶段顺序存在返工风险

**问题**：设计文档先 P2（组件拆分，用 props 传数据）再 P3（store 拆分）。这意味着：
1. P2 阶段所有子组件通过 props 接收数据
2. P3 拆分 store 后，App.tsx 传 props 的方式需要全改
3. 子组件改为直接 `useXxxStore()` 后，之前定义的 props interface 全部废弃

**返工量**：10 个组件 × 平均 8 个 props = 80 个 prop 定义 + 80 次传递需要删除。

**修正方案**：**调换 P2 和 P3 顺序**，或采用混合策略：
- **推荐**：P2 组件拆分时，子组件直接使用 store hooks（不走 props）
- 仅对纯展示组件（ErrorNotice、TokenUsage）使用 props
- 对业务组件（MarketOverview、ScenarioPanel、AnalysisGrid）直接在内部 `useXxxStore()`
- 这样 P3 拆分 store 时只需改 import 路径而非 prop 接口

---

### 缺陷 #6：P1.3 Zod Schema 工作量严重低估

**问题**：`StockAnalysis` 类型实际有 **40+ 字段**（含嵌套类型 `AgentDiscussion`、`TradingPlan`、`Scenario[]`、`SensitivityFactor[]` 等）。设计文档仅列出 3 个字段 + 注释 `// ... 核心字段校验`，未定义校验策略。

完整 Zod schema 将超过 300 行，且 Gemini API 返回的 JSON 结构不稳定（不同 prompt 可能返回不同字段集合）。全字段强校验会导致大量误报 parse error。

**修正方案**：采用 **宽松外壳 + 严格核心** 二层校验：
```typescript
// Layer 1: 宽松 — 确保是 object 且有基本结构
const RawResponseSchema = z.object({}).passthrough();

// Layer 2: 严格 — 仅校验影响 UI 渲染的关键字段
const CoreFieldsSchema = z.object({
  stockInfo: z.object({
    name: z.string(),
    symbol: z.string(),
    price: z.number(),
  }).passthrough(),
  summary: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  scenarios: z.array(z.object({
    name: z.string(),
    probability: z.number(),
    targetPrice: z.number(),
  }).passthrough()).optional(),
}).passthrough();

// 使用: safeParse + 降级（core 校验失败时仍显示原始数据 + 警告标记）
```

关键决策：**校验失败不阻断渲染**，而是在 UI 显示 `⚠️ 数据质量降级` 标记。金融数据宁可展示不完美数据，也不可拒绝展示。

---

### 缺陷 #7：缺失 Custom Hooks 提取层

**问题**：设计文档将所有业务逻辑 handlers 留在 App.tsx（预估 200+ 行 handlers）。参考项目 `D:\workspace\local_daily_ai` 使用了 `hooks/useStockAnalysis`、`hooks/useReports` 等自定义 hooks。当前设计缺失这一关键抽象层。

即使拆分组件 + 拆分 store，App.tsx 仍保留：
- `handleSearch()` — 60+ 行股票分析触发逻辑
- `handleChat()` — 30+ 行聊天逻辑
- `handleDiscussionQuestion()` — 40+ 行讨论触发逻辑
- `fetchMarketOverview()` — 30+ 行大盘获取逻辑
- `handleSendStockReport()` / `handleTriggerDailyReport()` — 各 40+ 行
- `handleExportFullReport()` — 20+ 行

这 250+ 行 handler 逻辑才是 App.tsx 的真正复杂度来源，不是 JSX 模板。

**修正方案**：在 P2 和 P3 之间增加 **P2.5：Custom Hooks 提取**：
```
src/hooks/
  useStockAnalysis.ts    ← handleSearch, handleChat, handleExportFullReport
  useDiscussion.ts       ← handleDiscussionQuestion, discussion 相关逻辑
  useMarketData.ts       ← fetchMarketOverview, auto-refresh 逻辑
  useReporting.ts        ← handleSendStockReport, handleTriggerDailyReport, sendReport
```

App.tsx 最终：
```tsx
function App() {
  const { handleSearch, handleChat } = useStockAnalysis();
  const { handleDiscussionQuestion } = useDiscussion();
  const { fetchMarketOverview } = useMarketData();
  const { handleSendReport, handleTriggerDaily } = useReporting();
  
  // ~150 行 JSX 编排
}
```
App.tsx 从 500 行 → **250 行**。

---

## 三、次要问题（5 项）

| # | 问题 | 影响 | 修正建议 |
|---|------|------|----------|
| M1 | 设计文档称 server.ts ~800 行，实际 ~1100 行 | 低估 P4.4 工作量 | 更新行数估算 |
| M2 | P4.4 路由拆分总和 680 行 < 实际 1100 行 | 遗漏 symbol resolution、commodity、health 路由 | 补充 `symbol.ts`（~250行，符号解析链） |
| M3 | P4.1 "移除 axios" — axios 仅在 `test-backend.ts` 使用 | 过度设计，非生产代码 | 降级为 nice-to-have |
| M4 | P5.3 "预计 20-30 处类型错误" — 实际可能 100-200+ | 时间估算失准 | 建议分批启用 strict 选项 |
| M5 | 缺少对 `discussionService.ts`（800+ 行）的重构考虑 | 最大 service 文件被忽视 | 纳入 P4 做函数拆分 |

---

## 四、优化后的路线图

```
P1   安全加固
 ├─ P1.1  API Key → .env + store fallback（修正：仅 VITE_ 前缀）
 ├─ P1.2  三层 Error Boundary（修正：非单一根级）
 └─ P1.3  Zod 宽松外壳+严格核心（修正：校验失败不阻断）

P2   组件拆分（修正：子组件直接用 store hooks）
 ├─ P2.1~P2.10  10 个组件提取（同原方案，但去掉 props drilling）
 └─ P2.11 Custom Hooks 提取（新增：4 个 hooks）

P3   状态管理优化（修正：并发状态建模）
 ├─ P3.1  拆分 useAnalysisStore → 3 stores
 ├─ P3.2  UIStore 分组布尔+派生 getter（修正：非单一枚举）
 └─ P3.3  React.memo / useMemo / useCallback

P4   服务层清理
 ├─ P4.1  讨论 prompt 提取至 prompts.ts（修正：非新建目录）
 ├─ P4.2  discussionService.ts 函数拆分（新增）
 ├─ P4.3  请求去重
 └─ P4.4  server.ts 路由拆分（修正：补充 symbol.ts）

P5   测试与文档
 ├─ P5.1  组件测试
 ├─ P5.2  架构文档
 └─ P5.3  TypeScript strict 分批启用（修正：先 strictNullChecks）
```

---

## 五、新增建议（超越原设计范围）

### 建议 A：金融数据新鲜度指示器

作为 AI 金融系统，数据时效性是核心质量维度。建议在 P2 组件拆分时，为 `MarketOverview` 和 `StockHeader` 添加：
```
🟢 实时 (< 5min)  |  🟡 延迟 (5-30min)  |  🔴 过时 (> 30min)
```
基于 `marketLastUpdatedTimes` 和 `stockInfo.lastUpdated` 计算。工作量极小，用户价值极高。

### 建议 B：Gemini 响应缓存

对同一 symbol 在短时间内（5 分钟）的重复分析请求，直接返回缓存结果。避免消耗 token 配额（当前最大用户痛点之一）。可用 `Map<string, { data: StockAnalysis; timestamp: number }>` 实现。

### 建议 C：关键操作 Undo

金融系统的 `resetToHome()` 会清空整个分析结果。建议在清空前将当前状态存入 `previousState`，支持 Ctrl+Z 恢复。成本极低，防误操作价值极高。

---

*评审完毕。修正以上 7 项关键缺陷后，设计文档可进入实施阶段。*
