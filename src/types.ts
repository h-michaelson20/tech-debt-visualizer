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

/** Order for sorting by severity (higher = more severe). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** LLM-assigned file debt severity; "none" = no significant debt. */
export type LlmFileSeverity = Severity | "none";

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
  /** Full raw LLM response for this debt item (displayed in report) */
  llmRawResponse?: string;
  /** LLM-assigned severity for this item: critical | high | medium | low | none */
  llmSeverity?: LlmFileSeverity;
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
  /** LLM-rated technical debt for this file 0–100 (higher = more debt), when available */
  llmFileScore?: number;
  /** LLM-assigned severity for this file: critical | high | medium | low | none */
  llmSeverity?: LlmFileSeverity;
  /** Full raw LLM assessment response for this file (displayed in report) */
  llmRawAssessment?: string;
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
  /** True if LLM was invoked this run (even if it returned no data) */
  llmAttempted?: boolean;
  /** LLM-derived overall debt score 0–100 when available (higher = more debt) */
  llmOverallScore?: number;
  /** LLM-assigned overall severity: critical | high | medium | low | none */
  llmOverallSeverity?: LlmFileSeverity;
  /** Full raw LLM overall assessment response (displayed in report) */
  llmOverallRaw?: string;
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
