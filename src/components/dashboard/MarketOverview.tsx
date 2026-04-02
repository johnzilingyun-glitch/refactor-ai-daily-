import { 
  Globe, Settings, Loader2, ExternalLink, TrendingUp, Share2, CheckCircle2,
  LayoutGrid, Coins, Star, Newspaper, Search, RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Market } from '../../types';
import { useUIStore } from '../../stores/useUIStore';
import { useMarketStore } from '../../stores/useMarketStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { ErrorNotice } from '../ErrorNotice';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarketOverviewProps {
  onFetchMarketOverview: (force?: boolean) => void;
  onTriggerDailyReport: () => void;
}

export function MarketOverview({ onFetchMarketOverview, onTriggerDailyReport }: MarketOverviewProps) {
  const { 
    overviewLoading, overviewError, isGeneratingReport, isSendingReport, reportStatus,
    autoRefreshInterval, setAutoRefreshInterval, setIsSettingsOpen,
  } = useUIStore();
  const { 
    marketOverviews, marketLastUpdatedTimes, overviewMarket, setOverviewMarket 
  } = useMarketStore();
  const { setSymbol, setMarket } = useAnalysisStore();

  const marketOverview = marketOverviews[overviewMarket];
  const marketLastUpdated = marketLastUpdatedTimes[overviewMarket];

  return (
    <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="space-y-12">
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-zinc-200/60 px-8 py-6 rounded-2xl shadow-[0_2px_8px_rgb(0,0,0,0.04)] gap-4">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tighter">
              <Globe size={28} className="text-emerald-500" />
              今日大盘概览
            </h2>
            
            <div className="flex items-center gap-2 text-sm ml-4 border-l border-zinc-200/60 pl-4">
              {marketLastUpdated && (
                <span className="text-zinc-400 hidden sm:inline-block">
                  数据时间: {new Date(marketLastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  {new Date(marketLastUpdated).toDateString() === new Date().toDateString() ? ' (今日)' : ''}
                </span>
              )}
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-zinc-50 text-zinc-500 border border-zinc-200/80 rounded-xl px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-600/50 outline-none hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <option value={0}>不自动刷新</option>
                <option value={5}>每 5 分钟</option>
                <option value={15}>每 15 分钟</option>
                <option value={30}>每 30 分钟</option>
                <option value={60}>每 60 分钟</option>
              </select>
              <button
                onClick={() => onFetchMarketOverview(true)}
                disabled={overviewLoading}
                className="p-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-950 ring-1 ring-zinc-200 transition-colors disabled:opacity-50"
                title="手动刷新大盘数据"
              >
                <RefreshCw className={`w-4 h-4 ${overviewLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-2xl bg-zinc-50 p-1 border border-zinc-200">
              {(['A-Share', 'HK-Share', 'US-Share'] as Market[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setOverviewMarket(m)}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-xs font-medium transition-all",
                    overviewMarket === m 
                      ? "bg-indigo-600 text-zinc-950 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-600"
                  )}
                >
                  {m === 'A-Share' ? 'A股' : m === 'HK-Share' ? '港股' : '美股'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-500 transition-all hover:border-indigo-600/30 hover:bg-blue-500/10 hover:text-indigo-600"
              title="系统配置"
            >
              <Settings size={20} />
            </button>
            {overviewLoading && <Loader2 className="animate-spin text-emerald-500" size={20} />}
            <button
              onClick={onTriggerDailyReport}
              disabled={overviewLoading || isGeneratingReport || isSendingReport || !marketOverview}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-medium transition-all shadow-sm",
                reportStatus === 'success' 
                  ? "bg-indigo-100 text-indigo-600 border border-indigo-600/50"
                  : reportStatus === 'error'
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/50"
                  : "bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-600"
              )}
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  生成报告中...
                </>
              ) : isSendingReport ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  发送至飞书...
                </>
              ) : reportStatus === 'success' ? (
                <>
                  <CheckCircle2 size={16} />
                  已发送
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  发送每日简报
                </>
              )}
            </button>
          </div>
        </div>

        {overviewError && (
          <div className="flex flex-col gap-4">
            <ErrorNotice title="市场概览加载失败" message={overviewError} />
            <button 
              onClick={() => void onFetchMarketOverview(true)}
              className="flex w-fit items-center gap-2 rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              <TrendingUp size={16} className="text-amber-500" />
              重试加载市场概览
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {overviewLoading ? Array(5).fill(0).map((_, i) => (
            <div key={`skeleton-index-${i}`} className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          )) : marketOverview?.indices?.map((index, i) => (
            <div key={`index-${index.symbol || index.name}-${i}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="mb-1 text-xs font-medium text-zinc-400">{index.name}</p>
              <p className="text-lg font-medium tracking-tight">{(index.price ?? 0).toLocaleString()}</p>
              <div className={cn('mt-1 flex items-center gap-1 font-mono text-xs', (index.change ?? 0) >= 0 ? 'text-indigo-500' : 'text-rose-400')}>
                {(index.change ?? 0) >= 0 ? '+' : ''}{index.changePercent ?? 0}%
              </div>
            </div>
          ))}
        </div>

        {!overviewLoading && marketOverview && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="premium-card p-8 md:col-span-2">
                <p className="text-base italic leading-relaxed text-zinc-500 font-medium">"{marketOverview.marketSummary}"</p>
              </div>
              <div className="flex flex-col items-center justify-center premium-card p-8 text-center">
                <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">市场情绪</h3>
                <div className="text-4xl font-semibold text-emerald-500 tracking-tighter">
                  {(marketOverview.marketSummary?.includes('牛') || marketOverview.marketSummary?.includes('涨')) ? '看多' : (marketOverview.marketSummary?.includes('熊') || marketOverview.marketSummary?.includes('跌')) ? '看空' : '中性'}
                </div>
                <p className="mt-3 text-[10px] font-medium text-zinc-400 uppercase tracking-widest">AI 综合研判</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-zinc-200/50 bg-white/30 p-6">
                <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-zinc-400">
                  <LayoutGrid size={16} className="text-emerald-500" />
                  热门板块分析
                </h3>
                <div className="space-y-3">
                  {marketOverview.sectorAnalysis?.map((sector, i) => (
                    <div key={`sector-${sector.name}-${i}`} className="rounded-xl bg-zinc-50/30 p-3 border border-zinc-200/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-zinc-600">{sector.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase", 
                          sector.trend?.includes('涨') || sector.trend?.includes('强') ? "bg-indigo-100 text-indigo-600" : "bg-rose-500/20 text-rose-400"
                        )}>{sector.trend}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{sector.conclusion}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-zinc-200/50 bg-white/30 p-6">
                <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-zinc-400">
                  <Coins size={16} className="text-amber-500" />
                  大宗商品走势
                </h3>
                <div className="space-y-3">
                  {marketOverview.commodityAnalysis?.map((item, i) => (
                    <div key={`commodity-${item.name}-${i}`} className="rounded-xl bg-zinc-50/30 p-3 border border-zinc-200/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-zinc-600">{item.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase", 
                          item.trend?.includes('涨') || item.trend?.includes('强') ? "bg-indigo-100 text-indigo-600" : "bg-rose-500/20 text-rose-400"
                        )}>{item.trend}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.expectation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-200/50 bg-white/30 p-6">
              <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-zinc-400">
                <Star size={16} className="text-blue-500" />
                AI 推荐标的/板块
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {marketOverview.recommendations?.map((rec, i) => (
                  <div key={`${rec.type}-${rec.name}-${i}`} className="rounded-xl bg-zinc-50/30 p-4 border border-zinc-200/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-indigo-600 font-medium uppercase">{rec.type}</span>
                      <span className="font-medium text-zinc-950">{rec.name}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-xl font-medium">
            <Newspaper size={20} className="text-blue-500" />
            重要财经新闻
          </h2>
          <div className="space-y-4">
            {overviewLoading ? Array(3).fill(0).map((_, i) => (
              <div key={`news-skeleton-${i}`} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
            )) : marketOverview?.topNews?.map((news, i) => (
              <a key={`news-${i}-${news.url || news.title}`} href={news.url} target="_blank" rel="noopener noreferrer" className="group block rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-600/30">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold transition-colors group-hover:text-indigo-600">{news.title}</h3>
                  <ExternalLink size={16} className="mt-1 shrink-0 text-zinc-400" />
                </div>
                <p className="mb-3 line-clamp-2 text-sm text-zinc-500">{news.summary}</p>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  <span className="rounded bg-zinc-50 px-2 py-0.5">{news.source}</span>
                  <span>{news.time}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-medium">
            <TrendingUp size={20} className="text-amber-500" />
            热门搜索
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {[
              { symbol: '600519', name: '贵州茅台', market: "A-Share" as Market },
              { symbol: '300750', name: '宁德时代', market: "A-Share" as Market },
              { symbol: '700', name: '腾讯控股', market: "HK-Share" as Market },
              { symbol: 'NVDA', name: '英伟达', market: "US-Share" as Market },
            ].map((stock) => (
              <button key={stock.symbol} onClick={() => { setSymbol(stock.symbol); setMarket(stock.market); }} className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-indigo-600/50">
                <div>
                  <p className="mb-0.5 font-mono text-[10px] uppercase text-zinc-400">{stock.market}</p>
                  <p className="font-medium transition-colors group-hover:text-indigo-600">{stock.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">{stock.name}</p>
                  <Search size={14} className="ml-auto mt-1 text-zinc-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
