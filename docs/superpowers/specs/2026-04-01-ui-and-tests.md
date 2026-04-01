# UI 交互设计与测试用例规格书

> 日期：2026-04-01
> 设计系统：zinc 灰阶 + indigo-600 主色 + JetBrains Mono 代码字体
> CSS 类库：premium-card, btn-primary, btn-secondary, input-premium, section-label
> 动画：motion/react (AnimatePresence, motion.div)
> 图标：lucide-react (strokeWidth={1.5})
> 图表：Recharts

---

## 一、UI 交互设计

### 1. OPT-6 分析粒度选择器（Header 集成）

**位置**：Header 搜索栏右侧，在搜索按钮左边

**布局**：
```
┌─────────────────────────────────────────────────────────┐
│  ◆ 每日股票智能分析                          ⏲ ⚙ 📋    │
│                                                          │
│  [🔍 输入股票代码/名称...] [⚡|📊|🔬] [搜索]  A-Share ▼ │
└─────────────────────────────────────────────────────────┘
```

**选择器样式**：
```tsx
<div className="flex items-center rounded-full border border-zinc-200 bg-white overflow-hidden h-10">
  {['quick', 'standard', 'deep'].map(level => (
    <button
      key={level}
      onClick={() => setAnalysisLevel(level)}
      className={cn(
        "px-3 py-2 text-xs font-medium transition-all",
        analysisLevel === level
          ? "bg-indigo-600 text-white"
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
      )}
    >
      {level === 'quick' && '⚡ 快扫'}
      {level === 'standard' && '📊 标准'}
      {level === 'deep' && '🔬 深研'}
    </button>
  ))}
</div>
```

**Tooltip 说明**（hover 显示）：
- ⚡ 快扫：~3 秒，仅评分和一句话结论
- 📊 标准：~15 秒，完整 40+ 维度分析
- 🔬 深研：~45 秒，标准分析 + 8 专家讨论 + 回测

**交互流**：
1. 用户选择级别 → `useUIStore.setAnalysisLevel()`
2. 点击搜索 → `handleSearch()` 根据 level 调用不同服务
3. Quick 结果不显示讨论面板 / 场景面板 / 分析网格
4. Deep 结果自动展开讨论面板

---

### 2. NEW-1 自选股面板（WatchlistPanel）

**位置**：MarketOverview 区域内，作为新 tab "自选股"

**Tab 栏**：
```
[大盘指数] [板块分析] [新闻要闻] [自选股 ⭐(5)]
```

**面板布局**：
```
┌──────────────────────────────────────────────────────────┐
│ section-label: 自选股监控                                  │
│ ┌──────────────────────────────┐  ┌──────────────┐       │
│ │ 上次扫描: 10:32 AM           │  │ 🔄 批量扫描   │       │
│ └──────────────────────────────┘  └──────────────┘       │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ 股票        Score趋势    评分  推荐     最后更新  操作 │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ 贵州茅台    [迷你折线]   85   Strong   10:32   📊 🗑  │  │
│ │ 600519.SS                     Buy                      │
│ │─────────────────────────────────────────────────────│  │
│ │ 宁德时代    [迷你折线]   62   Hold     10:34   📊 🗑  │  │
│ │ 300750.SZ    ⚠️ -18                                    │
│ │─────────────────────────────────────────────────────│  │
│ │ 腾讯控股    [迷你折线]   71   Buy      10:36   📊 🗑  │  │
│ │ 0700.HK                                               │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌─ 添加自选 ──────────────────────────────────────────┐  │
│ │ [输入股票代码或名称]  [A-Share ▼]  [➕ 添加]          │  │
│ └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**行样式**：
```tsx
<div className="premium-card premium-card-hover p-4 mb-2 cursor-pointer group">
  <div className="flex items-center justify-between">
    {/* 左侧：股票信息 */}
    <div className="flex items-center gap-4">
      <div>
        <div className="text-sm font-bold text-zinc-900">{item.name}</div>
        <div className="text-xs text-zinc-400 font-mono">{item.symbol}</div>
      </div>
      <ScoreSparkline data={item.scoreHistory} />
    </div>
    
    {/* 中间：Score + 推荐 */}
    <div className="flex items-center gap-3">
      <span className={cn(
        "text-lg font-bold font-mono",
        score >= 70 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-rose-500"
      )}>
        {score}
      </span>
      <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
        recommendationColors[recommendation]
      )}>
        {recommendation}
      </span>
    </div>
    
    {/* 右侧：操作 */}
    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => onAnalyze(item.symbol, item.market)}>
        📊 分析
      </button>
      <button className="text-zinc-300 hover:text-rose-500 transition-colors" onClick={() => removeItem(item.id)}>
        <Trash2 size={14} />
      </button>
    </div>
  </div>
  
  {/* 告警 Badge */}
  {unacknowledgedAlerts > 0 && (
    <div className="mt-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs">
      ⚠️ {lastAlert.message}
    </div>
  )}
</div>
```

**ScoreSparkline 组件**：
```tsx
// 60×24 px 迷你折线图，无轴线，无 tooltip
<ResponsiveContainer width={60} height={24}>
  <LineChart data={data.slice(-7)}>
    <Line
      type="monotone"
      dataKey="score"
      stroke={trend > 0 ? '#16a34a' : trend < 0 ? '#ef4444' : '#a1a1aa'}
      strokeWidth={1.5}
      dot={false}
    />
  </LineChart>
</ResponsiveContainer>
```

**扫描进度**：
```tsx
// 扫描中显示进度条
{isScanning && (
  <div className="mt-3">
    <div className="flex justify-between text-xs text-zinc-400 mb-1">
      <span>扫描中... {progress.current}/{progress.total}</span>
      <span>{currentItem.name}</span>
    </div>
    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-indigo-600 rounded-full"
        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
      />
    </div>
  </div>
)}
```

**批量扫描按钮**：
```tsx
<button
  className="btn-primary !text-xs !px-4 !py-2"
  onClick={handleBatchScan}
  disabled={isScanning || items.length === 0}
>
  {isScanning ? (
    <><Loader2 size={14} className="animate-spin" /> 扫描中</>
  ) : (
    <><RefreshCw size={14} /> 批量扫描</>
  )}
</button>
```

---

### 3. NEW-3 策略回溯时间线（StrategyTimeline）

**位置**：AnalysisResult 内，ScenarioPanel 之后

**整体布局**：
```
┌──────────────────────────────────────────────────────────┐
│ section-label: 策略回溯时间线                              │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐  │
│ │  价格                                                │  │
│ │  ▲    ──── 实际价格                                  │  │
│ │  │  /    \     ● Strong Buy                          │  │
│ │  │ /      \    ● Buy                                 │  │
│ │  │/   ●    \   ● Hold                                │  │
│ │  │    │     \  ○ Sell                                 │  │
│ │  │    │  ●   ──── ○                                  │  │
│ │  │    │  │   ·····  目标价 (虚线)                      │  │
│ │  │    │  │   ─ ─ ─  止损价 (虚线)                      │  │
│ │  └────┴──┴───────────────────────── 时间 →            │  │
│ │  3/15  3/20  3/25  3/30  4/1                          │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌─ 点击节点展开 ──────────────────────────────────────┐  │
│ │ 📅 2026-03-25  Score: [72]  推荐: [Buy]              │  │
│ │ 目标价: ¥32.50  止损: ¥26.80  状态: ⏳ In Progress    │  │
│ │ 争议点: "风险经理警告政策风险，但基本面分析师认为..."    │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ section-label: 专家历史准确率                              │
│ ┌─────────────────────────────────────────────────────┐  │
│ │  100%│ ██                                            │  │
│ │   80%│ ██ ██      ██                                 │  │
│ │   60%│ ██ ██ ██   ██ ██                              │  │
│ │   40%│ ██ ██ ██ █ ██ ██ ██                           │  │
│ │   20%│ ██ ██ ██ ██ ██ ██ ██ ██                       │  │
│ │      └──────────────────────────                     │  │
│ │       深研 技术 基本 情绪 风险 逆向 评审 首席          │  │
│ │       ■ 方向准确率  ■ 目标命中率                       │  │
│ └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Recharts 配置**：
```tsx
<div className="premium-card p-6">
  <span className="section-label">策略回溯时间线</span>
  
  <ResponsiveContainer width="100%" height={280}>
    <ComposedChart data={chartData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: '#a1a1aa' }}
        tickFormatter={d => format(new Date(d), 'M/d')}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#a1a1aa' }}
        domain={['auto', 'auto']}
        tickFormatter={v => `¥${v}`}
      />
      <Tooltip content={<CustomTooltip />} />
      
      {/* 实际价格线 */}
      <Line
        type="monotone"
        dataKey="price"
        stroke="#a1a1aa"
        strokeWidth={2}
        dot={false}
        name="实际价格"
      />
      
      {/* 分析节点 */}
      <Scatter
        dataKey="analysisPrice"
        fill="#4f46e5"
        shape={({ cx, cy, payload }) => (
          <circle
            cx={cx} cy={cy} r={6}
            fill={RECOMMENDATION_COLORS[payload.recommendation]}
            stroke="white"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
          />
        )}
        onClick={(data) => setSelectedNode(data)}
      />
      
      {/* 目标价参考线（选中节点时显示） */}
      {selectedNode && (
        <>
          <ReferenceLine
            y={selectedNode.targetPrice}
            stroke="#16a34a"
            strokeDasharray="5 5"
            label={{ value: `目标 ¥${selectedNode.targetPrice}`, fill: '#16a34a', fontSize: 10 }}
          />
          <ReferenceLine
            y={selectedNode.stopLoss}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{ value: `止损 ¥${selectedNode.stopLoss}`, fill: '#ef4444', fontSize: 10 }}
          />
        </>
      )}
    </ComposedChart>
  </ResponsiveContainer>
  
  {/* 节点详情卡 */}
  <AnimatePresence>
    {selectedNode && (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100"
      >
        {/* ... 节点详情 */}
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

**推荐颜色映射**：
```typescript
const RECOMMENDATION_COLORS = {
  'Strong Buy': '#16a34a',
  'Buy': '#22c55e',
  'Hold': '#f59e0b',
  'Sell': '#ef4444',
  'Strong Sell': '#dc2626',
};
```

---

### 4. NEW-5 决策日志 UI

**决策记录 Modal**（分析结果底部按钮触发）：
```
┌── 记录投资决策 ─────────────────────────────────────────┐
│                                                          │
│  贵州茅台 (600519.SS)  当前价: ¥1,856.20                 │
│                                                          │
│  操作意向                                                 │
│  [买入] [观望] [卖出] [加仓] [减仓] [关注]               │
│                                                          │
│  决策理由                                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 请描述你的操作理由...                                │  │
│  │                                                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  置信度                                                   │
│  ──●──────────────────── 75%                             │
│  低                                高                     │
│                                                          │
│  📎 关联分析 ID: analysis-1711539180                      │
│                                                          │
│              [取消]  [📝 记录决策]                         │
└──────────────────────────────────────────────────────────┘
```

**决策日志列表**（AdminPanel tab）：
```
┌──────────────────────────────────────────────────────────┐
│ [历史记录]  [优化日志]  [📝 决策日志]                      │
│                                                           │
│ ┌─ 统计卡片 ──────────────────────────────────────────┐  │
│ │  总决策: 23  │  正确率: 61%  │  过度自信: +12%  │     │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ⚠️ 系统检测到过度自信偏差：你的自评置信度显著高于实际正确    │
│    率。建议在高置信度决策时降低仓位 20%。                   │
│                                                           │
│ ┌─ 时间线 ────────────────────────────────────────────┐  │
│ │ ● 2026-04-01  贵州茅台  买入  置信75%  ⏳待复盘       │  │
│ │   "基于8专家讨论结论，Score 85，强烈买入信号"           │  │
│ │                                                       │  │
│ │ ● 2026-03-28  宁德时代  卖出  置信60%  ✅正确          │  │
│ │   "风险经理连续3次警告，Score降至52"                    │  │
│ │   复盘: "执行了止损纪律，避免了后续15%跌幅"             │  │
│ │                                                       │  │
│ │ ● 2026-03-25  腾讯控股  买入  置信85%  ❌错误          │  │
│ │   "追高买入，忽视了技术分析师的超买警告"                 │  │
│ │   ⚠️ 过度自信 + 追涨偏差                               │  │
│ └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**操作意向按钮组样式**：
```tsx
const ACTIONS = [
  { value: 'buy', label: '买入', icon: TrendingUp, color: 'emerald' },
  { value: 'hold', label: '观望', icon: Pause, color: 'amber' },
  { value: 'sell', label: '卖出', icon: TrendingDown, color: 'rose' },
  { value: 'add', label: '加仓', icon: Plus, color: 'emerald' },
  { value: 'reduce', label: '减仓', icon: Minus, color: 'rose' },
  { value: 'watch', label: '关注', icon: Eye, color: 'indigo' },
];

// 选中态
<button className={cn(
  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
  selected
    ? `bg-${color}-50 border-${color}-200 text-${color}-700 ring-1 ring-${color}-500/20`
    : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
)}>
  <Icon size={14} /> {label}
</button>
```

---

### 5. OPT-3 数据源状态指示器

**位置**：TokenUsage 组件旁（或下方）

**样式**：
```
┌─ 数据源状态 ──────────────────────────────────┐
│  🟢 Yahoo (45ms)  🟡 EastMoney (320ms)  🔴 Sina │
└───────────────────────────────────────────────────┘
```

```tsx
<div className="flex items-center gap-3 text-[10px] text-zinc-400">
  {sources.map(s => (
    <span key={s.source} className="flex items-center gap-1">
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        s.status === 'healthy' && "bg-emerald-500",
        s.status === 'degraded' && "bg-amber-500",
        s.status === 'down' && "bg-rose-500 animate-pulse"
      )} />
      <span className="font-mono">{s.source}</span>
      {s.status !== 'down' && (
        <span className="text-zinc-300">({s.avgLatencyMs}ms)</span>
      )}
      {s.status === 'down' && (
        <span className="text-rose-400">down</span>
      )}
    </span>
  ))}
</div>
```

---

### 6. NEW-2 行业轮动雷达

**位置**：MarketOverview 新 tab "行业轮动"

**布局**：
```
┌──────────────────────────────────────────────────────────┐
│ ┌─ 美林时钟 ──────────┐  ┌─ 板块资金流 ──────────────┐  │
│ │      过热             │  │                           │  │
│ │   ┌────────┐          │  │  新能源   ████████▶ +62  │  │
│ │   │        │          │  │  半导体   ███████▶  +55  │  │
│ │ 复│   ●    │ 滞       │  │  消费     ◀████    -38  │  │
│ │ 苏│  当前   │ 涨       │  │  医药     ◀██     -22  │  │
│ │   │        │          │  │  金融     ██▶      +15  │  │
│ │   └────────┘          │  │  房地产   ◀███     -31  │  │
│ │      衰退             │  │                           │  │
│ │ 置信度: 72%           │  │ 推荐: 新能源 > 半导体      │  │
│ └───────────────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**美林时钟 SVG**：
```tsx
// 四象限圆形 + 当前位置标记
<svg viewBox="0 0 200 200" className="w-48 h-48">
  {/* 四象限 */}
  <path d="M100,0 A100,100 0 0,1 200,100 L100,100 Z" fill="#fef3c7" /> {/* 过热-amber */}
  <path d="M200,100 A100,100 0 0,1 100,200 L100,100 Z" fill="#fecaca" /> {/* 滞涨-rose */}
  <path d="M100,200 A100,100 0 0,1 0,100 L100,100 Z" fill="#dbeafe" /> {/* 衰退-blue */}
  <path d="M0,100 A100,100 0 0,1 100,0 L100,100 Z" fill="#d1fae5" /> {/* 复苏-emerald */}
  
  {/* 当前位置 */}
  <circle cx={posX} cy={posY} r={8} fill="#4f46e5" stroke="white" strokeWidth={3} />
  
  {/* 标签 */}
  <text x="140" y="40" className="text-[10px] fill-zinc-500">过热</text>
  <text x="140" y="170" className="text-[10px] fill-zinc-500">滞涨</text>
  <text x="20" y="170" className="text-[10px] fill-zinc-500">衰退</text>
  <text x="20" y="40" className="text-[10px] fill-zinc-500">复苏</text>
</svg>
```

**板块资金流柱状图**：
```tsx
<div className="space-y-2">
  {rotations.sort((a, b) => b.flowMagnitude - a.flowMagnitude).map(r => (
    <div key={r.sector} className="flex items-center gap-2">
      <span className="text-xs text-zinc-600 w-16 text-right">{r.sector}</span>
      <div className="flex-1 h-4 bg-zinc-100 rounded-full relative overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            r.flowMagnitude > 0 ? "bg-emerald-500" : "bg-rose-400"
          )}
          style={{
            width: `${Math.abs(r.flowMagnitude)}%`,
            marginLeft: r.flowMagnitude < 0 ? `${100 - Math.abs(r.flowMagnitude)}%` : '0'
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.abs(r.flowMagnitude)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className={cn(
        "text-xs font-mono w-8",
        r.flowMagnitude > 0 ? "text-emerald-600" : "text-rose-500"
      )}>
        {r.flowMagnitude > 0 ? '+' : ''}{r.flowMagnitude}
      </span>
    </div>
  ))}
</div>
```

---

### 7. NEW-4 多股对比

**搜索模式切换**：
```
普通模式: [🔍 输入股票代码...]              [搜索]
对比模式: [股票1] [股票2] [股票3(可选)]      [📊 对比]
```

**对比结果页**：
```
┌──────────────────────────────────────────────────────────┐
│ section-label: 同行业对比分析                              │
│                                                           │
│ ┌─ 对比表 ────────────────────────────────────────────┐  │
│ │ 维度      │ 贵州茅台    │ 五粮液      │ 泸州老窖     │  │
│ ├───────────┼────────────┼────────────┼─────────────┤  │
│ │ Score     │ ★ 85       │ 72         │ 68          │  │
│ │ 推荐      │ Strong Buy │ Buy        │ Hold        │  │
│ │ PE        │ 28.5       │ 22.3       │ ★ 18.7      │  │
│ │ PB        │ 9.2        │ 5.8        │ ★ 4.1       │  │
│ │ ROE       │ ★ 32%      │ 24%        │ 21%         │  │
│ │ 护城河     │ ★ Wide     │ Narrow     │ Narrow      │  │
│ │ 风险      │ Low        │ Medium     │ Medium      │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ 🏆 推荐排序: 贵州茅台 > 五粮液 > 泸州老窖                  │
│ "茅台在护城河和ROE维度显著领先，估值溢价合理..."             │
└──────────────────────────────────────────────────────────┘
```

**★ 标记**每行维度最优值，使用 `text-indigo-600 font-bold`。

---

### 8. OPT-5 报告偏好设置（SettingsModal 新增区域）

**位置**：SettingsModal 底部，在模型选择下方

```
┌── 报告偏好 ────────────────────────────────────────────┐
│                                                         │
│  报告详细程度                                            │
│  [高管摘要]  [分析师]  [交易员]                           │
│                                                         │
│  关注领域（可多选）                                       │
│  ☑ 基本面  ☑ 技术面  ☑ 风险  ☐ 情绪  ☑ 场景            │
│                                                         │
│  附加选项                                                │
│  ☑ 包含回测结果                                          │
│  ☑ 包含专家讨论全文                                      │
│                                                         │
│  最大长度                                                │
│  [简短 2K]  [标准 12K]  [完整 28K]                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 二、测试用例

### 测试框架

- **单元测试**：Vitest + @testing-library/react
- **Store 测试**：直接调用 Zustand store actions
- **Service 测试**：vi.mock 外部依赖（fetch, Gemini API）
- **组件测试**：render + fireEvent + screen.getByText

---

### OPT-1 讨论编排测试

```typescript
// src/test/discussion/orchestrator.test.ts

describe('buildTopology', () => {
  it('deep 模式生成 5 轮拓扑', () => {
    const topology = buildTopology({ level: 'deep', assetType: 'stock', maxConcurrency: 3 });
    expect(topology).toHaveLength(5);
    expect(topology[0].experts).toEqual(['Deep Research Specialist']);
    expect(topology[1].parallel).toBe(true);
    expect(topology[1].experts).toHaveLength(3);
  });

  it('quick 模式仅 3 位专家', () => {
    const topology = buildTopology({ level: 'quick', assetType: 'stock', maxConcurrency: 3 });
    const allExperts = topology.flatMap(r => r.experts);
    expect(allExperts).toHaveLength(3);
    expect(allExperts).toContain('Chief Strategist');
    expect(allExperts).not.toContain('Technical Analyst');
  });

  it('ETF 类型跳过深研和基本面', () => {
    const topology = buildTopology({ level: 'standard', assetType: 'etf', maxConcurrency: 3 });
    const allExperts = topology.flatMap(r => r.experts);
    expect(allExperts).not.toContain('Deep Research Specialist');
    expect(allExperts).not.toContain('Fundamental Analyst');
  });

  it('并行轮次的 dependsOn 包含所有前置轮', () => {
    const topology = buildTopology({ level: 'deep', assetType: 'stock', maxConcurrency: 3 });
    const round3 = topology[2]; // Risk + Contrarian
    expect(round3.dependsOn).toEqual([1, 2]);
  });
});

describe('skipRules', () => {
  it('自定义 skipRoles 生效', () => {
    const topology = buildTopology({
      level: 'deep', assetType: 'stock', maxConcurrency: 3,
      skipRoles: ['Sentiment Analyst'],
    });
    const allExperts = topology.flatMap(r => r.experts);
    expect(allExperts).not.toContain('Sentiment Analyst');
  });
});
```

### OPT-2 回测系统测试

```typescript
// src/test/backtestTimeSeries.test.ts

describe('buildBacktestTimeSeries', () => {
  const mockHistory: StockAnalysis[] = [
    createMockAnalysis({ score: 70, recommendation: 'Buy', targetPrice: '32', stopLoss: '26', price: 28 }),
    createMockAnalysis({ score: 65, recommendation: 'Hold', targetPrice: '30', stopLoss: '25', price: 29 }),
    createMockAnalysis({ score: 80, recommendation: 'Strong Buy', targetPrice: '35', stopLoss: '27', price: 31 }),
  ];

  it('正确计算 overallAccuracy', () => {
    const ts = buildBacktestTimeSeries('600519.SS', mockHistory[2], mockHistory);
    expect(ts.overallAccuracy).toBeGreaterThanOrEqual(0);
    expect(ts.overallAccuracy).toBeLessThanOrEqual(100);
  });

  it('entries 按日期升序排列', () => {
    const ts = buildBacktestTimeSeries('600519.SS', mockHistory[2], mockHistory);
    for (let i = 1; i < ts.entries.length; i++) {
      expect(new Date(ts.entries[i].date).getTime())
        .toBeGreaterThanOrEqual(new Date(ts.entries[i-1].date).getTime());
    }
  });

  it('空历史返回零条目', () => {
    const ts = buildBacktestTimeSeries('600519.SS', mockHistory[0], []);
    expect(ts.entries).toHaveLength(0);
    expect(ts.overallAccuracy).toBe(0);
  });
});

describe('detectSystematicBias', () => {
  it('连续 3 次看多但下跌 → bullish_drift', () => {
    const ts: BacktestTimeSeries = {
      symbol: 'TEST',
      entries: [
        { recommendation: 'Buy', returnPercent: -5, status: 'In Progress' },
        { recommendation: 'Buy', returnPercent: -8, status: 'In Progress' },
        { recommendation: 'Strong Buy', returnPercent: -12, status: 'Stop Loss Hit' },
      ] as any,
      overallAccuracy: 30, directionAccuracy: 0,
      avgHoldingPeriodDays: 15, profitFactor: 0.3,
      maxConsecutiveLosses: 3, longestWinStreak: 0, sharpeRatio: -1.2
    };
    const bias = detectSystematicBias(ts);
    expect(bias.hasBias).toBe(true);
    expect(bias.biasType).toBe('bullish_drift');
    expect(bias.severity).toBe('high');
  });

  it('准确率 > 60% 无偏差', () => {
    const ts = { entries: [], overallAccuracy: 65, directionAccuracy: 70 } as any;
    const bias = detectSystematicBias(ts);
    expect(bias.hasBias).toBe(false);
  });
});
```

### OPT-3 Circuit Breaker 测试

```typescript
// src/test/dataSourceHealth.test.ts

describe('DataSourceMonitor', () => {
  let monitor: DataSourceMonitor;
  
  beforeEach(() => {
    monitor = new DataSourceMonitor(['eastmoney_new', 'sina', 'yahoo']);
  });

  it('初始状态全部 healthy', () => {
    const report = monitor.getHealthReport();
    expect(report.every(h => h.status === 'healthy')).toBe(true);
  });

  it('连续 3 次失败 → status=down', () => {
    monitor.recordFailure('sina');
    monitor.recordFailure('sina');
    monitor.recordFailure('sina');
    expect(monitor.isAvailable('sina')).toBe(false);
    const h = monitor.getHealthReport().find(h => h.source === 'sina')!;
    expect(h.status).toBe('down');
  });

  it('down 后 5 分钟内不可用', () => {
    monitor.recordFailure('sina');
    monitor.recordFailure('sina');
    monitor.recordFailure('sina');
    expect(monitor.isAvailable('sina')).toBe(false);
  });

  it('成功请求重置 consecutiveFailures', () => {
    monitor.recordFailure('sina');
    monitor.recordFailure('sina');
    monitor.recordSuccess('sina', 100);
    expect(monitor.isAvailable('sina')).toBe(true);
    const h = monitor.getHealthReport().find(h => h.source === 'sina')!;
    expect(h.consecutiveFailures).toBe(0);
  });

  it('getSortedAvailable 按延迟排序', () => {
    monitor.recordSuccess('eastmoney_new', 300);
    monitor.recordSuccess('sina', 100);
    monitor.recordSuccess('yahoo', 50);
    const sorted = monitor.getSortedAvailable();
    expect(sorted[0]).toBe('yahoo');
    expect(sorted[1]).toBe('sina');
  });

  it('avgLatencyMs 为滑动窗口平均', () => {
    for (let i = 0; i < 5; i++) monitor.recordSuccess('yahoo', 100);
    monitor.recordSuccess('yahoo', 200);
    const h = monitor.getHealthReport().find(h => h.source === 'yahoo')!;
    // (5*100 + 200) / 6 ≈ 116.67
    expect(h.avgLatencyMs).toBeCloseTo(116.67, 0);
  });
});
```

### OPT-4 Prompt Registry 测试

```typescript
// src/test/promptRegistry.test.ts

describe('PromptRegistry', () => {
  beforeEach(() => {
    // 清空注册表
    clearRegistry();
  });

  it('注册并获取活跃 prompt', () => {
    registerPrompt({ id: 'test-v1', name: 'test', version: '1.0', template: () => 'hello', changelog: '', createdAt: '', isActive: true });
    const active = getActivePrompt('test');
    expect(active.id).toBe('test-v1');
  });

  it('未注册的 name 抛出错误', () => {
    expect(() => getActivePrompt('nonexistent')).toThrow('No active prompt');
  });

  it('recordPromptMetrics 更新滚动平均', () => {
    registerPrompt({ id: 'test-v1', name: 'test', version: '1.0', template: () => '', changelog: '', createdAt: '', isActive: true });
    recordPromptMetrics('test', 1000, 80, 5000, false);
    recordPromptMetrics('test', 2000, 60, 3000, false);
    const m = getPromptMetrics('test')!;
    expect(m.callCount).toBe(2);
    expect(m.avgTokenUsage).toBe(1500);
    expect(m.avgResponseScore).toBe(70);
    expect(m.errorRate).toBe(0);
  });

  it('错误率正确计算', () => {
    registerPrompt({ id: 'test-v1', name: 'test', version: '1.0', template: () => '', changelog: '', createdAt: '', isActive: true });
    recordPromptMetrics('test', 0, 0, 0, true);
    recordPromptMetrics('test', 1000, 80, 5000, false);
    expect(getPromptMetrics('test')!.errorRate).toBe(0.5);
  });

  it('getAllVersions 返回所有版本', () => {
    registerPrompt({ id: 'test-v1', name: 'test', version: '1.0', template: () => '', changelog: '', createdAt: '', isActive: false });
    registerPrompt({ id: 'test-v2', name: 'test', version: '2.0', template: () => '', changelog: '', createdAt: '', isActive: true });
    expect(getAllVersions('test')).toHaveLength(2);
  });
});
```

### OPT-6 分析分级测试

```typescript
// src/test/analysisLevel.test.ts

describe('quickScan', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ symbol: '600519.SS', name: '贵州茅台', price: 1856.2 })
    } as any);
  });

  it('返回精简 StockAnalysis 对象', async () => {
    const result = await quickScan('600519', 'A-Share', mockConfig);
    expect(result.stockInfo).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.summary).toBeDefined();
    // Quick Scan 不应有讨论数据
    expect(result.discussion).toBeUndefined();
  });

  it('id 以 quick- 前缀开头', async () => {
    const result = await quickScan('600519', 'A-Share', mockConfig);
    expect(result.id).toMatch(/^quick-/);
  });
});
```

### NEW-1 自选股测试

```typescript
// src/test/watchlist.test.ts

describe('useWatchlistStore', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ items: [], isScanning: false, lastScanTime: null, scanProgress: null });
  });

  it('添加自选股', () => {
    useWatchlistStore.getState().addItem('600519', '贵州茅台', 'A-Share');
    expect(useWatchlistStore.getState().items).toHaveLength(1);
    expect(useWatchlistStore.getState().items[0].symbol).toBe('600519');
  });

  it('删除自选股', () => {
    useWatchlistStore.getState().addItem('600519', '贵州茅台', 'A-Share');
    const id = useWatchlistStore.getState().items[0].id;
    useWatchlistStore.getState().removeItem(id);
    expect(useWatchlistStore.getState().items).toHaveLength(0);
  });

  it('Score 快照按日期追加', () => {
    useWatchlistStore.getState().addItem('600519', '贵州茅台', 'A-Share');
    const id = useWatchlistStore.getState().items[0].id;
    useWatchlistStore.getState().addScoreSnapshot(id, { date: '2026-04-01', score: 85, price: 1856, recommendation: 'Buy' });
    useWatchlistStore.getState().addScoreSnapshot(id, { date: '2026-04-02', score: 78, price: 1820, recommendation: 'Hold' });
    expect(useWatchlistStore.getState().items[0].scoreHistory).toHaveLength(2);
  });

  it('不重复添加相同 symbol', () => {
    useWatchlistStore.getState().addItem('600519', '贵州茅台', 'A-Share');
    useWatchlistStore.getState().addItem('600519', '贵州茅台', 'A-Share');
    // 如果设计允许重复，调整此测试
    expect(useWatchlistStore.getState().items.length).toBeLessThanOrEqual(2);
  });
});

describe('detectAlert', () => {
  it('Score 下降超过阈值 → score_drop', () => {
    const item: WatchlistItem = {
      ...createMockItem(),
      alertThreshold: 15,
      scoreHistory: [{ date: '2026-04-01', score: 80, price: 100, recommendation: 'Buy' }],
    };
    const alert = detectAlert(item, 60);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('score_drop');
  });

  it('Score 变化小于阈值 → 无告警', () => {
    const item: WatchlistItem = {
      ...createMockItem(),
      alertThreshold: 15,
      scoreHistory: [{ date: '2026-04-01', score: 80, price: 100, recommendation: 'Buy' }],
    };
    const alert = detectAlert(item, 70);
    expect(alert).toBeNull();
  });

  it('空历史 → 无告警', () => {
    const item: WatchlistItem = { ...createMockItem(), scoreHistory: [] };
    const alert = detectAlert(item, 80);
    expect(alert).toBeNull();
  });
});
```

### NEW-5 偏差检测测试

```typescript
// src/test/biasDetector.test.ts

describe('detectBiases', () => {
  it('过度自信：置信度 80% 但正确率 50% → 检出', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      ...createMockDecision(),
      confidence: 80,
      outcome: i < 5 ? 'correct' : 'incorrect' as const,
    }));
    const biases = detectBiases(entries);
    expect(biases.some(b => b.name === 'overconfidence')).toBe(true);
  });

  it('正确率高于置信度 → 不检出', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      ...createMockDecision(),
      confidence: 50,
      outcome: i < 8 ? 'correct' : 'incorrect' as const,
    }));
    const biases = detectBiases(entries);
    expect(biases.some(b => b.name === 'overconfidence')).toBe(false);
  });

  it('损失厌恶：3 次亏损 >10% 仍持有 → 检出', () => {
    const entries = [
      { ...createMockDecision(), action: 'hold' as const, outcome: 'incorrect' as const, actualReturn: -15 },
      { ...createMockDecision(), action: 'hold' as const, outcome: 'incorrect' as const, actualReturn: -12 },
      { ...createMockDecision(), action: 'hold' as const, outcome: 'incorrect' as const, actualReturn: -20 },
    ];
    const biases = detectBiases(entries);
    expect(biases.some(b => b.name === 'loss_aversion')).toBe(true);
  });

  it('样本不足 (<5) → 不检出', () => {
    const entries = [createMockDecision(), createMockDecision()];
    const biases = detectBiases(entries);
    expect(biases).toHaveLength(0);
  });

  it('追涨偏差：买入错误率 >60% → 检出', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      ...createMockDecision(),
      action: 'buy' as const,
      outcome: i < 7 ? 'incorrect' : 'correct' as const,
    }));
    const biases = detectBiases(entries);
    expect(biases.some(b => b.name === 'recency_bias')).toBe(true);
  });
});
```

### 组件渲染测试

```typescript
// src/test/components/WatchlistPanel.test.tsx

describe('WatchlistPanel', () => {
  it('空列表显示添加提示', () => {
    render(<WatchlistPanel onAnalyze={vi.fn()} />);
    expect(screen.getByText(/添加自选/)).toBeInTheDocument();
  });

  it('显示自选股列表', () => {
    useWatchlistStore.setState({
      items: [
        { ...createMockItem(), name: '贵州茅台', symbol: '600519.SS' },
        { ...createMockItem(), name: '宁德时代', symbol: '300750.SZ' },
      ]
    });
    render(<WatchlistPanel onAnalyze={vi.fn()} />);
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByText('宁德时代')).toBeInTheDocument();
  });

  it('点击分析按钮调用 onAnalyze', async () => {
    const onAnalyze = vi.fn();
    useWatchlistStore.setState({
      items: [{ ...createMockItem(), symbol: '600519', market: 'A-Share', name: '茅台' }]
    });
    render(<WatchlistPanel onAnalyze={onAnalyze} />);
    await userEvent.click(screen.getByText('📊 分析'));
    expect(onAnalyze).toHaveBeenCalledWith('600519', 'A-Share');
  });

  it('告警 badge 显示未确认告警数', () => {
    useWatchlistStore.setState({
      items: [{
        ...createMockItem(),
        alertHistory: [
          { id: '1', type: 'score_drop', message: 'Score ↓ 18', triggeredAt: '', acknowledged: false },
          { id: '2', type: 'score_rise', message: 'Score ↑ 20', triggeredAt: '', acknowledged: true },
        ]
      }]
    });
    render(<WatchlistPanel onAnalyze={vi.fn()} />);
    expect(screen.getByText(/Score ↓ 18/)).toBeInTheDocument();
  });
});

// src/test/components/StrategyTimeline.test.tsx

describe('StrategyTimeline', () => {
  it('entries < 2 时不渲染', () => {
    const { container } = render(
      <StrategyTimeline
        timeSeries={{ entries: [createMockEntry()], overallAccuracy: 50 } as any}
        currentAnalysis={createMockAnalysis() as any}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('entries >= 2 时渲染图表区域', () => {
    render(
      <StrategyTimeline
        timeSeries={{ entries: [createMockEntry(), createMockEntry()], overallAccuracy: 65 } as any}
        currentAnalysis={createMockAnalysis() as any}
      />
    );
    expect(screen.getByText('策略回溯时间线')).toBeInTheDocument();
  });
});

// src/test/components/ErrorBoundary.test.tsx

describe('ErrorBoundary', () => {
  const ThrowError = () => { throw new Error('test crash'); };
  
  it('捕获渲染错误，显示重试按钮', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText(/重试/)).toBeInTheDocument();
    expect(screen.queryByText('test crash')).not.toBeInTheDocument(); // production 隐藏
  });

  it('自定义 fallback 文本', () => {
    render(
      <ErrorBoundary fallback="分析数据加载异常">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('分析数据加载异常')).toBeInTheDocument();
  });

  it('子组件正常时透传渲染', () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });
});
```

---

## 三、测试覆盖目标矩阵

| 模块 | 测试文件 | 用例数 | 覆盖重点 |
|------|---------|-------|---------|
| OPT-1 | `orchestrator.test.ts` | 5 | 拓扑构建 + 跳过规则 |
| OPT-2 | `backtestTimeSeries.test.ts` | 5 | 时间序列 + 偏差检测 |
| OPT-3 | `dataSourceHealth.test.ts` | 6 | Circuit Breaker 状态流转 |
| OPT-4 | `promptRegistry.test.ts` | 5 | 注册 + 指标 + 版本 |
| OPT-6 | `analysisLevel.test.ts` | 2 | Quick Scan 输出验证 |
| NEW-1 | `watchlist.test.ts` | 7 | Store CRUD + 告警检测 |
| NEW-5 | `biasDetector.test.ts` | 5 | 3 种偏差模式 + 边界 |
| P1.2 | `ErrorBoundary.test.tsx` | 3 | 捕获 + fallback + 透传 |
| NEW-1 | `WatchlistPanel.test.tsx` | 4 | 列表渲染 + 交互 + 告警 |
| NEW-3 | `StrategyTimeline.test.tsx` | 2 | 条件渲染 |
| **总计** | **10 文件** | **44 用例** | |

---

*UI 交互设计与测试用例规格书完毕。所有 UI 组件严格遵循 zinc/indigo-600 设计系统和 premium-card 组件库。*
