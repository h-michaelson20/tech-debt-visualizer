/**
 * Base utilities for AST-based analyzers: complexity from tree-sitter trees,
 * and shared file discovery.
 */

import Parser from "tree-sitter";
import type { DebtCategory, DebtItem, Severity } from "../types.js";

/** Tree-sitter node types that add cyclomatic complexity (decision points only). */
const COMPLEXITY_NODE_TYPES = new Set([
  "if_statement",
  "else_clause",
  "elif_clause",
  "for_statement",
  "while_statement",
  "switch_statement",
  "case_clause",
  "catch_clause",
  "except_clause",
  "conditional_expression",
]);

/** Recursively count complexity from tree (cyclomatic: decision points only). */
export function countComplexity(node: Parser.SyntaxNode): number {
  let n = 0;
  const type = node.type;
  if (COMPLEXITY_NODE_TYPES.has(type)) n++;
  if (type === "binary_expression") {
    const text = node.text;
    if (text.includes("&&") || text.includes("||")) n++;
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) n += countComplexity(child);
  }
  return n;
}

/** Count lines in source (excluding empty and comment-only). */
export function effectiveLines(source: string): number {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("//") && !t.startsWith("#") && !t.startsWith("/*") && !t.startsWith("*");
    }).length;
}

export function createDebtItem(
  file: string,
  category: DebtCategory,
  title: string,
  description: string,
  opts: {
    line?: number;
    endLine?: number;
    severity?: Severity;
    confidence?: number;
    metrics?: Record<string, number | string>;
  } = {}
): DebtItem {
  const id = `${file}:${opts.line ?? 0}:${category}:${title.slice(0, 30)}`.replace(/\s/g, "_");
  return {
    id,
    file,
    line: opts.line,
    endLine: opts.endLine,
    category,
    severity: opts.severity ?? "medium",
    title,
    description,
    confidence: opts.confidence ?? 0.8,
    metrics: opts.metrics,
  };
}

export function inferSeverity(complexity: number): Severity {
  if (complexity >= 20) return "critical";
  if (complexity >= 10) return "high";
  if (complexity >= 5) return "medium";
  return "low";
}
