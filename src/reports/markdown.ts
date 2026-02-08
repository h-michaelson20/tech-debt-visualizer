import type { AnalysisRun, DebtItem } from "../types.js";

export function generateMarkdownReport(run: AnalysisRun): string {
  const lines: string[] = [];
  lines.push("# Technical Debt Report");
  lines.push("");
  lines.push(`**Repository:** \`${run.repoPath}\``);
  lines.push(`**Generated:** ${run.completedAt ?? run.startedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Files analyzed | ${run.fileMetrics.length} |`);
  lines.push(`| Debt items | ${run.debtItems.length} |`);
  lines.push(`| Parse errors | ${run.errors.length} |`);
  lines.push("");

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const d of run.debtItems) {
    bySeverity[d.severity]++;
  }
  lines.push("## By severity");
  lines.push("");
  lines.push(`- **Critical:** ${bySeverity.critical}`);
  lines.push(`- **High:** ${bySeverity.high}`);
  lines.push(`- **Medium:** ${bySeverity.medium}`);
  lines.push(`- **Low:** ${bySeverity.low}`);
  lines.push("");

  const hotspots = run.fileMetrics
    .filter((m) => (m.hotspotScore ?? 0) > 0.2)
    .sort((a, b) => (b.hotspotScore ?? 0) - (a.hotspotScore ?? 0))
    .slice(0, 15);
  if (hotspots.length > 0) {
    lines.push("## Hotspot files");
    lines.push("");
    lines.push("| File | Hotspot score | Complexity | Churn |");
    lines.push("|------|---------------|------------|-------|");
    for (const h of hotspots) {
      lines.push(`| \`${h.file}\` | ${(h.hotspotScore ?? 0).toFixed(2)} | ${h.cyclomaticComplexity ?? "-"} | ${h.churn ?? "-"} |`);
    }
    lines.push("");
  }

  lines.push("## Debt items");
  lines.push("");
  const byCategory = new Map<string, DebtItem[]>();
  for (const d of run.debtItems) {
    const list = byCategory.get(d.category) ?? [];
    list.push(d);
    byCategory.set(d.category, list);
  }
  const order = ["complexity", "hotspot", "documentation", "duplication", "architecture", "dependencies", "other"];
  for (const cat of order) {
    const items = byCategory.get(cat);
    if (!items?.length) continue;
    lines.push(`### ${cat}`);
    lines.push("");
    for (const d of items.slice(0, 20)) {
      lines.push(`- **${d.title}** (\`${d.file}${d.line ? `:${d.line}` : ""}\`) — ${d.severity}`);
      if (d.insight) lines.push(`  - ${d.insight}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
