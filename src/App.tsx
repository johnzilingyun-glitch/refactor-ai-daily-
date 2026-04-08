import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useStockAnalysis, useDiscussion, useChat, useReporting, useMarketData } from './hooks';
import { useUIStore } from './stores/useUIStore';
import { useMarketStore } from './stores/useMarketStore';
import { useAnalysisStore } from './stores/useAnalysisStore';
import { useDiscussionStore } from './stores/useDiscussionStore';
import { useScenarioStore } from './stores/useScenarioStore';
import { useConfigStore } from './stores/useConfigStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorNotice } from './components/ErrorNotice';
import { TokenUsage } from './components/dashboard/TokenUsage';
import { Header } from './components/layout/Header';
import { MarketOverview } from './components/dashboard/MarketOverview';
import { DetailModal } from './components/shared/DetailModal';

// Lazy-load conditionally rendered large components
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const HistoryModal = lazy(() => import('./components/HistoryModal').then(m => ({ default: m.HistoryModal })));
const AnalysisResult = lazy(() => import('./components/analysis/AnalysisResult').then(m => ({ default: m.AnalysisResult })));
const AdminPanel = lazy(() => import('./components/admin/AdminPanel').then(m => ({ default: m.AdminPanel })));

export default function App() {
  console.log('App is rendering');
  const { i18n } = useTranslation();
  const language = useConfigStore(s => s.language);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  const analysisError = useUIStore(s => s.analysisError);
  const showAdminPanel = useUIStore(s => s.showAdminPanel);
  const setShowDiscussion = useUIStore(s => s.setShowDiscussion);
  const analysis = useAnalysisStore(s => s.analysis);
  const setAnalysis = useAnalysisStore(s => s.setAnalysis);
  const setSymbol = useAnalysisStore(s => s.setSymbol);
  const setMarket = useAnalysisStore(s => s.setMarket);
  const setChatHistory = useAnalysisStore(s => s.setChatHistory);
  const resetAnalysis = useAnalysisStore(s => s.resetAnalysis);
  const setDiscussionResults = useDiscussionStore(s => s.setDiscussionResults);
  const resetDiscussion = useDiscussionStore(s => s.resetDiscussion);
  const setScenarioResults = useScenarioStore(s => s.setScenarioResults);
  const resetScenario = useScenarioStore(s => s.resetScenario);

  // Custom hooks for business logic
  const { handleSearch, resetToHome, fetchAdminData } = useStockAnalysis();
  const { handleDiscussionQuestion, handleGenerateNewConclusion } = useDiscussion(fetchAdminData);
  const { handleChat } = useChat(fetchAdminData);
  const { fetchMarketOverview } = useMarketData(fetchAdminData);
  const {
    handleTriggerDailyReport,
    handleSendStockReport,
    handleSendChatReport,
    handleSendDiscussionReport,
    handleSendHistoryToFeishu,
    handleExportFullReport,
  } = useReporting(fetchAdminData);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-600 font-sans selection:bg-indigo-600/10 transition-colors duration-500">
      {/* Subtle Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] h-[40%] w-[40%] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[15%] h-[30%] w-[30%] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:px-12">
        <Suspense fallback={null}>
        <HistoryModal 
          isOpen={isHistoryOpen} 
          onClose={() => setIsHistoryOpen(false)} 
          onSelect={(item) => {
            setAnalysis(item);
            setSymbol(item.stockInfo?.symbol || '');
            setMarket(item.stockInfo?.market || 'A-Share');
            
            if (item.chatHistory) {
              setChatHistory(item.chatHistory);
            } else {
              setChatHistory([]);
            }

            if (item.discussion) {
              const discussionData = {
                ...item,
                messages: item.discussion,
                finalConclusion: item.finalConclusion || '',
                tradingPlan: item.tradingPlan,
                verificationMetrics: item.verificationMetrics,
                capitalFlow: item.capitalFlow
              };
              setDiscussionResults(discussionData);
              setScenarioResults(discussionData);
              setShowDiscussion(true);
            } else {
              resetAnalysis();
              resetDiscussion();
              resetScenario();
              setShowDiscussion(false);
            }
            
            setIsHistoryOpen(false);
          }}
        />
        </Suspense>

        <Header
          onSearch={handleSearch}
          onResetToHome={resetToHome}
          onTriggerDailyReport={handleTriggerDailyReport}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onFetchAdminData={fetchAdminData}
        />

        <TokenUsage />

        <AnimatePresence mode="wait">
          {analysisError && (
            <div className="mb-8">
              <ErrorNotice title="个股 analysis 加载失败" message={analysisError} />
            </div>
          )}

          {analysis ? (
            <ErrorBoundary fallback="Analysis component encountered an error">
            <Suspense fallback={<div className="text-center py-12 text-zinc-400">Loading...</div>}>
            <AnalysisResult
              onResetToHome={resetToHome}
              onExportFullReport={handleExportFullReport}
              onSendStockReport={handleSendStockReport}
              onSendDiscussionReport={handleSendDiscussionReport}
              onSendChatReport={handleSendChatReport}
              onDiscussionQuestion={handleDiscussionQuestion}
              onGenerateNewConclusion={handleGenerateNewConclusion}
              onChat={handleChat}
            />
            </Suspense>
            </ErrorBoundary>
          ) : (
            <ErrorBoundary fallback="Market overview encountered an error">
            <MarketOverview
              onFetchMarketOverview={fetchMarketOverview}
              onTriggerDailyReport={handleTriggerDailyReport}
            />
            </ErrorBoundary>
          )}
        </AnimatePresence>

        <Suspense fallback={null}><SettingsModal /></Suspense>

        {showAdminPanel && <ErrorBoundary fallback="Admin panel encountered an error"><Suspense fallback={null}><AdminPanel /></Suspense></ErrorBoundary>}
      </div>

      <DetailModal onSendHistoryToFeishu={handleSendHistoryToFeishu} />

      <footer className="mx-auto mt-12 max-w-7xl border-t border-zinc-200 px-4 py-12 md:px-8">
        <div className="flex flex-col items-center justify-between gap-6 font-mono text-xs uppercase tracking-widest text-zinc-400 md:flex-row">
          <div className="text-center md:text-left">
            <p>© 2026 每日股票智能分析 AI</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="transition-colors hover:text-zinc-500">数据来源</a>
            <a href="#" className="transition-colors hover:text-zinc-500">服务条款</a>
            <a href="#" className="transition-colors hover:text-zinc-500">隐私政策</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
