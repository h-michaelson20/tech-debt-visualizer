/**
 * LLM integration: debt explanations, per-file cleanliness, and overall assessment.
 * Supports OpenAI, OpenRouter (OpenAI-compatible), and Google Gemini.
 */

import type { DebtItem, FileMetrics } from "./types.js";
import type { AnalysisRun } from "./types.js";

export interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
}

export type LLMProvider = "openai" | "openrouter" | "gemini";

const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.0-flash-001";
const GEMINI_DEFAULT_MODEL = "gemini-1.5-flash";
const DEFAULT_MAX_TOKENS = 300;
const DEFAULT_MAX_TOKENS_OVERALL = 500;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Extract first markdown code block and the prose before it. */
function parseCodeBlockAndProse(response: string): { prose: string; code?: string } {
  const match = response.match(/^(.*?)(?:```(?:\w*)\n?([\s\S]*?)```|$)/);
  if (!match) return { prose: response.trim() };
  const prose = match[1]!.trim();
  const code = match[2]?.trim();
  return { prose, code: code || undefined };
}

/** Resolve provider and auth from config + env. OpenRouter and Gemini take precedence when their keys are set. */
export function resolveLLMConfig(config: LLMConfig = {}): {
  provider: LLMProvider;
  apiKey: string;
  baseURL: string;
  model: string;
} | null {
  const openRouterKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  const geminiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY;
  const openaiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;

  if (openRouterKey) {
    return {
      provider: "openrouter",
      apiKey: openRouterKey,
      baseURL: config.baseURL ?? process.env.OPENROUTER_BASE_URL ?? OPENROUTER_BASE,
      model: config.model ?? process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL,
    };
  }
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      baseURL: GEMINI_BASE,
      model: config.model ?? process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL,
    };
  }
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseURL: config.baseURL ?? process.env.OPENAI_BASE_URL ?? "",
      model: config.model ?? process.env.OPENAI_MODEL ?? OPENAI_DEFAULT_MODEL,
    };
  }
  return null;
}

async function chat(
  prompt: string,
  opts: { apiKey: string; baseURL?: string; model: string; maxTokens: number; provider?: LLMProvider }
): Promise<string | null> {
  const provider = opts.provider ?? (opts.baseURL?.includes("openrouter") ? "openrouter" : "openai");
  if (provider === "gemini") {
    return geminiCompletion(prompt, { apiKey: opts.apiKey, model: opts.model, maxTokens: opts.maxTokens });
  }
  return openAICompatibleCompletion(prompt, opts);
}

async function openAICompatibleCompletion(
  prompt: string,
  opts: { apiKey: string; baseURL?: string; model: string; maxTokens: number }
): Promise<string | null> {
  try {
    const url = opts.baseURL
      ? `${opts.baseURL.replace(/\/$/, "")}/chat/completions`
      : "https://api.openai.com/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: opts.maxTokens,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

async function geminiCompletion(
  prompt: string,
  opts: { apiKey: string; model: string; maxTokens: number }
): Promise<string | null> {
  try {
    const modelId = opts.model.replace(/^models\//, "");
    const url = `${GEMINI_BASE}/models/${modelId}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens,
          temperature: 0.2,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function enrichDebtWithInsights(
  items: DebtItem[],
  fileContents: Map<string, string>,
  config: LLMConfig = {}
): Promise<DebtItem[]> {
  const resolved = resolveLLMConfig(config);
  if (!resolved) return items;

  const { provider, apiKey, baseURL, model } = resolved;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  const enriched: DebtItem[] = [];
  const batchSize = 5;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((item) =>
        explainDebtItem(item, fileContents.get(item.file) ?? "", {
          apiKey,
          baseURL,
          model,
          maxTokens,
          provider,
        })
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j]!;
      const result = results[j];
      if (result?.status === "fulfilled" && result.value) {
        const v = result.value;
        enriched.push({
          ...item,
          insight: v.insight,
          suggestedCode: v.suggestedCode,
        });
      } else {
        enriched.push(item);
      }
    }
  }
  return enriched;
}

async function explainDebtItem(
  item: DebtItem,
  fileContent: string,
  opts: {
    apiKey: string;
    baseURL?: string;
    model: string;
    maxTokens: number;
    provider?: LLMProvider;
  }
): Promise<{ insight: string; suggestedCode?: string } | null> {
  const snippet = item.line
    ? fileContent.split("\n").slice(Math.max(0, item.line - 3), (item.endLine ?? item.line) + 2).join("\n")
    : fileContent.slice(0, 1500);

  const prompt = `You are a senior engineer reviewing technical debt. For this item:

1) In 1-2 sentences: why it matters for maintainability or risk, and what to do.
2) If a concrete code simplification or refactor is possible (e.g. reduce branching, extract function, simplify condition), provide ONLY the refactored/simplified code in a markdown code block. Use the same language as the snippet. If no code change is needed or the fix is trivial (e.g. "add a comment"), omit the code block.

Debt: ${item.title}
Category: ${item.category}
Description: ${item.description}
${item.metrics ? `Metrics: ${JSON.stringify(item.metrics)}` : ""}

Relevant code:
\`\`\`
${snippet}
\`\`\`

Reply format: Short explanation first, then optionally a code block with the suggested refactor. No other preamble.`;

  const raw = await chat(prompt, { ...opts, maxTokens: 500 });
  if (!raw) return null;
  const { prose, code } = parseCodeBlockAndProse(raw);
  return { insight: prose || item.description, suggestedCode: code };
}

/** Context about the rest of the repo for cross-file optimization suggestions. */
export interface RepoContext {
  /** All analyzed file paths in this run (including the current file). */
  filePaths: string[];
}

/** Per-file: LLM assesses cleanliness and suggests optimizations with cross-file context. */
export async function assessFileCleanliness(
  filePath: string,
  content: string,
  metrics: FileMetrics,
  config: LLMConfig = {},
  repoContext?: RepoContext
): Promise<{ assessment: string; suggestedCode?: string } | null> {
  const resolved = resolveLLMConfig(config);
  if (!resolved) return null;

  const snippet = content.length > 4000 ? content.slice(0, 4000) + "\n\n[... truncated]" : content;
  const otherFiles =
    repoContext?.filePaths?.filter((p) => p !== filePath).slice(0, 80) ?? [];
  const repoContextBlock =
    otherFiles.length > 0
      ? `\nRepository context (other files in this run): ${otherFiles.join(", ")}.\nWhen suggesting optimizations, you may reference other files (e.g. extract to a shared module, reuse from another file, or move code between files). Explain why each suggestion helps.\n`
      : "";

  const prompt = `You are a senior engineer assessing code cleanliness and possible optimizations for this file.

1) In 1-3 sentences: how clean and maintainable is it, and one or two concrete improvements (or "Looks good" if fine). Explain why each improvement matters.
2) If one specific optimization is possible (e.g. simplify a function, reduce nesting, extract a helper, or a cross-file refactor like moving code to a shared module), provide ONLY that refactored snippet in a markdown code block. Same language as the file. Briefly say why it helps. If no clear code change applies, omit the code block.
${repoContextBlock}
File: ${filePath}
Metrics: complexity ${metrics.cyclomaticComplexity ?? "?"}, lines ${metrics.lineCount}, ${metrics.hasDocumentation ? "has docs" : "no module docs"}${metrics.hotspotScore != null ? `, hotspot ${metrics.hotspotScore.toFixed(2)}` : ""}.

Code:
\`\`\`
${snippet}
\`\`\`

Reply: short assessment first (with brief "why"), then optionally a code block with the suggested refactor. No preamble.`;

  const raw = await chat(prompt, {
    ...resolved,
    maxTokens: config.maxTokens ?? 500,
  });
  if (!raw) return null;
  const { prose, code } = parseCodeBlockAndProse(raw);
  return { assessment: prose, suggestedCode: code };
}

/** Overall: LLM assesses the whole codebase cleanliness in a short paragraph. */
export async function assessOverallCleanliness(
  run: AnalysisRun,
  config: LLMConfig = {}
): Promise<string | null> {
  const resolved = resolveLLMConfig(config);
  if (!resolved) return null;

  const fileCount = run.fileMetrics.length;
  const debtCount = run.debtItems.length;
  const criticalHigh = run.debtItems.filter((d) => d.severity === "critical" || d.severity === "high").length;
  const hotspots = run.fileMetrics.filter((m) => (m.hotspotScore ?? 0) > 0.3).length;
  const topFiles = run.fileMetrics
    .sort((a, b) => (b.hotspotScore ?? 0) - (a.hotspotScore ?? 0))
    .slice(0, 12)
    .map((m) => m.file);

  const prompt = `You are a senior engineer giving a brief overall assessment of a codebase's technical debt and cleanliness.

Summary:
- ${fileCount} files analyzed
- ${debtCount} debt items (${criticalHigh} critical/high)
- ${hotspots} hotspot files (high churn + complexity)
- Top files by risk: ${topFiles.join(", ")}

In one short paragraph (3-5 sentences), assess overall cleanliness: main strengths or concerns, and the single most important thing to improve. Be direct and actionable. No preamble.`;

  return chat(prompt, {
    ...resolved,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS_OVERALL,
  });
}

/** LLM suggests 3–5 prioritized next steps (actionable bullets). */
export async function suggestNextSteps(
  run: AnalysisRun,
  config: LLMConfig = {}
): Promise<string[] | null> {
  const resolved = resolveLLMConfig(config);
  if (!resolved) return null;

  const fileCount = run.fileMetrics.length;
  const debtCount = run.debtItems.length;
  const bySeverity = run.debtItems.reduce(
    (acc, d) => {
      acc[d.severity] = (acc[d.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const severityOrd = (s: string) => ({ critical: 4, high: 3, medium: 2, low: 1 }[s] ?? 0);
  const topItems = run.debtItems
    .sort((a, b) => severityOrd(b.severity) - severityOrd(a.severity))
    .slice(0, 15)
    .map((d) => `${d.severity}: ${d.title} (${d.file}${d.line ? `:${d.line}` : ""})`);

  const prompt = `You are a senior engineer. Given this technical debt summary, suggest 3–5 concrete, prioritized next steps the team should take to reduce debt. Be specific (files, types of fixes). Output ONLY a short bullet list: one action per line, starting each line with "- " or "• ". No preamble or explanation.

Summary: ${fileCount} files, ${debtCount} debt items. By severity: ${JSON.stringify(bySeverity)}.
Sample items: ${topItems.join("; ")}

List 3–5 next steps:`;

  const raw = await chat(prompt, {
    ...resolved,
    maxTokens: 300,
  });
  if (!raw) return null;
  const bullets = raw
    .split(/\n/)
    .map((s) => s.replace(/^[\s\-•*]+\s*/, "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
  return bullets.length > 0 ? bullets : null;
}
