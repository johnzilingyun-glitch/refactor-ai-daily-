import type { AgentRole, DiscussionRound, OrchestratorConfig } from '../../types';
import { getSkipRoles } from './skipRules';

// ── Topology definitions ──────────────────────────────────────────

const DEEP_TOPOLOGY: DiscussionRound[] = [
  { round: 1, experts: ['Deep Research Specialist'], parallel: false, dependsOn: [] },
  { round: 2, experts: ['Technical Analyst'], parallel: false, dependsOn: [1] },
  { round: 3, experts: ['Fundamental Analyst'], parallel: false, dependsOn: [2] },
  { round: 4, experts: ['Sentiment Analyst'], parallel: false, dependsOn: [3] },
  // Bull vs Bear structured debate — round 1
  { round: 5, experts: ['Bull Researcher'], parallel: false, dependsOn: [4] },
  { round: 6, experts: ['Bear Researcher'], parallel: false, dependsOn: [5] },
  // Risk management triad
  { round: 7, experts: ['Aggressive Risk Analyst'], parallel: false, dependsOn: [6] },
  { round: 8, experts: ['Conservative Risk Analyst'], parallel: false, dependsOn: [7] },
  { round: 9, experts: ['Neutral Risk Analyst'], parallel: false, dependsOn: [8] },
  { round: 10, experts: ['Contrarian Strategist'], parallel: false, dependsOn: [9] },
  { round: 11, experts: ['Professional Reviewer'], parallel: false, dependsOn: [10] },
  // Targeted revision: Bull & Bear refine arguments after seeing all risk + contrarian + reviewer feedback
  { round: 12, experts: ['Bull Researcher'], parallel: false, dependsOn: [11] },
  { round: 13, experts: ['Bear Researcher'], parallel: false, dependsOn: [12] },
  { round: 14, experts: ['Chief Strategist'], parallel: false, dependsOn: [13] },
];

const STANDARD_TOPOLOGY: DiscussionRound[] = [
  { round: 1, experts: ['Deep Research Specialist'], parallel: false, dependsOn: [] },
  { round: 2, experts: ['Technical Analyst'], parallel: false, dependsOn: [1] },
  { round: 3, experts: ['Fundamental Analyst'], parallel: false, dependsOn: [2] },
  // Bull vs Bear structured debate
  { round: 4, experts: ['Bull Researcher'], parallel: false, dependsOn: [3] },
  { round: 5, experts: ['Bear Researcher'], parallel: false, dependsOn: [4] },
  { round: 6, experts: ['Risk Manager'], parallel: false, dependsOn: [5] },
  { round: 7, experts: ['Professional Reviewer'], parallel: false, dependsOn: [6] },
  { round: 8, experts: ['Chief Strategist'], parallel: false, dependsOn: [7] },
];

const QUICK_TOPOLOGY: DiscussionRound[] = [
  { round: 1, experts: ['Deep Research Specialist'], parallel: false, dependsOn: [] },
  { round: 2, experts: ['Risk Manager'], parallel: false, dependsOn: [1] },
  { round: 3, experts: ['Chief Strategist'], parallel: false, dependsOn: [2] },
];

// ── Public API ─────────────────────────────────────────────────────

export function buildTopology(config: OrchestratorConfig): DiscussionRound[] {
  let template: DiscussionRound[];

  switch (config.level) {
    case 'quick':
      template = QUICK_TOPOLOGY;
      break;
    case 'standard':
      template = STANDARD_TOPOLOGY;
      break;
    case 'deep':
    default:
      template = DEEP_TOPOLOGY;
      break;
  }

  // Determine roles to skip
  const autoSkip = getSkipRoles(config.assetType);
  const manualSkip = config.skipRoles ?? [];
  const skipSet = new Set<AgentRole>([...autoSkip, ...manualSkip]);

  // Filter out skipped roles and remove empty rounds
  const filtered = template
    .map((round) => ({
      ...round,
      experts: round.experts.filter((e) => !skipSet.has(e)),
    }))
    .filter((round) => round.experts.length > 0);

  // Re-number rounds sequentially
  return filtered.map((round, i) => ({
    ...round,
    round: i + 1,
  }));
}
