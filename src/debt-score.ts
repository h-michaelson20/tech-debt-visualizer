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
 * Debt score 0–100. Uses a single consistent source when LLM is available so overall and file scores match:
 * - If LLM overall score is set: use it as-is.
 * - Else if any file has LLM file score: use average of those.
 * - Else: static score from debt items.
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
