import { StockAnalysis, AgentDiscussion } from "../types";

export async function sendAnalysisToFeishu(analysis: StockAnalysis, webhookUrl: string, discussion?: AgentDiscussion): Promise<boolean> {
  if (!webhookUrl) {
    console.error("Feishu Webhook URL is missing");
    return false;
  }

  const ratingColor = analysis.recommendation === "Buy" ? "green" : 
                      analysis.recommendation === "Sell" ? "red" : "orange";

  const elements: any[] = [
    {
      tag: "div",
      text: {
        content: `**决策摘要**: ${analysis.finalConclusion || "未生成摘要"}`,
        tag: "lark_md"
      }
    },
    {
        tag: "div",
        fields: [
          {
            is_short: true,
            text: {
              content: `**数据信度**\n${analysis.dataQuality?.score}% (${analysis.dataQuality?.isStale ? "⚠️ 延时" : "✅ 实时"})`,
              tag: "lark_md"
            }
          }
        ]
    }
  ];

  // 1. Add Risk Matrix Summary
  if (analysis.quantifiedRisks && analysis.quantifiedRisks.length > 0) {
    elements.push({ tag: "hr" });
    const riskContent = analysis.quantifiedRisks.slice(0, 3).map(r => 
      `• **${r.name}**: 概率 ${r.probability}% | 冲击 ${r.impactPercent}%`
    ).join('\n');
    
    elements.push({
      tag: "div",
      text: {
        content: `**风险概率因子**\n${riskContent}`,
        tag: "lark_md"
      }
    });
  }

  // 3. Add Execution Strategy
  elements.push({ tag: "hr" });
  elements.push({
    tag: "div",
    fields: [
      {
        is_short: true,
        text: {
          content: `**建议买入**\n${analysis.tradingPlan?.entryPrice || "N/A"}`,
          tag: "lark_md"
        }
      },
      {
        is_short: true,
        text: {
          content: `**目标/止损**\n${analysis.tradingPlan?.targetPrice || "N/A"} / ${analysis.tradingPlan?.stopLoss || "N/A"}`,
          tag: "lark_md"
        }
      }
    ]
  });

  if (analysis.tradingPlan?.strategy) {
    elements.push({
      tag: "note",
      elements: [{
        content: `策略: ${analysis.tradingPlan.strategy}`,
        tag: "plain_text"
      }]
    });
  }

  elements.push({
    tag: "hr"
  });
  
  elements.push({
    tag: "note",
    elements: [
      {
        content: `📅 ${new Date().toLocaleString('zh-CN')} | 🤖 Antigravity 机构决策引擎 | 5-Layer Model`,
        tag: "plain_text"
      }
    ]
  });

  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: ratingColor,
      title: {
        content: `📊 机构联席研判: ${analysis.stockInfo.name} (${analysis.stockInfo.symbol})`,
        tag: "plain_text"
      }
    },
    elements: elements
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "interactive", card: card })
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to send to Feishu:", error);
    return false;
  }
}
