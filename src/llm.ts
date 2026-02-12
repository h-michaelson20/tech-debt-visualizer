/**
 * LLM integration: debt explanations, per-file cleanliness, and overall assessment.
 * Supports OpenAI, OpenRouter (OpenAI-compatible), and Google Gemini.
 *
 * No time limits: requests run until the API returns. Truncation is only from token limits.
 * Override with LLMConfig.maxTokens or --llm-max-tokens. Defaults are generous to avoid cut-off:
 * - Debt item insights (explainDebtItem): config.maxTokens ?? DEFAULT_MAX_TOKENS (2048)
 * - Per-file assessment (assessFileCleanliness): config.maxTokens ?? DEFAULT_MAX_TOKENS_FILE (8192)
 * - Overall assessment (assessOverallCleanliness): config.maxTokens ?? DEFAULT_MAX_TOKENS_OVERALL (8192)
 * - enrichDebtWithInsights: passes config.maxTokens ?? DEFAULT_MAX_TOKENS to each item
 */

import type { AnalysisRun, DebtItem, FileMetrics, LlmFileSeverity } from "./types.js";

export interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  /** Overrides default token limits for LLM responses (used where applicable). */
  maxTokens?: number;
}

export type LLMProvider = "openai" | "openrouter" | "gemini";

const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
/** Default for enrichDebtWithInsights (debt item insights). Override with config.maxTokens. */
const DEFAULT_MAX_TOKENS = 2048;
/** Default for assessFileCleanliness. */
const DEFAULT_MAX_TOKENS_FILE = 8192;
/** Default for assessOverallCleanliness. Override with config.maxTokens. */
const DEFAULT_MAX_TOKENS_OVERALL = 8192;

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

/** Parse trailing "severity" line and "score" line from LLM text; return assessment + optional score/severity. */
function parseSeverityAndScore(lines: string[]): {
  assessment: string;
  score?: number;
  severity?: LlmFileSeverity;
} {
  let assessment = lines.join("\n").trim();
  let score: number | undefined;
  let severity: LlmFileSeverity | undefined;
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1]!;
    const scoreMatch = lastLine.match(/^\s*(\d{1,3})\s*$/);
    if (scoreMatch) {
      score = Math.min(100, Math.max(0, parseInt(scoreMatch[1]!, 10)));
      const rest = lines.length > 1 ? lines.slice(0, -1) : [];
      if (rest.length > 0) {
        const severityLine = rest[rest.length - 1]!;
        const sevMatch = severityLine.match(/^\s*(critical|high|medium|low|none)\s*$/i);
        if (sevMatch) {
          severity = sevMatch[1]!.toLowerCase() as LlmFileSeverity;
          rest.pop();
        }
        assessment = rest.join("\n").trim();
      } else {
        assessment = "";
      }
    }
  }
  return { assessment: assessment || lines.join("\n").trim(), score, severity };
}

/** Parse per-file assessment: prose, fileScore 0–100, severity (critical|high|medium|low|none), optional code block. */
function parseFileAssessmentResponse(raw: string): {
  assessment: string;
  fileScore?: number;
  severity?: LlmFileSeverity;
  code?: string;
} {
  const { prose, code } = parseCodeBlockAndProse(raw);
  const lines = prose.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = parseSeverityAndScore(lines);
  return {
    assessment: parsed.assessment || prose,
    fileScore: parsed.score,
    severity: parsed.severity,
    code: code || undefined,
  };
}

/** Resolve provider and auth from config + env. Explicit baseURL = OpenAI-compatible; else key format or env picks provider. */
export function resolveLLMConfig(config: LLMConfig = {}): {
  provider: LLMProvider;
  apiKey: string;
  baseURL: string;
  model: string;
} | null {
  const explicitBase = (config.baseURL ?? process.env.OPENAI_BASE_URL)?.replace(/\/$/, "");
  const cliKey = config.apiKey;
  const openaiKey = cliKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;

  if (explicitBase && openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseURL: explicitBase,
      model: config.model ?? process.env.OPENAI_MODEL ?? OPENAI_DEFAULT_MODEL,
    };
  }
  if (cliKey) {
    if (cliKey.startsWith("AIza")) {
      return {
        provider: "gemini",
        apiKey: cliKey,
        baseURL: GEMINI_BASE,
        model: config.model ?? process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL,
      };
    }
    if (cliKey.startsWith("sk-")) {
      return {
        provider: "openai",
        apiKey: cliKey,
        baseURL: (config.baseURL ?? process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, ""),
        model: config.model ?? process.env.OPENAI_MODEL ?? OPENAI_DEFAULT_MODEL,
      };
    }
  }

  if (cliKey ?? process.env.OPENROUTER_API_KEY) {
    const key = cliKey ?? process.env.OPENROUTER_API_KEY!;
    return {
      provider: "openrouter",
      apiKey: key,
      baseURL: config.baseURL ?? process.env.OPENROUTER_BASE_URL ?? OPENROUTER_BASE,
      model: config.model ?? process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL,
    };
  }
  if (cliKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY) {
    const key = cliKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY!;
    return {
      provider: "gemini",
      apiKey: key,
      baseURL: GEMINI_BASE,
      model: config.model ?? process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL,
    };
  }
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseURL: (config.baseURL ?? process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, ""),
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
    const bodyText = await res.text();
    if (!res.ok) {
      process.stderr.write(
        `[LLM] OpenAI-compatible API error ${res.status}: ${bodyText.slice(0, 200)}${bodyText.length > 200 ? "..." : ""}\n`
      );
      return null;
    }
    const data = JSON.parse(bodyText) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    process.stderr.write(`[LLM] Request failed: ${e instanceof Error ? e.message : String(e)}\n`);
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
    const bodyText = await res.text();
    if (!res.ok) {
      process.stderr.write(
        `[LLM] Gemini API error ${res.status}: ${bodyText.slice(0, 300)}${bodyText.length > 300 ? "..." : ""}\n`
      );
      return null;
    }
    const data = JSON.parse(bodyText) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (e) {
    process.stderr.write(`[LLM] Gemini request failed: ${e instanceof Error ? e.message : String(e)}\n`);
    return null;
  }
}
/** Optional progress callback: (completedBatches, totalBatches) after each batch. */
export async function enrichDebtWithInsights(
  items: DebtItem[],
  fileContents: Map<string, string>,
  config: LLMConfig = {},
  onProgress?: (completed: number, total: number) => void
): Promise<DebtItem[]> {
  const resolved = resolveLLMConfig(config);
  if (!resolved) return items;

  const { provider, apiKey, baseURL, model } = resolved;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  const enriched: DebtItem[] = [];
  const batchSize = 5;
  const totalBatches = Math.ceil(items.length / batchSize);
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
          llmSeverity: v.severity,
          llmRawResponse: v.raw,
        });
      } else {
        enriched.push(item);
      }
    }
    onProgress?.(Math.floor((i + batchSize) / batchSize), totalBatches);
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
): Promise<{ insight: string; suggestedCode?: string; severity?: LlmFileSeverity; raw: string } | null> {
  const snippet = item.line
    ? fileContent.split("\n").slice(Math.max(0, item.line - 3), (item.endLine ?? item.line) + 2).join("\n")
    : fileContent.slice(0, 1500);

  const prompt = `Technical debt item: ${item.title} (${item.category})
${item.description}
${item.metrics ? `Metrics: ${JSON.stringify(item.metrics)}` : ""}

Relevant code:
\`\`\`
${snippet}
\`\`\`

Output only:
1. A two- to four-sentence summary of the issues: why it matters and what to do. No code block unless absolutely necessary to demonstrate.
2. On the next line write only one word: critical, high, medium, low, or none (how severe this debt item is; none = not significant).
No preamble.`;

  const raw = await chat(prompt, opts);
  if (!raw) return null;
  const { prose, code } = parseCodeBlockAndProse(raw);
  const lines = prose.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let severity: LlmFileSeverity | undefined;
  let assessment = prose;
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1]!;
    const sevMatch = lastLine.match(/^\s*(critical|high|medium|low|none)\s*$/i);
    if (sevMatch) {
      severity = sevMatch[1]!.toLowerCase() as LlmFileSeverity;
      const rest = lines.slice(0, -1).join("\n").trim();
      assessment = rest || prose;
    }
  }
  return {
    insight: assessment || item.description,
    suggestedCode: code,
    severity,
    raw,
  };
}

/** Context about the rest of the repo for cross-file optimization suggestions. */
export interface RepoContext {
  /** All analyzed file paths in this run (including the current file). */
  filePaths: string[];
}

/** Per-file: LLM gives a short summary, a 0–100 debt score, and optionally one refactor. One request per file; call in parallel from CLI. */
export async function assessFileCleanliness(
  filePath: string,
  content: string,
  metrics: FileMetrics,
  config: LLMConfig = {},
  repoContext?: RepoContext
): Promise<{ assessment: string; suggestedCode?: string; fileScore?: number; severity?: LlmFileSeverity; raw: string } | null> {
  const resolved = resolveLLMConfig(config);
  if (!resolved) return null;

  const snippet = content.length > 3500 ? content.slice(0, 3500) + "\n\n[... truncated]" : content;

  const prompt = `File: ${filePath}
Metrics: complexity ${metrics.cyclomaticComplexity ?? "?"}, lines ${metrics.lineCount}, ${metrics.hasDocumentation ? "has docs" : "no module docs"}${metrics.hotspotScore != null ? `, hotspot ${metrics.hotspotScore.toFixed(2)}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Output only:
1. A two- to four-sentence summary of the issues (how clean/maintainable, main concerns). No code block unless absolutely necessary to demonstrate.
2. On the next line write only one word: critical, high, medium, low, or none (this file's technical debt severity; none = no significant debt).
3. On the line after that write only a number 0-100 (100 = most technical debt).
No preamble.`;

  const raw = await chat(prompt, {
    ...resolved,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS_FILE,
  });
  if (!raw) return null;
  const parsed = parseFileAssessmentResponse(raw);
  return {
    assessment: parsed.assessment,
    suggestedCode: parsed.code,
    fileScore: parsed.fileScore,
    severity: parsed.severity,
    raw,
  };
}

/** Overall: LLM assesses the whole codebase and optionally a 0–100 debt score. */
export async function assessOverallCleanliness(
  run: AnalysisRun,
  config: LLMConfig = {}
): Promise<{ assessment: string; score?: number; severity?: LlmFileSeverity; raw: string } | null> {
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

  const prompt = `Codebase summary: ${fileCount} files, ${debtCount} debt items (${criticalHigh} critical/high), ${hotspots} hotspots. Top risk files: ${topFiles.join(", ")}

Output only:
1. A two- to four-sentence summary of the main issues (strengths, concerns, single most important improvement). No code block unless absolutely necessary to demonstrate.
2. On the next line write only one word: critical, high, medium, low, or none (overall codebase technical debt severity).
3. On the line after that write only a number 0-100 (100 = most debt).
No preamble.`;

  const raw = await chat(prompt, {
    ...resolved,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS_OVERALL,
  });
  if (!raw) return null;
  const lines = raw.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = parseSeverityAndScore(lines);
  return {
    assessment: parsed.assessment || raw.trim(),
    score: parsed.score,
    severity: parsed.severity,
    raw,
  };
}
