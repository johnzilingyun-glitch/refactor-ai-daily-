import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StockHeroCard } from '../StockHeroCard';
import type { StockAnalysis } from '../../../types';

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('StockHeroCard - AI Data Resilience Tests', () => {
  const baseAnalysis: StockAnalysis = {
    stockInfo: {
      symbol: 'TEST.SS',
      name: 'Test Stock',
      price: 100,
      change: 5,
      changePercent: 5,
      market: 'A-Share',
      currency: 'CNY',
      lastUpdated: '2026-04-09 10:00:00 CST'
    },
    summary: 'Testing',
    technicalAnalysis: 'Tech OK',
    fundamentalAnalysis: 'Fund OK',
    sentiment: 'Bullish',
    score: 80,
    recommendation: 'Buy',
    keyRisks: [],
    keyOpportunities: [],
    news: [],
    tradingPlan: { entryPrice: '100', targetPrice: '120', stopLoss: '90', strategy: 'Test' }
  };

  it('OK Scenario: Renders successfully with standard valid string arrays', () => {
    const okAnalysis = {
      ...baseAnalysis,
      historicalData: {
        yearHigh: 150,
        yearLow: 80,
        majorEvents: ['Positive Earnings', 'CEO transition ok']
      }
    };

    const { container } = render(<StockHeroCard analysis={okAnalysis} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Positive Earnings')).toBeInTheDocument();
  });

  it('NG Scenario: Survives gracefully without crashing when AI injects non-string object data into arrays', () => {
    const ngAnalysis = {
      ...baseAnalysis,
      historicalData: {
        yearHigh: 150,
        yearLow: 80,
        majorEvents: [
          { date: '2026', event: 'Unexpected Object Injection instead of string' } 
        ]
      }
    };

    // The test naturally fails here if React throws "Objects are not valid as a React child"
    // Our fix stringifies the object without blowing up the renderer or calling substring() on it.
    const { container } = render(<StockHeroCard analysis={ngAnalysis} />);
    expect(container).toBeInTheDocument();
    
    // Check if the safely stringified text is rendered instead of causing a white screen
    const element = screen.getByText(/Unexpected Object Injection/i);
    expect(element).toBeInTheDocument();
  });
});
