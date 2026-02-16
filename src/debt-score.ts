/**
 * Technical debt score 0–100 (higher = more debt).
 * When LLM is used, the overall score is taken from LLM only so it matches per-file and overall LLM scores.
 */

import type { AnalysisRun } from "./types.js";

/** Compute static score from debt items (severity × confidence). Used when no LLM scores exist. */
function getStaticDebtScore(run: AnalysisRun): number {
  const items = run.debtItems;
  if (items.length === 0) return 0;
  const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
  const sum = items.reduce((a, b) => a + (severityWeight[b.severity] ?? 0) * b.confidence, 0);
  return Math.min(100, Math.round((sum / items.length) * 25));
}

/**
 * Debt score 0–100 (higher = more debt). Stored and computed internally; for display use getCleanlinessScore.
 * When LLM is used, we store debt = 100 - llm_cleanliness so that this still returns "debt".
 */
export function getDebtScore(run: AnalysisRun): number {
  if (run.llmOverallScore != null) {
    return Math.min(100, Math.max(0, Math.round(run.llmOverallScore)));
  }
  const fileScores = run.fileMetrics
    .map((m) => m.llmFileScore)
    .filter((s): s is number => typeof s === "number");
  if (fileScores.length > 0) {
    const avg = fileScores.reduce((a, b) => a + b, 0) / fileScores.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  }
  return getStaticDebtScore(run);
}

/** Cleanliness score 0–100 (0 = most debt, 100 = least debt). Use this for display and tier. */
export function getCleanlinessScore(run: AnalysisRun): number {
  return 100 - getDebtScore(run);
}
