#!/usr/bin/env node
/**
 * CLI entry: colorful terminal output, progress bars, actionable insights.
 */

import { Command } from "commander";
import chalk from "chalk";
import cliProgress from "cli-progress";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCleanlinessTier } from "./cleanliness-score.js";
import { runAnalysis } from "./engine.js";
import {
  assessFileCleanliness,
  assessOverallCleanliness,
  enrichDebtWithInsights,
  suggestNextSteps,
} from "./llm.js";
import { generateHtmlReport } from "./reports/html.js";
import { generateJsonReport } from "./reports/json.js";
import { generateMarkdownReport } from "./reports/markdown.js";
import type { AnalysisRun, DebtItem } from "./types.js";

const program = new Command();

program
  .name("tech-debt")
  .description("Analyze repositories and visualize technical debt with AI-powered insights")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze a repository and output report")
  .argument("[path]", "Repository path", ".")
  .option("-o, --output <path>", "Output file path (default: report.html or stdout for CLI)")
  .option("-f, --format <type>", "Output format: cli | html | json | markdown", "cli")
  .option("--no-llm", "Skip LLM-powered insights")
  .option("--ci", "CI mode: minimal output, exit with non-zero if debt score is high")
  .action(async (path: string, opts: { output?: string; format?: string; llm?: boolean; ci?: boolean }) => {
    const repoPath = join(process.cwd(), path);
    const format = (opts.format ?? "cli") as "cli" | "html" | "json" | "markdown";
    const useLlm = opts.llm !== false;
    const outputPath = opts.output ?? (format === "html" ? "tech-debt-report.html" : undefined);

    const totalSteps = useLlm ? 6 : 4;
    const progress = new cliProgress.SingleBar(
      {
        format: chalk.cyan(" {bar} ") + "| {task} | {value}/{total}",
        barCompleteChar: "█",
        barIncompleteChar: "░",
      },
      cliProgress.Presets.shades_classic
    );

    try {
      process.stderr.write(chalk.bold.blue("\n  Technical Debt Visualizer\n\n"));
      progress.start(totalSteps, 0, { task: "Discovering files..." });
      progress.update(1, { task: "Discovering files..." });

      const run = await runAnalysis({
        repoPath,
        maxFiles: 1500,
        gitDays: 90,
      });
      progress.update(2, { task: "Analyzing..." });

      const fileContents = new Map<string, string>();
      for (const f of run.fileMetrics.map((m) => m.file)) {
        try {
          fileContents.set(f, await readFile(join(repoPath, f), "utf-8"));
        } catch {
          // ignore
        }
      }

      if (useLlm) {
        progress.update(3, { task: "LLM: per-file cleanliness..." });
        const allFilePaths = run.fileMetrics.map((m) => m.file);
        const maxFiles = 80;
        const filesToAssess = run.fileMetrics.slice(0, maxFiles);
        for (const m of filesToAssess) {
          const content = fileContents.get(m.file);
          if (!content) continue;
          const result = await assessFileCleanliness(m.file, content, m, {}, { filePaths: allFilePaths });
          if (result) {
            const idx = run.fileMetrics.findIndex((x) => x.file === m.file);
            if (idx >= 0)
              run.fileMetrics[idx] = {
                ...run.fileMetrics[idx]!,
                llmAssessment: result.assessment,
                llmSuggestedCode: result.suggestedCode,
              };
          }
        }

        progress.update(4, { task: "LLM: debt item insights..." });
        let debtItems = run.debtItems;
        if (debtItems.length > 0) {
          debtItems = await enrichDebtWithInsights(debtItems.slice(0, 25), fileContents);
          const byId = new Map(debtItems.map((d) => [d.id, d]));
          run.debtItems = run.debtItems.map((d) => byId.get(d.id) ?? d);
        }

        progress.update(5, { task: "LLM: overall assessment..." });
        const overall = await assessOverallCleanliness(run);
        if (overall) run.llmOverallAssessment = overall;
        const nextSteps = await suggestNextSteps(run);
        if (nextSteps?.length) run.llmNextSteps = nextSteps;
      }

      progress.update(totalSteps, { task: "Done" });
      progress.stop();

      if (format === "html" && outputPath) {
        await generateHtmlReport(run, { outputPath, title: "Technical Debt Report", darkMode: true });
        process.stdout.write(chalk.green(`\n  Report written to ${outputPath}\n\n`));
      } else if (format === "json") {
        const out = outputPath ?? undefined;
        const json = generateJsonReport(run);
        if (out) {
          const { writeFile } = await import("node:fs/promises");
          await writeFile(out, json, "utf-8");
          process.stdout.write(chalk.green(`\n  JSON written to ${out}\n\n`));
        } else {
          process.stdout.write(json + "\n");
        }
      } else if (format === "markdown") {
        const out = outputPath ?? undefined;
        const md = generateMarkdownReport(run);
        if (out) {
          const { writeFile } = await import("node:fs/promises");
          await writeFile(out, md, "utf-8");
          process.stdout.write(chalk.green(`\n  Markdown written to ${out}\n\n`));
        } else {
          process.stdout.write(md + "\n");
        }
      } else {
        printCliReport(run, opts.ci ?? false);
        if (!run.llmOverallAssessment) {
          process.stdout.write(
            chalk.dim(
              "  To get AI insights, per-file optimization suggestions, and refactor recommendations:\n" +
                "  set GEMINI_API_KEY or OPENAI_API_KEY and run without --no-llm.\n\n"
            )
          );
        }
        if (opts.ci && getDebtScore(run) > 60) process.exit(1);
      }
    } catch (e) {
      progress.stop();
      process.stderr.write(chalk.red("\n  Error: " + (e instanceof Error ? e.message : String(e)) + "\n\n"));
      process.exit(1);
    }
  });

function getDebtScore(run: AnalysisRun): number {
  const items = run.debtItems;
  if (items.length === 0) return 0;
  const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
  const sum = items.reduce((a, b) => a + (severityWeight[b.severity] ?? 0) * b.confidence, 0);
  return Math.min(100, Math.round((sum / items.length) * 25));
}

function printCliReport(run: AnalysisRun, ci: boolean): void {
  const { debtItems, fileMetrics, errors } = run;
  const score = getDebtScore(run);
  const cleanliness = getCleanlinessTier(score);

  process.stdout.write("\n");
  process.stdout.write(chalk.bold.dim("  Technical Debt Cleanliness Score\n"));
  process.stdout.write("  " + "—".repeat(52) + "\n");
  const tierColor = cleanlinessTierColor(cleanliness.tier);
  process.stdout.write(tierColor(`  ${cleanliness.label} (${cleanliness.tier}/5)\n`));
  process.stdout.write(tierColor(`  ${cleanliness.description}\n`));
  process.stdout.write("  " + "—".repeat(52) + "\n\n");

  process.stdout.write(chalk.bold("  Summary\n"));
  process.stdout.write(chalk.dim("  " + "—".repeat(50) + "\n"));
  process.stdout.write(`  Files analyzed: ${chalk.cyan(String(fileMetrics.length))}\n`);
  process.stdout.write(`  Debt items:     ${chalk.yellow(String(debtItems.length))}\n`);
  if (run.debtTrend && run.debtTrend.length > 0) {
    process.stdout.write(`  Recent commits: ${chalk.cyan(String(run.debtTrend.length))}\n`);
  }
  process.stdout.write(`  Debt score:     ${severityColor(score)} / 100\n`);
  process.stdout.write(chalk.dim("  (weighted average of debt item severity × confidence, 0–100)\n\n"));

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const d of debtItems) {
    bySeverity[d.severity]++;
  }
  process.stdout.write(chalk.bold("  By severity\n"));
  process.stdout.write(`  Critical: ${chalk.red(String(bySeverity.critical))}  High: ${chalk.yellow(String(bySeverity.high))}  Medium: ${chalk.hex("#b8860b")(String(bySeverity.medium))}  Low: ${chalk.gray(String(bySeverity.low))}\n\n`);

  if (run.llmOverallAssessment) {
    process.stdout.write(chalk.bold("  LLM overall assessment\n"));
    process.stdout.write(chalk.dim("  " + "—".repeat(50) + "\n"));
    process.stdout.write(chalk.cyan("  " + run.llmOverallAssessment.replace(/\n/g, "\n  ") + "\n\n"));
  }

  const hotspots = fileMetrics
    .filter((m) => (m.hotspotScore ?? 0) > 0.3)
    .sort((a, b) => (b.hotspotScore ?? 0) - (a.hotspotScore ?? 0))
    .slice(0, 5);
  if (hotspots.length > 0) {
    process.stdout.write(chalk.bold("  Hotspot files (high churn + complexity)\n"));
    for (const h of hotspots) {
      process.stdout.write(`  ${chalk.red("●")} ${h.file} ${chalk.dim(`(score ${(h.hotspotScore ?? 0).toFixed(2)})`)}\n`);
      if (h.llmAssessment) process.stdout.write(chalk.dim(`    ${h.llmAssessment.replace(/\n/g, "\n    ")}\n`));
      if (h.llmSuggestedCode) {
        process.stdout.write(chalk.cyan("    Suggested refactor:\n"));
        process.stdout.write(chalk.dim(h.llmSuggestedCode.split("\n").map((l) => "    " + l).join("\n") + "\n"));
      }
    }
    process.stdout.write("\n");
  }

  process.stdout.write(chalk.bold("  Top debt items\n"));
  const top = debtItems
    .sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
    .slice(0, 10);
  for (const d of top) {
    const sev = chalkSeverity(d.severity);
    process.stdout.write(`  ${sev} ${d.title}\n`);
    process.stdout.write(chalk.dim(`    ${d.file}${d.line ? `:${d.line}` : ""}\n`));
    if (d.insight) process.stdout.write(chalk.dim(`    ${d.insight.slice(0, 120)}${d.insight.length > 120 ? "…" : ""}\n`));
    if (d.suggestedCode) {
      process.stdout.write(chalk.cyan("    Suggested refactor:\n"));
      process.stdout.write(chalk.dim(d.suggestedCode.split("\n").map((l) => "    " + l).join("\n") + "\n"));
    }
    process.stdout.write("\n");
  }

  if (errors.length > 0 && !ci) {
    process.stdout.write(chalk.bold.yellow("  Parse errors\n"));
    for (const e of errors.slice(0, 5)) {
      process.stdout.write(chalk.dim(`  ${e.file}: ${e.message}\n`));
    }
    process.stdout.write("\n");
  }

  process.stdout.write(chalk.bold("  What to fix\n"));
  process.stdout.write(chalk.dim("  " + "—".repeat(50) + "\n"));
  const severityLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fixList = debtItems
    .sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
    .slice(0, 12)
    .map((d) => `  • [${severityLabel(d.severity)}] ${d.title} — ${d.file}${d.line != null ? `:${d.line}` : ""}`);
  if (fixList.length > 0) {
    fixList.forEach((line) => process.stdout.write(line + "\n"));
  } else {
    process.stdout.write(chalk.dim("  No debt items. Keep it up.\n"));
  }
  process.stdout.write("\n");

  if (run.llmNextSteps && run.llmNextSteps.length > 0) {
    process.stdout.write(chalk.bold.cyan("  Recommended next steps (AI)\n"));
    process.stdout.write(chalk.dim("  " + "—".repeat(50) + "\n"));
    for (const step of run.llmNextSteps) {
      process.stdout.write(chalk.cyan("  • ") + step + "\n");
    }
    process.stdout.write("\n");
  }

  process.stdout.write(chalk.dim("  Run with --format html -o report.html for the interactive dashboard.\n\n"));
}

function severityOrder(s: string): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s] ?? 0;
}

function chalkSeverity(s: string): string {
  const map: Record<string, string> = {
    critical: chalk.red("◆ Critical"),
    high: chalk.yellow("◇ High"),
    medium: chalk.hex("#b8860b")("▸ Medium"),
    low: chalk.gray("▹ Low"),
  };
  return map[s] ?? s;
}

function severityColor(score: number): string {
  if (score >= 70) return chalk.red(String(score));
  if (score >= 40) return chalk.yellow(String(score));
  return chalk.green(String(score));
}

function cleanlinessTierColor(tier: number): (s: string) => string {
  switch (tier) {
    case 5: return chalk.green.bold;
    case 4: return chalk.cyan.bold;
    case 3: return chalk.yellow.bold;
    case 2: return chalk.hex("#f97316").bold;
    case 1: return chalk.red.bold;
    default: return chalk.white.bold;
  }
}

program.parse();
