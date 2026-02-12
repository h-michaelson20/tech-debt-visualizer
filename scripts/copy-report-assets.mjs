import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "reports", "assets");
const dest = join(root, "dist", "reports", "assets");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
