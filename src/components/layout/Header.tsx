import React, { useState, useEffect, useRef } from 'react';
import { Download, Bell, History, Clock, Settings, Loader2, Search, TrendingUp, Zap, BarChart3, Microscope, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Market, AnalysisLevel } from '../../types';
import { useUIStore, selectLoading } from '../../stores/useUIStore';
import { useMarketStore } from '../../stores/useMarketStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useConfigStore } from '../../stores/useConfigStore';

interface HeaderProps {
  onSearch: (e: React.FormEvent) => void;
  onResetToHome: () => void;
  onTriggerDailyReport: () => void;
  onOpenHistory: () => void;
  onFetchAdminData: () => void;
}

export function Header({ onSearch, onResetToHome, onTriggerDailyReport, onOpenHistory, onFetchAdminData }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const loading = useUIStore(selectLoading);
  const { isTriggeringReport, showAdminPanel, setShowAdminPanel, setIsSettingsOpen, analysisLevel, setAnalysisLevel } = useUIStore();
  const { dailyReport } = useMarketStore();
  const { symbol, setSymbol, market, setMarket } = useAnalysisStore();
  const { language, setLanguage, cooldownUntil, setCooldownUntil } = useConfigStore();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setCooldownUntil(0);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownUntil, setCooldownUntil]);

  const isComposing = useRef(false);
  const [localSymbol, setLocalSymbol] = useState(symbol);

  useEffect(() => {
    setLocalSymbol(symbol);
  }, [symbol]);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh-CN' : 'en';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <header className="mb-12 animate-premium text-zinc-950 dark:text-white relative">
      {cooldownRemaining > 0 && (
        <div className="absolute -top-6 left-0 right-0 bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-1.5 rounded-full text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse z-50">
          <Clock size={12} strokeWidth={2.5} />
          <span>System cooling down to reset AI quota... ({cooldownRemaining}s remaining)</span>
        </div>
      )}
      <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="cursor-pointer" onClick={onResetToHome}>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-1 bg-indigo-600 rounded-full" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">
              {t('header.brand')}
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('header.title')}
          </h1>
          <p className="mt-4 text-zinc-500 font-medium max-w-xl leading-relaxed">
            {t('header.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={toggleLanguage}
            className="btn-secondary w-12 h-12 p-0 flex items-center justify-center rounded-xl overflow-hidden relative group"
            title={language === 'en' ? 'Switch to Chinese' : '切换为英文'}
          >
            <Languages size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
            <span className="absolute bottom-1 right-1 text-[8px] font-bold opacity-70">
              {language === 'en' ? 'EN' : 'ZH'}
            </span>
          </button>
          
          {dailyReport && (
            <button
              onClick={() => {
                const blob = new Blob([dailyReport], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Daily_Market_Report_${new Date().toISOString().split('T')[0]}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="btn-secondary w-12 h-12 p-0 flex items-center justify-center rounded-xl"
              title={t('header.downloadReport')}
            >
              <Download size={20} strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={onTriggerDailyReport}
            disabled={isTriggeringReport}
            className="btn-secondary h-12 px-5 rounded-xl disabled:opacity-50"
          >
            {isTriggeringReport ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} strokeWidth={1.5} />}
            <span className="text-sm">{t('header.triggerBrief')}</span>
          </button>
          <button
            onClick={onOpenHistory}
            className="btn-secondary w-12 h-12 p-0 flex items-center justify-center rounded-xl"
            title={t('header.history')}
          >
            <History size={20} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => {
              setShowAdminPanel(!showAdminPanel);
              if (!showAdminPanel) onFetchAdminData();
            }}
            className="btn-secondary w-12 h-12 p-0 flex items-center justify-center rounded-xl"
            title={t('header.sysLogs')}
          >
            <Clock size={20} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="btn-secondary w-12 h-12 p-0 flex items-center justify-center rounded-xl"
            title={t('header.settings')}
          >
            <Settings size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={onSearch} className="mt-12 flex flex-col gap-4 sm:flex-row items-stretch">
        <div className="relative group flex-shrink-0">
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as Market)}
            className="h-14 w-full sm:w-48 cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-white px-5 pr-12 text-sm font-semibold text-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600/40 hover:bg-zinc-50"
          >
            <option value="A-Share">{t('markets.aShare')}</option>
            <option value="HK-Share">{t('markets.hkShare')}</option>
            <option value="US-Share">{t('markets.usShare')}</option>
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
            <TrendingUp size={16} strokeWidth={1.5} />
          </div>
        </div>

        <div className="relative flex-1 group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition-colors">
            <Search size={20} strokeWidth={1.5} />
          </div>
          <input
            type="text"
            placeholder={t('header.searchPlaceholder')}
            value={localSymbol}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={(e) => {
              isComposing.current = false;
              const val = e.currentTarget.value.toUpperCase();
              setLocalSymbol(val);
              setSymbol(val);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setLocalSymbol(val);
              if (!isComposing.current) {
                setSymbol(val.toUpperCase());
              }
            }}
            className="h-14 w-full font-medium text-base rounded-xl border border-zinc-200 bg-white pl-14 pr-6 text-zinc-950 transition-all placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600/40 shadow-sm shadow-zinc-900/5 group-hover:border-zinc-300"
          />
        </div>

        {/* Analysis Level Selector */}
        <div className="flex rounded-xl border border-zinc-200 bg-white overflow-hidden h-14 flex-shrink-0">
          {([
            { level: 'quick' as AnalysisLevel, icon: Zap, label: t('levels.quick') },
            { level: 'standard' as AnalysisLevel, icon: BarChart3, label: t('levels.standard') },
            { level: 'deep' as AnalysisLevel, icon: Microscope, label: t('levels.deep') },
          ] as const).map(({ level, icon: Icon, label }) => (
            <button
              key={level}
              type="button"
              onClick={() => setAnalysisLevel(level)}
              className={`flex items-center gap-1.5 px-4 text-sm font-medium transition-all ${
                analysisLevel === level
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary h-14 px-10 rounded-xl shadow-indigo-600/10 shadow-xl"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <span>{t('header.startAnalysis')}</span>
          )}
        </button>
      </form>
    </header>
  );
}
