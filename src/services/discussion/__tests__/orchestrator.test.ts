import { describe, it, expect } from 'vitest';
import { buildTopology } from '../orchestrator';
import type { OrchestratorConfig } from '../../../types';

describe('Discussion Orchestrator', () => {
  describe('buildTopology - deep level', () => {
    const deepConfig: OrchestratorConfig = {
      level: 'deep',
      assetType: 'stock',
      maxConcurrency: 3,
    };

    it('generates 14 rounds for deep analysis', () => {
      const rounds = buildTopology(deepConfig);
      expect(rounds).toHaveLength(14);
    });

    it('starts with Deep Research Specialist in round 1', () => {
      const rounds = buildTopology(deepConfig);
      expect(rounds[0].round).toBe(1);
      expect(rounds[0].experts).toEqual(['Deep Research Specialist']);
      expect(rounds[0].parallel).toBe(false);
      expect(rounds[0].dependsOn).toEqual([]);
    });

    it('sequentially calls Technical analyst in round 2', () => {
      const rounds = buildTopology(deepConfig);
      expect(rounds[1].round).toBe(2);
      expect(rounds[1].experts).toEqual(['Technical Analyst']);
      expect(rounds[1].parallel).toBe(false);
      expect(rounds[1].dependsOn).toEqual([1]);
    });

    it('has Fundamental Analyst in round 3', () => {
      const rounds = buildTopology(deepConfig);
      expect(rounds[2].round).toBe(3);
      expect(rounds[2].experts).toEqual(['Fundamental Analyst']);
      expect(rounds[2].parallel).toBe(false);
    });

    it('has Professional Reviewer in round 11', () => {
      const rounds = buildTopology(deepConfig);
      expect(rounds[10].round).toBe(11);
      expect(rounds[10].experts).toContain('Professional Reviewer');
    });

    it('ends with Chief Strategist in round 14', () => {
      const rounds = buildTopology(deepConfig);
      expect(rounds[13].round).toBe(14);
      expect(rounds[13].experts).toEqual(['Chief Strategist']);
    });
  });

  describe('buildTopology - quick level', () => {
    const quickConfig: OrchestratorConfig = {
      level: 'quick',
      assetType: 'stock',
      maxConcurrency: 3,
    };

    it('generates 3 rounds for quick scan', () => {
      const rounds = buildTopology(quickConfig);
      expect(rounds).toHaveLength(3);
    });

    it('starts with Deep Research Specialist', () => {
      const rounds = buildTopology(quickConfig);
      expect(rounds[0].experts).toEqual(['Deep Research Specialist']);
    });

    it('has Risk Manager in round 2', () => {
      const rounds = buildTopology(quickConfig);
      expect(rounds[1].experts).toContain('Risk Manager');
    });

    it('ends with Chief Strategist', () => {
      const rounds = buildTopology(quickConfig);
      expect(rounds[2].experts).toEqual(['Chief Strategist']);
    });
  });

  describe('buildTopology - standard level', () => {
    it('generates 8 rounds for standard analysis', () => {
      const config: OrchestratorConfig = {
        level: 'standard',
        assetType: 'stock',
        maxConcurrency: 3,
      };
      const rounds = buildTopology(config);
      expect(rounds).toHaveLength(8);
    });
  });

  describe('buildTopology - ETF skip rules', () => {
    it('skips Deep Research and Fundamental Analyst for ETF', () => {
      const config: OrchestratorConfig = {
        level: 'deep',
        assetType: 'etf',
        maxConcurrency: 3,
      };
      const rounds = buildTopology(config);
      const allExperts = rounds.flatMap(r => r.experts);
      expect(allExperts).not.toContain('Deep Research Specialist');
      expect(allExperts).not.toContain('Fundamental Analyst');
    });

    it('skips Deep Research and Fundamental Analyst for index', () => {
      const config: OrchestratorConfig = {
        level: 'deep',
        assetType: 'index',
        maxConcurrency: 3,
      };
      const rounds = buildTopology(config);
      const allExperts = rounds.flatMap(r => r.experts);
      expect(allExperts).not.toContain('Deep Research Specialist');
      expect(allExperts).not.toContain('Fundamental Analyst');
    });
  });

  describe('buildTopology - custom skipRoles', () => {
    it('removes specified roles from topology', () => {
      const config: OrchestratorConfig = {
        level: 'deep',
        assetType: 'stock',
        skipRoles: ['Sentiment Analyst'],
        maxConcurrency: 3,
      };
      const rounds = buildTopology(config);
      const allExperts = rounds.flatMap(r => r.experts);
      expect(allExperts).not.toContain('Sentiment Analyst');
    });

    it('removes empty rounds after skipping', () => {
      const config: OrchestratorConfig = {
        level: 'quick',
        assetType: 'stock',
        skipRoles: ['Risk Manager'],
        maxConcurrency: 3,
      };
      const rounds = buildTopology(config);
      // All rounds should have at least one expert
      rounds.forEach(r => {
        expect(r.experts.length).toBeGreaterThan(0);
      });
    });
  });
});
