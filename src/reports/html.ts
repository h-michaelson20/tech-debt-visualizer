import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCleanlinessTier } from "../cleanliness-score.js";
import { getDebtScore } from "../debt-score.js";
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

/** Inline SVG badge: shield shape with tier number and "of 5". */
function buildScoreBadgeSvg(tier: number, fillColor: string): string {
  const lighter = adjustHexBrightness(fillColor, 1.3);
  const shadowId = "badge-shadow-" + tier;
  const gradientId = "badge-shine-" + tier;
  return `<svg class="score-badge-svg" viewBox="0 0 140 168" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${lighter};stop-opacity:0.5" />
      <stop offset="100%" style="stop-color:${fillColor};stop-opacity:1" />
    </linearGradient>
    <filter id="${shadowId}" x="-30%" y="-20%" width="160%" height="150%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.35"/>
    </filter>
  </defs>
  <path fill="url(#${gradientId})" filter="url(#${shadowId})" d="M70 12 C108 12 128 38 128 72 C128 106 70 156 70 156 C70 156 12 106 12 72 C12 38 32 12 70 12 Z"/>
  <path fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linejoin="round" d="M70 12 C108 12 128 38 128 72 C128 106 70 156 70 156 C70 156 12 106 12 72 C12 38 32 12 70 12 Z"/>
  <text x="70" y="78" text-anchor="middle" class="score-badge-num" fill="white">${tier}</text>
  <text x="70" y="100" text-anchor="middle" class="score-badge-of" fill="white">of 5</text>
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
  const debtScore = getDebtScore(run);
  const cleanliness = getCleanlinessTier(debtScore);
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
      debtScore,
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

  const tierColors: Record<number, string> = {
    1: "#c00",
    2: "#e85d00",
    3: "#b8860b",
    4: "#069",
    5: "#0a6b0a",
  };
  const tierColor = tierColors[cleanliness.tier] ?? "#666";
  const scoreBadgeSvg = buildScoreBadgeSvg(cleanliness.tier, tierColor);

  const llmPanelHtml =
    run.llmOverallAssessment || run.llmOverallRaw
      ? `
    <div class="panel panel-llm">
      <div class="panel-header">
        <h2 class="panel-title">LLM overall assessment</h2>
      </div>
      <div class="panel-body">
        <div class="llm-output">${
          run.llmOverallAssessment
            ? renderLlmOutputToHtml(run.llmOverallAssessment)
            : '<div class="llm-prose">' +
              escapeHtml(stripTrailingSeverityAndScore(run.llmOverallRaw ?? "")).replace(/\n/g, "<br>") +
              "</div>"
        }</div>
      </div>
    </div>`
      : "";

  const statsLine = `${run.fileMetrics.length} files · ${run.debtItems.length} items · ${highCriticalCount} high/crit · ${hotspotCount} hotspots`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)} — ${cleanliness.tier}/5 ${escapeHtml(cleanliness.label)}" />
  <meta property="og:description" content="${escapeHtml(cleanliness.description)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)} — ${cleanliness.tier}/5" />
  <meta name="twitter:description" content="${escapeHtml(cleanliness.label)}: ${escapeHtml(cleanliness.description)}" />
  <style>${css}</style>
</head>
<body class="dashboard-page">
  ${!hasLlm ? `<div class="no-llm-banner"><p class="no-llm-cta">Analysis run without LLM — for full results, run with LLM</p></div>` : ""}
  <header class="dashboard-header">
    <div class="dashboard-header-left">
      <div class="dashboard-score-badge tier-${cleanliness.tier}" aria-label="Score ${cleanliness.tier} of 5">${scoreBadgeSvg}</div>
      <div class="dashboard-hero">
        <h1 class="dashboard-title">${escapeHtml(title)}</h1>
        <p class="dashboard-blurb">${escapeHtml(cleanliness.description)}</p>
        <span class="dashboard-meta">${escapeHtml(run.repoPath)}</span>
      </div>
    </div>
    <div class="dashboard-header-right">
      <span class="dashboard-stats">${statsLine}</span>
      <span class="dashboard-date">${run.completedAt ?? run.startedAt}</span>
    </div>
  </header>

  <main class="dashboard-main">
    ${llmPanelHtml}

    <div class="panel panel-heatmap">
      <div class="panel-header panel-header-heatmap">
        <h2 class="panel-title">Files by debt</h2>
        <p class="panel-desc">Size = complexity + churn. Color = severity (static or LLM). Click for details.</p>
        <div class="legend legend-inline">
          <span><span class="swatch swatch-crit"></span> Critical</span>
          <span><span class="swatch swatch-high"></span> High</span>
          <span><span class="swatch swatch-med"></span> Medium</span>
          <span><span class="swatch swatch-low"></span> Low</span>
          <span><span class="swatch swatch-none"></span> None</span>
        </div>
      </div>
      <div class="panel-body panel-body-heatmap">
        <div id="treemap"></div>
      </div>
    </div>

    <div class="dashboard-grid dashboard-grid-half">
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">High impact, easier</h2>
          <p class="panel-desc">High severity in smaller files.</p>
        </div>
        <div class="panel-body">
          <ul id="q1" class="priority-list"></ul>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">High impact, harder</h2>
          <p class="panel-desc">Critical or hotspot files.</p>
        </div>
        <div class="panel-body">
          <ul id="q2" class="priority-list"></ul>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Files with debt (static or LLM)</h2>
        <p class="panel-desc">Every file rated above none by static analysis or LLM. Click a row for full ratings and explanations.</p>
      </div>
      <div class="panel-body">
        <ul class="debt-list" id="debtList"></ul>
      </div>
    </div>
  </main>

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
