# Sample Issues for tech-debt-visualizer

Copy these into new GitHub issues to make the repo look active. Use the suggested labels.

---

## Issue #3 — Add configurable ignore patterns (good first issue)

**Title:** Add configurable ignore patterns (e.g. .techdebtignore)

**Labels:** `good first issue`, `type: feature`, `area: cli`

**Body:**
Currently the tool uses a fixed set of ignores (e.g. `node_modules`, `.git`, `dist`). It would be helpful to support a config file or `.techdebtignore` file so users can add project-specific paths or globs to ignore (e.g. generated code, vendored libs, or specific folders).

**Acceptance criteria:**
- User can create a `.techdebtignore` (or similar) in the repo root
- Each line is a path or glob pattern; matching paths are excluded from discovery
- Default ignores (node_modules, .git, etc.) still apply unless overridable via config
- Document in README

---

## Issue #4 — GitHub Actions integration (good first issue)

**Title:** Add GitHub Actions workflow / usage docs

**Labels:** `good first issue`, `type: documentation`, `area: ci`

**Body:**
Document how to run tech-debt-visualizer in GitHub Actions (e.g. on push/PR, output report as artifact or comment). Optionally provide a reusable workflow or a starter `ci.yml` snippet that runs `npx tech-debt-visualizer analyze . --ci` and fails if debt score is above a threshold.

**Acceptance criteria:**
- README or docs explain how to add the workflow
- Example workflow runs on main and PRs
- Optional: artifact upload for HTML report

---

## Issue #6 — Monorepo support (help wanted)

**Title:** Monorepo / workspace support (per-package analysis)

**Labels:** `help wanted`, `type: feature`, `area: analyzers`

**Body:**
In monorepos (npm workspaces, pnpm, Yarn, etc.), it would be valuable to:
- Detect workspace roots and list packages
- Run analysis per package and optionally aggregate
- Show debt score and hotspots at the package level in the HTML report

**Acceptance criteria:**
- Detects common monorepo layouts (package.json workspaces, pnpm-workspace.yaml, etc.)
- CLI can report per-package metrics
- HTML report has a view or section for packages (if monorepo detected)

---

## Issue #7 — Performance optimization for large repos (help wanted)

**Title:** Performance optimization for large repos

**Labels:** `help wanted`, `type: performance`, `area: analyzers`

**Body:**
On very large repos (thousands of files), analysis can be slow. Ideas:
- Parallelize file parsing (e.g. worker threads or batch processing)
- Limit or sample files when over a threshold (with a flag to force full scan)
- Cache tree-sitter parse results per file hash
- Progress reporting so users see activity

**Acceptance criteria:**
- Measurable improvement on a repo with 2000+ source files
- No regression on small repos
- Optional flags documented (e.g. `--max-files`, `--no-cache`)

---

## Issue #11 — FAQ section in README (good first issue)

**Title:** Add FAQ section to README

**Labels:** `good first issue`, `type: documentation`

**Body:**
Add a short FAQ to the README answering common questions, for example:
- How is the debt score calculated?
- Why is my file reported as “missing documentation”?
- Can I use a different LLM or API key?
- How do I ignore certain files or directories?
- What does “hotspot” mean?

**Acceptance criteria:**
- New “FAQ” or “Common questions” section in README
- At least 4–5 questions with clear, concise answers
- Links to relevant docs or options where applicable
