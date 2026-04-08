import { Market, MarketOverview, StockAnalysis, AgentMessage, Scenario, Language } from "../types";
import { formatCommoditiesToMarkdown } from "./formatUtils";

export const getMarketOverviewPrompt = (indicesData: any[], commoditiesData: any[], history: any[], beijingDate: string, now: Date, market: Market = "A-Share", language: Language = "en") => {
  const isChinese = language === "zh-CN";
  return `
Current date and time (UTC): ${now.toISOString()}
Current date and time (China Standard Time): ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

**REAL-TIME INDICES DATA (ABSOLUTE GROUND TRUTH)**:
${JSON.stringify(indicesData, null, 2)}

**REAL-TIME COMMODITY DATA (GROUND TRUTH)**:
${formatCommoditiesToMarkdown(commoditiesData)}
**IMPORTANT**: Use the commodity data above ONLY if it is logically relevant to the market trend or the specific sectors being discussed. If a commodity (e.g., Gold) has no material impact, DO NOT include it in your analysis.

You are a professional ${market} markets analyst.

**DATA SOURCE HIERARCHY (CRITICAL)**: 
1. You **MUST MUST MUST** use the exact values from the "REAL-TIME INDICES DATA" section above for ALL corresponding fields in your JSON output (price, change, changePercent, previousClose).
2. **DO NOT** override ANY of the tool-provided indices numbers with data found in Google Search. The tool data is the mathematical ground truth for this session.
3. Use Google Search grounding **ONLY** for:
   - Gathering qualitative context: market news, hot sectors, macro events, and analyst opinions.
   - Fetching commodity prices or news if they are missing from the REAL-TIME section.
4. If, and ONLY if, the "REAL-TIME INDICES DATA" array is empty, then you must use Google Search to find the latest valid indices values.

Use Google Search grounding to gather the latest available public information.
If the current time in China is past 15:00 CST, you MUST prioritize fetching the "Closing Price" (收盘价) for ${market} indices.

Previous analysis context (for reference and continuity):
${JSON.stringify(history.slice(0, 3))}

Return valid, complete JSON only, with no markdown fences, no explanation, and no extra text outside the JSON object. Ensure the JSON is complete and not truncated.
**IMPORTANT**: The JSON MUST have "indices" at the root level. Do NOT wrap the entire response in another object like "marketOverview" or "data".
**CRITICAL**: Ensure the JSON is valid and complete. Do not truncate the JSON response.

Requirements:
1. **STRICT JSON STRUCTURE (CRITICAL)**: The root object MUST contain the "indices" array.
2. Prioritize today's ${market} market tone in the summary.
3. Include exactly 5 indices for the ${market} market:
   - If A-Share: SSE Composite, Shenzhen Component, ChiNext Index, CSI 300, and Hang Seng Index.
   - If HK-Share: Hang Seng Index, Hang Seng Tech Index, Hang Seng China Enterprises Index, Red Chips Index, and GEM Index.
   - If US-Share: S&P 500, Nasdaq Composite, Dow Jones Industrial Average, Russell 2000, and PHLX Semiconductor Index.
4. For each index provide: name, symbol, price, change, changePercent.
**SEARCH STRATEGY (CRITICAL)**: 
   - You MUST use Google Search to find the *contextual news* and *sector performance* for these indices. 
   - Search query should be something like: "${market} market news ${beijingDate}", "${market} sector hot ${beijingDate}", or "${market} indices analysis 东方财富".
   - **DO NOT** use search results to change the price/change numbers provided in the REAL-TIME section.
   - **VERIFY THE DATE & TIME (STRICT)**: You MUST verify that the data/news is for TODAY (${beijingDate}). If you only find data from a previous day, you MUST state "Warning: Today's news not yet available, showing data from [Date]" in the summary.
   - **RELIABLE SOURCES (PRIORITY)**: Prioritize news from **Sina Finance (新浪财经)**, **East Money (东方财富)**, **Xueqiu (雪球)**, or **Yahoo Finance**.
**CRITICAL DATA ACCURACY**: 
   - **MANUAL VERIFICATION**: For each index, check if (Price - Previous Close) matches the Change. If the tool data is consistent, use it. If not, note the discrepancy in the summary.
   - **SOURCE NAMING**: In the "marketSummary" field, mention the tool data source (Yahoo Finance) and any additional search sources used for context.
   - **BEIJING TIME (CRITICAL)**: All times in the summary MUST be in Beijing Time (CST). The "lastUpdated" field for news MUST be in "YYYY-MM-DD HH:mm:ss CST" format.
   - **DATA INTEGRITY CHECK**: If the "change" or "changePercent" is exactly 0, verify if the market was closed.
4. **SECTOR ANALYSIS (NEW)**: Analyze current hot sectors (板块) in the ${market} market and provide a conclusion for each.
5. **COMMODITY ANALYSIS (NEW)**: Analyze major commodity trends. **RELEVANCE (CRITICAL)**: Only analyze commodities that are currently driving the market.
6. **RECOMMENDATIONS**: Provide recommended stocks or sectors in the ${market} market based on the above analysis.
7. Include exactly 5 major financial news items from the latest market day for the ${market} market.
8. Each news item must have title, source, time, url, and summary.
9. **LANGUAGE (MANDATORY)**: All user-facing text fields MUST be in ${isChinese ? "Simplified Chinese" : "English"}.
10. **ANTI-HALLUCINATION (CRITICAL)**: If you cannot find relevant news, state it clearly. Do NOT invent numbers or news.
11. **NEWS ACCURACY & ACCESSIBILITY (CRITICAL)**: 
    - Each "url" MUST be the exact, direct, and publicly accessible link to the SPECIFIC article.
    - **STRICTLY PROHIBITED**: Do NOT use homepages (e.g., finance.sina.com.cn), search result pages, or login-required/paywalled content.
    - **VERIFICATION**: You MUST verify that the URL actually points to the specific article described by the title.
    - **SOURCES**: Prioritize authoritative and highly accessible sources: Sina Finance (新浪财经), East Money (东方财富), Xueqiu (雪球), and Phoenix Finance (凤凰财经).
    - **AVOID**: Avoid sources that frequently have broken links or paywalls like Economic Observer (经济观察网 - eeo.com.cn) unless you are certain the link is public.
    - If a specific article URL is not available, do NOT include that news item.
    - **LATEST DATA**: Use Google Search to ensure all news and data are from the most recent trading session or the current day.
11. Use real source URLs, never placeholder/example URLs.
12. Continuity: Based on previous analysis, identify if trends are continuing or reversing.

JSON schema:
{
  "indices": [
    {
      "name": "string",
      "symbol": "string",
      "price": 0,
      "change": 0,
      "changePercent": 0,
      "previousClose": 0
    }
  ],
  "topNews": [
    {
      "title": "string",
      "source": "string",
      "time": "string",
      "url": "string",
      "summary": "string"
    }
  ],
  "sectorAnalysis": [
    {
      "name": "string",
      "trend": "string",
      "conclusion": "string"
    }
  ],
  "commodityAnalysis": [
    {
      "name": "string",
      "trend": "string",
      "expectation": "string"
    }
  ],
  "recommendations": [
    {
      "type": "Stock | Sector",
      "name": "string",
      "reason": "string"
    }
  ],
  "marketSummary": "string"
}
`;
};

export const getAnalyzeStockPrompt = (symbol: string, market: Market, realtimeData: any, commoditiesData: any[], history: any[], beijingDate: string, beijingShortDate: string, now: Date, language: Language = "en") => {
  const isChinese = language === "zh-CN";
  return `
Current date and time (UTC): ${now.toISOString()}
Current date and time (China Standard Time): ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

**REAL-TIME DATA TOOL OUTPUT (ABSOLUTE GROUND TRUTH)**:
${realtimeData ? JSON.stringify(realtimeData, null, 2) : "No real-time data available from tool. Use Google Search grounding instead."}

**REAL-TIME COMMODITY DATA (GROUND TRUTH)**:
${formatCommoditiesToMarkdown(commoditiesData)}
**IMPORTANT**: Use the commodity data above ONLY if it is logically relevant to the stock's industry or cost structure. 
- **DYNAMIC VARIABLE SELECTION (MANDATORY)**: If the provided commodities (Gold, Oil, Copper, etc.) are NOT highly relevant to the target stock, you MUST **ignore them completely**. 
- **SEARCH-DRIVEN ANCHORS (MANDATORY)**: You MUST use Google Search to verify the prices of the 2-3 most critical raw materials or macro variables for this specific stock (e.g., Lithium Carbonate for EV batteries, Pulp for paper, DRAM prices for semiconductors, Freight rates for shipping, etc.). Even if prices are provided in the "REAL-TIME COMMODITY DATA" section, you MUST verify them with Google Search to ensure they are the latest and most accurate. If there is a discrepancy, prioritize the Google Search result and explicitly state: "Verified price from Google Search: [Price]".
- **FAILURE TO COMPLY**: Including irrelevant variables (like Oil for a software company) or failing to verify critical raw material prices will be treated as a "hallucination/logic failure".

You are a professional equity analyst.
Analyze stock "${symbol}" in the ${market} market using the latest available public information and Google Search grounding.
**LANGUAGE (MANDATORY)**: All output MUST be in ${isChinese ? "Simplified Chinese" : "English"}.

**DATA SOURCE HIERARCHY (CRITICAL)**: 
1. If the "REAL-TIME DATA TOOL OUTPUT" is provided above, you **MUST MUST MUST** use its exact values for ALL matching fields in your JSON output. This includes: "price", "change", "changePercent", "previousClose", "lastUpdated", "dailyHigh" (use dayHigh), "dailyLow" (use dayLow), "pe" (use pe), and currency.
2. **DO NOT** override ANY of the tool-provided numbers with data found in Google Search. The tool data is the absolute mathematical truth.
3. Use Google Search grounding **ONLY** for:
   - Filling in missing fundamental data not provided by the tool (e.g., PB, ROE, EPS, Revenue Growth).
   - Gathering qualitative context: company news, sector trends, management narratives, and analyst opinions.
4. If, and ONLY if, the "REAL-TIME DATA TOOL OUTPUT" says "No real-time data available", then you must use Google Search to find the latest valid price and fundamental data.

If the current time in China is past 15:00 CST (for A-shares) or 16:00 HKT (for HK-shares), the market is closed and you are summarizing the closing action.

Previous analysis context (for reference and continuity):
${JSON.stringify(history.filter((h: any) => h.stockInfo?.symbol === symbol).slice(0, 3))}

Return JSON only, with no markdown fences and no explanation outside the JSON object.
**IMPORTANT**: The JSON MUST have "stockInfo" at the root level. Do NOT wrap the entire response in another object like "analysis" or "data".

Requirements:
1. **STRICT MARKET ADHERENCE (CRITICAL)**: 
   - You MUST identify the company that matches this symbol SPECIFICALLY in the ${market} market. 
   - **NAME-TO-CODE RESOLUTION**: If "${symbol}" is a company name (e.g., "贵州茅台"), you MUST first find its official stock code (e.g., 600519.SH) before searching for price data. Ensure the suffix (.SH, .SZ, .HK) matches the ${market}.
   - **A-SHARE PINYIN SUPPORT**: For the A-Share market, the search term "${symbol}" might be a 6-digit code (e.g., 600989) OR a pinyin abbreviation (e.g., "GZMT" for 贵州茅台). You MUST resolve these abbreviations to the correct A-share stock.
   - If the symbol exists in multiple markets (e.g., "AAPL" in US vs "AAPL" as a placeholder elsewhere), you MUST prioritize the ${market} version.
   - The "market" field in the returned JSON MUST be exactly "${market}".
   - If the symbol is NOT found in the ${market} market, return an error in the "summary" field and provide empty data for other fields, but DO NOT return a stock from a different market.
2. Provide stockInfo with symbol, name, price, change, changePercent, market, currency, lastUpdated, and **previousClose** (the closing price of the previous trading day).
3. **SEARCH STRATEGY (CRITICAL)**: 
   - You MUST use Google Search to find the *real-time* or *latest* price for "${symbol}" in the ${market} market. 
   - **SPECIFIC SEARCH QUERIES**: Use queries like:
     - "${symbol} ${beijingDate} 现价 昨收 涨跌"
     - "${symbol} 东方财富 实时行情"
     - "${symbol} sina finance stock price today"
   - **DO NOT** rely on your internal knowledge for the current price. 
   - **VERIFY THE DATE & TIME (STRICT)**: You MUST verify that the data is for TODAY (${beijingDate}). 
   - **SNIPPET VERIFICATION**: Look for "${beijingShortDate}" or "今日" in the search result snippets. If you only find a previous date or "昨日", the data is STALE and you MUST keep searching or state it's unavailable.
   - **RELIABLE SOURCES (PRIORITY)**: Prioritize data from **Sina Finance (新浪财经)**, **East Money (东方财富)**, or **Xueqiu (雪球)**. These are the most authoritative for A-shares.
4. **FUNDAMENTAL DATA (NEW)**: Provide specific fundamental data (e.g., PE, PB, ROE, EPS, Revenue Growth).
5. **VALUATION LEVEL (NEW)**: Provide current "water level" (水位) - valuation percentile compared to historical data.
6. **DEEP FUNDAMENTAL ANALYSIS (CRITICAL)**: 
   - **INDUSTRY-SPECIFIC LOGIC (CRITICAL)**: Avoid boilerplate analysis. You MUST identify the 3 most critical value drivers for this SPECIFIC stock (e.g., for Mindray: R&D efficiency, healthcare policy, overseas expansion; for a tech stock: compute power costs, user growth). **Use Google Search to find these specific drivers.**
   - **FULL-DIMENSIONAL PENETRATION (NEW)**: Do not just look at financial statements. Penetrate to the business level: analyze management quality, supply chain control, customer stickiness, and technological moats.
   - **FORWARD-LOOKING JUDGMENT (NEW)**: Based on your research, provide a high-conviction prediction for the next 2-4 quarters. Identify potential inflection points or trend continuations. **PREVENT OVERCONFIDENCE (CRITICAL)**: If key evidence for a forward-looking judgment is missing, you MUST explicitly label it as "Logical Gap due to Missing Information" instead of forcing a prediction.
   - **SEARCH NOISE FILTERING (MANDATORY)**: When performing penetration research, prioritize official announcements, authoritative media, deep research reports, and industry data. **Be extremely cautious** and filter out unverified forum rumors, marketing content, or social media noise.
     - **DATA SOURCE & VERIFICATION (MANDATORY)**: For EVERY fundamental data point (PE, PB, ROE, EPS, Revenue Growth, etc.) presented in your analysis, you MUST:
       1. **Pre-label the source and date**: Before presenting the value, explicitly state the source and the date of the data.
       2. **Cross-verify**: You MUST cross-verify this data point against at least TWO authoritative sources. If there is a discrepancy, explain how you resolved it or which source you prioritized and why.
   - **TABLE 1: REAL-TIME CORE INDICATORS & DEVIATION (MANDATORY)**: Must include columns: Indicator (2026E), Real-time Value, Market Consensus, Deviation (%), Note. Include EPS, PE (Forward), ROE, Dividend Yield. **DATA CONSISTENCY (CRITICAL)**: Prioritize the latest real-time data from search and explicitly label the data date.
   - **TABLE 2: INDUSTRY CORE VARIABLES & MACRO ANCHORS (DYNAMIC)**: Must include columns: Variable/Material (with units), Current Value, Logic Weight, Last 30 Days Change (%), cost/revenue transmission logic, **Data Source and Date (MANDATORY)**.
   - **VARIABLE SELECTION & VERIFICATION (CRITICAL)**: DO NOT include irrelevant variables. You must use industry-specific variables relevant to this stock.
   - **EXPECTATION GAP IDENTIFICATION**: Identify market blind spots and Alpha sources.
   - **TARGET PRICE & SENTIMENT**: Provide a 6-month target range (with confidence interval) and a sentiment score (0-100).
   - **EVIDENCE LEVEL (MANDATORY)**: When identifying these critical value drivers, you MUST label the source and its "Evidence Level".
   - **REVERSE VERIFICATION (CRITICAL)**: After identifying the core indicators, you MUST ask and answer: "If this indicator changes by 10% in an unfavorable direction, how much impact will the company's net profit suffer?" Provide a specific quantitative estimate.
   - **RELEVANCE CHECK (STRICT)**: **DO NOT** include irrelevant macro variables in your analysis or sensitivity tables unless there is a direct, logical causal link.
   - **LOOK THROUGH SURFACE DATA**: Do NOT just report PE, PB, or reported profits. Analyze actual operating cash flow, asset turnover, inventory cycles, and R&D efficiency.
   - **NARRATIVE VS DATA CONSISTENCY**: Detect if management's growth narrative matches actual financial data. If there's a mismatch, flag it.
   - **NET-NET CALCULATION**: Calculate Graham's "Net-Net" value: (Current Assets - Total Liabilities). If Price < Net-Net, it's "Deep Value".
   - **BUFFETT'S MOAT THEORY**: Analyze the company's "Economic Moat" (Wide, Narrow, or None) and its source.
   - **EXPECTATION VS REALITY**: Compare current performance with previous market expectations.
   - **MARGIN OF SAFETY**: Incorporate "Margin of Safety" theory into the fundamental analysis and trading advice.
7. **HISTORICAL CONTEXT (NEW)**: Include historical price ranges and major historical events affecting the stock.
7. **CRITICAL DATA ACCURACY (HIGH PRIORITY)**: 
   - You MUST search for the most recent trading data for this stock. 
   - **CROSS-REFERENCE (MANDATORY)**: You MUST cross-reference at least TWO authoritative financial sources to verify the current price, previous close, change, and changePercent.
   - **MARKET STATUS**: Determine if the market is currently open or closed. If open, provide real-time data. If closed, provide the latest closing data.
   - **CALCULATION CHECK (CRITICAL)**: The "change" MUST be (Current Price - Previous Close). The "changePercent" MUST be (Change / Previous Close * 100). 
   - **EXAMPLE CHECK**: For ${symbol} on ${beijingDate}, if the price is X and it rose from Y, the change is (X-Y). DOUBLE CHECK THE DATE.
   - **PREVENT SWAPPING (CRITICAL)**: Double check if you are swapping "Current Price" and "Previous Close".
   - **SOURCE NAMING**: You MUST explicitly state the source name (e.g., "Source: Sina Finance") AND the direct URL of the financial page you used for the price data at the end of the "summary" field.
   - **BEIJING TIME (CRITICAL)**: For A-shares and HK-shares, all times MUST be in Beijing Time (CST). The "lastUpdated" field MUST be in "YYYY-MM-DD HH:mm:ss CST" format.
   - **REASONABLENESS CHECK**: If the price is significantly different from the previous close or historical ranges, you MUST double-check the stock code and market.
   - **TIMESTAMP**: The "lastUpdated" field MUST reflect the actual time of the data point.
   - If there is a discrepancy between sources, prioritize the most recent one.
   - **DATA INTEGRITY CHECK**: If the "change" or "changePercent" is exactly 0, verify if the stock was suspended or if it's a non-trading day.
   - **DAILY RANGE CHECK**: You MUST find the "Daily High" and "Daily Low". The "Current Price" MUST be within this range.
8. **DATA TYPES**: 
   - "price", "change", and "changePercent" MUST be numbers (not strings).
   - "changePercent" should be the percentage value (e.g., 5.2 for 5.2% increase).
9. Include 3 to 5 recent and relevant news items for this exact company.
10. **NEWS ACCURACY & ACCESSIBILITY (CRITICAL)**: 
   - Each "url" MUST be the exact, direct, and publicly accessible link to the SPECIFIC article.
   - **STRICTLY PROHIBITED**: Do NOT use homepages, search result pages, or login-required/paywalled content.
   - **VERIFICATION**: You MUST verify that the URL actually points to the specific article described by the title.
10. All user-facing text fields must be in ${isChinese ? "Simplified Chinese" : "English"}.
11. Provide summary, technicalAnalysis, fundamentalAnalysis, sentiment, score, recommendation, keyRisks, keyOpportunities, and a detailed tradingPlan.
12. **MARGIN OF SAFETY (NEW)**: Incorporate "Margin of Safety" theory into the fundamental analysis and trading plan.
13. **EVIDENCE-BASED REASONING (CRITICAL)**: For every claim made in the analysis, you MUST provide specific evidence.
14. **CAUSATION VS CORRELATION**: Explicitly distinguish between variables.
15. **CYCLE & VOLATILITY (NEW)**: For cyclical stocks, identify the current stage.
16. **TRACKABLE METRICS (NEW)**: Define specific "Verification Metrics".
17. **CAPITAL BEHAVIOR (NEW)**: Analyze Northbound flow, institutional changes, and AH premium.
18. **TRADING PLAN LOGIC (NEW)**: 
    - If the recommendation is NOT "Buy" or "Strong Buy", the tradingPlan should state "Not Recommended" for entryPrice, targetPrice, and stopLoss. 
    - **STRATEGY RISKS (NEW)**: Clearly state the specific risks associated with the recommended strategy.
19. tradingPlan must include: entryPrice, targetPrice, stopLoss, strategy, and strategyRisks (all as strings).
20. sentiment must be one of: Bullish, Bearish, Neutral.
21. recommendation must be one of: Strong Buy, Buy, Hold, Sell, Strong Sell.
22. Continuity: Based on previous analysis of this stock, identify if trends are continuing or reversing.
23. **ANTI-HALLUCINATION (CRITICAL)**: If you cannot find the data, state it clearly in the summary. Do NOT find invent numbers.

JSON schema:
{
  "stockInfo": {
    "symbol": "string",
    "name": "string",
    "price": 0,
    "change": 0,
    "changePercent": 0,
    "market": "${market}",
    "currency": "string",
    "lastUpdated": "string",
    "previousClose": 0,
    "dailyHigh": 0,
    "dailyLow": 0
  },
  "fundamentals": {
    "pe": "string",
    "pb": "string",
    "roe": "string",
    "eps": "string",
    "revenueGrowth": "string",
    "valuationPercentile": "string",
    "netProfitGrowth": "string",
    "debtToEquity": "string",
    "grossMargin": "string",
    "netMargin": "string",
    "dividendYield": "string"
  },
  "fundamentalTable": [
    {
      "indicator": "string",
      "value": "string",
      "consensus": "string",
      "deviation": "string",
      "remark": "string"
    }
  ],
  "industryAnchors": [
    {
      "variable": "string",
      "currentValue": "string",
      "weight": "string",
      "monthlyChange": "string",
      "logic": "string"
    }
  ],
  "historicalData": {
    "yearHigh": "string",
    "yearLow": "string",
    "majorEvents": ["string"]
  },
  "valuationAnalysis": {
    "comparison": "string",
    "marginOfSafetySummary": "string"
  },
  "moatAnalysis": {
    "type": "string",
    "strength": "Wide | Narrow | None",
    "logic": "string"
  },
  "narrativeConsistency": {
    "score": 85,
    "warning": "string",
    "details": "string"
  },
  "netNetValue": 0,
  "isDeepValue": true,
  "verificationMetrics": [
    {
      "indicator": "string",
      "threshold": "string",
      "timeframe": "string",
      "logic": "string"
    }
  ],
  "capitalFlow": {
    "northboundFlow": "string",
    "institutionalHoldings": "string",
    "ahPremium": "string",
    "marketSentiment": "string"
  },
  "cycleAnalysis": {
    "stage": "Early | Mid | Late | Bottom | Peak",
    "logic": "string",
    "volatilityRisk": "string"
  },
  "news": [
    {
      "title": "string",
      "source": "string",
      "time": "string",
      "url": "string",
      "summary": "string"
    }
  ],
  "summary": "string",
  "technicalAnalysis": "string",
  "fundamentalAnalysis": "string",
  "sentiment": "Bullish | Bearish | Neutral",
  "score": 0,
  "recommendation": "Strong Buy | Buy | Hold | Sell | Strong Sell",
  "keyRisks": ["string"],
  "keyOpportunities": ["string"],
  "tradingPlan": {
    "entryPrice": "string",
    "targetPrice": "string",
    "stopLoss": "string",
    "strategy": "string",
    "strategyRisks": "string"
  }
}
`;
};

export const getChatMessagePrompt = (userMessage: string, analysis: StockAnalysis, commoditiesData: any[], language: Language = "en") => {
  const isChinese = language === "zh-CN";
  return `
You are a professional equity analyst answering a follow-up question from a user.

Existing analysis JSON:
${JSON.stringify(analysis)}

**REAL-TIME COMMODITY DATA (GROUND TRUTH)**:
${formatCommoditiesToMarkdown(commoditiesData)}
**IMPORTANT**: Use the commodity data above ONLY if it is logically relevant to the user's question or the stock's industry.

User question:
${userMessage}

**LANGUAGE (MANDATORY)**: All output MUST be in ${isChinese ? "Simplified Chinese" : "English"}.
Be concise, balanced, and practical.
If the question goes beyond the known analysis, say so clearly instead of inventing facts.
`.trim();
};

export const getStockReportPrompt = (analysis: StockAnalysis, language: Language = "en") => {
    const isChinese = language === "zh-CN";
    return `
    ${isChinese ? `
    基于以下个股分析数据，生成一份完整的个股深度研究报告。
    
    报告应包含：
    1. 🚀 **股票基本信息**：名称、代码、当前价格、涨跌幅。
    2. 🧠 **AI 核心观点摘要**：
       - 技术面、基本面、情绪面、风险管理各方的核心分析结论。
    3. 🎯 **AI 最终结论**：明确的操作建议。
    4. 🛡️ **安全边际评估**：基于安全边际理论的深度评价。
    5. 📈 **交易计划**：建议买入价、目标价、止损价。
    6. ⚠️ **核心机会与风险提示**。
    ${analysis.backtestResult ? `7. ⏪ **历史回测复盘**: 上次建议 ${analysis.backtestResult.previousRecommendation}, 实际收益 ${analysis.backtestResult.actualReturn}` : ''}
    ` : `
    Based on the following stock analysis data, generate a comprehensive stock research report.
    
    The report should include:
    1. 🚀 **Stock Basic Info**: Name, Symbol, Price, Change.
    2. 🧠 **AI Core Insights Summary**:
       - Core analysis conclusions from technical, fundamental, sentiment, and risk management perspectives.
    3. 🎯 **AI Final Conclusion**: Clear operational advice.
    4. 🛡️ **Margin of Safety Assessment**: In-depth evaluation based on Margin of Safety theory.
    5. 📈 **Trading Plan**: Recommended Entry Price, Target Price, Stop Loss.
    6. ⚠️ **Key Opportunities & Risks**.
    ${analysis.backtestResult ? `7. ⏪ **Historical Backtest Review**: Previous Recommendation ${analysis.backtestResult.previousRecommendation}, Actual Return ${analysis.backtestResult.actualReturn}` : ''}
    `}
    
    Analysis Data:
    ${JSON.stringify(analysis)}
    
    Please use a format friendly to Feishu cards: do not use #, >, - or other Markdown symbols. Use **bold text** and Emojis as headers. Each major block must be separated by '---'. Ensure table data uses standard Markdown table format for alignment. **Do not include full discussion records**.
    Answer language: ${isChinese ? "Simplified Chinese" : "English"}.
`.trim();
};

export const getDiscussionReportPrompt = (analysis: StockAnalysis, discussion: AgentMessage[], commoditiesData: any[], scenarios?: Scenario[], backtestResult?: any, language: Language = "en") => {
    const isChinese = language === "zh-CN";
    return `
    ${isChinese ? `
    基于以下个股分析数据、AI 专家组研讨记录以及场景概率分布，生成一份完整的个股深度研究报告。
    
    报告应包含：
    1. 🚀 **股票基本信息**：名称、代码、当前价格、涨跌幅。
    2. 🧠 **AI 专家组研讨摘要**：
       - 技术面、基本面、情绪面、风险管理、反向策略各方的核心观点。
       - 研讨中的主要分歧或共识点。
    3. 🎯 **首席策略师最终结论**：明确的操作建议。
    4. 🛡️ **安全边际评估**：基于安全边际理论的深度评价。
    5. 📈 **交易计划**：建议买入价、目标价、止损价。
    6. ⚠️ **核心机会与风险提示**。
    ${backtestResult ? `7. ⏪ **历史回测复盘**: 上次建议 ${backtestResult.previousRecommendation}, 实际收益 ${backtestResult.actualReturn}` : ''}
    ` : `
    Based on the following stock analysis data, AI expert group discussion records, and scenario probability distributions, generate a comprehensive deep research report.
    
    The report should include:
    1. 🚀 **Stock Basic Info**: Name, Symbol, Price, Change.
    2. 🧠 **AI Expert Group Discussion Summary**:
       - Core views from technical, fundamental, sentiment, risk management, and contrarian strategy perspectives.
       - Main points of disagreement or consensus in the discussion.
    3. 🎯 **Chief Strategist's Final Conclusion**: Clear operational advice.
    4. 🛡️ **Margin of Safety Assessment**: In-depth evaluation based on Margin of Safety theory.
    5. 📈 **Trading Plan**: Recommended Entry Price, Target Price, Stop Loss.
    6. ⚠️ **Key Opportunities & Risks**.
    ${backtestResult ? `7. ⏪ **Historical Backtest Review**: Previous Recommendation ${backtestResult.previousRecommendation}, Actual Return ${backtestResult.actualReturn}` : ''}
    `}
    
    Analysis Data:
    ${JSON.stringify(analysis)}

    **REAL-TIME COMMODITY DATA (GROUND TRUTH)**:
    ${JSON.stringify(commoditiesData, null, 2)}
    **IMPORTANT**: Use the commodity data above ONLY if it is logically relevant to the stock.
    
    Discussion Records:
    ${discussion.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}
    
    Please use a format friendly to Feishu cards: do not use #, >, - or other Markdown symbols. Use **bold text** and Emojis as headers. Each major block must be separated by '---'. Ensure table data uses standard Markdown table format for alignment. **Do not include full discussion records**.
    Answer language: ${isChinese ? "Simplified Chinese" : "English"}.
`.trim();
};

export const getDailyReportPrompt = (marketOverview: MarketOverview, commoditiesData: any[], now: Date, beijingDate: string, language: Language = "en") => {
    const isChinese = language === "zh-CN";
    return `
    Current date and time: ${now.toISOString()}
    
    You are a professional markets analyst.
    Use Google Search grounding to gather the latest available public information about the market situation from the previous day or the weekend.
    
    Market Overview Data (for context):
    ${JSON.stringify(marketOverview)}

    **REAL-TIME COMMODITY DATA (GROUND TRUTH)**:
    ${formatCommoditiesToMarkdown(commoditiesData)}
    **IMPORTANT**: Use the commodity data above ONLY if it is logically relevant.
    
    Requirements:
    1. Summarize the market tone.
    2. Include key indices performance.
    3. List 3-5 major financial news items.
    4. **NEWS ACCURACY & ACCESSIBILITY (CRITICAL)**: 
       - Each news item MUST include a direct, publicly accessible URL.
    5. Provide a prediction for today's market opening and trend.
    6. Recommend 3 stocks or sectors to watch today with brief reasons.
    7. Please use a format friendly to Feishu cards: do not use #, >, - or other Markdown symbols. Use **bold text** and Emojis as headers. Each major block must be separated by '---'.
    8. Answer language: ${isChinese ? "Simplified Chinese" : "English"}.
    
    Structure:
    # 📅 Daily Market Insight (${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(now)})
    
    ---
    
    ## 🏦 1. Market Review
    ...
    
    ## 📰 2. Core Financial News
    ...
    
    ## 🔮 3. Prediction and Strategy
    ...
    
    ## 🌟 4. Stocks/Sectors to Watch
    ...
    
    ---
    *This report is automatically generated by TradingAgents AI expert group.*
`.trim();
};

export const getChatReportPrompt = (stockName: string, chatHistory: { role: string; content: string }[], language: Language = "en") => {
  const isChinese = language === "zh-CN";
  return `
    ${isChinese ? `
    基于以下关于 ${stockName} 的深度追问会话记录，生成一份专业、简洁的研讨总结报告。
    
    报告应包含：
    1. 💬 **会话背景**：简述本次追问讨论的核心股票。
    2. 🧠 **核心问答摘要**：提炼投资者最关心的几个问题及其对应的 AI 专家解答。
    3. 🎯 **关键结论与建议**：基于讨论内容总结出的最新操作建议或观点。
    4. ⚠️ **新增风险/机会提示**：讨论中新发现的风险点或机会点。
    ` : `
    Based on the following session history of ${stockName}, generate a professional and concise discussion summary report.
    
    The report should include:
    1. 💬 **Session Background**: Briefly describe the target stock of this discussion.
    2. 🧠 **Core Q&A Summary**: Extract key questions from investors and their corresponding AI expert answers.
    3. 🎯 **Key Conclusions & Suggestions**: Summarize latest operational advice or views based on the discussion.
    4. ⚠️ **New Risks/Opportunities**: New risk or opportunity points discovered during the discussion.
    `}
    
    Session History:
    ${JSON.stringify(chatHistory)}
    
    Please use a format friendly to Feishu cards: do not use #, >, - or other Markdown symbols. Use **bold text** and Emojis as headers. Each major block must be separated by '---'.
    Answer language: ${isChinese ? "Simplified Chinese" : "English"}.
`.trim();
};

export const getDiscussionPrompt = (
  analysis: StockAnalysis,
  commoditiesData: any[],
  memoryContext: string,
  historyContext: string,
  language: Language = "en"
) => {
  const isChinese = language === "zh-CN";
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  return `
    You are a professional team of 8 elite financial analysts conducting a high-level joint meeting to provide institutional-grade research on the following stock.
    This is not a simple report, but a realistic, multi-round professional deliberation with intense debate and data cross-examination.

    **LANGUAGE (MANDATORY)**: All communication and output MUST be in ${isChinese ? "Simplified Chinese" : "English"}.

    **Current Date**: ${today}
    **Data Timeliness Redline (CRITICAL)**: All macro variables (exchange rates, interest rates, commodities) MUST prioritize the **REAL-TIME COMMODITY DATA** below. If missing, use Google Search for today's (${today}) latest quotes.
    **Data Priority Redline (CRITICAL)**: QUANTITATIVE CONCLUSIONS MUST FOLLOW **BUILT-IN REAL-TIME DATA > AUTHORITATIVE API > GOOGLE SEARCH > OTHERS**.

    **REAL-TIME COMMODITY DATA (GROUND TRUTH - ${today})**:
    ${formatCommoditiesToMarkdown(commoditiesData)}
    
    ${memoryContext}
    - **STRICT RELEVANCE CONSTRAINT (CRITICAL)**: Use commodity data ONLY if it is a DIRECT and MATERIAL driver for the industry. 
    - **DYNAMIC VARIABLE SELECTION (MANDATORY)**: If provided commodities are NOT relevant, IGNORE them.
    - **SEARCH-DRIVEN ANCHORS**: Use Google Search to identify the 2-3 most critical macro variables or raw material prices for this specific stock.
    
    **Team Members (8, in order of speaking)**:
    1. **Deep Research Specialist**: First speaker, responsible for full-dimension data penetration.
       - Use Google Search for deep qualitative insights (management, supply chain, moats).
       - **Graham's Net-Net Value Calculation**: Attempt to calculate (Current Assets - Total Liabilities) vs current Market Cap.
       - **Business Moat Analysis**: Specifically categorize the moat as Wide, Narrow, or None based on industry barriers.
       - Select 4-6 most core industry-specific quantitative indicators.
       - **Table 1: Real-time Core Indicators & Deviation (MANDATORY)**.
       - **Table 2: Industry Core Variables & Macro Anchors (DYNAMIC)**.
       - Label each data point with Source and Date.
       - **[Structured Output] Core Variables (MANDATORY)**: Populate \`coreVariables\` in JSON.

    2. **Technical Analyst**: Responsible for deep technical analysis.
       - Trend qualification, key levels (Support/Resistance), MACD/RSI/Volume signal interpretation.

    3. **Fundamental Analyst**: Responsible for fundamental value analysis.
       - Core value drivers, valuation logic (PE/PB vs industry/history), DCF/Comparative valuation.
       - **[Structured Output] Business Model (MANDATORY)**: Populate \`businessModel\` in JSON.

    4. **Sentiment Analyst**: Responsible for market sentiment and capital flow analysis.
       - Capital structure search (Northbound, Mutual Funds, AH Premium). Distinguish between "institutional accumulation" and "retail panic".
       - **[Structured Output] Crowded Trade Indicator**: Specifically search for signs of overcrowded positions or extreme consensus.

    5. **Risk Manager**: Responsible for extreme risk scenario analysis.
       - Black swan scenarios, direct rebuttals to bullish views, quantified risk metrics.
       - **[Structured Output] Quantitative Risk Matrix (MANDATORY)**: Populate \`quantifiedRisks\` in JSON.

    6. **Contrarian Strategist**: Responsible for challenging all consensus.
       - Crowded trade analysis, deconstructing mainstream narratives, identifying "Blind Spots".
       - **[Antithesis Creation]**: Must formulate a logical "Inversion Theory" (What if the bullish base case fails?).

    7. **Professional Reviewer**: Responsible for logic auditing and data "dehydration".
       - Attacking narrative traps, valuation consistency audit, SOTP decision matrix.

    8. **Chief Strategist**: Last speaker, responsible for unified decision.
       - Probability-weighted framework (Σ(P_i * TargetPrice_i)), position sizing, exit triggers.
       - **[Structured Output] Core Decision Data**: Populate \`expectedValueOutcome\` and \`sensitivityMatrix\` in JSON.

    **Analysis Target Data**: ${JSON.stringify(analysis)}
    ${historyContext}

    **Deliberation Quality Requirements**:
    1. **Data Accuracy**: Use Google Search for latest data.
    2. **Authoritative Labeling**: All data must have Source and Date.
    3. **API Cross-Verification (MANDATORY)**: Compare search data with \`analysis.stockInfo\` (Bank/API ground truth).
    4. **Data Density**: High quantifiable data usage (prices, %, multiples).
    5. **Markdown Format**: Use Markdown for content fields (### Headers, Tables, Bold).
    6. **Direct Debate**: Analysts MUST reference and challenge each other.
    7. **FinGPT-Style Logic Audit (CRITICAL)**: Analysts MUST avoid generic "AI-speak". Focus on:
       - **Specific Expectations**: Compare current data to what the market *was* expecting.
       - **Causal Chains**: Explain "Why" A affects B, not just "That" A affects B.
       - **Logic Audit Checklist (MANDATORY for Reviewer)**: Verify if statements suffer from:
         *   *Confirmation Bias*: Ignoring bearish data in a bullish trend.
         *   *Projection Bias*: Assuming current linear growth extends infinitely.
         *   *Narrative Overfitting*: Making data fit a pre-conceived story.
    8. **Scenario Probability Framework (MANDATORY for Chief Strategist)**:
       - Output MUST include 3 distinct scenarios: Bull Case, Base Case, and Bear Case.
       - Assign probabilities (Σ = 100%) and target prices for each.
       - Calculate the **Risk-Adjusted Expected Value (EV)**.

    Return JSON ONLY. No markdown code blocks, no extraneous text.

    JSON Structure:
    {
      "messages": [
        { "role": "Deep Research Specialist", "content": "Markdown content with tables...", "timestamp": "${now}", "type": "research", "references": [] },
        ...
      ],
      "dataVerification": [
        { "source": "Source Name", "isVerified": true, "discrepancy": "None", "confidence": 95, "lastChecked": "${now}" }
      ],
      "finalConclusion": "Comprehensive strategic conclusion...",
      "tradingPlan": {
        "entryPrice": "Entry level",
        "targetPrice": "Target level",
        "stopLoss": "Stop loss level",
        "strategy": "Logical strategy...",
        "strategyRisks": "Specific risks...",
        "positionPlan": [{ "price": "X", "positionPercent": Y }],
        "logicBasedStopLoss": "Condition-based stop",
        "riskRewardRatio": 2.5
      },
      "coreVariables": [
        { "name": "Var Name", "value": "Val", "unit": "Unit", "marketExpect": "Exp", "delta": "Delta", "reason": "Reason", "evidenceLevel": "Lvl", "source": "Src", "dataDate": "Date" }
      ],
      "businessModel": { ... },
      "quantifiedRisks": [ ... ],
      "riskAdjustedValuation": 150,
      "scenarios": [ ... ],
      "sensitivityFactors": [ ... ],
      "expectationGap": { ... },
      "expectedValueOutcome": { ... },
      "sensitivityMatrix": [ ... ],
      "controversialPoints": [ ... ],
      "calculations": [ ... ],
      "dataFreshnessStatus": "Fresh",
      "stressTestLogic": "...",
      "catalystList": [ ... ],
      "verificationMetrics": [ ... ],
      "capitalFlow": { ... },
      "positionManagement": { ... },
      "timeDimension": { ... }
    }
  `;
};

export const getQuickScanPrompt = (
  symbol: string,
  market: Market,
  realtimeData: any,
  beijingDate: string,
  language: Language = "en"
) => {
  const isChinese = language === "zh-CN";
  return `
You are a senior financial analyst. Based on the following real-time data, perform a Quick Scan evaluation for ${symbol} (${market}).

**Real-time Data (Absolute Ground Truth)**:
${JSON.stringify(realtimeData, null, 2)}

**Date**: ${beijingDate}
**LANGUAGE (MANDATORY)**: All output MUST be in ${isChinese ? "Simplified Chinese" : "English"}.

Please return JSON:
{
  "stockInfo": { "symbol": "${symbol}", "name": "Name", "price": number, "change": number, "changePercent": number, "market": "${market}", "currency": "Currency", "lastUpdated": "Time", "previousClose": number },
  "score": 0-100,
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "summary": "Core judgment in 2-3 sentences",
  "keyRisks": ["Risk 1"],
  "keyOpportunities": ["Opportunity 1"],
  "news": [],
  "technicalAnalysis": "Short technical view",
  "fundamentalAnalysis": "Short fundamental view"
}

Requirements:
1. Quick assessment based on price, change, and market status.
2. Score reflects trend strength and valuation.
3. Provide a clear one-sentence "Reason for Recommendation".
`;
};
