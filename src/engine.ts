/**
 * Analysis engine: discover files, run pluggable analyzers, merge git stats,
 * compute hotspots and confidence, and produce a single AnalysisRun.
 */

import {
  computeHotspotScore,
  getDebtTrend,
  getGitStats,
  type GitStats,
} from "./git-analyzer.js";
import { discoverFiles } from "./discover.js";
import { analyzers } from "./analyzers/index.js";
import type {
  AnalysisRun,
  DebtItem,
  FileMetrics,
  IAnalyzer,
} from "./types.js";

export interface EngineOptions {
  repoPath: string;
  analyzerNames?: string[];
  maxFiles?: number;
  gitDays?: number;
}

export async function runAnalysis(options: EngineOptions): Promise<AnalysisRun> {
  const {
    repoPath,
    analyzerNames,
    maxFiles = 1500,
    gitDays = 90,
  } = options;

  const selectedAnalyzers = analyzerNames?.length
    ? analyzers.filter((a) => analyzerNames.includes(a.name))
    : analyzers;

  const files = await discoverFiles(repoPath, selectedAnalyzers, { maxFiles });
  if (files.size === 0) {
    return {
      repoPath,
      startedAt: new Date().toISOString(),
      analyzers: selectedAnalyzers.map((a) => a.name),
      fileMetrics: [],
      debtItems: [],
      errors: [{ file: "", message: "No matching source files found." }],
    };
  }

  const [gitStats, debtTrend] = await Promise.all([
    getGitStats(repoPath, { days: gitDays }),
    getDebtTrend(repoPath, 15),
  ]);

  const allMetrics: FileMetrics[] = [];
  const allDebt: DebtItem[] = [];
  const allErrors: AnalysisRun["errors"] = [];

  for (const analyzer of selectedAnalyzers) {
    const toAnalyze = new Map<string, string>();
    for (const [path, content] of files) {
      if (analyzer.canAnalyze(path)) toAnalyze.set(path, content);
    }
    if (toAnalyze.size === 0) continue;

    const result = await analyzer.analyze(toAnalyze, { repoPath });
    allMetrics.push(...result.metrics);
    allDebt.push(...result.debtItems);
    allErrors.push(...result.errors);
  }

  enrichWithGit(gitStats, allMetrics);
  const run: AnalysisRun = {
    repoPath,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    analyzers: selectedAnalyzers.map((a) => a.name),
    fileMetrics: allMetrics,
    debtItems: allDebt,
    debtTrend,
    errors: allErrors,
  };

  return run;
}

function enrichWithGit(gitStats: GitStats, metrics: FileMetrics[]): void {
  let maxChange = 0,
    maxChurn = 0,
    maxComplexity = 0;
  for (const m of metrics) {
    const g = gitStats.byFile.get(m.file);
    if (g) {
      m.changeCount = g.commits;
      m.churn = g.churn;
      maxChange = Math.max(maxChange, g.commits);
      maxChurn = Math.max(maxChurn, g.churn);
    }
    const c = m.cyclomaticComplexity ?? 0;
    maxComplexity = Math.max(maxComplexity, c);
  }

  for (const m of metrics) {
    const change = m.changeCount ?? 0;
    const churn = m.churn ?? 0;
    const complexity = m.cyclomaticComplexity ?? 0;
    m.hotspotScore = computeHotspotScore(
      change,
      churn,
      complexity,
      maxChange,
      maxChurn,
      maxComplexity
    );
  }
}
