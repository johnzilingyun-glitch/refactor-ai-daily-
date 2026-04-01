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
1. 识别该股票所在行业的 3-5 个核心驱动变量
2. 为每个变量提供当前值、市场预期和偏离分析
3. 评估数据源可靠性（财报/研报/推算）
4. 构建商业模式利润公式`,

  'Technical Analyst': `你是技术分析师。任务：
1. 分析当前价格所处的技术形态（突破/整理/反转）
2. 识别关键支撑位和阻力位
3. 评估成交量配合情况
4. 给出技术面评分和短期趋势判断`,

  'Fundamental Analyst': `你是基本面分析师。任务：
1. 评估核心财务指标（PE/PB/ROE/增长率）
2. 与同行业公司估值对比
3. 分析盈利质量和可持续性
4. 给出合理估值区间`,

  'Sentiment Analyst': `你是情绪分析师。任务：
1. 评估当前市场对该股票的整体情绪
2. 分析北向资金/机构持仓变化
3. 评估新闻事件对预期的影响
4. 判断情绪是否处于极端（过度乐观/悲观）`,

  'Risk Manager': `你是风险经理。任务：
1. 列出 3-5 个量化风险（概率 × 影响 = 期望损失）
2. 为每个风险提供对冲策略
3. 设计止损方案（价格止损 + 逻辑止损）
4. 评估最大回撤风险`,

  'Contrarian Strategist': `你是逆向策略师。任务：
1. 挑战前面专家的主流观点
2. 指出被忽略的反面论据
3. 分析"如果市场共识错了"的情景
4. 提供替代性投资逻辑`,

  'Professional Reviewer': `你是专业评审。任务：
1. 检查前面所有专家发言的逻辑一致性
2. 识别数据冲突和自相矛盾
3. 验证关键假设是否有数据支撑
4. 给出综合可信度评分`,

  'Chief Strategist': `你是首席策略师。任务：
1. 综合所有专家意见形成最终判断
2. 制定具体交易计划（入场/目标/止损）
3. 设计仓位管理方案
4. 给出明确的投资建议和置信度`,

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

  // Stock context
  sections.push(`\n**分析标的**: ${analysis.stockInfo.symbol} ${analysis.stockInfo.name}`);
  sections.push(`**当前价格**: ${analysis.stockInfo.price} ${analysis.stockInfo.currency} (${analysis.stockInfo.changePercent > 0 ? '+' : ''}${analysis.stockInfo.changePercent}%)`);
  sections.push(`**AI 初步评分**: ${analysis.score}/100, 推荐: ${analysis.recommendation}, 情绪: ${analysis.sentiment}`);

  if (analysis.summary) {
    sections.push(`\n**AI 分析摘要**: ${analysis.summary}`);
  }

  // Commodities
  if (commoditiesData.length > 0) {
    sections.push(`\n**大宗商品数据**: ${JSON.stringify(commoditiesData)}`);
  }

  // Previous rounds
  if (previousRounds.length > 0) {
    sections.push('\n**前轮专家发言**:');
    for (const msg of previousRounds) {
      sections.push(`- **${msg.role}**: ${msg.content.slice(0, 500)}${msg.content.length > 500 ? '...' : ''}`);
    }
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
