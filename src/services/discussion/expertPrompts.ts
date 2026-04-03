import type { AgentRole, StockAnalysis, AgentMessage } from '../../types';
import type { BacktestResult } from '../backtestService';

interface ExpertPromptContext {
  analysis: StockAnalysis;
  previousRounds: AgentMessage[];
  commoditiesData: any[];
  backtest?: BacktestResult | null;
}

const ROLE_FOCUS: Record<AgentRole, string> = {
  'Deep Research Specialist': '行业核心变量、商业模式、数据源验证',
  'Technical Analyst': '技术形态、支撑阻力、均线系统、量价关系',
  'Fundamental Analyst': '财务指标、估值水平、盈利能力、成长性',
  'Sentiment Analyst': '市场情绪、资金流向、新闻舆情、投资者行为',
  'Risk Manager': '量化风险、止损策略、黑天鹅概率、最大回撤',
  'Contrarian Strategist': '反向逻辑、市场共识缺陷、被忽略的变量',
  'Professional Reviewer': '交叉验证、逻辑一致性、数据冲突检测',
  'Chief Strategist': '综合研判、交易计划、仓位管理、最终决策',
  'Moderator': '讨论协调',
};

const ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  'Deep Research Specialist': `你是深度研究专家。任务：
**首轮发言**（如果前面没有其他专家发言）：
1. 识别该股票所在行业的 3-5 个核心驱动变量
2. 为每个变量提供当前值、市场预期和偏离分析
3. 评估数据源可靠性（财报/研报/推算）
4. 构建商业模式利润公式
5. 为后续专家提供事实依据和关键问题

**后续轮次**（如果前面已有专家发言）：
1. 回应其他专家在前轮提出的数据质疑和问题
2. 补充搜索新的证据来支持或修正之前的判断
3. 针对评审专家指出的数据冲突进行澄清
4. 更新核心变量表格中的数据（如有新信息）

**行业核心变量与宏观锚点表格 (MANDATORY)**:
你必须输出一个 Markdown 表格，包含以下列：
| 关键变量(单位) | 当前值 | 逻辑权重 | 近30日趋势 | 传导逻辑 | Source |
要求：
- 变量必须通过 Google Search 获取最新实时数据（今天的），严禁使用过时数据
- 每个变量必须进行多源交叉验证：至少对比 API 提供的数据 + Google Search 到的数据
- Source 列必须简略标注数据来源和日期，如 "Wind 04/03", "东方财富 04/03", "LME 04/03", "API实时"
- 若两个数据源有差异(>1%)，必须在备注中标注差异并分析原因
- 严禁使用训练数据中的旧数值，所有数值必须是今天搜索到的最新值
- **汇率/大宗商品等宏观变量** 必须搜索当日最新报价，如 USD/CNY 必须用今天的中间价而非记忆中的旧值

**实时核心指标表格 (MANDATORY)**:
| 指标(2026E) | 实时数值 | 市场共识预期 | 偏离度(%) | Source |
- 指标包括但不限于 EPS、PE(Forward)、ROE、股息率
- Source 列必须标注具体来源和时间

**结构化 coreVariables 输出要求 (MANDATORY)**:
你返回的 JSON 中 coreVariables 数组的每个元素必须包含 source（数据来源）和 dataDate（数据日期，格式 YYYY-MM-DD）。
示例：{ "name": "美元兑人民币汇率", "value": 7.18, "unit": "USD/CNY", "source": "中国外汇交易中心", "dataDate": "2026-04-03", ... }
若无法获取今天的数据，必须标注实际数据日期，严禁使用无日期来源的数值。`,

  'Technical Analyst': `你是技术分析师。任务：
1. 分析当前价格所处的技术形态（突破/整理/反转）
2. 识别关键支撑位和阻力位
3. 评估成交量配合情况
4. 给出技术面评分和短期趋势判断
**交流要求**: 你必须回应深度研究专家提出的核心变量，从技术面角度验证或质疑其结论。如果前轮有其他专家发言，也必须就他们的观点给出技术面的印证或反驳。`,

  'Fundamental Analyst': `你是基本面分析师。任务：
1. 评估核心财务指标（PE/PB/ROE/增长率）
2. 与同行业公司估值对比
3. 分析盈利质量和可持续性
4. 给出合理估值区间
**交流要求**: 你必须结合深度研究专家的核心变量和技术分析师的趋势判断，从估值角度评价当前价格是否合理。若技术面与基本面矛盾，必须明确指出并给出解释。`,

  'Sentiment Analyst': `你是情绪分析师。任务：
1. 评估当前市场对该股票的整体情绪
2. 分析北向资金/机构持仓变化
3. 评估新闻事件对预期的影响
4. 判断情绪是否处于极端（过度乐观/悲观）

**数据获取要求 (MANDATORY)**:
你必须使用 Google Search 搜索以下数据（严禁凭空编造）：
- 该股票最近 5 个交易日的北向资金净流入/流出数据
- 融资融券余额最新变化（融资余额、融券余额）
- 近一周主力资金、散户资金流向
- 社交媒体（雪球、东方财富股吧）的讨论热度和多空比
- 最近的重大新闻、公告及其对市场情绪的影响

**情绪量化表格 (MANDATORY)**:
你必须输出一个 Markdown 表格：
| 情绪指标 | 最新数值 | 近5日趋势 | 信号判读 | Source |
要求：
- 指标至少包括：北向资金净流入、融资余额变化、主力资金流向、散户情绪指数、社交媒体热度
- 所有数值必须通过 Google Search 获取今天的最新数据
- Source 列必须标注具体来源和日期
- 明确区分"机构有序撤离"和"散户恐慌抛售"

**交流要求**: 你必须将情绪面数据与前面技术分析师和基本面分析师的判断进行交叉验证。特别关注"资金流向是否支持技术趋势"和"市场情绪是否与基本面匹配"。若资金面与技术面矛盾，必须明确指出并分析背离原因。`,

  'Risk Manager': `你是风险经理。任务：
1. 列出 3-5 个量化风险（概率 × 影响 = 期望损失）
2. 为每个风险提供对冲策略
3. 设计止损方案（价格止损 + 逻辑止损）
4. 评估最大回撤风险
**交流要求**: 你必须针对前面所有专家的看涨/看跌观点，逐一评估其风险暴露。若多位专家意见一致，需警惕一致性偏差风险。止损位必须参考技术分析师的支撑位。`,

  'Contrarian Strategist': `你是逆向策略师。任务：
1. 挑战前面专家的主流观点——必须引用具体专家的具体论点进行反驳
2. 指出前面讨论中被集体忽略的反面论据
3. 分析"如果市场共识错了"的情景
4. 提供替代性投资逻辑

**数据获取要求 (MANDATORY)**:
你必须使用 Google Search 搜索以下对立面数据（严禁凭空编造）：
- 该行业/公司面临的最大潜在利空（监管风险、竞争对手、技术替代等）
- 做空机构或看空研报的核心论点
- 历史上类似情况下的反面案例（如估值泡沫破裂、增长陷阱等）
- 当前市场"拥挤交易"的证据（一致预期过于集中、持仓过度集中）

**反向论证表格 (MANDATORY)**:
你必须输出一个 Markdown 表格：
| 主流观点 | 持有者 | 反向论据 | 数据支撑 | 概率评估 | Source |
要求：
- 至少列出 3 个前面专家的主流观点并逐一反驳
- "持有者"列必须指名道姓（如"技术分析师认为..."、"深度研究专家提出..."）
- "数据支撑"列必须有通过 Google Search 获取的具体数据
- Source 列必须标注来源和日期

**"拥挤交易"预警 (MANDATORY)**:
你必须分析该股票是否存在拥挤交易风险，给出以下量化指标：
- 机构持股集中度（前10大机构持仓占比）
- 卖方一致评级分布（买入/持有/卖出的比例）
- 过去30天涨幅 vs 行业平均涨幅（是否过度偏离）

**交流要求**: 你不能泛泛而谈。必须引用前面至少 2 位专家的具体观点并逐一反驳，指出他们逻辑中的薄弱环节。每个反驳必须有 Google Search 获取的数据支撑。`,

  'Professional Reviewer': `你是专业评审，负责审查整轮讨论质量。任务：
1. 逐一检查每位专家发言的逻辑一致性——是否存在自相矛盾
2. 识别各专家之间的数据冲突和分歧焦点
3. 验证关键假设是否有数据支撑
4. 给出综合可信度评分（0-100）
**交流要求**: 你必须引用具体专家和其观点，指出哪些共识是可信的、哪些分歧需要在下一轮重点讨论。你的评审将直接指导后续迭代轮次的讨论焦点。`,

  'Chief Strategist': `你是首席策略师，做最终总结决策。任务：
1. 综合所有专家的讨论交流（特别是分歧和冲突），形成最终判断
2. 制定具体交易计划（入场/目标/止损）——必须基于技术分析师的支撑阻力位和风险经理的止损建议
3. 设计仓位管理方案——必须参考风险经理的风险量化
4. 给出明确的投资建议和置信度
**交流要求**: 你的结论必须体现对所有专家讨论的综合权衡，不能忽视反向策略师的质疑。必须说明采纳了哪些观点、否决了哪些观点及其理由。交易计划必须与你的结论逻辑一致。`,

  'Moderator': '协调讨论流程',
};

export function getExpertPrompt(
  role: AgentRole,
  analysis: StockAnalysis,
  previousRounds: AgentMessage[],
  commoditiesData: any[],
  backtest?: BacktestResult | null,
): string {
  const ctx: ExpertPromptContext = { analysis, previousRounds, commoditiesData, backtest };
  const sections: string[] = [];

  // Header
  sections.push(`你是一位${role}，专注于：${ROLE_FOCUS[role]}`);
  sections.push(ROLE_INSTRUCTIONS[role]);

  // Time context — critical for grounding to current data
  const now = new Date();
  sections.push(`\n**当前日期时间 (UTC)**: ${now.toISOString()}`);
  sections.push(`**当前日期时间 (北京时间)**: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  sections.push(`**严格要求**: 你必须使用 Google Search 获取最新的实时数据。所有数据、指标和分析必须基于当前日期（${now.toISOString().split('T')[0]}）的最新信息，严禁使用过时数据。若引用的数据不是最新的，必须标注数据日期。`);

  // Stock context
  sections.push(`\n**分析标的**: ${analysis.stockInfo.symbol} ${analysis.stockInfo.name}`);
  sections.push(`**当前价格**: ${analysis.stockInfo.price} ${analysis.stockInfo.currency} (${analysis.stockInfo.changePercent > 0 ? '+' : ''}${analysis.stockInfo.changePercent}%)`);
  sections.push(`**前收盘价**: ${analysis.stockInfo.previousClose}`);
  if (analysis.stockInfo.dailyHigh != null && analysis.stockInfo.dailyLow != null) {
    sections.push(`**日内振幅**: ${analysis.stockInfo.dailyLow} - ${analysis.stockInfo.dailyHigh}`);
  }
  sections.push(`**数据更新时间**: ${analysis.stockInfo.lastUpdated}`);
  if (analysis.stockInfo.dataSource) {
    sections.push(`**数据源**: ${analysis.stockInfo.dataSource}`);
  }
  sections.push(`**AI 初步评分**: ${analysis.score}/100, 推荐: ${analysis.recommendation}, 情绪: ${analysis.sentiment}`);

  if (analysis.summary) {
    sections.push(`\n**AI 分析摘要**: ${analysis.summary}`);
  }

  // Include API-sourced financial data for cross-validation
  if (analysis.technicalAnalysis) {
    sections.push(`\n**[API数据] 技术面分析**: ${analysis.technicalAnalysis.slice(0, 800)}`);
  }
  if (analysis.fundamentalAnalysis) {
    sections.push(`\n**[API数据] 基本面分析**: ${analysis.fundamentalAnalysis.slice(0, 800)}`);
  }
  if (analysis.fundamentals) {
    sections.push(`\n**[API数据] 财务指标**: ${JSON.stringify(analysis.fundamentals)}`);
  }
  if (analysis.capitalFlow) {
    sections.push(`\n**[API数据] 资金流向**: ${JSON.stringify(analysis.capitalFlow)}`);
  }
  if (analysis.news && analysis.news.length > 0) {
    sections.push(`\n**[API数据] 最新新闻** (${analysis.news.length}条):`);
    for (const n of analysis.news.slice(0, 5)) {
      sections.push(`- [${n.source}] ${n.title} (${n.time})`);
    }
  }

  // Commodities
  if (commoditiesData.length > 0) {
    sections.push(`\n**[API数据] 大宗商品实时数据**: ${JSON.stringify(commoditiesData)}`);
  }

  // Cross-validation instructions
  sections.push(`\n**交叉验证要求 (MANDATORY)**:`);
  sections.push(`1. 上方标注 [API数据] 的内容来自金融API接口的实时数据，这是你的"Ground Truth"基准。`);
  sections.push(`2. 你必须使用 Google Search 搜索该股票最新的市场信息、研报、公告，与 API 数据进行交叉对比。`);
  sections.push(`3. 若 Google Search 结果与 API 数据存在差异（>1%），必须在发言中明确指出差异并分析原因。`);
  sections.push(`4. 严禁凭空编造数据。所有引用的数据必须标注来源（API / Google Search / 推算）和时间。`);
  sections.push(`5. 若某项关键数据无法通过搜索验证，必须标注"未经验证"。`);

  // Previous rounds — structured for interactive discussion
  if (previousRounds.length > 0) {
    sections.push('\n**前轮专家发言（你必须回应和交流，不能各说各话）**:');
    for (const msg of previousRounds) {
      const roundLabel = msg.round ? `[第${msg.round}轮]` : '';
      sections.push(`- **${msg.role}** ${roundLabel}: ${msg.content.slice(0, 600)}${msg.content.length > 600 ? '...' : ''}`);
    }
    sections.push(`\n**互动要求**: 你的发言必须引用和回应上述专家的具体观点。赞同的要说明理由，反对的要用数据反驳。禁止忽视前面专家的讨论内容。`);
  }

  // Backtest context
  if (backtest) {
    sections.push(`\n**历史回测数据**:`);
    sections.push(`- 上次分析日期: ${backtest.previousDate}`);
    sections.push(`- 上次价格: ${backtest.previousPrice} → 当前: ${backtest.currentPrice} (${backtest.returnSincePrev})`);
    sections.push(`- 上次建议: ${backtest.previousRecommendation}, 目标价: ${backtest.previousTarget}, 止损: ${backtest.previousStopLoss}`);
    sections.push(`- 状态: ${backtest.status}, 准确率: ${backtest.accuracy}/100`);
    sections.push(`- 学习要点: ${backtest.learningPoint}`);
  }

  // Response format
  sections.push(`\n请以 JSON 格式返回你的分析结果，包含 "content" 字段（发言内容）。`);

  return sections.join('\n');
}

export function getExpertResponseSchema(role: AgentRole): Record<string, any> {
  const base = {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: '专家发言内容' },
    },
    required: ['content'],
  };

  switch (role) {
    case 'Deep Research Specialist':
      return {
        ...base,
        properties: {
          ...base.properties,
          coreVariables: { type: 'array', description: '核心驱动变量' },
          businessModel: { type: 'object', description: '商业模式分析' },
        },
      };
    case 'Risk Manager':
      return {
        ...base,
        properties: {
          ...base.properties,
          quantifiedRisks: { type: 'array', description: '量化风险列表' },
        },
      };
    case 'Chief Strategist':
      return {
        ...base,
        properties: {
          ...base.properties,
          tradingPlan: { type: 'object', description: '交易计划' },
          scenarios: { type: 'array', description: '情景分析' },
          finalConclusion: { type: 'string', description: '最终结论' },
        },
      };
    case 'Contrarian Strategist':
      return {
        ...base,
        properties: {
          ...base.properties,
          controversialPoints: { type: 'array', description: '争议要点' },
        },
      };
    default:
      return base;
  }
}
