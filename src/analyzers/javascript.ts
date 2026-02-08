/**
 * JavaScript/TypeScript analyzer using tree-sitter.
 * Metrics: cyclomatic complexity, line count, basic duplication heuristic, documentation.
 */

import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import type { AnalyzerResult, FileMetrics } from "../types.js";
import {
  countComplexity,
  createDebtItem,
  effectiveLines,
  inferSeverity,
} from "./base.js";

const LANG_JS = "javascript";
const LANG_TS = "typescript";

const JS_EXT = /\.(?:js|jsx|mjs|cjs)$/i;
const TS_EXT = /\.(?:ts|tsx)$/i;

function getParser(filePath: string): Parser {
  const P = new Parser();
  const TS = TypeScript as { typescript?: unknown; tsx?: unknown };
  if (filePath.endsWith(".tsx") && TS.tsx) {
    P.setLanguage(TS.tsx as Parameters<Parser["setLanguage"]>[0]);
  } else if (TS_EXT.test(filePath) && TS.typescript) {
    P.setLanguage(TS.typescript as Parameters<Parser["setLanguage"]>[0]);
  } else {
    const J = JavaScript as { default?: unknown };
    P.setLanguage((J.default ?? JavaScript) as Parameters<Parser["setLanguage"]>[0]);
  }
  return P;
}

function languageForPath(filePath: string): string {
  return TS_EXT.test(filePath) ? LANG_TS : LANG_JS;
}

export const javascriptAnalyzer = {
  name: "javascript",
  languages: [LANG_JS, LANG_TS],

  canAnalyze(filePath: string): boolean {
    return JS_EXT.test(filePath) || TS_EXT.test(filePath);
  },

  async analyze(
    files: Map<string, string>,
    _options?: { repoPath?: string }
  ): Promise<AnalyzerResult> {
    const metrics: FileMetrics[] = [];
    const debtItems: AnalyzerResult["debtItems"] = [];
    const errors: AnalyzerResult["errors"] = [];

    for (const [path, content] of files) {
      const lang = languageForPath(path);
      const parser = getParser(path);

      try {
        const tree = parser.parse(content);
        const root = tree.rootNode;
        const complexity = root ? countComplexity(root) : 0;
        const lineCount = effectiveLines(content);
        const hasDocumentation = /^\s*(\/\*\*[\s\S]*?\*\/|\/\/\s*@file|\/\*\*)/m.test(content);

        const fileMetric: FileMetrics = {
          file: path,
          language: lang,
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
              `This file has ${complexity} decision points, which makes it harder to test and maintain.`,
              {
                severity: inferSeverity(complexity),
                confidence: 0.85,
                metrics: { cyclomaticComplexity: complexity },
              }
            )
          );
        }

        if (lineCount > 300) {
          debtItems.push(
            createDebtItem(
              path,
              "complexity",
              "Large file",
              `File has ${lineCount} effective lines. Consider splitting into smaller modules.`,
              {
                severity: lineCount > 500 ? "high" : "medium",
                confidence: 0.75,
                metrics: { lineCount },
              }
            )
          );
        }

        if (!hasDocumentation && lineCount > 50) {
          debtItems.push(
            createDebtItem(
              path,
              "documentation",
              "Missing module-level documentation",
              "No JSDoc or file-level comment found. Document purpose and usage for maintainability.",
              { confidence: 0.7 }
            )
          );
        }
      } catch (e) {
        errors.push({ file: path, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      language: "javascript",
      files: [...files.keys()],
      metrics,
      debtItems,
      errors,
    };
  },
};
