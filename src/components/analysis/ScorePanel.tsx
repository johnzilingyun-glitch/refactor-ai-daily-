import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from './utils';
import { PredictionAccuracy } from './PredictionAccuracy';
import type { StockAnalysis } from '../../types';
import type { PredictionTrackRecord } from '../../hooks/usePredictionTrackRecord';

interface ScorePanelProps {
  analysis: StockAnalysis;
  trackRecord?: PredictionTrackRecord;
}

export function ScorePanel({ analysis, trackRecord }: ScorePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      {/* Score */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <div className="absolute left-0 top-0 h-1 w-full bg-zinc-50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analysis.score}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className={cn('h-full', analysis.score >= 70 ? 'bg-indigo-500' : analysis.score >= 40 ? 'bg-amber-500' : 'bg-rose-500')}
          />
        </div>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">{t('analysis.info.ai_confidence')}</p>
        <div className="relative inline-block">
          <span className="text-8xl font-semibold tracking-tighter text-zinc-950">{analysis.score}</span>
          <span className="absolute -right-4 -top-2 font-medium text-zinc-400">/100</span>
        </div>
        <div className="mt-8 space-y-2">
          <div className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium uppercase tracking-widest', analysis.sentiment === 'Bullish' ? 'border-indigo-100 bg-indigo-50 text-indigo-500' : analysis.sentiment === 'Bearish' ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' : 'border-zinc-200 bg-zinc-100 text-zinc-500')}>
            {t(`analysis.sentiment.${analysis.sentiment.toLowerCase()}`)} {t('analysis.info.sentiment')}
          </div>
          <div className="mt-4 text-2xl font-medium text-zinc-950">
            {t(`analysis.recommendation.${analysis.recommendation.toLowerCase().replace(' ', '_')}`)}
          </div>
        </div>
      </div>

      {/* Opportunities & Risks */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-600">
            {t('analysis.info.opportunities')}
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
            {t('analysis.info.risks')}
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

      {/* Prediction Track Record (FinGPT-inspired) */}
      {trackRecord?.timeSeries && trackRecord.timeSeries.entries.length > 0 && (
        <PredictionAccuracy
          timeSeries={trackRecord.timeSeries}
          bias={trackRecord.bias}
          previousAnalysis={trackRecord.previousAnalysis}
          currentSentiment={analysis.sentiment}
        />
      )}
    </div>
  );
}
