/**
 * Discover source files in a repository by extension and optional globs.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Dirent } from "node:fs";
import type { IAnalyzer } from "./types.js";

const DEFAULT_IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "__pycache__",
  ".venv",
  "venv",
  "vendor",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
]);

export async function discoverFiles(
  repoPath: string,
  analyzers: IAnalyzer[],
  options: { maxFiles?: number } = {}
): Promise<Map<string, string>> {
  const { maxFiles = 2000 } = options;
  const extensions = new Set<string>();
  for (const a of analyzers) {
    for (const lang of a.languages) {
      if (lang === "javascript" || lang === "typescript") {
        extensions.add(".js").add(".jsx").add(".ts").add(".tsx").add(".mjs").add(".cjs");
      } else if (lang === "python") {
        extensions.add(".py");
      }
    }
  }

  const result = new Map<string, string>();
  await walk(repoPath, repoPath, extensions, result, maxFiles);
  return result;
}

async function walk(
  root: string,
  dir: string,
  extensions: Set<string>,
  result: Map<string, string>,
  maxFiles: number
): Promise<void> {
  if (result.size >= maxFiles) return;

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    if (result.size >= maxFiles) break;
    const full = join(dir, ent.name);
    const rel = full.slice(root.length).replace(/^[/\\]/, "");

    if (ent.isDirectory()) {
      if (DEFAULT_IGNORE.has(ent.name) || ent.name.startsWith(".")) continue;
      await walk(root, full, extensions, result, maxFiles);
      continue;
    }

    const ext = ent.name.includes(".") ? "." + ent.name.split(".").pop()!.toLowerCase() : "";
    if (!extensions.has(ext)) continue;

    try {
      const content = await readFile(full, "utf-8");
      result.set(rel, content);
    } catch {
      // skip binary or unreadable
    }
  }
}
