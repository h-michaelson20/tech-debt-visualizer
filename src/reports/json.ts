import type { AnalysisRun } from "../types.js";

export function generateJsonReport(run: AnalysisRun): string {
  const payload = {
    repoPath: run.repoPath,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    analyzers: run.analyzers,
    summary: {
      filesAnalyzed: run.fileMetrics.length,
      debtItemsCount: run.debtItems.length,
      errorsCount: run.errors.length,
    },
    fileMetrics: run.fileMetrics,
    debtItems: run.debtItems,
    debtTrend: run.debtTrend,
    errors: run.errors,
    llmOverallAssessment: run.llmOverallAssessment ?? undefined,
    llmNextSteps: run.llmNextSteps ?? undefined,
  };
  return JSON.stringify(payload, null, 2);
}
