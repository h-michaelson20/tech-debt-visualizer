import type { IAnalyzer } from "../types.js";
import { javascriptAnalyzer } from "./javascript.js";
import { pythonAnalyzer } from "./python.js";

export const analyzers: IAnalyzer[] = [javascriptAnalyzer, pythonAnalyzer];

export { javascriptAnalyzer } from "./javascript.js";
export { pythonAnalyzer } from "./python.js";
