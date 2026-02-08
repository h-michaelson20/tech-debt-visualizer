/**
 * Load .env from current working directory. Uses dotenv if installed, else parses manually.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function loadEnv(): Promise<void> {
  const envPath = join(process.cwd(), ".env");
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: envPath });
    return;
  } catch {
    // dotenv not installed
  }
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    process.env[key] = value;
  }
}
