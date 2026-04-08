import React from 'react';
import {
  BarChart3, PieChart, TrendingUp, TrendingDown, Clock, Info,
  Award, ShieldCheck, MessageSquare, History, RefreshCcw,
  LayoutGrid, CheckCircle2, Coins, AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './utils';
import type { StockAnalysis } from '../../types';

interface StockHeroCardProps {
  analysis: StockAnalysis;
}

export function StockHeroCard({ analysis }: StockHeroCardProps) {
  const { t } = useTranslation();

  return (
    <div className="premium-card p-6 sm:p-10 md:p-14 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none hidden sm:block">
        <BarChart3 size={240} className="text-zinc-900" />
      </div>
      
      {/* Stock Header */}
      <div className="mb-8 sm:mb-14 flex flex-wrap items-end justify-between gap-6 sm:gap-10 relative z-10">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="rounded-xl bg-zinc-100 px-3 sm:px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 border border-zinc-200/60 shadow-sm">
              {analysis.stockInfo?.market}
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tighter text-zinc-950">{analysis.stockInfo?.name}</h2>
            <span className="font-mono text-lg sm:text-2xl font-medium text-zinc-400 tracking-tighter">{analysis.stockInfo?.symbol}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {analysis.isDeepValue && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2 shadow-sm">
                <Award size={14} />
                绝对安全边际 (Deep Value)
              </div>
            )}
            {analysis.moatAnalysis && analysis.moatAnalysis.strength !== "None" && (
              <div className="px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-600/20 text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2 shadow-sm">
                <ShieldCheck size={14} />
                护城河: {analysis.moatAnalysis.strength === "Wide" ? "宽阔" : "狭窄"} ({analysis.moatAnalysis.type})
              </div>
            )}
            {analysis.narrativeConsistency && (
              <div className={cn(
                "px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm",
                analysis.narrativeConsistency.score >= 80 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                analysis.narrativeConsistency.score >= 50 ? "bg-amber-500/10 border-amber-500/20 text-amber-600" :
                "bg-rose-500/10 border-rose-500/20 text-rose-600"
              )}>
                <MessageSquare size={14} />
                叙事一致性: {analysis.narrativeConsistency.score}%
              </div>
            )}
          </div>
          
          <div className="flex items-baseline gap-8 pt-4">
            <span className="text-5xl sm:text-8xl font-bold tracking-tighter text-zinc-950">
              {analysis.stockInfo?.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="ml-2 sm:ml-4 text-xl sm:text-3xl font-medium uppercase text-zinc-300 tracking-tight">{analysis.stockInfo?.currency}</span>
            </span>
            <div className={cn(
              'flex items-center gap-2 sm:gap-3 text-xl sm:text-3xl font-bold tracking-tight px-4 sm:px-6 py-2 rounded-[1.5rem] border shadow-sm', 
              (analysis.stockInfo?.change ?? 0) >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-500 bg-rose-50 border-rose-100'
            )}>
              {(analysis.stockInfo?.change ?? 0) >= 0 ? <TrendingUp size={24} className="sm:w-8 sm:h-8" /> : <TrendingDown size={24} className="sm:w-8 sm:h-8" />}
              <span>{(analysis.stockInfo?.change ?? 0) >= 0 ? '+' : ''}{analysis.stockInfo?.change}</span>
              <span className="text-base sm:text-xl opacity-60">({analysis.stockInfo?.changePercent}%)</span>
            </div>
          </div>
        </div>
        
        <div className="text-right space-y-2 relative z-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">最后更新 (Last Sync)</p>
          <p className="text-base font-semibold text-zinc-500 flex items-center justify-end gap-2">
            <Clock size={16} className="text-zinc-300" />
            {analysis.stockInfo?.lastUpdated}
          </p>
          <div className="group relative inline-flex items-center gap-1 cursor-help">
            <Info size={12} className="text-zinc-300" />
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest">{t('analysis.info.data_sources')}</span>
            <div className="absolute bottom-full right-0 mb-2 w-56 p-3 rounded-xl bg-zinc-900 text-white text-[10px] leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-20 shadow-xl">
              <p className="font-semibold mb-1.5">{t('analysis.info.data_pipeline')}</p>
              <ul className="space-y-1 text-zinc-300">
                <li>• Yahoo Finance — {t('analysis.info.price_fundamentals')}</li>
                <li>• Sina Finance — {t('analysis.info.ashare_fallback')}</li>
                <li>• Google Gemini AI — {t('analysis.info.ai_analysis')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Technical & Fundamental Analysis */}
      <div className="grid grid-cols-1 gap-6 border-t border-zinc-200/50 pt-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <BarChart3 size={16} className="text-emerald-500" />
            技术面分析
          </div>
          <p className="text-sm leading-relaxed text-zinc-500">{analysis.technicalAnalysis}</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <PieChart size={16} className="text-blue-500" />
            基本面分析 (结合安全边际)
          </div>
          <p className="text-sm leading-relaxed text-zinc-500">{analysis.fundamentalAnalysis}</p>
        </div>
      </div>

      {/* Fundamentals Grid */}
      {analysis.fundamentals && (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 border-t border-zinc-200/50 pt-8">
          <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">市盈率 PE</p>
            <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.pe}</p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">市净率 PB</p>
            <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.pb}</p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">净资产收益率 ROE</p>
            <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.roe}</p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">每股收益 EPS</p>
            <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.eps}</p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">营收增长</p>
            <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.revenueGrowth}</p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-500/60 mb-1">估值水位</p>
            <p className="text-sm font-medium text-indigo-600">{analysis.fundamentals.valuationPercentile}</p>
          </div>
          {analysis.fundamentals.netProfitGrowth && (
            <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">净利增长</p>
              <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.netProfitGrowth}</p>
            </div>
          )}
          {analysis.fundamentals.debtToEquity && (
            <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">资产负债率</p>
              <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.debtToEquity}</p>
            </div>
          )}
          {analysis.fundamentals.grossMargin && (
            <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">毛利率</p>
              <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.grossMargin}</p>
            </div>
          )}
          {analysis.fundamentals.netMargin && (
            <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">净利率</p>
              <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.netMargin}</p>
            </div>
          )}
          {analysis.fundamentals.dividendYield && (
            <div className="p-3 rounded-2xl bg-zinc-50/30 border border-zinc-200/30">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">股息率</p>
              <p className="text-sm font-medium text-zinc-600">{analysis.fundamentals.dividendYield}</p>
            </div>
          )}
        </div>
      )}

      {/* Historical Data */}
      {analysis.historicalData && (
        <div className="mt-6 p-4 rounded-2xl bg-zinc-50/20 border border-zinc-200/20">
          <h4 className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <History size={12} />
            历史数据与重大事件
          </h4>
          <div className="flex gap-8 mb-4">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase mb-1">52周最高</p>
              <p className="text-sm font-mono text-zinc-500">{analysis.historicalData.yearHigh}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase mb-1">52周最低</p>
              <p className="text-sm font-mono text-zinc-500">{analysis.historicalData.yearLow}</p>
            </div>
          </div>
          <ul className="space-y-2">
            {analysis.historicalData?.majorEvents?.map((event, i) => (
              <li key={`hist-event-${event.substring(0, 20)}-${i}`} className="text-xs text-zinc-400 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />
                {event}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Valuation Analysis */}
      {analysis.valuationAnalysis && (
        <div className="mt-6 p-6 rounded-2xl bg-indigo-600/5 border border-indigo-50">
          <h4 className="text-sm font-medium text-indigo-600 mb-4 flex items-center gap-2">
            <ShieldCheck size={18} />
            {t('analysis.tools.valuation_analysis')} ({t('analysis.tools.margin_of_safety_eval')})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.historical_comparison')}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{analysis.valuationAnalysis.comparison}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.safety_margin_summary')}</p>
              <p className="text-sm text-zinc-500 leading-relaxed font-medium">{analysis.valuationAnalysis.marginOfSafetySummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Analysis */}
      {analysis.cycleAnalysis && (
        <div className="mt-6 p-6 rounded-2xl bg-indigo-50/30 border border-blue-500/10">
          <h4 className="text-sm font-medium text-indigo-600 mb-4 flex items-center gap-2">
            <RefreshCcw size={18} />
            {t('analysis.tools.cycle_analysis')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.current_stage')}</p>
              <div className={cn(
                "inline-flex px-3 py-1 rounded-xl text-sm font-medium",
                analysis.cycleAnalysis.stage === "Bottom" ? "bg-indigo-100 text-indigo-600" :
                analysis.cycleAnalysis.stage === "Peak" ? "bg-rose-500/20 text-rose-400" :
                "bg-blue-500/20 text-indigo-600"
              )}>
                {analysis.cycleAnalysis.stage}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.cycle_logic')}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{analysis.cycleAnalysis.logic}</p>
              <p className="text-xs text-rose-400 mt-2 italic flex items-center gap-1">
                <AlertTriangle size={12} />
                {t('analysis.tools.volatility_risk_hint')}: {analysis.cycleAnalysis.volatilityRisk}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fundamental Tables & Industry Anchors */}
      {(analysis.fundamentalTable || analysis.industryAnchors) && (
        <div className="mt-8 space-y-8 border-t border-zinc-200/50 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <LayoutGrid size={18} className="text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-950">{t('analysis.tools.fundamental_insight')}</h3>
          </div>

          {analysis.fundamentalTable && analysis.fundamentalTable.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                {t('analysis.tools.core_indicators')}
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/30">
                      <th className="px-4 py-3 font-medium text-zinc-500">{t('analysis.tools.indicator_item')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500 text-right">{t('analysis.tools.realtime_value')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500 text-right">{t('analysis.tools.market_consensus')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500 text-right">{t('analysis.tools.deviation_degree')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500">{t('analysis.tools.remark_note')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {analysis.fundamentalTable.map((item, i) => (
                      <tr key={`fund-table-${item.indicator}-${i}`} className="hover:bg-zinc-50/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-zinc-600">{item.indicator}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-950">{item.value}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-500">{item.consensus}</td>
                        <td className={cn(
                          "px-4 py-3 text-right font-mono font-medium",
                          item.deviation.startsWith('-') ? "text-rose-400" : "text-indigo-600"
                        )}>
                          {item.deviation}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400 italic">{item.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analysis.industryAnchors && analysis.industryAnchors.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                {t('analysis.tools.macro_anchors')}
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/30">
                      <th className="px-4 py-3 font-medium text-zinc-500">{t('analysis.tools.variable_name')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500 text-right">{t('analysis.tools.realtime_value')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500 text-center">{t('analysis.tools.weight_level')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500 text-right">{t('analysis.tools.monthly_change')}</th>
                      <th className="px-4 py-3 font-medium text-zinc-500">{t('analysis.tools.transmission_logic')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {analysis.industryAnchors.map((anchor, i) => (
                      <tr key={`anchor-table-${anchor.variable}-${i}`} className="hover:bg-zinc-50/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-zinc-600">{anchor.variable}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-950">{anchor.currentValue}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                            anchor.weight.includes('第一') ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-zinc-50 text-zinc-400"
                          )}>
                            {anchor.weight}
                          </span>
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-mono font-medium",
                          anchor.monthlyChange.startsWith('-') ? "text-rose-400" : "text-indigo-600"
                        )}>
                          {anchor.monthlyChange}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500 leading-relaxed">{anchor.logic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification Metrics */}
      {analysis.verificationMetrics && analysis.verificationMetrics.length > 0 && (
        <div className="mt-6 p-6 rounded-2xl bg-indigo-600/5 border border-indigo-50">
          <h4 className="text-sm font-medium text-indigo-600 mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} />
            {t('analysis.tools.verification_metrics')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.verificationMetrics?.map((m, i) => (
              <div key={`analysis-verification-${m.indicator}-${i}`} className="p-4 rounded-xl bg-zinc-50/30 border border-zinc-200/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-zinc-950">{m.indicator}</span>
                  <span className="text-base font-semibold text-indigo-600 font-mono">{m.threshold}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] text-zinc-400">
                  <div className="flex flex-col">
                    <span className="uppercase font-medium text-zinc-400">{t('analysis.tools.expected_duration')}</span>
                    <span>{m.timeframe}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="uppercase font-medium text-zinc-400">{t('analysis.tools.transmission_logic')}</span>
                    <span className="italic">{m.logic}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capital Flow */}
      {analysis.capitalFlow && (
        <div className="mt-6 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10">
          <h4 className="text-sm font-medium text-amber-500 mb-4 flex items-center gap-2">
            <Coins size={18} />
            {t('analysis.tools.capital_flow')}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.northbound')}</p>
              <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.northboundFlow}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.institutional')}</p>
              <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.institutionalHoldings}</p>
            </div>
            {analysis.capitalFlow.ahPremium && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.tools.ah_premium')}</p>
                <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.ahPremium}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{t('analysis.scenarios.safety_margin')}</p>
              <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.marketSentiment}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
