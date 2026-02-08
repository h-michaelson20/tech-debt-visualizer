# Technical Debt Visualizer

Analyze a repo and get a **cleanliness score**, **debt breakdown**, and optional **AI explanations and refactor suggestions**—in the terminal or as an interactive HTML report.

![Node 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)
![Languages](https://img.shields.io/badge/languages-JS%20%7C%20TS%20%7C%20Python-green?style=flat-square)
![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue?style=flat-square)

---

## Quick start

```bash
git clone <this-repo>
cd tech-debt-visualizer
npm install && npm run build
node dist/cli.js analyze . --format cli
```

To try the **HTML dashboard**:  
`node dist/cli.js analyze . --format html -o report.html` then open `report.html`.

To use **AI insights** (explanations + optional code refactors): set `GEMINI_API_KEY` or `OPENAI_API_KEY` and run the same commands without `--no-llm`.

---

## How it works

The tool runs a fixed pipeline so you know exactly what you’re getting.

1. **Discover files**  
   Walks the repo (respecting common ignores like `node_modules`, `.git`, `dist`) and collects source files by extension: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, etc.

2. **Run language analyzers**  
   Pluggable analyzers (today: JavaScript/TypeScript and Python) parse each file with **tree-sitter**, then:
   - Count **cyclomatic complexity** (if/else, loops, switch, ternaries, `&&`/`||`).
   - Count effective lines and check for **module-level docs** (JSDoc, docstrings).
   - Emit **debt items** (e.g. “High cyclomatic complexity”, “Missing documentation”, “Large file”) with severity and confidence.

3. **Enrich with git**  
   Uses `git log` (e.g. last 90 days) to compute per-file **churn** and **commit count**. Combines that with complexity into a **hotspot score**: files that change often and are complex are treated as higher risk. A simple **debt trend** over recent commits is also derived (heuristic, not full historical analysis).

4. **Score and tier**  
   A single **debt score** (0–100) is computed from severity and confidence of all debt items. That score is mapped to a **Cleanliness tier** (1–5), e.g. “Thoughtful Prompter (3/5)” or “Pure Coder (5/5)”, shown at the top of the CLI and report.

5. **Optional LLM pass**  
   If an API key is set and you don’t use `--no-llm`, the tool:
   - Asks the LLM to assess **per-file cleanliness** for the top ~15 hotspot files (and optionally suggest a **concrete code refactor** in a code block).
   - Asks the LLM to explain **each debt item** (why it matters, what to do) and optionally suggest a **simplified/refactored code snippet**.
   - Asks the LLM for one **overall codebase assessment** (a short paragraph).

   Responses are parsed: prose goes into insights/assessments; any markdown code block is stored as **suggested refactor** and shown in CLI and HTML.

6. **Output**  
   Results are printed in the terminal (CLI) and/or written as **HTML** (treemap, trend chart, drill-down), **JSON**, or **Markdown** for CI or tooling.

So: **static metrics + git → score & tier → optional LLM explanations and code suggestions → your chosen output format.**

---

## Install & run

| How you run it | Command |
|----------------|--------|
| **From this repo** | `node dist/cli.js analyze [path]` (after `npm run build`) |
| **Global (after publish)** | `npm install -g tech-debt-visualizer` then `tech-debt analyze [path]` |
| **No install (after publish)** | `npx tech-debt-visualizer analyze [path]` |

Requires **Node 18+**.

---

## Options

| Option | Meaning |
|--------|--------|
| `-f, --format` | `cli` (default), `html`, `json`, or `markdown` |
| `-o, --output` | Output path (e.g. `report.html` for HTML) |
| `--no-llm` | Skip all LLM calls (no API key needed) |
| `--ci` | Terse output; exit code 1 if debt score &gt; 60 |

Examples:

```bash
node dist/cli.js analyze . -f html -o report.html
node dist/cli.js analyze ./src -f json -o debt.json
node dist/cli.js analyze . --ci
```

---

## LLM (optional)

The tool can call an LLM to get **explanations** and **concrete code refactor suggestions**. You only need one provider; the first one with a key wins.

| Provider | Env var(s) | Optional env |
|----------|------------|---------------|
| **OpenRouter** | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` (default: `google/gemini-2.0-flash-001`) |
| **Gemini** | `GEMINI_API_KEY` or `GOOGLE_GENAI_API_KEY` | `GEMINI_MODEL` (default: `gemini-1.5-flash`) |
| **OpenAI** | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | `OPENAI_BASE_URL`, `OPENAI_MODEL` (default: `gpt-4o-mini`) |

With a key set, the CLI and HTML report will include:

- **Overall assessment** — One short paragraph on the codebase.
- **Per-file** — For hotspot files: short assessment and, when the LLM suggests one, a **suggested refactor** code block.
- **Per debt item** — Why it matters, what to do, and when applicable a **suggested refactor** code block (parsed from the LLM response).

Use `--no-llm` to run with no API calls.

---

## What we measure

- **Cyclomatic complexity** — Decision points in the AST (if/for/while/switch/ternary/&&/||). Higher values suggest harder testing and refactors.
- **Documentation** — Presence of module-level JSDoc or docstrings.
- **Hotspots** — Files with high git churn *and* high complexity (riskiest to change).
- **Debt trend** — Simple heuristic over recent commits (files touched); not a full historical debt metric.
- **Cleanliness tier** — Score 0–100 mapped to a 1–5 label (e.g. “Pure Coder (5/5)” for low debt).

---

## Contributing

We’d love **issues** and **contributions**.

- **Bugs or confusing behavior?** Open an issue and describe what you ran and what you expected.
- **Feature ideas?** Open an issue with a short use case; we’re happy to discuss.
- **Want to add a language?** Implement the `IAnalyzer` interface in `src/analyzers/` (see `javascript.ts` / `python.ts`), register it in `src/analyzers/index.ts`, and add the right file extensions in `src/discover.ts`. PRs welcome.
- **Docs or README improvements?** PRs welcome.

By contributing, you agree that your contributions may be used under this project's license (CC BY-NC 4.0).

---

## Repo layout

```
src/
  cli.ts           # Entrypoint, progress, output
  engine.ts       # Runs discovery → analyzers → git → optional LLM
  discover.ts     # File discovery by extension
  git-analyzer.ts # Churn, hotspots, trend from git log
  llm.ts          # LLM calls (OpenAI/OpenRouter/Gemini), prompts, code-block parsing
  cleanliness-score.ts  # Score → tier (1–5)
  types.ts        # DebtItem, FileMetrics, AnalysisRun, IAnalyzer
  analyzers/      # Per-language: tree-sitter parse, complexity, debt items
  reports/        # HTML, JSON, Markdown
```

---

## License

This project is licensed under **CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial 4.0). You may use, share, and adapt it for **non-commercial** purposes with attribution. **Commercial use is not permitted** without separate permission. See [LICENSE](LICENSE) for details.

---

*This project is an independent initiative and is not affiliated with, endorsed by, or operated by any formed legal entity.*
