import React, { useState } from 'react';
import {
  ExternalLink, CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  BarChart3, Info, MessageSquare, Newspaper, PieChart, Send,
  ShieldAlert, TrendingDown, TrendingUp, Zap, Share2, Download,
  AlertTriangle, Cpu, Award, Target, RefreshCcw, Clock, Layers,
  Database, History, Coins, ShieldCheck, Search, LayoutGrid, User
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getQualityLabel } from '../../services/dataQualityService';
import { useUIStore, selectLoading, selectIsChatting, selectIsDiscussing, selectIsReviewing } from '../../stores/useUIStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useDiscussionStore } from '../../stores/useDiscussionStore';
import { useScenarioStore } from '../../stores/useScenarioStore';
import { DiscussionPanel } from '../DiscussionPanel';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const chatPrompts = [
  '现在适合追高还是等回调？',
  '这只股票未来三个月最大的风险是什么？',
  '请给我一个更稳健的交易计划。',
];

interface AnalysisResultProps {
  onResetToHome: () => void;
  onExportFullReport: () => void;
  onSendStockReport: () => void;
  onSendDiscussionReport: () => void;
  onSendChatReport: () => void;
  onDiscussionQuestion: (question: string) => void;
  onGenerateNewConclusion: () => void;
  onChat: (message?: string) => void;
}

export function AnalysisResult({
  onResetToHome,
  onExportFullReport,
  onSendStockReport,
  onSendDiscussionReport,
  onSendChatReport,
  onDiscussionQuestion,
  onGenerateNewConclusion,
  onChat,
}: AnalysisResultProps) {
  const [isDiscussionFullscreen, setIsDiscussionFullscreen] = useState(false);
  const dragControls = useDragControls();

  const isChatting = useUIStore(selectIsChatting);
  const isDiscussing = useUIStore(selectIsDiscussing);
  const isReviewing = useUIStore(selectIsReviewing);
  const {
    isGeneratingReport, isSendingReport, reportStatus,
    showDiscussion, setShowDiscussion,
  } = useUIStore();

  const { analysis, chatMessage, setChatMessage, chatHistory } = useAnalysisStore();
  const { discussionMessages, controversialPoints, tradingPlanHistory } = useDiscussionStore();
  const {
    scenarios, sensitivityFactors, expectationGap, calculations,
    dataFreshnessStatus, stressTestLogic, catalystList,
    verificationMetrics, capitalFlow, positionManagement, timeDimension,
  } = useScenarioStore();

  if (!analysis) return null;

  return (
    <motion.main
      key={analysis.stockInfo?.symbol}
      initial={{ opacity: 1, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onResetToHome}
          className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-950"
        >
          <ArrowLeft size={16} />
          返回首页
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportFullReport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200/60 hover:bg-zinc-50 text-zinc-500 text-sm font-medium transition-all"
          >
            <Download size={16} />
            导出全维度报告
          </button>
          <button
            onClick={onSendStockReport}
            disabled={isGeneratingReport || isSendingReport}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              reportStatus === 'success'
                ? "bg-indigo-100 text-indigo-600 border border-indigo-600/50"
                : reportStatus === 'error'
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/50"
                : "bg-white border border-zinc-200/60 hover:bg-zinc-50 text-zinc-500"
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
                发送个股简报
              </>
            )}
          </button>
        </div>
      </div>

      {/* Core Conclusions and Scenario Analysis */}
      {(isDiscussing || discussionMessages.length > 0) && (
        <div className="flex flex-col gap-8 mt-4 pt-4 w-full">
          <div className="space-y-6 w-full">
            <div className="p-8 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                <h3 className="text-lg font-bold uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                      <Zap size={24} className="text-emerald-500" />
                    </div>
                    研讨会核心结论与场景分析
                  </div>
                {dataFreshnessStatus && (
                  <div className="flex items-center gap-2">
                     {analysis.dataQuality && (
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm shadow-emerald-500/5",
                        getQualityLabel(analysis.dataQuality.score).color,
                        "bg-white/5 border-zinc-200/60"
                      )}>
                        <Database size={10} />
                        Data Health: {analysis.dataQuality.score}% - {getQualityLabel(analysis.dataQuality.score).label}
                      </div>
                    )}
                    <div className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm",
                      dataFreshnessStatus === "Fresh" ? "bg-indigo-50 text-emerald-500 border-indigo-100 shadow-emerald-500/5" :
                      dataFreshnessStatus === "Warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5" :
                      "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/5 animate-pulse"
                    )}>
                      {dataFreshnessStatus === "Stale" ? (
                        <span className="flex items-center gap-1">
                          <AlertCircle size={10} />
                          STALE DATA detected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <ShieldCheck size={10} />
                          {dataFreshnessStatus} Data
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </h3>
              {isDiscussing && discussionMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 text-zinc-400 py-12">
                  <div className="relative">
                    <Loader2 size={32} className="animate-spin text-emerald-500" />
                    <div className="absolute inset-0 blur-xl bg-indigo-100 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium tracking-wide">专家组正在进入会议室...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* In-progress indicator when discussion is running */}
                  {isDiscussing && discussionMessages.length > 0 && (
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/40 flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-indigo-500" />
                      <p className="text-xs font-medium text-indigo-600">专家组联席会议讨论进行中，结论将在全部轮次完成后呈现...</p>
                    </div>
                  )}

                  {/* Final Conclusion Card - hidden during active discussion */}
                  {analysis.finalConclusion && !isDiscussing && (
                    <div className="p-8 rounded-[2rem] bg-indigo-600/5 border border-indigo-100 relative overflow-hidden group shadow-sm">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                        <Award size={120} className="text-indigo-600 rotate-12" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                            <Award size={20} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">联席会议最终结论</h4>
                            <p className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider">Final Consensus & Strategic Directive</p>
                          </div>
                        </div>
                        <div className="prose prose-zinc max-w-none prose-p:text-zinc-700 prose-p:text-lg prose-p:font-medium prose-p:leading-relaxed prose-p:tracking-tight">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {analysis.finalConclusion}
                          </ReactMarkdown>
                        </div>
                        <div className="mt-8 pt-6 border-t border-zinc-200/60 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden">
                              <User size={16} className="text-zinc-400" />
                            </div>
                            <span className="text-xs font-bold text-zinc-900 uppercase tracking-widest">首席策略师 签发</span>
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400">
                            VERIFIED BY MULTI-AGENT CONSENSUS
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conflict Logger */}
                  {controversialPoints.length > 0 && (
                    <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400 mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        逻辑冲突记录仪 (Conflict Logger)
                      </h4>
                      <div className="space-y-2">
                        {controversialPoints.map((point, idx) => (
                          <div key={`controversial-${idx}-${point.substring(0, 30)}-${Math.random().toString(36).slice(2, 7)}`} className="flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            <p className="text-[11px] text-zinc-500 leading-relaxed italic">{point}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[9px] text-zinc-400 uppercase font-semibold tracking-widest">
                        * 真正的 Alpha 往往隐藏在被否定的"逆向观点"里
                      </p>
                    </div>
                  )}

                  {/* Trading Plan Card - hidden during active discussion */}
                  {analysis.tradingPlan && !isDiscussing && (
                    <div className="p-8 rounded-[2rem] bg-zinc-50/50 border border-zinc-200/60 relative overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 border border-indigo-600/20">
                            <Target size={20} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">联席会议执行计划</h4>
                            <p className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider">Tactical Execution & Risk Management</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-600/20">
                          <Zap size={10} />
                          ACTIVE PLAN
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="p-5 rounded-2xl bg-white border border-zinc-200/60 shadow-sm group hover:border-indigo-600/30 transition-all">
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-2">建议入场位</p>
                          <p className="text-2xl font-semibold text-zinc-950 tracking-tighter group-hover:text-indigo-600 transition-colors">{analysis.tradingPlan.entryPrice}</p>
                          <div className="mt-2 h-1 w-8 bg-indigo-600/20 rounded-full" />
                        </div>
                        <div className="p-5 rounded-2xl bg-white border border-zinc-200/60 shadow-sm group hover:border-emerald-500/30 transition-all">
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-2">目标止盈位</p>
                          <p className="text-2xl font-semibold text-zinc-950 tracking-tighter group-hover:text-emerald-500 transition-colors">{analysis.tradingPlan.targetPrice}</p>
                          <div className="mt-2 h-1 w-8 bg-emerald-500/20 rounded-full" />
                        </div>
                        <div className="p-5 rounded-2xl bg-white border border-zinc-200/60 shadow-sm group hover:border-rose-500/30 transition-all">
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-2">硬性止损位</p>
                          <p className="text-2xl font-semibold text-zinc-950 tracking-tighter group-hover:text-rose-500 transition-colors">{analysis.tradingPlan.stopLoss}</p>
                          <div className="mt-2 h-1 w-8 bg-rose-500/20 rounded-full" />
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-indigo-600/5 border border-indigo-100/50">
                        <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-2">核心战术策略</p>
                        <p className="text-sm text-zinc-600 leading-relaxed font-medium italic">
                          "{analysis.tradingPlan.strategy}"
                        </p>
                      </div>

                      {/* Trading Plan Version History */}
                      {tradingPlanHistory.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-zinc-200/50">
                          <h5 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                            <History size={12} />
                            交易计划版本控制 (Version Control)
                          </h5>
                          <div className="space-y-3">
                            {tradingPlanHistory.map((v, i) => (
                              <div key={`trading-plan-${v.version}-${v.timestamp}-${i}`} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/50 text-[10px]">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-indigo-600 uppercase tracking-widest">{v.version}</span>
                                  <span className="text-zinc-400 font-mono">{new Date(v.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-zinc-500 mb-2 leading-relaxed">
                                  <span className="text-zinc-400 font-medium uppercase mr-1">变更原因:</span>
                                  {v.changeReason}
                                </p>
                                <div className="grid grid-cols-3 gap-2 py-2 border-t border-zinc-200">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-zinc-400 uppercase font-semibold">入场</span>
                                    <span className="text-emerald-500/80 font-semibold">{v.plan.entryPrice}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-zinc-400 uppercase font-semibold">目标</span>
                                    <span className="text-blue-500/80 font-semibold">{v.plan.targetPrice}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-zinc-400 uppercase font-semibold">止损</span>
                                    <span className="text-rose-500/80 font-semibold">{v.plan.stopLoss}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(scenarios.length > 0 || !!expectationGap || (sensitivityFactors && sensitivityFactors.length > 0) || calculations.length > 0 || !!stressTestLogic || (catalystList && catalystList.length > 0) || (verificationMetrics && verificationMetrics.length > 0) || !!capitalFlow || !!positionManagement || !!timeDimension) && (
                    <div className="space-y-6">
                      {/* Expectation Gap */}
                      {expectationGap && (
                        <div className="p-8 rounded-[2rem] bg-indigo-600/5 border border-indigo-100 relative overflow-hidden shadow-sm">
                          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                            <Search size={120} className="text-indigo-600" />
                          </div>
                          
                          <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 border border-indigo-600/20">
                                <Search size={20} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">预期偏差识别 (Expectation Gap)</h4>
                                <p className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider">Market Consensus vs. AI Insight</p>
                              </div>
                            </div>
                            {expectationGap.confidenceScore && (
                              <div className="px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold tracking-widest shadow-lg shadow-indigo-600/20">
                                CONFIDENCE: {expectationGap.confidenceScore}%
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 relative z-10">
                            <div className="p-6 rounded-2xl bg-white border border-zinc-200/60 shadow-sm">
                              <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-3">市场共识 (Market Consensus)</p>
                              <p className="text-sm text-zinc-600 leading-relaxed font-medium">{expectationGap.marketConsensus}</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-indigo-600 border border-indigo-500 shadow-lg shadow-indigo-600/10">
                              <p className="text-[9px] text-indigo-200 uppercase font-bold tracking-widest mb-3">AI 团队观点 (Our View)</p>
                              <p className="text-sm text-white leading-relaxed font-bold">{expectationGap.ourView}</p>
                            </div>
                          </div>

                          <div className="p-6 rounded-2xl bg-white/50 border border-zinc-200/60 relative z-10">
                            <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                              <Zap size={12} className="text-amber-500" />
                              核心偏差逻辑 (Gap Reason)
                            </p>
                            <p className="text-sm text-zinc-600 leading-relaxed font-medium italic">
                              "{expectationGap.gapReason}"
                            </p>
                            {expectationGap.isSignificant && (
                              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 font-bold uppercase tracking-widest shadow-sm">
                                <AlertTriangle size={14} />
                                显著性偏差 (SIGNIFICANT GAP DETECTED)
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Scenario Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {scenarios.map((s, i) => (
                          <div key={`scenario-${s.case}-${s.probability}-${i}`} className={cn(
                            "p-8 rounded-[2rem] border transition-all hover:scale-[1.02] duration-500 shadow-sm relative overflow-hidden group",
                            s.case === "Bull" ? "bg-emerald-500/5 border-emerald-500/20" :
                            s.case === "Stress" ? "bg-rose-500/5 border-rose-500/20" :
                            "bg-indigo-600/5 border-indigo-100"
                          )}>
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                              {s.case === "Bull" ? <TrendingUp size={80} /> : s.case === "Stress" ? <AlertTriangle size={80} /> : <BarChart3 size={80} />}
                            </div>
                            
                            <div className="flex items-center justify-between mb-6 relative z-10">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm",
                                s.case === "Bull" ? "text-emerald-600 border-emerald-600/30 bg-white" :
                                s.case === "Stress" ? "text-rose-500 border-rose-500/30 bg-white" :
                                "text-indigo-600 border-indigo-600/30 bg-white"
                              )}>
                                {s.case === 'Bull' ? '乐观 (Bull)' : s.case === 'Stress' ? '压力 (Stress)' : '基准 (Base)'}
                              </span>
                              <div className="text-right">
                                <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">发生概率</p>
                                <p className="text-xl font-semibold text-zinc-950">{s.probability}%</p>
                              </div>
                            </div>
                            
                            <div className="space-y-6 relative z-10">
                              <div>
                                <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-2">关键假设边界</p>
                                <p className="text-sm text-zinc-600 leading-relaxed font-medium">{s.keyInputs}</p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-zinc-200/60">
                                <div>
                                  <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1">目标估值</p>
                                  <p className="text-2xl font-semibold text-zinc-950 tracking-tighter">{s.targetPrice}</p>
                                </div>
                                <div>
                                  <p className={cn(
                                    "text-[9px] uppercase font-bold tracking-widest mb-1",
                                    s.case === "Stress" ? "text-rose-400" : "text-emerald-500"
                                  )}>预期回报</p>
                                  <p className={cn(
                                    "text-2xl font-semibold tracking-tighter",
                                    s.case === "Stress" ? "text-rose-500" : "text-emerald-500"
                                  )}>{s.expectedReturn}</p>
                                </div>
                              </div>
                              
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">安全边际评估</span>
                                <span className="text-xs font-semibold text-zinc-600">{s.marginOfSafety}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Sensitivity Analysis */}
                      {sensitivityFactors && sensitivityFactors.length > 0 && (
                        <div className="rounded-2xl border border-zinc-200 bg-white/40 p-5">
                          <h4 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">因子敏感度面板 (Sensitivity Analysis)</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sensitivityFactors.map((f, i) => (
                              <div key={`sensitivity-${f.factor}-${f.change}-${i}`} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/50 group hover:border-zinc-200 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-zinc-500">{f.factor}</span>
                                  <span className="text-[10px] font-mono text-zinc-400">{f.change}</span>
                                </div>
                                <div className="flex items-end justify-between">
                                  <span className={cn(
                                    "text-lg font-semibold tracking-tighter",
                                    f.impact?.includes('+') ? "text-indigo-600" : "text-rose-400"
                                  )}>
                                    {f.impact}
                                    <span className="text-[10px] ml-1 font-medium text-zinc-400">Δ TP</span>
                                  </span>
                                  <div className="text-right max-w-[60%]">
                                    <span className="text-[10px] text-zinc-400 leading-tight italic block">
                                      {f.logic}
                                    </span>
                                    {f.formula && (
                                      <code className="text-[9px] text-zinc-400 font-mono mt-1 block truncate">{f.formula}</code>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Calculation Engine */}
                      {calculations.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-5">
                          <div className="flex items-center gap-2 text-amber-500 mb-4">
                            <Cpu size={16} />
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">计算引擎 (Calculation Engine)</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {calculations.map((calc, idx) => (
                              <div key={`calc-${calc.formulaName}-${calc.timestamp}-${idx}`} className="p-4 rounded-xl bg-zinc-50 border border-amber-500/10 group hover:border-amber-500/20 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest">{calc.formulaName}</span>
                                  <span className="text-[9px] font-mono text-zinc-400">{new Date(calc.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(calc.inputs).map(([k, v]) => (
                                      <div key={k} className="flex flex-col">
                                        <span className="text-[8px] text-zinc-400 uppercase font-semibold">{k}</span>
                                        <span className="text-[10px] text-zinc-500 font-mono">{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-2 border-t border-zinc-200/50 flex items-center justify-between">
                                    <span className="text-[9px] text-zinc-400 uppercase font-semibold">结果 (Output)</span>
                                    <span className="text-sm font-semibold text-amber-500 font-mono">{calc.output}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {stressTestLogic && (
                        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                          <h4 className="text-[10px] font-medium uppercase tracking-widest text-rose-500 mb-2 flex items-center gap-2">
                            <AlertTriangle size={12} />
                            压力测试逻辑 (Stress Test Logic)
                          </h4>
                          <div className="text-[11px] text-zinc-400 font-mono leading-relaxed">
                            {stressTestLogic}
                          </div>
                        </div>
                      )}

                      {catalystList && catalystList.length > 0 && (
                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                          <h4 className="text-[10px] font-medium uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-2">
                            <Zap size={12} />
                            催化剂清单 (Catalyst List)
                          </h4>
                          <div className="space-y-2">
                            {catalystList.map((c, i) => (
                              <div key={`catalyst-${c.event.substring(0, 20)}-${i}`} className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-500 font-medium">{c.event}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-zinc-400">概率: {c.probability}%</span>
                                  <span className="text-amber-500 font-medium">影响: {c.impact}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {verificationMetrics && verificationMetrics.length > 0 && (
                        <div className="p-4 rounded-2xl bg-indigo-600/5 border border-indigo-50">
                          <h4 className="text-[10px] font-medium uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-2">
                            <CheckCircle2 size={12} />
                            可跟踪验证指标 (Verification Metrics)
                          </h4>
                          <div className="space-y-3">
                            {verificationMetrics?.map((m, i) => (
                              <div key={`verification-${m.indicator.substring(0, 20)}-${i}`} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-zinc-600 font-medium">{m.indicator}</span>
                                  <span className="text-indigo-600 font-mono">{m.threshold}</span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                                  <span>周期: {m.timeframe}</span>
                                  <span className="italic">{m.logic}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {capitalFlow && (
                        <div className="p-4 rounded-2xl bg-indigo-50/30 border border-blue-500/10">
                          <h4 className="text-[10px] font-medium uppercase tracking-widest text-blue-500 mb-3 flex items-center gap-2">
                            <Coins size={12} />
                            资金行为验证 (Capital Flow)
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-400 uppercase font-semibold">北向资金 (Northbound)</span>
                              <p className="text-[10px] text-zinc-500">{capitalFlow.northboundFlow}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-400 uppercase font-semibold">机构持仓 (Institutional)</span>
                              <p className="text-[10px] text-zinc-500">{capitalFlow.institutionalHoldings}</p>
                            </div>
                            {capitalFlow.ahPremium && (
                              <div className="space-y-1">
                                <span className="text-[8px] text-zinc-400 uppercase font-semibold">AH 溢价 (AH Premium)</span>
                                <p className="text-[10px] text-zinc-500">{capitalFlow.ahPremium}</p>
                              </div>
                            )}
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-400 uppercase font-semibold">市场情绪 (Sentiment)</span>
                              <p className="text-[10px] text-zinc-500">{capitalFlow.marketSentiment}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {positionManagement && (
                        <div className="p-4 rounded-2xl bg-zinc-50/50 border border-zinc-200/60">
                          <h4 className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                            <Layers size={12} />
                            仓位管理逻辑 (Position Management)
                          </h4>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-400 uppercase font-semibold">分层建仓 (Layered Entry)</span>
                              <div className="flex flex-wrap gap-2">
                                {positionManagement.layeredEntry?.map((step, i) => (
                                  <span key={`entry-step-${i}-${step.substring(0, 20)}`} className="text-[9px] px-2 py-0.5 rounded bg-zinc-50 text-zinc-500 border border-zinc-200">{step}</span>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[8px] text-zinc-400 uppercase font-semibold">仓位逻辑 (Sizing)</span>
                                <p className="text-[10px] text-zinc-500">{positionManagement.sizingLogic}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] text-zinc-400 uppercase font-semibold">风险立场 (Stance)</span>
                                <p className="text-[10px] text-zinc-500">{positionManagement.riskAdjustedStance}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {timeDimension && (
                        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                          <h4 className="text-[10px] font-medium uppercase tracking-widest text-purple-500 mb-3 flex items-center gap-2">
                            <Clock size={12} />
                            时间维度 (Time Dimension)
                          </h4>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-400 uppercase font-semibold">预期持仓周期 (Duration)</span>
                              <p className="text-[10px] text-zinc-500 font-medium">{timeDimension.expectedDuration}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[8px] text-zinc-400 uppercase font-semibold">关键里程碑 (Milestones)</span>
                                <ul className="list-disc list-inside text-[9px] text-zinc-500 space-y-0.5">
                                  {timeDimension.keyMilestones?.map((m, i) => <li key={`milestone-${i}-${m.substring(0, 10)}`}>{m}</li>)}
                                </ul>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] text-zinc-400 uppercase font-semibold">退出触发 (Exit Triggers)</span>
                                <ul className="list-disc list-inside text-[9px] text-zinc-500 space-y-0.5">
                                  {timeDimension.exitTriggers?.map((t, i) => <li key={`trigger-${i}-${t.substring(0, 10)}`}>{t}</li>)}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Moderator messages */}
                  {discussionMessages.filter(m => m.role === "Moderator").map((m, i) => (
                    <div key={`mod-${i}-${m.id || m.role}-${Math.random().toString(36).slice(2, 7)}`} className="relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-indigo-600/50 rounded-full" />
                      <div className="prose prose-invert prose-sm max-w-none pl-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {discussionMessages.length > 0 && isDiscussing && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-50/30 border border-zinc-200/60">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" />
                      </div>
                      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">专家们正在激烈讨论中</p>
                    </div>
                  )}
                  {discussionMessages.length > 0 && isReviewing && (
                    <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-indigo-600/5 border border-indigo-100 mt-4">
                      <Loader2 size={16} className="animate-spin text-emerald-500" />
                      <p className="text-xs font-medium text-emerald-500 uppercase tracking-widest">专家组正在审阅并回复中...</p>
                    </div>
                  )}
                  {discussionMessages.length > 0 && !isDiscussing && !isReviewing && !analysis.finalConclusion && (
                    <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 mt-4">
                      <Loader2 size={16} className="animate-spin text-amber-500" />
                      <p className="text-xs font-medium text-amber-500 uppercase tracking-widest">首席策略师正在整理最终意见...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Discussion action buttons */}
              {discussionMessages.length > 0 && !isDiscussing && (
                <div className="pt-4 border-t border-zinc-200 mt-4 space-y-3">
                  <button
                    onClick={onSendDiscussionReport}
                    disabled={isGeneratingReport || isSendingReport}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all",
                      reportStatus === 'success' 
                        ? "bg-indigo-100 text-indigo-600 border border-indigo-600/50"
                        : reportStatus === 'error'
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/50"
                        : "bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-500"
                    )}
                  >
                    {isGeneratingReport ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        生成研讨总结...
                      </>
                    ) : isSendingReport ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        发送至飞书...
                      </>
                    ) : reportStatus === 'success' ? (
                      <>
                        <CheckCircle2 size={14} />
                        已发送
                      </>
                    ) : (
                      <>
                        <Share2 size={14} />
                        发送研讨总结至飞书
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const content = discussionMessages.map(msg => {
                        const time = new Date(msg.timestamp).toLocaleString();
                        return `### [${msg.role}] - ${time}\n\n${msg.content}\n\n---\n\n`;
                      }).join('\n');
                      const header = `# AI 专家组研讨记录 - ${analysis.stockInfo?.name} (${analysis.stockInfo?.symbol})\n生成时间: ${new Date().toLocaleString()}\n\n---\n\n`;
                      const fullContent = header + content;
                      const blob = new Blob([fullContent], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Discussion_${analysis.stockInfo?.symbol}_${new Date().toISOString().split('T')[0]}.md`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-500 transition-all"
                  >
                    <Download size={14} />
                    下载完整研讨文档 (.md)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Discussion Panel */}
      <AnimatePresence>
        {showDiscussion && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${isDiscussionFullscreen ? 'p-0' : 'p-4 md:p-8'}`}>
            {!isDiscussionFullscreen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-zinc-900/10 backdrop-blur-sm pointer-events-auto" 
                onClick={() => setShowDiscussion(false)} 
              />
            )}
            
            <motion.div
              drag={!isDiscussionFullscreen}
              dragMomentum={false}
              dragListener={false}
              dragControls={dragControls}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                width: isDiscussionFullscreen ? '100%' : '100%',
                height: isDiscussionFullscreen ? '100%' : '85vh',
              }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative z-10 flex flex-col overflow-hidden pointer-events-auto bg-white border border-zinc-200 shadow-2xl ${ isDiscussionFullscreen ? 'rounded-none border-0 max-w-none' : 'rounded-3xl max-w-5xl' }`}
            >
              <DiscussionPanel 
                onSendMessage={onDiscussionQuestion}
                onGenerateNewConclusion={onGenerateNewConclusion}
                onClose={() => setShowDiscussion(false)}
                isFullscreen={isDiscussionFullscreen}
                onToggleFullscreen={() => setIsDiscussionFullscreen(!isDiscussionFullscreen)}
                onPointerDownDrag={(e) => dragControls.start(e)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      {(isDiscussing || discussionMessages.length > 0) && !showDiscussion && (
        <button
          onClick={() => setShowDiscussion(true)}
          className="fixed bottom-8 right-8 p-4 rounded-2xl bg-emerald-600 text-zinc-950 shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] hover:bg-indigo-700 hover:scale-105 transition-all z-40 group flex items-center justify-center border border-emerald-400/30"
        >
          <MessageSquare size={24} />
          {isDiscussing && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-zinc-200"></span>
            </span>
          )}
          <span className="absolute right-full mr-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-zinc-50 text-zinc-500 text-xs px-3 py-1.5 rounded-xl border border-zinc-200 font-medium">
            展开专家联席会议
          </span>
        </button>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
        <div className="premium-card p-10 md:p-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
            <BarChart3 size={240} className="text-zinc-900" />
          </div>
          
          <div className="mb-14 flex flex-wrap items-end justify-between gap-10 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="rounded-xl bg-zinc-100 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 border border-zinc-200/60 shadow-sm">
                  {analysis.stockInfo?.market}
                </span>
                <h2 className="text-5xl font-bold tracking-tighter text-zinc-950">{analysis.stockInfo?.name}</h2>
                <span className="font-mono text-2xl font-medium text-zinc-400 tracking-tighter">{analysis.stockInfo?.symbol}</span>
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
                <span className="text-8xl font-bold tracking-tighter text-zinc-950">
                  {analysis.stockInfo?.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="ml-4 text-3xl font-medium uppercase text-zinc-300 tracking-tight">{analysis.stockInfo?.currency}</span>
                </span>
                <div className={cn(
                  'flex items-center gap-3 text-3xl font-bold tracking-tight px-6 py-2 rounded-[1.5rem] border shadow-sm', 
                  (analysis.stockInfo?.change ?? 0) >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-500 bg-rose-50 border-rose-100'
                )}>
                  {(analysis.stockInfo?.change ?? 0) >= 0 ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
                  <span>{(analysis.stockInfo?.change ?? 0) >= 0 ? '+' : ''}{analysis.stockInfo?.change}</span>
                  <span className="text-xl opacity-60">({analysis.stockInfo?.changePercent}%)</span>
                </div>
              </div>
            </div>
            
            <div className="text-right space-y-2 relative z-10">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">最后更新 (Last Sync)</p>
              <p className="text-base font-semibold text-zinc-500 flex items-center justify-end gap-2">
                <Clock size={16} className="text-zinc-300" />
                {analysis.stockInfo?.lastUpdated}
              </p>
            </div>
          </div>

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

          {analysis.valuationAnalysis && (
            <div className="mt-6 p-6 rounded-2xl bg-indigo-600/5 border border-indigo-50">
              <h4 className="text-sm font-medium text-indigo-600 mb-4 flex items-center gap-2">
                <ShieldCheck size={18} />
                市场估值分析 (安全边际评估)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">历史均值对比</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{analysis.valuationAnalysis.comparison}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">安全边际总结</p>
                  <p className="text-sm text-zinc-500 leading-relaxed font-medium">{analysis.valuationAnalysis.marginOfSafetySummary}</p>
                </div>
              </div>
            </div>
          )}

          {analysis.cycleAnalysis && (
            <div className="mt-6 p-6 rounded-2xl bg-indigo-50/30 border border-blue-500/10">
              <h4 className="text-sm font-medium text-indigo-600 mb-4 flex items-center gap-2">
                <RefreshCcw size={18} />
                周期性分析 (Cycle Analysis)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">当前阶段 (Stage)</p>
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
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">周期逻辑与波动风险</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{analysis.cycleAnalysis.logic}</p>
                  <p className="text-xs text-rose-400 mt-2 italic flex items-center gap-1">
                    <AlertTriangle size={12} />
                    波动风险: {analysis.cycleAnalysis.volatilityRisk}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(analysis.fundamentalTable || analysis.industryAnchors) && (
            <div className="mt-8 space-y-8 border-t border-zinc-200/50 pt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <LayoutGrid size={18} className="text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">基本面数据透视与分析</h3>
              </div>

              {analysis.fundamentalTable && analysis.fundamentalTable.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-medium uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <Target size={14} className="text-emerald-500" />
                    核心指标与预期偏差 (2026E)
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/30">
                          <th className="px-4 py-3 font-medium text-zinc-500">指标</th>
                          <th className="px-4 py-3 font-medium text-zinc-500 text-right">实时数值</th>
                          <th className="px-4 py-3 font-medium text-zinc-500 text-right">市场共识</th>
                          <th className="px-4 py-3 font-medium text-zinc-500 text-right">偏离度</th>
                          <th className="px-4 py-3 font-medium text-zinc-500">备注</th>
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
                    <Layers size={14} className="text-blue-500" />
                    行业核心变量与宏观锚点
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/30">
                          <th className="px-4 py-3 font-medium text-zinc-500">关键变量</th>
                          <th className="px-4 py-3 font-medium text-zinc-500 text-right">当前数值</th>
                          <th className="px-4 py-3 font-medium text-zinc-500 text-center">权重</th>
                          <th className="px-4 py-3 font-medium text-zinc-500 text-right">30日涨跌</th>
                          <th className="px-4 py-3 font-medium text-zinc-500">传导逻辑</th>
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

          {analysis.verificationMetrics && analysis.verificationMetrics.length > 0 && (
            <div className="mt-6 p-6 rounded-2xl bg-indigo-600/5 border border-indigo-50">
              <h4 className="text-sm font-medium text-indigo-600 mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} />
                可跟踪验证指标体系 (Verification Metrics)
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
                        <span className="uppercase font-medium text-zinc-400">验证周期</span>
                        <span>{m.timeframe}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="uppercase font-medium text-zinc-400">验证逻辑</span>
                        <span className="italic">{m.logic}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.capitalFlow && (
            <div className="mt-6 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <h4 className="text-sm font-medium text-amber-500 mb-4 flex items-center gap-2">
                <Coins size={18} />
                资金行为验证 (Capital Flow)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">北向资金</p>
                  <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.northboundFlow}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">机构持仓</p>
                  <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.institutionalHoldings}</p>
                </div>
                {analysis.capitalFlow.ahPremium && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">AH 溢价</p>
                    <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.ahPremium}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">市场情绪</p>
                  <p className="text-sm text-zinc-500 font-medium">{analysis.capitalFlow.marketSentiment}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-4 premium-card p-8">
            <h3 className="flex items-center gap-2 text-lg font-medium text-zinc-950">
              <Info size={18} className="text-emerald-500" />
              核心摘要
            </h3>
            <p className="text-sm leading-relaxed text-zinc-500 font-medium">{analysis.summary}</p>
          </div>

          {analysis.tradingPlan && (
            <div className={cn(
              "space-y-4 rounded-2xl p-8 border transition-all duration-500",
              analysis.tradingPlan.entryPrice === '不推荐' 
                ? "border-rose-500/20 bg-rose-500/5 shadow-[0_0_40px_-15px_rgba(244,63,94,0.1)]" 
                : "border-indigo-100 bg-indigo-600/5 shadow-[0_0_40px_-15px_rgba(16,185,129,0.1)]"
            )}>
              <h3 className={cn(
                "flex items-center gap-2 text-xl font-semibold tracking-tight",
                analysis.tradingPlan.entryPrice === '不推荐' ? "text-rose-400" : "text-indigo-600"
              )}>
                <Zap size={20} />
                交易计划 {analysis.tradingPlan.entryPrice === '不推荐' && '(基于安全边际不推荐)'}
              </h3>
              {analysis.tradingPlan.entryPrice !== '不推荐' ? (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">建议买入</p>
                    <p className="text-sm font-medium text-indigo-600">{analysis.tradingPlan.entryPrice}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">目标价位</p>
                    <p className="text-sm font-medium text-indigo-600">{analysis.tradingPlan.targetPrice}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">止损价位</p>
                    <p className="text-sm font-medium text-rose-400">{analysis.tradingPlan.stopLoss}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <p className="text-sm font-medium text-rose-400">当前估值或风险不符合安全边际要求，暂不推荐买入计划。</p>
                </div>
              )}
              <div className="p-4 rounded-2xl bg-white border border-zinc-200">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-2">操作策略</p>
                <p className="text-sm leading-relaxed text-zinc-500 italic">{analysis.tradingPlan.strategy}</p>
              </div>
              {analysis.tradingPlan.strategyRisks && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-rose-400 mb-2 flex items-center gap-2">
                    <ShieldAlert size={12} />
                    交易策略风险提示
                  </p>
                  <p className="text-xs text-rose-200/80 leading-relaxed italic">
                    {analysis.tradingPlan.strategyRisks}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Newspaper size={18} className="text-zinc-400" />
              相关新闻
            </h3>
            <div className="space-y-4">
              {analysis.news?.map((item, i) => (
                <a key={`news-${item.title.substring(0, 20)}-${i}`} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h4 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-indigo-600">{item.title}</h4>
                    <ExternalLink size={12} className="shrink-0 text-zinc-400 transition-colors group-hover:text-indigo-600" />
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.time}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <div className="absolute left-0 top-0 h-1 w-full bg-zinc-50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analysis.score}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className={cn('h-full', analysis.score >= 70 ? 'bg-indigo-500' : analysis.score >= 40 ? 'bg-amber-500' : 'bg-rose-500')}
            />
          </div>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">AI 信心评分</p>
          <div className="relative inline-block">
            <span className="text-8xl font-semibold tracking-tighter text-zinc-950">{analysis.score}</span>
            <span className="absolute -right-4 -top-2 font-medium text-zinc-400">/100</span>
          </div>
          <div className="mt-8 space-y-2">
            <div className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium uppercase tracking-widest', analysis.sentiment === 'Bullish' ? 'border-indigo-100 bg-indigo-50 text-indigo-500' : analysis.sentiment === 'Bearish' ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' : 'border-zinc-200 bg-zinc-100 text-zinc-500')}>
              {analysis.sentiment === 'Bullish' ? '看涨' : analysis.sentiment === 'Bearish' ? '看跌' : '中性'} 情绪
            </div>
            <div className="mt-4 text-2xl font-medium text-zinc-950">
              {analysis.recommendation === 'Strong Buy' ? '强烈买入' : analysis.recommendation === 'Buy' ? '买入' : analysis.recommendation === 'Hold' ? '持有' : analysis.recommendation === 'Sell' ? '卖出' : '强烈卖出'}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-600">
              <Zap size={16} />
              潜在机会
            </h3>
            <ul className="space-y-3">
              {analysis.keyOpportunities?.map((opp, i) => (
                <li key={`opp-${opp.substring(0, 20)}-${i}`} className="flex items-start gap-3 text-sm text-zinc-500">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  {opp}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-rose-400">
              <ShieldAlert size={16} />
              核心风险
            </h3>
            <ul className="space-y-3">
              {analysis.keyRisks?.map((risk, i) => (
                <li key={`risk-${risk.substring(0, 20)}-${i}`} className="flex items-start gap-3 text-sm text-zinc-500">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Chat Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-2xl border border-zinc-200 bg-white p-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600">
              <MessageSquare size={20} />
              <h2 className="text-xl font-semibold">AI 深度追问</h2>
            </div>
            <button
              onClick={onSendChatReport}
              disabled={isGeneratingReport || isSendingReport || !chatHistory || chatHistory.length === 0}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                reportStatus === 'success' 
                  ? "bg-indigo-100 text-indigo-600 border border-indigo-600/50"
                  : reportStatus === 'error'
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/50"
                  : "bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-500"
              )}
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="animate-spin" size={12} />
                  生成中...
                </>
              ) : isSendingReport ? (
                <>
                  <Loader2 className="animate-spin" size={12} />
                  发送中...
                </>
              ) : reportStatus === 'success' ? (
                <>
                  <CheckCircle2 size={12} />
                  已发送
                </>
              ) : (
                <>
                  <Share2 size={12} />
                  整理发送飞书
                </>
              )}
            </button>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-zinc-400">继续追问买点、仓位、风险、估值或交易计划。</p>

          <div className="mb-4 flex flex-wrap gap-2">
            {chatPrompts.map((p, i) => (
              <button key={`chat-prompt-${p.substring(0, 20)}-${i}`} type="button" onClick={() => void onChat(p)} disabled={isChatting} className="rounded-full border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-indigo-600/50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60">
                {p}
              </button>
            ))}
          </div>

          <div className="mb-6 max-h-96 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {chatHistory?.map((msg, idx) => (
              <div key={`chat-msg-${msg.id || 'no-id'}-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'rounded-tr-none bg-emerald-600 text-zinc-950' : 'rounded-tl-none bg-zinc-50 text-zinc-500'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isChatting && (
              <div className="flex justify-start">
                <div className="animate-pulse rounded-2xl rounded-tl-none bg-zinc-50 px-4 py-2 text-sm text-zinc-400">AI 正在整理分析...</div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onChat()}
              placeholder="继续追问 AI..."
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-950 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
            />
            <button onClick={() => void onChat()} disabled={isChatting || !chatMessage.trim()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-zinc-950 transition-all hover:bg-indigo-700 disabled:opacity-50">
              <Send size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  </motion.main>
  );
}
