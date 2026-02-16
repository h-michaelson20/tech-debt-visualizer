import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCleanlinessTier } from "../cleanliness-score.js";
import { getCleanlinessScore } from "../debt-score.js";
import type { AnalysisRun } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "assets");

export interface HtmlReportOptions {
  outputPath: string;
  title?: string;
  darkMode?: boolean;
}

export async function generateHtmlReport(
  run: AnalysisRun,
  options: HtmlReportOptions
): Promise<void> {
  const { outputPath, title = "Technical Debt Report", darkMode = true } = options;
  const [css, script] = await Promise.all([
    readFile(join(ASSETS_DIR, "report.css"), "utf-8"),
    readFile(join(ASSETS_DIR, "report.js"), "utf-8"),
  ]);
  const html = buildHtml(run, title, darkMode, css, script);
  await writeFile(outputPath, html, "utf-8");
}

/** Inline SVG badge: shield shape with tier number and "of 5" — clean, bold, tier-colored. */
function buildScoreBadgeSvg(tier: number, fillColor: string): string {
  const lighter = adjustHexBrightness(fillColor, 1.25);
  const shadowId = "badge-shadow-" + tier;
  const gradientId = "badge-shine-" + tier;
  return `<svg class="score-badge-svg" viewBox="0 0 140 168" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${lighter};stop-opacity:0.6" />
      <stop offset="100%" style="stop-color:${fillColor};stop-opacity:1" />
    </linearGradient>
    <filter id="${shadowId}" x="-40%" y="-30%" width="180%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${fillColor}" flood-opacity="0.4"/>
    </filter>
  </defs>
  <path fill="url(#${gradientId})" filter="url(#${shadowId})" d="M70 12 C108 12 128 38 128 72 C128 106 70 156 70 156 C70 156 12 106 12 72 C12 38 32 12 70 12 Z"/>
  <path fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linejoin="round" d="M70 12 C108 12 128 38 128 72 C128 106 70 156 70 156 C70 156 12 106 12 72 C12 38 32 12 70 12 Z"/>
  <text x="70" y="80" text-anchor="middle" class="score-badge-num" fill="white">${tier}</text>
  <text x="70" y="102" text-anchor="middle" class="score-badge-of" fill="rgba(255,255,255,0.95)">of 5</text>
</svg>`;
}

function adjustHexBrightness(hex: string, factor: number): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = Math.min(255, Math.round(parseInt(m[1]!, 16) * factor));
  const g = Math.min(255, Math.round(parseInt(m[2]!, 16) * factor));
  const b = Math.min(255, Math.round(parseInt(m[3]!, 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function buildHtml(
  run: AnalysisRun,
  title: string,
  darkMode: boolean,
  css: string,
  script: string
): string {
  const theme = darkMode ? "dark" : "light";
  const cleanlinessScore = getCleanlinessScore(run);
  const scoreNum = Math.round(Math.max(0, Math.min(100, cleanlinessScore)));
  const cleanliness = getCleanlinessTier(cleanlinessScore);
  const hasLlm = !!(run.llmOverallAssessment || run.llmOverallRaw);
  const dataJson = JSON.stringify({
    fileMetrics: run.fileMetrics,
    debtItems: run.debtItems,
    hasLlm,
    llmOverallAssessment: run.llmOverallAssessment ?? null,
    llmOverallRaw: run.llmOverallRaw ?? null,
    llmOverallSeverity: run.llmOverallSeverity ?? null,
    summary: {
      filesAnalyzed: run.fileMetrics.length,
      debtCount: run.debtItems.length,
      debtScore: 100 - cleanlinessScore,
      cleanlinessScore: scoreNum,
      cleanlinessTier: cleanliness.tier,
      cleanlinessLabel: cleanliness.label,
      cleanlinessDescription: cleanliness.description,
      repoPath: run.repoPath,
      completedAt: run.completedAt ?? run.startedAt,
    },
  });

  const highCriticalCount = run.debtItems.filter(
    (d) => d.severity === "high" || d.severity === "critical"
  ).length;
  const hotspotCount = run.fileMetrics.filter((m) => (m.hotspotScore ?? 0) > 0.3).length;

  const statsLine = `${run.fileMetrics.length} files · ${run.debtItems.length} items · ${highCriticalCount} high/crit · ${hotspotCount} hotspots`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)} — ${cleanliness.tier} out of 5 ${escapeHtml(cleanliness.label)}" />
  <meta property="og:description" content="${escapeHtml(cleanliness.description)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)} — ${cleanliness.tier} out of 5" />
  <meta name="twitter:description" content="${escapeHtml(cleanliness.label)}: ${escapeHtml(cleanliness.description)}" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body class="dashboard-page">
  ${!hasLlm ? `<div class="no-llm-banner"><p class="no-llm-cta">Analysis run without LLM — for full results, run with LLM</p></div>` : ""}
  <header class="dashboard-header">
    <div class="dashboard-header-left">
      <h1 class="dashboard-title">${escapeHtml(title)}</h1>
      <span class="dashboard-meta">${escapeHtml(run.repoPath)}</span>
    </div>
    <div class="dashboard-header-right">
      <div class="dashboard-score tier-${cleanliness.tier}" aria-label="Score ${cleanliness.tier} out of 5">
        <span class="dashboard-score-value">${cleanliness.tier}</span>
        <span class="dashboard-score-of"> out of 5</span>
        <span class="dashboard-score-label">${escapeHtml(cleanliness.label)}</span>
      </div>
      <button type="button" class="btn-ai-prompts btn-ai-prompts-header" id="btnAiPrompts">AI cleanup prompts</button>
      <span class="dashboard-date">${run.completedAt ?? run.startedAt}</span>
    </div>
  </header>

  <main class="dashboard-main">
    <div class="dashboard-grid-2x2">
      <div class="dashboard-cell dashboard-cell-score">
        <div class="panel panel-score panel-score-pop" data-tier="${cleanliness.tier}">
          <div class="panel-header">
            <h2 class="panel-title">Technical Debt Cleanliness Score</h2>
          </div>
          <div class="panel-body panel-body-score">
            <div class="score-numeric">
              <span class="score-num">${cleanliness.tier}</span>
              <span class="score-of"> out of 5</span>
            </div>
            <p class="score-label">${escapeHtml(cleanliness.label)}</p>
            <p class="score-desc">${escapeHtml(cleanliness.description)}</p>
            <p class="score-stats">${statsLine}</p>
          </div>
        </div>
      </div>

      <div class="dashboard-cell dashboard-cell-heatmap">
        <div class="panel panel-heatmap">
          <div class="panel-header panel-header-heatmap">
            <h2 class="panel-title">Files by debt</h2>
            <div class="panel-heatmap-row">
              <p class="panel-desc">Size = complexity + churn. Color = severity. Click for details.</p>
              <div class="legend legend-inline">
                <span><span class="swatch swatch-crit"></span> Critical</span>
                <span><span class="swatch swatch-high"></span> High</span>
                <span><span class="swatch swatch-med"></span> Medium</span>
                <span><span class="swatch swatch-low"></span> Low</span>
                <span><span class="swatch swatch-none"></span> None</span>
              </div>
            </div>
          </div>
          <div class="panel-body panel-body-heatmap">
            <div id="treemap"></div>
          </div>
        </div>
      </div>

      <div class="dashboard-cell dashboard-cell-problems">
        <div class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Description of problems</h2>
          </div>
          <div class="panel-body">
            ${run.llmOverallAssessment || run.llmOverallRaw
              ? `<div class="llm-output">${
                  run.llmOverallAssessment
                    ? renderLlmOutputToHtml(run.llmOverallAssessment)
                    : '<div class="llm-prose">' +
                      escapeHtml(stripTrailingSeverityAndScore(run.llmOverallRaw ?? "")).replace(/\n/g, "<br>") +
                      "</div>"
                }</div>`
              : '<p class="panel-empty">Run with LLM for an overall assessment of problems.</p>'}
            <div class="priority-inline">
              <div class="priority-inline-col">
                <h4>High impact, easier</h4>
                <ul id="q1" class="priority-list"></ul>
              </div>
              <div class="priority-inline-col">
                <h4>High impact, harder</h4>
                <ul id="q2" class="priority-list"></ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-cell dashboard-cell-list">
        <div class="panel panel-list">
          <div class="panel-header">
            <h2 class="panel-title">Ratings & files</h2>
            <p class="panel-desc">Files rated above none by static or LLM. Click for full details.</p>
          </div>
          <div class="panel-body">
            <ul class="debt-list" id="debtList"></ul>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-footer"></div>
  </main>

  <div id="aiPromptsOverlay" class="overlay" aria-hidden="true">
    <div class="overlay-backdrop"></div>
    <div class="overlay-panel">
      <div class="overlay-header">
        <h2 class="overlay-title">AI cleanup prompts</h2>
        <button type="button" class="overlay-close" id="closeAiPrompts" aria-label="Close">&times;</button>
      </div>
      <div class="overlay-body">
        <p class="overlay-plan-mode">Give this prompt to a <strong>PLAN MODE</strong> AI or coding agent (e.g. plan mode in your IDE).</p>
        <div class="overlay-prompt-wrap">
          <pre id="aiPromptsText" class="overlay-prompt-text"></pre>
        </div>
        <button type="button" class="btn-copy-prompt" id="copyAiPrompts" aria-label="Copy prompt">
          <span class="btn-copy-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          <span class="btn-copy-label">Copy prompt</span>
        </button>
      </div>
    </div>
  </div>

  <div id="detail">
    <div class="panel">
      <h3 id="detailTitle"></h3>
      <div class="file" id="detailFile"></div>
      <div class="detail-explanation" id="detailExplanation"></div>
      <div class="suggested-code" id="detailSuggestedCode"></div>
      <div class="file-assessment" id="detailFileAssessment"></div>
      <p class="close-hint">Click outside to close</p>
    </div>
  </div>

  <script>
const DATA = ${dataJson};
${script}
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remove trailing severity line and score line so they are not shown in the description. */
function stripTrailingSeverityAndScore(text: string): string {
  const lines = text.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
  while (lines.length > 0) {
    const last = lines[lines.length - 1]!;
    if (/^\s*\d{1,3}\s*$/.test(last)) {
      lines.pop();
      continue;
    }
    if (/^\s*(critical|high|medium|low|none)\s*$/i.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

/** Parse markdown-style code blocks and return HTML (prose + .code-block divs). */
function renderLlmOutputToHtml(text: string): string {
  if (!text?.trim()) return "";
  const parts: Array<{ type: "prose"; content: string } | { type: "code"; lang: string; content: string }> = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const prose = text.slice(lastIndex, m.index).trim();
      if (prose) parts.push({ type: "prose", content: prose });
    }
    const lang = (m[1] ?? "").trim();
    const code = (m[2] ?? "").trim();
    parts.push({ type: "code", lang, content: code });
    lastIndex = re.lastIndex;
  }
  const tail = text.slice(lastIndex).trim();
  if (tail) {
    const openIdx = tail.indexOf("```");
    if (openIdx !== -1) {
      const prosePart = tail.slice(0, openIdx).trim();
      if (prosePart) parts.push({ type: "prose", content: prosePart });
      const afterOpen = tail.slice(openIdx + 3).trim();
      const newline = afterOpen.indexOf("\n");
      const langPart = newline === -1 ? "" : afterOpen.slice(0, newline).trim();
      const lang = /^\w+$/.test(langPart) ? langPart : "";
      const codeContent = newline === -1 ? afterOpen : afterOpen.slice(newline + 1).trim();
      parts.push({ type: "code", lang, content: codeContent });
    } else {
      parts.push({ type: "prose", content: tail });
    }
  }
  return parts
    .map((p) => {
      if (p.type === "prose") {
        return (
          '<div class="llm-prose">' +
          escapeHtml(p.content).replace(/\n/g, "<br>") +
          "</div>"
        );
      }
      const langLabel = p.lang ? p.lang.charAt(0).toUpperCase() + p.lang.slice(1) : "Code";
      return (
        '<div class="code-block">' +
        '<span class="lang-label">' +
        escapeHtml(langLabel) +
        "</span>" +
        "<pre><code>" +
        escapeHtml(p.content) +
        "</code></pre></div>"
      );
    })
    .join("");
}
