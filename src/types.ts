/**
 * Core types for the Technical Debt Visualizer.
 * Language-agnostic debt items, metrics, and analyzer contracts.
 */

export type DebtCategory =
  | "complexity"
  | "duplication"
  | "dependencies"
  | "test_coverage"
  | "documentation"
  | "architecture"
  | "hotspot"
  | "naming"
  | "other";

export type Severity = "low" | "medium" | "high" | "critical";

export interface DebtItem {
  id: string;
  file: string;
  line?: number;
  endLine?: number;
  category: DebtCategory;
  severity: Severity;
  title: string;
  description: string;
  /** 0-1 confidence that this is real debt */
  confidence: number;
  /** LLM-generated explanation of why it matters and what to do */
  insight?: string;
  /** LLM-suggested simplified/refactored code snippet (when applicable) */
  suggestedCode?: string;
  /** Raw metrics that contributed (e.g. cyclomatic complexity value) */
  metrics?: Record<string, number | string>;
  /** Suggested fix or refactor (short text) */
  recommendation?: string;
}

export interface FileMetrics {
  file: string;
  language: string;
  /** Cyclomatic complexity (max or sum by scope) */
  cyclomaticComplexity?: number;
  /** Cognitive complexity style */
  cognitiveComplexity?: number;
  lineCount: number;
  /** Approx. duplicate/similar blocks */
  duplicateBlocks?: number;
  /** Test coverage 0-1 if available */
  coverage?: number;
  /** Has docstring/JSDoc at module level */
  hasDocumentation?: boolean;
  /** Coupling / dependency count */
  coupling?: number;
  /** From git: number of commits touching this file in window */
  changeCount?: number;
  /** From git: lines changed in window */
  churn?: number;
  /** Computed: high churn + high complexity */
  hotspotScore?: number;
  /** LLM-generated short assessment of this file's cleanliness (when LLM attached) */
  llmAssessment?: string;
  /** LLM-suggested refactored code snippet for this file (when applicable) */
  llmSuggestedCode?: string;
}

export interface GitBlameEntry {
  file: string;
  commits: number;
  authors: number;
  lastChange: string;
  churn: number;
}

export interface AnalyzerResult {
  language: string;
  files: string[];
  metrics: FileMetrics[];
  debtItems: DebtItem[];
  /** Errors during analysis (e.g. parse failures) */
  errors: Array<{ file: string; message: string }>;
}

export interface AnalysisRun {
  repoPath: string;
  startedAt: string;
  completedAt?: string;
  analyzers: string[];
  fileMetrics: FileMetrics[];
  debtItems: DebtItem[];
  /** Time-series: debt score over recent commits (for trend) */
  debtTrend?: Array<{ commit: string; date: string; score: number }>;
  errors: Array<{ file: string; message: string }>;
  /** LLM-generated overall codebase cleanliness assessment (when LLM attached) */
  llmOverallAssessment?: string;
  /** LLM-generated prioritized next steps (when LLM attached) */
  llmNextSteps?: string[];
}

/** Pluggable analyzer: given file paths and content, returns metrics + debt items */
export interface IAnalyzer {
  readonly name: string;
  readonly languages: string[];
  /** Check if this analyzer can handle the given file path */
  canAnalyze(filePath: string): boolean;
  /** Analyze files; content keyed by path */
  analyze(
    files: Map<string, string>,
    options?: { repoPath?: string }
  ): Promise<AnalyzerResult>;
}

export interface ReportOptions {
  outputPath: string;
  format: "html" | "json" | "markdown";
  title?: string;
  darkMode?: boolean;
}

export interface CliOptions {
  path: string;
  output?: string;
  format?: "html" | "json" | "markdown" | "cli";
  languages?: string[];
  noLlm?: boolean;
  ci?: boolean;
}
