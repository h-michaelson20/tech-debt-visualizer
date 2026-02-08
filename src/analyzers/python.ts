/**
 * Python analyzer using tree-sitter.
 * Metrics: cyclomatic complexity, line count, docstring presence.
 */

import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { AnalyzerResult, FileMetrics } from "../types.js";
import {
  countComplexity,
  createDebtItem,
  effectiveLines,
  inferSeverity,
} from "./base.js";

const PY_EXT = /\.py$/i;

function getParser(): Parser {
  const P = new Parser();
  P.setLanguage(Python);
  return P;
}

function hasModuleDocstring(content: string): boolean {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith('"""') ||
    trimmed.startsWith("'''") ||
    /^\s*#.*\n(\s*#.*\n)*/.test(content)
  );
}

export const pythonAnalyzer = {
  name: "python",
  languages: ["python"],

  canAnalyze(filePath: string): boolean {
    return PY_EXT.test(filePath);
  },

  async analyze(
    files: Map<string, string>,
    _options?: { repoPath?: string }
  ): Promise<AnalyzerResult> {
    const metrics: FileMetrics[] = [];
    const debtItems: AnalyzerResult["debtItems"] = [];
    const errors: AnalyzerResult["errors"] = [];
    const parser = getParser();

    for (const [path, content] of files) {
      try {
        const tree = parser.parse(content);
        const root = tree.rootNode;
        const complexity = root ? countComplexity(root) : 0;
        const lineCount = effectiveLines(content);
        const hasDocumentation = hasModuleDocstring(content);

        const fileMetric: FileMetrics = {
          file: path,
          language: "python",
          cyclomaticComplexity: complexity,
          cognitiveComplexity: complexity,
          lineCount,
          hasDocumentation,
        };
        metrics.push(fileMetric);

        if (complexity >= 5) {
          debtItems.push(
            createDebtItem(
              path,
              "complexity",
              `High cyclomatic complexity (${complexity})`,
              `This module has ${complexity} decision points. Consider simplifying conditionals or extracting functions.`,
              {
                severity: inferSeverity(complexity),
                confidence: 0.85,
                metrics: { cyclomaticComplexity: complexity },
              }
            )
          );
        }

        if (lineCount > 250) {
          debtItems.push(
            createDebtItem(
              path,
              "complexity",
              "Large module",
              `File has ${lineCount} effective lines. Consider splitting into smaller modules or packages.`,
              {
                severity: lineCount > 400 ? "high" : "medium",
                confidence: 0.75,
                metrics: { lineCount },
              }
            )
          );
        }

        if (!hasDocumentation && lineCount > 30) {
          debtItems.push(
            createDebtItem(
              path,
              "documentation",
              "Missing module docstring",
              "No module-level docstring found. Add a docstring describing the module's purpose.",
              { confidence: 0.7 }
            )
          );
        }
      } catch (e) {
        errors.push({ file: path, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      language: "python",
      files: [...files.keys()],
      metrics,
      debtItems,
      errors,
    };
  },
};
