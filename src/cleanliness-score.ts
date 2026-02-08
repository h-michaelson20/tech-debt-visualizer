/**
 * Technical Debt Cleanliness Score: map debt score (0-100) to one of five tiers.
 * Lower debt score = higher tier (cleaner code).
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

/** Debt score 0-100 (higher = worse). Returns tier 1-5 (1 = worst, 5 = best). */
export function getCleanlinessTier(debtScore: number): CleanlinessTier {
  const clamped = Math.max(0, Math.min(100, Math.round(debtScore)));
  if (clamped <= 20) return TIERS[4]!;  // 5/5
  if (clamped <= 40) return TIERS[3]!;  // 4/5
  if (clamped <= 60) return TIERS[2]!;  // 3/5
  if (clamped <= 80) return TIERS[1]!;  // 2/5
  return TIERS[0]!;  // 1/5
}
