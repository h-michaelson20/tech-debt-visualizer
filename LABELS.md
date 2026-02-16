# GitHub Labels for tech-debt-visualizer

## How to Add These Labels

You can add these labels via:
1. **GitHub UI**: Go to Issues → Labels → New label
2. **GitHub CLI**: Use `gh label create` commands (see script below)
3. **Script**: Run `bash setup-labels.sh` from the repo root (requires [GitHub CLI](https://cli.github.com/))

---

## Recommended Label Structure

### Priority Labels
- **priority: critical** - `#d73a4a` - Needs immediate attention
- **priority: high** - `#e99695` - Important but not blocking
- **priority: medium** - `#fbca04` - Normal priority
- **priority: low** - `#0e8a16` - Nice to have

### Type Labels
- **type: bug** - `#d73a4a` - Something isn't working
- **type: feature** - `#a2eeef` - New feature or request
- **type: enhancement** - `#84b6eb` - Improvement to existing feature
- **type: documentation** - `#0075ca` - Improvements or additions to documentation
- **type: refactor** - `#d4c5f9` - Code cleanup or restructuring
- **type: performance** - `#f9d0c4` - Performance improvements
- **type: security** - `#ee0701` - Security-related issues

### Difficulty Labels (Great for Contributors!)
- **good first issue** - `#7057ff` - Good for newcomers
- **help wanted** - `#008672` - Extra attention is needed
- **difficulty: easy** - `#c2e0c6` - Can be completed quickly
- **difficulty: medium** - `#fef2c0` - Requires some experience
- **difficulty: hard** - `#f9d0c4` - Complex, needs deep knowledge

### Area Labels
- **area: analyzers** - `#bfdadc` - Language analyzers (JS/TS/Python)
- **area: llm** - `#c5def5` - LLM integration and prompts
- **area: git-analysis** - `#bfd4f2` - Git metrics and hotspots
- **area: reporting** - `#d4c5f9` - HTML/JSON/CLI output
- **area: scoring** - `#fbca04` - Debt score calculation
- **area: cli** - `#0e8a16` - Command-line interface
- **area: ci** - `#e99695` - CI/CD integration

### Status Labels
- **status: blocked** - `#d93f0b` - Blocked by other issues
- **status: in-progress** - `#fbca04` - Currently being worked on
- **status: needs-review** - `#0e8a16` - Ready for review
- **status: needs-info** - `#d876e3` - More information needed

### Special Labels
- **breaking-change** - `#b60205` - Will require major version bump
- **dependencies** - `#0366d6` - Pull requests that update dependencies
- **duplicate** - `#cfd3d7` - This issue or PR already exists
- **wontfix** - `#ffffff` - This will not be worked on
- **hacktoberfest** - `#ff6b35` - Participating in Hacktoberfest

---

See **setup-labels.sh** in the repo root to create all labels via GitHub CLI.
