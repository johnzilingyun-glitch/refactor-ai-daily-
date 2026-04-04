import React, { useEffect, useRef, useState } from 'react';
import { AgentRole, DataVerification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
 User, Shield, BarChart3, PieChart, MessageSquare, Loader2, Download, Search, Zap, Send, 
 UserCheck, ExternalLink, AlertTriangle, Award, X, Maximize2, Minimize2, 
 CheckCircle2, ShieldCheck, Cpu, Layers, Target, History, RotateCcw, Database, 
 Calculator, Table, Activity, Clock, ArrowRight, Info, Share2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useDiscussionStore } from '../stores/useDiscussionStore';
import { useUIStore, selectIsDiscussing, selectIsReviewing } from '../stores/useUIStore';
import { useConfigStore } from '../stores/useConfigStore';
import { getQualityLabel } from '../services/dataQualityService';
import { sendAnalysisToFeishu } from '../services/feishuService';

function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs));
}

const roleIcons: Record<AgentRole, React.ReactNode> = {
 "Technical Analyst": <BarChart3 size={18} />,
 "Fundamental Analyst": <PieChart size={18} />,
 "Sentiment Analyst": <MessageSquare size={18} />,
 "Risk Manager": <Shield size={18} />,
 "Contrarian Strategist": <Zap size={18} />,
 "Deep Research Specialist": <Search size={18} />,
 "Professional Reviewer": <UserCheck size={18} />,
 "Chief Strategist": <Award size={18} />,
 "Moderator": <User size={18} />,
};

const roleColors: Record<AgentRole, string> = {
 "Technical Analyst": "text-indigo-600 bg-indigo-600/6 border-indigo-600/12",
 "Fundamental Analyst": "text-emerald-500 bg-emerald-500/8 border-emerald-500/15",
 "Sentiment Analyst": "text-purple-600 bg-purple-50/80 border-purple-200/50",
 "Risk Manager": "text-rose-500 bg-rose-500/6 border-rose-500/12",
 "Contrarian Strategist": "text-orange-600 bg-orange-50/80 border-orange-200/50",
 "Deep Research Specialist": "text-cyan-600 bg-cyan-50/80 border-cyan-200/50",
 "Professional Reviewer": "text-indigo-600 bg-indigo-50/80 border-indigo-200/50",
 "Chief Strategist": "text-indigo-600 bg-indigo-600/8 border-indigo-600/15",
 "Moderator": "text-zinc-500 bg-zinc-300/10 border-zinc-300/20",
};

const roleNames: Record<AgentRole, string> = {
 "Technical Analyst": "技术分析师",
 "Fundamental Analyst": "基本面分析师",
 "Sentiment Analyst": "情绪分析师",
 "Risk Manager": "风险合规官",
 "Contrarian Strategist": "反向策略师",
 "Deep Research Specialist": "深度研究专家",
 "Professional Reviewer": "高级评审专家",
 "Chief Strategist": "首席策略师",
 "Moderator": "研讨主持人",
};

interface DiscussionPanelProps {
 onSendMessage?: (message: string, targetRole?: AgentRole) => void;
 onGenerateNewConclusion?: () => void;
 onClose?: () => void;
 isFullscreen?: boolean;
 onToggleFullscreen?: () => void;
 onPointerDownDrag?: (e: React.PointerEvent) => void;
}

export const DiscussionPanel: React.FC<DiscussionPanelProps> = ({
 onSendMessage,
 onGenerateNewConclusion,
 onClose,
 isFullscreen,
 onToggleFullscreen,
 onPointerDownDrag
}) => {
 const { analysis } = useAnalysisStore();
 const { discussionMessages: messages, analystWeights, currentRound, totalRounds } = useDiscussionStore();

 const isDiscussing = useUIStore(selectIsDiscussing);
 const isReviewing = useUIStore(selectIsReviewing);

 const { feishuWebhookUrl, setFeishuWebhookUrl } = useConfigStore();
 const [showFeishuConfig, setShowFeishuConfig] = useState(false);
 const [tempWebhook, setTempWebhook] = useState(feishuWebhookUrl);
 const [isSendingToFeishu, setIsSendingToFeishu] = useState(false);
 const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

 const scrollRef = useRef<HTMLDivElement>(null);
 const [inputValue, setInputValue] = React.useState('');
 const [targetRole, setTargetRole] = React.useState<AgentRole>('Professional Reviewer');
 const stockSymbol = analysis?.stockInfo?.symbol;
 const dataVerification = analysis?.dataVerification;

 const getWeightInfo = (role: AgentRole) => {
 return analystWeights?.find(w => w.role === role);
 };

 useEffect(() => {
 if (scrollRef.current) {
 scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
 }
 }, [messages, isDiscussing]);

 const handleSend = () => {
 if (inputValue.trim() && onSendMessage) {
 onSendMessage(inputValue.trim(), targetRole);
 setInputValue('');
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 };

 const handleDownload = () => {
 if (messages.length === 0) return;

 const content = messages.map(msg => {
 const time = new Date(msg.timestamp).toLocaleString();
 const roleName = roleNames[msg.role] || msg.role;
 return `### [${roleName}] - ${time}\n\n${msg.content}\n\n---\n\n`;
 }).join('\n');

 const header = `# AI 专家组联席会议记录 - ${stockSymbol || '未知股票'}\n生成时间: ${new Date().toLocaleString()}\n\n---\n\n`;
 const fullContent = header + content;

 const blob = new Blob([fullContent], { type: 'text/markdown' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `AI_Discussion_${stockSymbol || 'Report'}_${new Date().toISOString().split('T')[0]}.md`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 const handleFeishuShare = async () => {
 if (!feishuWebhookUrl) {
 setTempWebhook('');
 setShowFeishuConfig(true);
 return;
 }


 setIsSendingToFeishu(true);
 setShareStatus('loading');
 try {
 const success = await sendAnalysisToFeishu(analysis!, feishuWebhookUrl);
 if (success) {
 setShareStatus('success');
 setTimeout(() => setShareStatus('idle'), 3000);
 } else {
 setShareStatus('error');
 setTimeout(() => setShareStatus('idle'), 3000);
 }
 } catch (error) {
 console.error(error);
 setShareStatus('error');
 setTimeout(() => setShareStatus('idle'), 3000);
 } finally {
 setIsSendingToFeishu(false);
 }
 };

 const saveFeishuWebhook = () => {
 if (!tempWebhook.trim() || !tempWebhook.includes('feishu.cn')) {
 alert("请输入有效的飞书 Webhook 链接");
 return;
 }
 setFeishuWebhookUrl(tempWebhook.trim());
 setShowFeishuConfig(false);
 // Auto-trigger after save
 setTimeout(handleFeishuShare, 100);
 };

 return (
 <div className="flex flex-col h-full bg-white overflow-hidden relative shadow-3xl">
 {/* Background Decoration */}
 <div className="absolute inset-0 pointer-events-none overflow-hidden">
 <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px]" />
 <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/5 blur-[120px]" />
 </div>

 {/* Header Bar */}
 <div className="px-8 py-6 border-b border-zinc-100 bg-white/70 backdrop-blur-xl flex items-center justify-between relative z-10 shadow-sm">
 <div className="flex items-center gap-6">
 <div
 className="group relative cursor-grab active:cursor-grabbing p-2 hover:bg-zinc-100 rounded-2xl transition-all"
 onPointerDown={onPointerDownDrag}
 >
 <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 shadow-lg shadow-indigo-600/30 animate-pulse" />
 </div>
 <div>
 <h3 className="text-sm font-bold tracking-tight text-zinc-950 uppercase flex items-center gap-2">
 AI 专家组联席会议中心
 <span className="text-[9px] font-bold text-zinc-400 border border-zinc-200 px-1.5 py-0.5 rounded-md">LIVE</span>
 </h3>
 <p className="text-[10px] font-medium text-zinc-400 mt-0.5 tracking-wider">Multi-Agent Strategic Intelligence Center</p>
 </div>
 
 <div className="ml-6 hidden md:flex items-center gap-3">
 <div className="h-6 w-px bg-zinc-100" />
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-100">
 <Target size={12} className="text-zinc-400" />
 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stockSymbol || 'GLOBAL MONITOR'}</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2 mr-3">
 {messages.length > 0 && !isDiscussing && (
 <button
 onClick={handleDownload}
 className="btn-secondary h-10 px-4 rounded-xl text-[10px] tracking-wider uppercase border-zinc-100 shadow-sm"
 >
 <Download size={14} />
 导出记录
 </button>
 )}

 {messages.length > 0 && !isDiscussing && (
 <button
 onClick={handleFeishuShare}
 disabled={isSendingToFeishu}
 className={cn(
 "btn-primary h-10 px-5 rounded-xl text-[10px] tracking-wider uppercase shadow-indigo-600/5",
 shareStatus === "success" && "bg-emerald-500 hover:bg-emerald-600",
 shareStatus === "error" && "bg-rose-500 hover:bg-rose-600"
 )}
 >
 {shareStatus === "loading" ? <Loader2 size={14} className="animate-spin" /> : 
 shareStatus === "success" ? <CheckCircle2 size={14} /> : 
 shareStatus === "error" ? <AlertTriangle size={14} /> : <Share2 size={14} />}
 {shareStatus === "loading" ? "SENDING" : shareStatus === "success" ? "DONE" : "飞书同步"}
 </button>
 )}
 </div>

 {isDiscussing && (
 <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-zinc-200 text-xs font-medium text-zinc-400 uppercase tracking-widest">
 <Loader2 size={14} className="animate-spin text-indigo-600" />
 {totalRounds > 1 ? `第 ${currentRound}/${totalRounds} 轮推演中` : '全网推演中'}
 </div>
 )}

 <div className="flex h-10 w-[1px] bg-zinc-100 mx-1" />

 {onToggleFullscreen && (
 <button
 onClick={onToggleFullscreen}
 className="p-2.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-950 transition-all"
 >
 {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
 </button>
 )}

 {onClose && (
 <button
 onClick={onClose}
 className="p-2.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-rose-500 transition-all"
 >
 <X size={18} />
 </button>
 )}
 </div>
 </div>

 <div
 ref={scrollRef}
 className="flex-1 overflow-y-auto px-8 md:px-12 py-10 space-y-12 bg-white relative custom-scrollbar"
 >
 {/* Performance Review (Backtest) */}
 {analysis?.backtestResult && (
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="max-w-4xl mx-auto bg-indigo-50/80 border border-indigo-600/30 rounded-2xl p-6 relative overflow-hidden"
 >
 <div className="absolute top-0 right-0 p-8 opacity-5">
 <RotateCcw size={120} className="text-indigo-600 rotate-12" />
 </div>
 
 <div className="relative z-10 space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-600/30">
 <History size={20} className="text-indigo-600" />
 </div>
 <div>
 <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-600">历史预测复盘 (Learning Loop)</h4>
 <p className="text-[10px] text-zinc-400">上次分析时间: {new Date(analysis.backtestResult.previousDate).toLocaleString()}</p>
 </div>
 </div>
 <div className="text-right">
 <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${ analysis.backtestResult.actualReturn.startsWith('+') ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-500' : 'bg-rose-500/6 border-rose-500/15 text-rose-500' }`}>
 区间表现: {analysis.backtestResult.actualReturn}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-zinc-100/80 rounded-xl p-3 border border-zinc-200/60">
 <p className="text-[10px] text-zinc-400 uppercase font-medium mb-1">上次建议</p>
 <p className="text-sm font-semibold text-zinc-950">{analysis.backtestResult.previousRecommendation}</p>
 </div>
 <div className="bg-zinc-100/80 rounded-xl p-3 border border-zinc-200/60 col-span-2">
 <p className="text-[10px] text-indigo-600 uppercase font-medium mb-1">专家组进化心得</p>
 <p className="text-xs text-zinc-600 leading-relaxed italic">"{analysis.backtestResult.learningPoint}"</p>
 </div>
 </div>
 </div>
 </motion.div>
 )}

  {/* Expected Value Center - Moved to Top */}
  {!isDiscussing && analysis?.expectedValueOutcome && (
  <motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  className="max-w-4xl mx-auto space-y-6"
  >
  <div className="flex items-center justify-between mb-2">
  <div className="flex items-center gap-3">
  <div className="h-8 w-8 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-600/15">
  <Calculator size={18} className="text-indigo-600" />
  </div>
  <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-600">期望价值中枢 (Expected Value)</h4>
  </div>
  <div className="text-right">
  <p className="text-[10px] text-zinc-400 uppercase font-semibold">统一期望价格</p>
  <p className="text-2xl font-semibold text-zinc-950 tracking-tighter">${analysis.expectedValueOutcome.expectedPrice}</p>
  </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
  {/* EV Calculation logic */}
  <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 space-y-4">
  <div className="flex items-center gap-2 border-b border-zinc-200/60 pb-3">
  <Activity size={16} className="text-indigo-600" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">概率加权演算逻辑</span>
  </div>
  <div className="bg-zinc-100/80 rounded-xl p-4 border border-zinc-200/60 font-mono text-xs text-indigo-500/80 leading-relaxed italic">
  "{analysis.expectedValueOutcome.calculationLogic}"
  </div>
  <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2">
  <span>置信区间: <span className="text-zinc-500 font-medium">{analysis.expectedValueOutcome.confidenceInterval}</span></span>
  <span className="flex items-center gap-1"><Shield size={10} /> 机构级一致性验证已通过</span>
  </div>
  </div>

  {/* Sensitivity Matrix */}
  {analysis.sensitivityMatrix && (
  <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 space-y-4">
  <div className="flex items-center gap-2 border-b border-zinc-200/60 pb-3">
  <Table size={16} className="text-emerald-500" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">多变量收益敏感度矩阵</span>
  </div>
  <div className="space-y-2">
  {analysis.sensitivityMatrix.map((row, idx) => (
  <div key={`smr-${row.variable}-${idx}`} className="flex items-center justify-between text-[11px] py-1 border-b border-zinc-200/60 last:border-0">
  <div className="flex items-center gap-2">
  <span className="text-zinc-400 w-16 truncate">{row.variable}</span>
  <span className="text-zinc-400 font-mono italic">{row.change}</span>
  <ArrowRight size={10} className="text-zinc-300" />
  </div>
  <div className="text-right">
  <span className={cn(
  "font-semibold tracking-tighter mr-2",
  row.profitImpact.includes('+') ? "text-emerald-500" : "text-rose-500"
  )}>
  {row.profitImpact}
  </span>
  <span className="text-[9px] text-zinc-300 flex items-center gap-0.5 justify-end">
  <Clock size={8} /> {row.timeLag}
  </span>
  </div>
  </div>
  ))}
  </div>
  </div>
  )}
  </div>
  </motion.div>
  )}

  {/* Decision Engine Dashboard - Moved to Top */}
  {!isDiscussing && analysis && (analysis.coreVariables || analysis.businessModel || analysis.quantifiedRisks) && (
  <motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  className="max-w-4xl mx-auto space-y-6 mb-8"
  >
  <div className="flex items-center gap-3 mb-2">
  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/15">
  <Target size={18} className="text-emerald-500" />
  </div>
  <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-500">决策引擎量化看板</h4>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
  {/* Core Variables */}
  {analysis.coreVariables && analysis.coreVariables.length > 0 && (
  <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 space-y-3 hover:border-cyan-200/50 transition-all">
  <div className="flex items-center gap-2 border-b border-zinc-200/60 pb-3">
  <Cpu size={16} className="text-cyan-600" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-600">核心经济变量 (SSoT)</span>
  </div>
  <div className="space-y-2">
  {analysis.coreVariables.map((v, idx) => (
  <div key={`cv-${v.name}-${idx}`} className="bg-white rounded-xl p-3 border border-zinc-200/60 text-xs">
  <div className="flex justify-between mb-1.5">
  <span className="font-medium text-zinc-600">{v.name}</span>
  <span className="text-zinc-400 font-mono text-[10px]">[{v.unit}] {v.evidenceLevel}{v.source ? ` · ${v.source}` : ''}{v.dataDate ? ` ${v.dataDate}` : ''}</span>
  </div>
  <div className="grid grid-cols-3 gap-2 text-center">
  <div><p className="text-[10px] text-zinc-400">当前</p><p className="font-mono text-zinc-500">{String(v.value)}</p></div>
  <div className="border-x border-zinc-200/60"><p className="text-[10px] text-zinc-400">市场预期</p><p className="font-mono text-zinc-500">{String(v.marketExpect)}</p></div>
  <div><p className="text-[10px] text-emerald-500">偏离</p><p className="font-mono text-emerald-500 font-medium">{v.delta}</p></div>
  </div>
  {v.reason && <p className="mt-1.5 pt-1.5 border-t border-zinc-200/60 text-[10px] text-indigo-500/80 italic">{v.reason}</p>}
  </div>
  ))}
  </div>
  </div>
  )}

  {/* Business Model */}
  {analysis.businessModel && (
  <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 space-y-3 hover:border-emerald-500/15 transition-all">
  <div className="flex items-center gap-2 border-b border-zinc-200/60 pb-3">
  <Layers size={16} className="text-emerald-500" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">单位经济模型</span>
  <span className="ml-auto text-[10px] font-mono text-zinc-300 uppercase">{analysis.businessModel.businessType}</span>
  </div>
  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
  <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1">利润推演公式</p>
  <p className="text-sm font-mono text-zinc-700 font-medium break-all">{analysis.businessModel.formula}</p>
  </div>
  <div className="grid grid-cols-2 gap-3">
  <div><p className="text-[10px] text-zinc-400">预测利润</p><p className="text-base font-semibold text-zinc-950">{analysis.businessModel.projectedProfit}</p></div>
  <div className="text-right"><p className="text-[10px] text-zinc-400">置信度</p><p className="text-base font-semibold text-emerald-500">{analysis.businessModel.confidenceScore}%</p></div>
  </div>
  <div className="flex flex-wrap gap-1.5">
  {Object.entries(analysis.businessModel.drivers).map(([k, v], idx) => (
  <span key={`drv-${k}-${idx}`} className="px-2 py-0.5 rounded-xl text-[10px] font-medium bg-zinc-100/50 border border-zinc-200 text-zinc-400">{k}: {v}</span>
  ))}
  </div>
  </div>
  )}

  {/* Quantified Risks */}
  {analysis.quantifiedRisks && analysis.quantifiedRisks.length > 0 && (
  <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 space-y-3 hover:border-rose-500/12 transition-all">
  <div className="flex items-center gap-2 border-b border-zinc-200/60 pb-3">
  <Shield size={16} className="text-rose-500" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-rose-500">风险概率矩阵 (EV)</span>
  {analysis.riskAdjustedValuation && (
  <span className="ml-auto text-[10px] font-mono font-medium text-indigo-600">风险调整估值: {analysis.riskAdjustedValuation}</span>
  )}
  </div>
  <div className="space-y-2">
  {analysis.quantifiedRisks.map((r, idx) => (
  <div key={`qr-${idx}`} className="grid grid-cols-12 gap-2 items-center bg-zinc-100/60 p-2.5 rounded-xl border border-zinc-200/60 text-xs">
  <div className="col-span-4"><p className="font-medium text-zinc-600 truncate">{r.name}</p><p className="text-[10px] text-zinc-400 truncate">{r.mitigation}</p></div>
  <div className="col-span-2 text-center"><p className="text-[9px] text-zinc-400">概率</p><p className="font-mono font-medium text-indigo-600">{r.probability}%</p></div>
  <div className="col-span-3 text-center"><p className="text-[9px] text-zinc-400">利润冲击</p><p className="font-mono font-medium text-rose-500">{r.impactPercent}%</p></div>
  <div className="col-span-3 text-right"><p className="text-[9px] text-zinc-400">EV损失</p><p className="font-mono font-semibold text-rose-500 bg-rose-500/6 px-1.5 py-0.5 rounded-xl">{r.expectedLoss}%</p></div>
  </div>
  ))}
  </div>
  </div>
  )}

  {/* Position Plan (from tradingPlan) */}
  {analysis.tradingPlan?.positionPlan && analysis.tradingPlan.positionPlan.length > 0 && (
  <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 space-y-3 hover:border-indigo-600/12 transition-all">
  <div className="flex items-center gap-2 border-b border-zinc-200/60 pb-3">
  <Award size={16} className="text-indigo-600" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">分层建仓 & 逻辑止损</span>
  </div>
  <div className="flex gap-2">
  {analysis.tradingPlan.positionPlan.map((p, idx) => (
  <div key={`pp-${idx}`} className="flex-1 bg-indigo-600/6 border border-indigo-600/12 rounded-xl p-3 text-center">
  <p className="text-sm font-semibold text-indigo-600">{p.price}</p>
  <p className="text-[10px] text-zinc-400">{p.positionPercent}%</p>
  </div>
  ))}
  </div>
  {analysis.tradingPlan.logicBasedStopLoss && (
  <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/4 p-2.5 rounded-xl border border-rose-500/8">
  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
  <span>{analysis.tradingPlan.logicBasedStopLoss}</span>
  </div>
  )}
  {analysis.tradingPlan.riskRewardRatio && (
  <p className="text-[10px] text-zinc-400">风险收益比: <span className="font-medium text-emerald-500">{analysis.tradingPlan.riskRewardRatio}</span></p>
  )}
  </div>
  )}
  </div>
  </motion.div>
  )}

  {/* Data Integrity Report - Moved to Top */}
  {!isDiscussing && dataVerification && dataVerification.length > 0 && (
  <motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  className="max-w-4xl mx-auto bg-white border border-emerald-500/15 rounded-2xl p-6 space-y-4"
  >
  <div className="flex items-center justify-between border-b border-zinc-200/60 pb-4">
  <div className="flex items-center gap-3">
  <ShieldCheck className="text-emerald-500" size={20} />
  <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-500">数据完整性与交叉验证报告</h4>
  </div>
  <div className="flex items-center gap-3">
  {analysis?.dataQuality && (
  <div className={cn(
  "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
  getQualityLabel(analysis.dataQuality.score).color,
  "bg-zinc-50 border-zinc-200/60"
  )}>
  <Database size={10} />
  综合质量: {analysis.dataQuality.score}%
  </div>
  )}
  <span className="text-[10px] font-mono font-medium text-zinc-400 uppercase">实时监测已开启</span>
  </div>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {dataVerification.map((item, idx) => (
  <div key={`verification-${idx}-${item.source}`} className="bg-white border border-zinc-200/60 rounded-xl p-4 space-y-2">
  <div className="flex items-center justify-between">
  <span className="text-xs font-medium text-zinc-500">{item.source}</span>
  {item.isVerified ? (
  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
  <CheckCircle2 size={10} />
  已验证
  </span>
  ) : (
  <span className="flex items-center gap-1 text-[10px] font-medium text-rose-500 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
  <AlertTriangle size={10} />
  存在差异
  </span>
  )}
  </div>
  {item.discrepancy && (
  <p className="text-xs text-rose-300/80 leading-relaxed italic">
  差异: {item.discrepancy}
  </p>
  )}
  <div className="flex items-center justify-between pt-2">
  <div className="flex items-center gap-2">
  <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
  <div
  className={`h-full rounded-full ${item.confidence > 90 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
  style={{ width: `${item.confidence}%` }}
  />
  </div>
  <span className="text-[10px] font-mono font-medium text-zinc-400">{item.confidence}% 置信度</span>
  </div>
  <span className="text-[10px] font-mono text-zinc-300 italic">
  {new Date(item.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </span>
  </div>
  </div>
  ))}
  </div>
  </motion.div>
  )}
 <AnimatePresence initial={false}>
 {messages.map((msg, i) => {
 const msgKey = msg.id ? `msg-id-${msg.id}` : `msg-idx-${i}-${msg.role}-${msg.timestamp}-${Math.random().toString(36).slice(2, 7)}`;
 const showRoundDivider = msg.round != null && (i === 0 || messages[i - 1]?.round !== msg.round);
 return (
 <React.Fragment key={`frag-${msgKey}`}>
 {showRoundDivider && (
 <div key={`divider-${msgKey}`} className="flex items-center gap-3 my-4 max-w-4xl mx-auto">
 <div className="flex-1 h-px bg-indigo-200/40" />
 <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/50 whitespace-nowrap">
 第 {msg.round} 轮
 </span>
 <div className="flex-1 h-px bg-indigo-200/40" />
 </div>
 )}
 <motion.div
 key={`msg-div-${msgKey}`}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ type: "spring", stiffness: 100, damping: 15 }}
 className="flex gap-6 group max-w-4xl mx-auto"
 >
 <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 shadow-sm ${roleColors[msg.role] || "text-zinc-400 bg-white border-zinc-200/60"}`}>
 {roleIcons[msg.role] || <MessageSquare size={24} />}
 </div>
 <div className="flex-1 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-xl border shadow-sm ${roleColors[msg.role] || "text-zinc-500 bg-white border-zinc-200/60"}`}>
 {roleNames[msg.role] || msg.role}
 </span>
 {getWeightInfo(msg.role)?.isExpert && (
 <span className="text-xs font-medium text-indigo-600 bg-indigo-600/8 px-3 py-1 rounded-xl border border-indigo-600/15 flex items-center gap-1.5 animate-pulse">
 <Award size={14} />
 行业专家 ({getWeightInfo(msg.role)?.expertiseArea})
 </span>
 )}
 </div>
 <span className="text-xs text-zinc-400 font-mono font-medium">
 {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
 </span>
 </div>
 <div className="relative">
 <div className={`text-[15px] leading-7 p-6 rounded-2xl rounded-tl-none border transition-all duration-200 ${msg.type === "research" ? "bg-cyan-50/50 border-cyan-200/60 text-zinc-700 hover:border-cyan-300" : msg.type === "review" ? "bg-indigo-50/30 border-indigo-200/60 text-zinc-700 hover:border-indigo-300" : msg.type === "fact_check" ? "bg-rose-50/50 border-rose-200/60 text-zinc-700 hover:border-rose-300" : msg.type === "user_question" ? "bg-white border-zinc-200 text-zinc-600" : "bg-white border-zinc-200/60 text-zinc-600 hover:border-zinc-300" }`}>
 <div className="prose prose-base max-w-none">
 <ReactMarkdown remarkPlugins={[remarkGfm]}>
 {msg.content}
 </ReactMarkdown>
 </div>

 {msg.references && msg.references.length > 0 && (
 <div className="mt-5 pt-5 border-t border-zinc-200/60">
 <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
 <ExternalLink size={14} />
 引用来源
 </p>
 <div className="flex flex-wrap gap-2">
 {msg.references.map((ref, idx) => (
 <a
 key={`ref-${idx}-${ref.url}-${Math.random().toString(36).slice(2, 7)}`}
 href={ref.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs font-medium text-cyan-600 hover:text-zinc-950 bg-cyan-950/40 border border-cyan-200/50 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
 >
 {ref.title.length > 30 ? ref.title.substring(0, 30) + '...' : ref.title}
 <ExternalLink size={12} />
 </a>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </motion.div>
 </React.Fragment>
 );
 })}
 </AnimatePresence>








 {messages.length === 0 && !isDiscussing && (
 <div className="flex-1 flex flex-col items-center justify-center text-zinc-200 py-32 space-y-6">
 <Activity size={64} strokeWidth={1} className="text-zinc-100" />
 <div className="text-center space-y-2">
 <p className="text-sm font-bold uppercase tracking-[0.3em] text-zinc-300">等待智库指令</p>
 <p className="text-[10px] uppercase font-bold tracking-[0.1em] text-zinc-400">Intelligence engine idle - Initiate analysis to begin</p>
 </div>
 </div>
 )}
 </div>

 {messages.length > 0 && !isDiscussing && onSendMessage && (
 <div className="p-8 border-t border-zinc-100 bg-white relative z-10 shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.05)]">
 <div className="relative flex flex-col gap-4 max-w-4xl mx-auto">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-zinc-500">指定回答专家:</span>
 <select
 value={targetRole}
 onChange={(e) => setTargetRole(e.target.value as AgentRole)}
 className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-zinc-50 text-zinc-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
 disabled={isReviewing}
 >
 {Object.keys(roleNames).map((role) => (
 <option key={role} value={role}>{roleNames[role as AgentRole]}</option>
 ))}
 </select>
 </div>
 {onGenerateNewConclusion && (
 <button
 onClick={onGenerateNewConclusion}
 disabled={isReviewing}
 className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200/50 text-sm font-medium transition-all disabled:opacity-50"
 >
 <Award size={16} />
 生成最新结论
 </button>
 )}
 </div>
 <div className="flex-1 relative">
 <textarea
 value={inputValue}
 onChange={(e) => setInputValue(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder={`向 ${roleNames[targetRole]} 提问...`}
 className="w-full input-premium px-6 py-4 pr-16 text-base h-[60px] resize-none rounded-2xl"
 rows={1}
 disabled={isReviewing}
 />
 <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
 {isReviewing ? (
 <Loader2 size={24} className="animate-spin text-indigo-600" />
 ) : (
 <button
 onClick={handleSend}
 disabled={!inputValue.trim()}
 className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-zinc-100 disabled:text-zinc-400 transition-all shadow-sm active:scale-[0.98]"
 >
 <Send size={20} />
 </button>
 )}
 </div>
 </div>
 </div>
 <p className="mt-3 text-[10px] text-zinc-400 px-2 flex items-center gap-1.5 font-bold uppercase tracking-wider max-w-4xl mx-auto">
 <Zap size={14} className="text-indigo-600" />
 提问后将由 <span className="text-indigo-600">{roleNames[targetRole]}</span> 对当前话题进行深度复核与答疑
 </p>
 </div>
 )}

 {/* Feishu Config Modal */}
 <AnimatePresence>
 {showFeishuConfig && (
 <div className="absolute inset-0 z-[100] flex items-center justify-center bg-zinc-900/10 backdrop-blur-xl p-10">
 <motion.div 
 initial={{ scale: 0.98, opacity: 0, y: 10 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 0.98, opacity: 0, y: 10 }}
 className="w-full max-w-lg bg-white border border-zinc-200 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
 >
 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -z-10" />
 
 <div className="flex items-center gap-6 mb-10">
 <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-sm">
 <Share2 size={28} strokeWidth={1.5} />
 </div>
 <div>
 <h3 className="text-2xl font-bold text-zinc-950 tracking-tight">飞书同步系统</h3>
 <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-0.5">Institutional Delivery Configuration</p>
 </div>
 </div>

 <div className="space-y-8">
 <div className="space-y-4">
 <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">Feishu Webhook Endpoint</label>
 <div className="relative group">
 <input 
 type="text" 
 value={tempWebhook}
 onChange={(e) => setTempWebhook(e.target.value)}
 placeholder="https://open.feishu.cn/..."
 className="input-premium h-12 pr-10 font-mono text-sm"
 autoFocus
 />
 <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300">
 <ExternalLink size={16} />
 </div>
 </div>
 </div>
 
 <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 flex gap-4 items-start">
 <Info size={18} className="text-indigo-400 mt-0.5 shrink-0" strokeWidth={2} />
 <p className="text-xs text-indigo-600 font-medium leading-relaxed">
 配置完成后，分析记录将以 <span className="font-bold">互动式卡片</span> 形式实时推送到工作群。
 </p>
 </div>

 <div className="flex gap-4 pt-4">
 <button 
 onClick={() => setShowFeishuConfig(false)}
 className="flex-1 h-12 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-500 text-xs font-bold uppercase tracking-widest transition-all"
 >
 取消
 </button>
 <button 
 onClick={saveFeishuWebhook}
 className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest shadow-xl shadow-indigo-600/10 transition-all active:scale-[0.98]"
 >
 保存并推送
 </button>
 </div>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </div>
 );
};
