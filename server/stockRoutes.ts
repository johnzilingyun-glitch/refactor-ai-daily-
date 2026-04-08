import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';
import { monitor } from './dataSourceHealth.js';
import { logDebug, logError } from './stockLogger.js';

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
    const startTime = Date.now();
    // Use parallel fetching to avoid long sequential waits
    const results = await Promise.all(symbols.map(async (idx) => {
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

          return {
            name: idx.name,
            symbol: idx.symbol,
            price,
            change: change !== undefined ? parseFloat(change.toFixed(2)) : 0,
            changePercent: changePercent !== undefined ? parseFloat(changePercent.toFixed(2)) : 0,
            previousClose: prevClose,
            lastUpdated: formattedTime + ' CST',
            source: 'Yahoo Finance API',
            marketState: quote.marketState,
          };
        }
      } catch (e) {
        logDebug(`Yahoo Index Fetch`, `Failed for ${idx.symbol}: ${e instanceof Error ? e.message : String(e)}`);
      }
      return null;
    }));

    let filteredResults = results.filter(r => r !== null);

    // Fallback for A-Share if Yahoo returned too few results
    if (marketKey === 'A-Share' && filteredResults.length < 3) {
      logDebug(`A-Share Fallback`, `Yahoo results too low (${filteredResults.length}), triggering Sina fallback...`);
      try {
        const sinaIndices = [
          { s: 's_sh000001', name: '上证综指', sym: '000001.SS' },
          { s: 's_sz399001', name: '深证成指', sym: '399001.SZ' },
          { s: 's_sz399006', name: '创业板指', sym: '399006.SZ' },
          { s: 's_sh000300', name: '沪深300', sym: '000300.SS' }
        ];
        
        const sinaUrl = `https://hq.sinajs.cn/list=${sinaIndices.map(i => i.s).join(',')}`;
        const response = await fetch(sinaUrl, { headers: { 'Referer': 'https://finance.sina.com.cn' } });
        const text = await response.text();
        
        sinaIndices.forEach(idx => {
          const match = text.match(new RegExp(`hq_str_${idx.s}="([^"]+)"`));
          if (match?.[1]) {
            const parts = match[1].split(',');
            if (parts.length >= 4) {
              const price = parseFloat(parts[1]);
              const change = parseFloat(parts[2]);
              const changePercent = parseFloat(parts[3]);
              
              // Only add if not already present from Yahoo
              if (!filteredResults.find(r => r.symbol === idx.sym)) {
                filteredResults.push({
                  name: idx.name,
                  symbol: idx.sym,
                  price,
                  change: parseFloat(change.toFixed(2)),
                  changePercent: parseFloat(changePercent.toFixed(2)),
                  previousClose: parseFloat((price - change).toFixed(2)),
                  lastUpdated: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + ' CST',
                  source: 'Sina Finance (Fallback)',
                  marketState: 'REGULAR'
                });
              }
            }
          }
        });
      } catch (sinaErr) {
        logError(`Sina Fallback failed`, sinaErr);
      }
    }

    monitor.recordSuccess('yahoo', Date.now() - startTime);
    res.json(filteredResults);
  } catch (error) {
    monitor.recordFailure('yahoo');
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
    { symbol: 'USDCNY=X', name: '美元/人民币', unit: 'CNY' },
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
            source: 'Yahoo Finance API',
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

// Stock Suggestion / Autocomplete (Universal)
router.get('/stock/suggest', async (req, res) => {
  const { input, market: currentMarket } = req.query;
  if (!input || typeof input !== 'string' || input.trim().length < 1) {
    return res.json([]);
  }

  const suggestions: any[] = [];
  const encodedInput = encodeURIComponent(input.trim());

  try {
    // 1. Try EastMoney Suggest API
    try {
      const emUrl = `https://suggest.eastmoney.com/suggest/default.aspx?name=cb&input=${encodedInput}`;
      const emResponse = await fetch(emUrl);
      const emText = await emResponse.text();
      const emMatch = emText.match(/^var cb = (\[.*\]);?$/);
      if (emMatch?.[1]) {
        const data = JSON.parse(emMatch[1]);
        if (Array.isArray(data)) {
          for (const item of data) {
            const parts = item.split(',');
            if (parts.length >= 7) {
              const code = parts[1];
              const name = parts[2];
              const pinyin = parts[3];
              const emMarketName = parts[6];
              let marketId = '';
              if (['SH', 'SZ', 'BJ'].includes(emMarketName)) marketId = 'A-Share';
              else if (emMarketName === 'HK') marketId = 'HK-Share';
              else if (emMarketName === 'US') marketId = 'US-Share';
              
              if (marketId) {
                suggestions.push({
                  symbol: code,
                  name: name,
                  pinyin: pinyin,
                  exchange: emMarketName,
                  market: marketId,
                  source: 'EastMoney'
                });
              }
            }
          }
        }
      }
    } catch {}

    // 2. Try Sina Suggest API
    if (suggestions.length < 5) {
      try {
        const sinaUrl = `https://suggest3.sinajs.cn/suggest/type=&key=${encodedInput}`;
        const sinaRes = await fetch(sinaUrl);
        const sinaText = await sinaRes.text();
        const sinaMatch = sinaText.match(/="([^"]+)"/);
        if (sinaMatch?.[1]) {
          const parts = sinaMatch[1].split(';');
          for (const part of parts) {
            const details = part.split(',');
            if (details.length >= 4) {
              const name = details[0];
              const sinaMarketId = details[1];
              const code = details[2];
              let marketId = '';
              let exchange = '';
              if (sinaMarketId === '11' || sinaMarketId === '12') { marketId = 'A-Share'; exchange = sinaMarketId === '11' ? 'SH' : 'SZ'; }
              else if (sinaMarketId === '31') { marketId = 'HK-Share'; exchange = 'HK'; }
              else if (sinaMarketId === '41') { marketId = 'US-Share'; exchange = 'US'; }
              if (marketId && !suggestions.find(s => s.symbol === code)) {
                suggestions.push({ symbol: code, name, exchange, market: marketId, source: 'Sina' });
              }
            }
          }
        }
      } catch {}
    }

    // 3. Yahoo Search Fallback
    if (suggestions.length === 0) {
      try {
        const yahooRes = await yahooFinance.search(input.trim());
        if (yahooRes?.quotes) {
          for (const q of yahooRes.quotes as any[]) {
            const s = (q.symbol || '').toUpperCase();
            let marketId = 'US-Share';
            if (s.endsWith('.SS') || s.endsWith('.SZ') || s.endsWith('.BJ')) marketId = 'A-Share';
            else if (s.endsWith('.HK')) marketId = 'HK-Share';
            if (!suggestions.find(subs => subs.symbol === q.symbol)) {
              suggestions.push({
                symbol: q.symbol.split('.')[0],
                fullSymbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                exchange: q.exchange,
                market: marketId,
                source: 'Yahoo'
              });
            }
            if (suggestions.length >= 8) break;
          }
        }
      } catch {}
    }

    // Sort: Prioritize current market
    const sorted = suggestions.sort((a, b) => {
      if (a.market === currentMarket && b.market !== currentMarket) return -1;
      if (a.market !== currentMarket && b.market === currentMarket) return 1;
      return 0;
    });

    res.json(sorted.slice(0, 10));
  } catch (error) {
    console.error('Suggest API error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Real-time Stock Data (Universal)
router.get('/stock/realtime', async (req, res) => {
  const { symbol, market, symbols, debug } = req.query;
  const isDebug = debug === 'true';

  if (isDebug) logDebug('incoming_request', { symbol, market, symbols, path: '/stock/realtime' });

  // Batch logic
  if (symbols && typeof symbols === 'string' && symbols.trim()) {
    try {
      const rawSymbolList = symbols.split(',').map(s => s.trim()).filter(s => !!s);
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
      const results = await yahooFinance.quote(symbolList as any) as any[];
      return res.json(results.map(r => formatQuoteResult(r)));
    } catch {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    const input = (symbol as string).trim();
    // Step 1: Broad Resolution
    const resolution = await resolveSymbolEx(input, market as string, isDebug);
    // Step 2: Quote
    const result = await tryQuoteEx(resolution.symbol, input, resolution.market, isDebug);

    if (!result) {
      return res.status(404).json({ error: `无法找到代码 "${symbol}" 的相关数据。` });
    }

    res.json({
      ...formatQuoteResult(result),
      resolvedMarket: resolution.market
    });
  } catch (error) {
    logError(error, 'realtime_total_error');
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Helpers ---

async function resolveSymbolEx(input: string, preferredMarket: string, isDebug: boolean): Promise<{ symbol: string; market: string }> {
  const upperInput = input.toUpperCase();
  
  const CROSS_MAPPING: Record<string, { symbol: string, market: string }> = {
    'BABA': { symbol: '9988', market: 'HK-Share' },
    'TCEHY': { symbol: '700', market: 'HK-Share' },
    'JD': { symbol: '9618', market: 'HK-Share' },
    'MEITUAN': { symbol: '3690', market: 'HK-Share' },
    'TENCENT': { symbol: '700', market: 'HK-Share' },
    'PPMT': { symbol: '9992', market: 'HK-Share' },
  };

  if (CROSS_MAPPING[upperInput]) return CROSS_MAPPING[upperInput];

  try {
    const encodedInput = encodeURIComponent(input);
    const emResponse = await fetch(`https://suggest.eastmoney.com/suggest/default.aspx?name=cb&input=${encodedInput}`);
    const emText = await emResponse.text();
    const emMatch = emText.match(/^var cb = (\[.*\]);?$/);
    if (emMatch?.[1]) {
      const data = JSON.parse(emMatch[1]);
      if (Array.isArray(data) && data.length > 0) {
        let bestMatch = null;
        for (const item of data) {
          const parts = item.split(',');
          if (parts.length >= 7) {
            const code = parts[1];
            const emMarketName = parts[6];
            let marketId = '';
            if (['SH', 'SZ', 'BJ'].includes(emMarketName)) marketId = 'A-Share';
            else if (emMarketName === 'HK') marketId = 'HK-Share';
            else if (emMarketName === 'US') marketId = 'US-Share';
            if (marketId) {
              if (marketId === preferredMarket) return { symbol: code, market: marketId };
              if (!bestMatch) bestMatch = { symbol: code, market: marketId };
            }
          }
        }
        if (bestMatch) return bestMatch;
      }
    }
  } catch {}

  let resolvedSym = upperInput;
  let resolvedMarket = preferredMarket;
  if (/^\d{6}$/.test(upperInput)) resolvedMarket = 'A-Share';
  else if (/^\d{1,5}$/.test(upperInput)) resolvedMarket = 'HK-Share';
  else if (/^[A-Z]{1,5}$/.test(upperInput)) resolvedMarket = 'US-Share';

  return { symbol: resolvedSym, market: resolvedMarket };
}

async function tryQuoteEx(yfSymbol: string, input: string, market: string, isDebug: boolean): Promise<any> {
    const symWithSuffix = appendMarketSuffix(yfSymbol, market);
    try {
        const result = await yahooFinance.quote(symWithSuffix);
        if (result) return result;
    } catch {}

    try {
        const search = await yahooFinance.search(input);
        if (search?.quotes?.length) {
            return await yahooFinance.quote(search.quotes[0].symbol as any);
        }
    } catch {}
    
    return null;
}

function appendMarketSuffix(symbol: string, market: string): string {
  if (symbol.includes('.') || symbol.startsWith('^')) return symbol;
  if (market === 'A-Share' && /^\d{6}$/.test(symbol)) {
    if (symbol.startsWith('60') || symbol.startsWith('68')) return `${symbol}.SS`;
    if (symbol.startsWith('00') || symbol.startsWith('30')) return `${symbol}.SZ`;
    if (symbol.startsWith('43') || symbol.startsWith('83') || symbol.startsWith('87')) return `${symbol}.BJ`;
    return `${symbol.startsWith('6') ? symbol + '.SS' : symbol + '.SZ'}`;
  }
  if (market === 'HK-Share' && /^\d+$/.test(symbol)) return `${symbol.padStart(5, '0')}.HK`;
  return symbol;
}

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

export default router;
