import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';
import { monitor } from './dataSourceHealth.js';

const yahooFinance = new YahooFinance();
const router = Router();

// Market Indices
router.get('/stock/indices', async (req, res) => {
  const { market } = req.query;

  const indexSymbols: Record<string, { symbol: string; name: string }[]> = {
    'A-Share': [
      { symbol: '000001.SS', name: '上证综指' },
      { symbol: '399001.SZ', name: '深证成指' },
      { symbol: '399006.SZ', name: '创业板指' },
      { symbol: '000300.SS', name: '沪深300' },
      { symbol: '^HSI', name: '恒生指数' },
    ],
    'HK-Share': [
      { symbol: '^HSI', name: '恒生指数' },
      { symbol: '^HSTECH', name: '恒生科技指数' },
      { symbol: '^HSCE', name: '国企指数' },
      { symbol: '^HSCCI', name: '红筹指数' },
      { symbol: '^S&P/HKEX GEM', name: '创业板指数' },
    ],
    'US-Share': [
      { symbol: '^GSPC', name: 'S&P 500' },
      { symbol: '^IXIC', name: '纳斯达克综合' },
      { symbol: '^DJI', name: '道琼斯工业' },
      { symbol: '^RUT', name: '罗素2000' },
      { symbol: '^SOX', name: '费城半导体' },
    ],
  };

  const marketKey = (market as string) || 'A-Share';
  const symbols = indexSymbols[marketKey] || indexSymbols['A-Share'];

  try {
    const results: any[] = [];
    for (const idx of symbols) {
      try {
        const quote = await yahooFinance.quote(idx.symbol as any) as any;
        if (quote) {
          const price = quote.regularMarketPrice;
          const prevClose = quote.regularMarketPreviousClose;
          let change = quote.regularMarketChange;
          let changePercent = quote.regularMarketChangePercent;

          if (change === undefined && price !== undefined && prevClose !== undefined) {
            change = price - prevClose;
          }
          if (changePercent === undefined && change !== undefined && prevClose !== undefined && prevClose !== 0) {
            changePercent = (change / prevClose) * 100;
          }

          const marketTime = quote.regularMarketTime ? new Date(quote.regularMarketTime) : new Date();
          const formattedTime = marketTime.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });

          results.push({
            name: idx.name,
            symbol: idx.symbol,
            price,
            change: change !== undefined ? parseFloat(change.toFixed(2)) : 0,
            changePercent: changePercent !== undefined ? parseFloat(changePercent.toFixed(2)) : 0,
            previousClose: prevClose,
            lastUpdated: formattedTime + ' CST',
            source: 'Yahoo Finance API',
            marketState: quote.marketState,
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch index ${idx.symbol}:`, e instanceof Error ? e.message : String(e));
      }
    }
    res.json(results);
  } catch (error) {
    console.error('Indices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch indices data' });
  }
});

// Commodities
router.get('/stock/commodities', async (req, res) => {
  const commoditySymbols = [
    { symbol: 'GC=F', name: '伦敦金 (XAU)', unit: '$/oz' },
    { symbol: 'HG=F', name: 'LME铜 (HG)', unit: '$/lb' },
    { symbol: 'CL=F', name: '原油 (WTI)', unit: '$/bbl' },
    { symbol: 'SI=F', name: '白银', unit: '$/oz' },
  ];

  try {
    const results: any[] = [];
    for (const item of commoditySymbols) {
      try {
        const quote = await yahooFinance.quote(item.symbol) as any;
        if (quote) {
          results.push({
            name: item.name,
            symbol: item.symbol,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent !== undefined ? parseFloat(quote.regularMarketChangePercent.toFixed(2)) : 0,
            unit: item.unit,
            lastUpdated: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + ' CST'
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch commodity ${item.symbol}:`, e instanceof Error ? e.message : String(e));
      }
    }
    res.json(results);
  } catch (error) {
    console.error('Commodities fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch commodities data' });
  }
});

// Real-time Stock Data
router.get('/stock/realtime', async (req, res) => {
  const { symbol, market, symbols } = req.query;

  // Handle multiple symbols (batch)
  if (symbols && typeof symbols === 'string' && symbols.trim()) {
    try {
      const rawSymbolList = symbols.split(',').map(s => s.trim()).filter(s => !!s);
      if (rawSymbolList.length === 0) {
        return res.status(400).json({ error: 'No valid symbols provided' });
      }

      const symbolList = rawSymbolList.map(s => {
        let sym = s.toUpperCase();
        if (sym.endsWith('.SH')) sym = sym.replace('.SH', '.SS');
        if (sym.length === 6) {
          if (sym.startsWith('60') || sym.startsWith('68')) return `${sym}.SS`;
          if (sym.startsWith('00') || sym.startsWith('30')) return `${sym}.SZ`;
          if (sym.startsWith('8') || sym.startsWith('4')) return `${sym}.BJ`;
        }
        return sym;
      });

      let results: any[];
      try {
        results = await yahooFinance.quote(symbolList as any) as any[];
      } catch {
        results = [];
        for (const sym of symbolList) {
          try {
            const q = await yahooFinance.quote(sym as any);
            if (q) results.push(q);
          } catch (e) {
            console.warn(`Individual quote failed for ${sym}:`, e instanceof Error ? e.message : String(e));
          }
        }
      }

      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'No valid data found for the provided symbols' });
      }

      const formattedResults = results.map(result => formatQuoteResult(result));
      return res.json(formattedResults);
    } catch (error) {
      console.error('Yahoo Finance Batch Error:', error);
      return res.status(500).json({ error: 'Failed to fetch batch stock data' });
    }
  }

  if (!symbol || typeof symbol !== 'string' || !symbol.trim() || !market) {
    return res.status(400).json({ error: 'Symbol and market are required' });
  }

  try {
    let yfSymbol = (symbol as string).trim().toUpperCase();
    yfSymbol = yfSymbol.replace('.SH', '.SS');

    if (!yfSymbol.includes('.') && !yfSymbol.startsWith('^')) {
      yfSymbol = await resolveSymbol(yfSymbol, symbol as string, market as string, yahooFinance);
    }

    // Append market suffix for standard codes
    yfSymbol = appendMarketSuffix(yfSymbol, market as string);

    let result: any = await tryQuote(yfSymbol, symbol as string, market as string, yahooFinance);

    if (!result) {
      return res.status(404).json({ error: `无法找到股票代码或简称 "${symbol}" 的相关数据，请检查后重试。` });
    }

    res.json(formatQuoteResult(result));
  } catch (error) {
    console.error('Yahoo Finance Error:', error);
    res.status(500).json({ error: 'Failed to fetch real-time stock data' });
  }
});

// --- Helper functions ---

function formatQuoteResult(result: any) {
  let changePercent = result.regularMarketChangePercent;
  let change = result.regularMarketChange;
  const price = result.regularMarketPrice;
  const prevClose = result.regularMarketPreviousClose;

  if (change === undefined && price !== undefined && prevClose !== undefined) {
    change = price - prevClose;
  }
  if (changePercent === undefined && change !== undefined && prevClose !== undefined && prevClose !== 0) {
    changePercent = (change / prevClose) * 100;
  }
  if (changePercent !== undefined && Math.abs(changePercent) < 0.1 && changePercent !== 0 && change !== undefined && price !== undefined) {
    if (Math.abs(change) > 0.005 * price) {
      changePercent = changePercent * 100;
    }
  }

  const dataTime = result.regularMarketTime ? new Date(result.regularMarketTime) : new Date();
  const formattedTime = dataTime.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }) + ' CST';

  return {
    symbol: result.symbol,
    name: result.shortName || result.longName || result.symbol,
    price,
    change: change !== undefined ? parseFloat(change.toFixed(2)) : 0,
    changePercent: changePercent !== undefined ? parseFloat(changePercent.toFixed(2)) : 0,
    previousClose: prevClose,
    open: result.regularMarketOpen,
    dayHigh: result.regularMarketDayHigh,
    dayLow: result.regularMarketDayLow,
    volume: result.regularMarketVolume,
    marketCap: result.marketCap,
    pe: result.trailingPE,
    currency: result.currency,
    lastUpdated: formattedTime,
    source: 'Yahoo Finance API',
    exchange: result.fullExchangeName || result.exchange,
    marketState: result.marketState,
    quoteDelay: result.exchangeDataDelayedBy || 0
  };
}

async function resolveSymbol(yfSymbol: string, originalSymbol: string, market: string, yf: any): Promise<string> {
  const isStandardA = market === 'A-Share' && /^\d{6}$/.test(yfSymbol);
  const isStandardHK = market === 'HK-Share' && /^\d{1,5}$/.test(yfSymbol);
  const isStandardUS = market === 'US-Share' && /^[A-Z]{1,5}$/.test(yfSymbol);

  if (isStandardA || isStandardHK || isStandardUS) return yfSymbol;

  const encodedInput = encodeURIComponent(originalSymbol.trim());

  // Tier 1: New EastMoney Suggest API
  if (monitor.isAvailable('eastmoney_new')) {
    const startTime = Date.now();
    try {
      const emUrl = `https://suggest.eastmoney.com/suggest/default.aspx?name=cb&input=${encodedInput}`;
      const response = await fetch(emUrl);
      const text = await response.text();
      const match = text.match(/^var cb = (\[.*\]);?$/);
      if (match?.[1]) {
        const data = JSON.parse(match[1]);
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const parts = item.split(',');
            if (parts.length >= 7) {
              const code = parts[1];
              const emMarketName = parts[6];
              let isMatch = false;
              if (market === 'A-Share' && (emMarketName === 'SH' || emMarketName === 'SZ' || emMarketName === 'BJ')) isMatch = true;
              if (market === 'HK-Share' && emMarketName === 'HK') isMatch = true;
              if (market === 'US-Share' && emMarketName === 'US') isMatch = true;
              if (isMatch) {
                monitor.recordSuccess('eastmoney_new', Date.now() - startTime);
                console.log(`Resolved '${yfSymbol}' -> '${code}' via EastMoney`);
                return code;
              }
            }
          }
        }
      }
    } catch (e) {
      monitor.recordFailure('eastmoney_new');
      console.warn('EastMoney new API failed:', e instanceof Error ? e.message : String(e));
    }
  }

  // Tier 2: Old EastMoney API
  if (monitor.isAvailable('eastmoney_old')) {
    const startTime = Date.now();
    try {
      let emType = '14';
      if (market === 'HK-Share') emType = '31';
      if (market === 'US-Share') emType = '32';
      const oldEmUrl = `https://searchapi.eastmoney.com/api/suggest/get?cb=cb&input=${encodedInput}&type=${emType}&token=D43BF722C8E33BDC906FB84D85E326E8`;
      const oldResponse = await fetch(oldEmUrl);
      const oldText = await oldResponse.text();
      const oldMatch = oldText.match(/^cb\((.*)\)$/);
      if (oldMatch?.[1]) {
        const oldData = JSON.parse(oldMatch[1]);
        if (oldData?.QuotationCodeTable?.Data?.length > 0) {
          const bestCode = oldData.QuotationCodeTable.Data[0].Code;
          if (bestCode) {
            monitor.recordSuccess('eastmoney_old', Date.now() - startTime);
            console.log(`Resolved '${yfSymbol}' -> '${bestCode}' via EastMoney Old`);
            return bestCode;
          }
        }
      }
    } catch (e) {
      monitor.recordFailure('eastmoney_old');
      console.warn('EastMoney old API failed:', e instanceof Error ? e.message : String(e));
    }
  }

  // Tier 3: Sina Suggest API
  if (monitor.isAvailable('sina')) {
    const startTime = Date.now();
    try {
      const sinaUrl = `https://suggest3.sinajs.cn/suggest/type=&key=${encodedInput}`;
      const sinaRes = await fetch(sinaUrl);
      const sinaText = await sinaRes.text();
      const sinaMatch = sinaText.match(/="([^"]+)"/);
      if (sinaMatch?.[1]) {
        const parts = sinaMatch[1].split(';');
        let firstValidMatch = null;
        for (const part of parts) {
          const details = part.split(',');
          if (details.length >= 3) {
            const sinaCode = details[2];
            const sinaMarket = details[1];
            
            // Store the first valid match as a fallback if the specific market doesn't match
            if (!firstValidMatch && (sinaMarket === '11' || sinaMarket === '12' || sinaMarket === '31' || sinaMarket === '41')) {
              firstValidMatch = sinaCode;
            }

            if ((market === 'A-Share' && (sinaMarket === '11' || sinaMarket === '12')) ||
                (market === 'HK-Share' && sinaMarket === '31') ||
                (market === 'US-Share' && sinaMarket === '41')) {
              monitor.recordSuccess('sina', Date.now() - startTime);
              console.log(`Resolved '${yfSymbol}' -> '${sinaCode}' via Sina`);
              return sinaCode;
            }
          }
        }
        // If no market-specific match found, but we found a valid stock in another market, return it
        if (firstValidMatch) {
          console.log(`No market-specific match for '${yfSymbol}' in ${market}, falling back to '${firstValidMatch}'`);
          return firstValidMatch;
        }
      }
    } catch (e) {
      monitor.recordFailure('sina');
      console.warn('Sina API failed:', e instanceof Error ? e.message : String(e));
    }
  }

  return yfSymbol;
}

function appendMarketSuffix(symbol: string, market: string): string {
  if (symbol.includes('.') || symbol.startsWith('^')) return symbol;

  if (market === 'A-Share' && /^\d{6}$/.test(symbol)) {
    if (symbol.startsWith('60') || symbol.startsWith('68')) return `${symbol}.SS`;
    if (symbol.startsWith('00') || symbol.startsWith('30')) return `${symbol}.SZ`;
    if (symbol.startsWith('43') || symbol.startsWith('83') || symbol.startsWith('87')) return `${symbol}.BJ`;
    if (symbol.startsWith('6')) return `${symbol}.SS`;
    return `${symbol}.SZ`;
  }
  if (market === 'HK-Share' && /^\d+$/.test(symbol)) {
    return `${symbol.padStart(5, '0')}.HK`;
  }
  return symbol;
}

async function tryQuote(yfSymbol: string, originalSymbol: string, market: string, yf: any): Promise<any> {
  let result: any = null;

  try {
    result = await yf.quote(yfSymbol);
    if (result?.symbol) {
      const symMatch = result.symbol.toUpperCase();
      if (market === 'A-Share' && !(symMatch.endsWith('.SS') || symMatch.endsWith('.SZ') || symMatch.endsWith('.BJ'))) result = null;
      else if (market === 'HK-Share' && !symMatch.endsWith('.HK')) result = null;
      else if (market === 'US-Share' && (symMatch.endsWith('.SS') || symMatch.endsWith('.SZ') || symMatch.endsWith('.BJ') || symMatch.endsWith('.HK'))) result = null;
    }
  } catch {
    console.log(`Quote failed for ${yfSymbol}, trying search...`);
  }

  if (result) return result;

  // Fallback: Yahoo Search
  const searchQueries: string[] = [];
  if (yfSymbol !== originalSymbol) searchQueries.push(yfSymbol);
  searchQueries.push(originalSymbol.trim());

  for (const query of searchQueries) {
    if (!query) continue;
    try {
      // Try searching with the query directly
      let searchResults = await yf.search(query);
      
      // If no results, try cleaning the query (removing special chars but keeping Chinese)
      if (!searchResults?.quotes?.length) {
        const cleanQuery = query.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ').trim();
        if (cleanQuery && cleanQuery !== query) {
          searchResults = await yf.search(cleanQuery);
        }
      }

      // If still no results and it's Chinese, try adding "stock" to the query
      if (!searchResults?.quotes?.length && /[\u4e00-\u9fa5]/.test(query)) {
        searchResults = await yf.search(`${query} stock`);
      }

      if (searchResults?.quotes?.length) {
        const bestMatch = searchResults.quotes.find((q: any) => {
          const s = (q.symbol || '').toUpperCase();
          if (market === 'A-Share') return s.endsWith('.SS') || s.endsWith('.SZ') || s.endsWith('.BJ');
          if (market === 'HK-Share') return s.endsWith('.HK');
          if (market === 'US-Share') return !s.endsWith('.SS') && !s.endsWith('.SZ') && !s.endsWith('.BJ') && !s.endsWith('.HK');
          return true;
        });
        
        // If no market-specific match, take the first one
        const matchToUse = bestMatch || searchResults.quotes[0];
        if (matchToUse) {
          result = await yf.quote(matchToUse.symbol);
          if (result) return result;
        }
      }
    } catch (e) {
      console.warn(`Search failed for "${query}":`, e instanceof Error ? e.message : String(e));
    }
  }

  return null;
}

export default router;
