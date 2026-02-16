/**
 * Technical Debt Cleanliness Score: map cleanliness score (0-100) to one of five tiers.
 * Cleanliness: 0 = most debt, 100 = least debt. Tier 1 = worst, Tier 5 = best.
 */

export interface CleanlinessTier {
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
}

const TIERS: CleanlinessTier[] = [
  { tier: 1, label: "Prompt Roulette Champion", description: "100% vibes, 0% understanding" },
  { tier: 2, label: "Vibe Coding Hero", description: '"Just make it work" smashes accept button' },
  { tier: 3, label: "Thoughtful Prompter", description: "AI helps, human decides" },
  { tier: 4, label: "Power Tool User", description: "AI is the nail gun" },
  { tier: 5, label: "Pure Coder", description: "Hand-crafted artisanal code, no AI needed" },
];

/** Cleanliness score 0-100 (0 = worst, 100 = best). Returns tier 1-5: 1 = 0-20, 2 = 21-40, 3 = 41-60, 4 = 61-80, 5 = 81-100. */
export function getCleanlinessTier(cleanlinessScore: number): CleanlinessTier {
  const clamped = Math.max(0, Math.min(100, Math.round(cleanlinessScore)));
  if (clamped <= 20) return TIERS[0]!; // tier 1
  if (clamped <= 40) return TIERS[1]!; // tier 2
  if (clamped <= 60) return TIERS[2]!; // tier 3
  if (clamped <= 80) return TIERS[3]!; // tier 4
  return TIERS[4]!; // tier 5
}
