/**
 * Git history analyzer: churn, hotspots, and change patterns.
 * Used to enrich file metrics with change frequency and debt trends.
 */

import { simpleGit, type SimpleGit } from "simple-git";

export interface GitStats {
  byFile: Map<string, { commits: number; churn: number; lastChange: string }>;
  recentCommits: number;
  defaultBranch?: string;
}

const DEFAULT_DAYS = 90;
const DEFAULT_MAX_FILES = 5000;

export async function getGitStats(
  repoPath: string,
  options: { days?: number; maxFiles?: number } = {}
): Promise<GitStats> {
  const { days = DEFAULT_DAYS, maxFiles = DEFAULT_MAX_FILES } = options;
  const git = simpleGit(repoPath);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const byFile = new Map<string, { commits: number; churn: number; lastChange: string }>();

  try {
    // Get file names only (repeated per commit) so we can count commits per file
    const nameOnly = await git.raw([
      "log",
      `--since=${since.toISOString()}`,
      "--name-only",
      "--format=",
    ]);
    const fileCommits = new Map<string, number>();
    for (const line of nameOnly.split("\n")) {
      const f = line.trim().replace(/^\.\//, "");
      if (!f || f.includes("=>")) continue;
      fileCommits.set(f, (fileCommits.get(f) ?? 0) + 1);
    }

    // Get churn (additions + deletions) per file via --numstat
    const numstat = await git.raw([
      "log",
      `--since=${since.toISOString()}`,
      "--numstat",
      "--format=",
    ]);
    const fileChurn = new Map<string, number>();
    const fileLastChange = new Map<string, string>();
    const logWithDate = await git.log({ "--since": since.toISOString() });
    for (const entry of logWithDate.all) {
      const names = await getFilesInCommit(git, entry.hash);
      for (const f of names) {
        const norm = f.replace(/^\.\//, "");
        fileLastChange.set(norm, entry.date);
      }
    }
    for (const line of numstat.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const add = parseInt(parts[0], 10) || 0;
        const del = parseInt(parts[1], 10) || 0;
        const path = parts.slice(2).join(" ").replace(/^\.\//, "");
        if (path && !path.includes("=>"))
          fileChurn.set(path, (fileChurn.get(path) ?? 0) + add + del);
      }
    }

    const sorted = [...fileCommits.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxFiles);

    for (const [file, commits] of sorted) {
      byFile.set(file, {
        commits,
        churn: fileChurn.get(file) ?? commits,
        lastChange: fileLastChange.get(file) ?? "",
      });
    }
  } catch {
    // Not a git repo or no history
  }

  let defaultBranch: string | undefined;
  try {
    defaultBranch = (await git.branch()).current;
  } catch {
    // ignore
  }

  let recentCommits = 0;
  try {
    recentCommits = (await git.log({ "--since": since.toISOString() })).total;
  } catch {
    // ignore
  }

  return {
    byFile,
    recentCommits,
    defaultBranch,
  };
}

async function getFilesInCommit(git: SimpleGit, hash: string): Promise<string[]> {
  try {
    const diff = await git.show([hash, "--name-only", "--format="]);
    return diff.split("\n").filter(Boolean).map((f) => f.trim());
  } catch {
    return [];
  }
}

/**
 * Compute hotspot score: files that change often AND are complex are riskier.
 * Normalize so we can combine with static metrics.
 */
export function computeHotspotScore(
  changeCount: number,
  churn: number,
  complexity: number,
  maxChange: number,
  maxChurn: number,
  maxComplexity: number
): number {
  if (maxChange === 0 && maxChurn === 0 && maxComplexity === 0) return 0;
  const changeNorm = maxChange > 0 ? changeCount / maxChange : 0;
  const churnNorm = maxChurn > 0 ? churn / maxChurn : 0;
  const complexityNorm = maxComplexity > 0 ? complexity / maxComplexity : 0;
  // Weight: complexity and churn matter most
  return (complexityNorm * 0.5 + (changeNorm + churnNorm) * 0.25);
}

export async function getDebtTrend(
  repoPath: string,
  sampleCommits: number = 20
): Promise<Array<{ commit: string; date: string; score: number }>> {
  const git = simpleGit(repoPath);
  const result: Array<{ commit: string; date: string; score: number }> = [];

  try {
    const log = await git.log({ max: sampleCommits });
    for (const entry of log.all) {
      // Placeholder: real trend would run analysis at each commit (expensive).
      // We use a simple heuristic: more files changed = potential debt churn.
      const names = await getFilesInCommit(git, entry.hash);
      const score = Math.min(100, names.length * 2 + 10);
      result.push({
        commit: entry.hash.slice(0, 7),
        date: entry.date,
        score,
      });
    }
  } catch {
    // ignore
  }

  return result.reverse();
}
