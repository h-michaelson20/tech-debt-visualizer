#!/usr/bin/env node
/**
 * CLI entry: colorful terminal output, progress bars, actionable insights.
 * Loads .env from cwd first; supports --llm-key and --llm-model.
 */
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.js";
import { Command } from "commander";
import chalk from "chalk";
import cliProgress from "cli-progress";
import { getCleanlinessTier } from "./cleanliness-score.js";
import { getCleanlinessScore, getDebtScore } from "./debt-score.js";
import { runAnalysis } from "./engine.js";
import {
  assessFileCleanliness,
  assessOverallCleanliness,
  resolveLLMConfig,
} from "./llm.js";
import { generateHtmlReport } from "./reports/html.js";
import { generateJsonReport } from "./reports/json.js";
import { generateMarkdownReport } from "./reports/markdown.js";
import { type AnalysisRun, SEVERITY_ORDER } from "./types.js";

function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return (pkg && pkg.version) || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("tech-debt-visualizer")
  .description("Analyze a repo and get a cleanliness score, debt breakdown, and optional AI insights. No install required.")
  .version(getVersion());

program
  .command("analyze")
  .description("Analyze a folder (default: current directory) and print or save a report")
  .argument("[path]", "Path to the repo or folder to analyze", ".")
  .option("-f, --format <type>", "Output format: cli | html | json | markdown", "cli")
  .option("-o, --output <path>", "Write output to this file (for html/json/markdown)")
  .option("--no-llm", "Skip AI insights (no API key needed; use this for a quick run)")
  .option("--llm", "Enable AI insights (default when an API key is set)")
  .option("--llm-key <key>", "API key (overrides env: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY)")
  .option("--llm-endpoint <url>", "OpenAI-compatible API base URL")
  .option("--llm-model <model>", "Model name (e.g. gpt-4o-mini, gemini-2.5-flash)")
  .option("--llm-max-tokens <n>", "Max tokens per response", (v) => parseInt(v, 10))
  .option("--ci", "CI mode: terse output; exit 1 if debt is high")
  .addHelpText(
    "after",
    `
Quick start:
  npx tech-debt-visualizer analyze .              No install: analyze current folder → terminal report
  tech-debt-visualizer analyze .                  Same, if you ran: npm install -g tech-debt-visualizer
  tech-debt-visualizer analyze . -f html -o report.html   Save interactive HTML report
  tech-debt-visualizer analyze . --no-llm         Skip AI (no API key needed)

Requires Node 18+. For AI insights, set GEMINI_API_KEY or OPENAI_API_KEY (or use --llm-key).
`
  )
  .action(async (path: string, opts: { output?: string; format?: string; llm?: boolean; ci?: boolean; llmKey?: string; llmEndpoint?: string; llmModel?: string; llmMaxTokens?: number }) => {
    const repoPath = join(process.cwd(), path);
    const format = (opts.format ?? "cli") as "cli" | "html" | "json" | "markdown";
    const useLlm = opts.llm !== false;
    const outputPath = opts.output ?? (format === "html" ? "tech-debt-report.html" : undefined);
    const llmConfigOverrides = {
      apiKey: opts.llmKey,
      baseURL: opts.llmEndpoint,
      model: opts.llmModel,
      ...(opts.llmMaxTokens != null && opts.llmMaxTokens > 0 ? { maxTokens: opts.llmMaxTokens } : {}),
    };

    const progress = new cliProgress.SingleBar(
      {
        format:
          chalk.cyan(" {bar} ") + "| {percentage}% | {value}/{total} | {task}",
        barCompleteChar: "█",
        barIncompleteChar: "░",
      },
      cliProgress.Presets.shades_classic
    );

    let run: Awaited<ReturnType<typeof runAnalysis>>;
    const fileContents = new Map<string, string>();

    try {
      process.stderr.write(chalk.bold.blue("\n  Technical Debt Visualizer\n\n"));

      const discoverySteps = useLlm ? 2 : 4;
      progress.start(discoverySteps, 0, { task: "Discovering files..." });
      run = await runAnalysis({ repoPath, maxFiles: 1500, gitDays: 90 });
      progress.update(1, { task: "Discovering files..." });
      progress.update(2, { task: "Analyzing..." });
      for (const f of run.fileMetrics.map((m) => m.file)) {
        try {
          fileContents.set(f, await readFile(join(repoPath, f), "utf-8"));
        } catch {
          // ignore
        }
      }
      if (!useLlm) {
        progress.update(4, { task: "Done" });
        progress.stop();
      } else {
        progress.stop();

        const maxFiles = 80;
        const filesToAssess = run.fileMetrics.slice(0, maxFiles);
        const totalSteps = 2 + filesToAssess.length + 1;

        progress.start(totalSteps, 2, {
          task: filesToAssess.length > 0 ? `LLM: file 0/${filesToAssess.length}` : "LLM: overall...",
        });

        const llmConfig = resolveLLMConfig(llmConfigOverrides);
        if (!llmConfig) {
          progress.update(totalSteps, { task: "Skipping LLM (no key)" });
          progress.stop();
          process.stderr.write(
            chalk.yellow(
              "  No LLM API key found. Use --llm-key <key> or set one of:\n" +
                "  GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY (or .env).\n" +
                "  For a custom endpoint: --llm-endpoint <url> --llm-key <key>\n" +
                "  Skipping AI insights for this run.\n\n"
            )
          );
        } else {
          run.llmAttempted = true;
          const config = { ...llmConfigOverrides };
          const allFilePaths = run.fileMetrics.map((m) => m.file);
          const FILE_BATCH_SIZE = 10;

          for (let i = 0; i < filesToAssess.length; i += FILE_BATCH_SIZE) {
            const batch = filesToAssess.slice(i, i + FILE_BATCH_SIZE);
            const completedBefore = i;
            const results = await Promise.allSettled(
              batch.map((m) => {
                const content = fileContents.get(m.file);
                if (!content) return Promise.resolve(null);
                return assessFileCleanliness(m.file, content, m, config, { filePaths: allFilePaths });
              })
            );
            for (let j = 0; j < batch.length; j++) {
              const result = results[j];
              if (result?.status === "fulfilled" && result.value) {
                const m = batch[j]!;
                const idx = run.fileMetrics.findIndex((x) => x.file === m.file);
                if (idx >= 0)
                  run.fileMetrics[idx] = {
                    ...run.fileMetrics[idx]!,
                    llmAssessment: result.value.assessment,
                    llmSuggestedCode: result.value.suggestedCode,
                    llmFileScore:
                      result.value.fileScore != null ? 100 - result.value.fileScore : undefined,
                    llmSeverity: result.value.severity,
                    llmRawAssessment: result.value.raw,
                  };
              }
            }
            const completedFiles = Math.min(completedBefore + batch.length, filesToAssess.length);
            progress.update(2 + completedFiles, {
              task: `LLM: file ${completedFiles}/${filesToAssess.length}`,
            });
          }

          const overallStep = 2 + filesToAssess.length;
          progress.update(overallStep, { task: "LLM: overall assessment..." });
          const overall = await assessOverallCleanliness(run, config);
          if (overall) {
            run.llmOverallAssessment = overall.assessment;
            if (overall.score != null) run.llmOverallScore = 100 - overall.score;
            if (overall.severity) run.llmOverallSeverity = overall.severity;
            run.llmOverallRaw = overall.raw;
          }
          progress.update(totalSteps, { task: "Done" });
          progress.stop();
        }
      }
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
          if (run.llmAttempted) {
            process.stdout.write(
              chalk.dim("  LLM was used but returned no insights. Check [LLM] errors above or verify your API key.\n\n")
            );
          } else {
            process.stdout.write(
              chalk.dim(
                "  To get AI insights: set GEMINI_API_KEY (or OPENAI_API_KEY) or use --llm-key <key>. Run without --no-llm.\n\n"
              )
            );
          }
        }
        if (opts.ci && getDebtScore(run) > 60) process.exit(1);
      }
    } catch (e) {
      progress.stop();
      process.stderr.write(chalk.red("\n  Error: " + (e instanceof Error ? e.message : String(e)) + "\n\n"));
      process.exit(1);
    }
  });

function printCliReport(run: AnalysisRun, ci: boolean): void {
  const { debtItems, fileMetrics, errors } = run;
  const cleanlinessScore = getCleanlinessScore(run);
  const cleanliness = getCleanlinessTier(cleanlinessScore);
  process.stdout.write("\n");
  process.stdout.write(chalk.bold.dim("  Technical Debt Cleanliness Score\n"));
  process.stdout.write("  " + "—".repeat(52) + "\n");
  const tierColor = cleanlinessTierColor(cleanliness.tier);
  process.stdout.write(tierColor(`  ${cleanliness.label} (${cleanliness.tier} out of 5)\n`));
  process.stdout.write(tierColor(`  ${cleanliness.description}\n`));
  process.stdout.write("  " + "—".repeat(52) + "\n\n");
  process.stdout.write(chalk.bold("  Summary\n"));
  process.stdout.write(chalk.dim("  " + "—".repeat(50) + "\n"));
  process.stdout.write(`  Files analyzed: ${chalk.cyan(String(fileMetrics.length))}\n`);
  process.stdout.write(`  Debt items:     ${chalk.yellow(String(debtItems.length))}\n`);
  if (run.debtTrend && run.debtTrend.length > 0) {
    process.stdout.write(`  Recent commits: ${chalk.cyan(String(run.debtTrend.length))}\n`);
  }
  process.stdout.write(`  Score:         ${tierColor(`${cleanliness.tier} out of 5`)}\n\n`);
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const d of debtItems) {
    bySeverity[d.severity]++;
  }
  process.stdout.write(chalk.bold("  By severity\n"));
  process.stdout.write(
    `  Critical: ${chalk.red(String(bySeverity.critical))}  High: ${chalk.yellow(String(bySeverity.high))}  Medium: ${chalk.hex("#b8860b")(String(bySeverity.medium))}  Low: ${chalk.gray(String(bySeverity.low))}\n\n`
  );
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
      const hotspotInfo = `(score ${(h.hotspotScore ?? 0).toFixed(2)})`;
      const llmInfo = h.llmFileScore != null ? ` LLM debt ${h.llmFileScore}/100` : "";
      const llmSev = h.llmSeverity ? ` LLM severity ${h.llmSeverity}` : "";
      process.stdout.write(`  ${chalk.red("●")} ${h.file} ${chalk.dim(hotspotInfo + llmInfo + llmSev)}\n`);
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
    if (d.insight) process.stdout.write(chalk.dim(`    ${d.insight.replace(/\n/g, "\n    ")}\n`));
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
  process.stdout.write(chalk.dim("  Tip: npx tech-debt-visualizer analyze . -f html -o report.html → interactive dashboard.\n\n"));
}

function severityOrder(s: string): number {
  return SEVERITY_ORDER[s as keyof typeof SEVERITY_ORDER] ?? 0;
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
    case 5:
      return chalk.green.bold;
    case 4:
      return chalk.cyan.bold;
    case 3:
      return chalk.yellow.bold;
    case 2:
      return chalk.hex("#f97316").bold;
    case 1:
      return chalk.red.bold;
    default:
      return chalk.white.bold;
  }
}

// Load .env from cwd first, then run the CLI
loadEnv().then(() => program.parse());
