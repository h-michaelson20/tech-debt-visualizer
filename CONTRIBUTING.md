# Contributing to Technical Debt Visualizer

We welcome issues and pull requests. To contribute code or docs, you need to agree to our **Contributor License Agreement (CLA)** first.

## Before you contribute

1. **Read the [CLA](CLA.md).** By opening a pull request, you confirm that you have read and agree to the CLA. That agreement lets the project owner use your contribution under both the GPL and a commercial license.
2. **Open an issue first** (optional but helpful) for anything beyond small fixes. It keeps everyone aligned and avoids duplicate work.

## How to contribute

- **Bugs or confusing behavior:** Open an issue with what you ran, what you expected, and (if possible) a minimal repro.
- **Feature ideas:** Open an issue with a short use case; we’re happy to discuss.
- **Code or docs:** Fork the repo, make your changes, then open a pull request. In the PR, check the CLA box in the template (if present) to confirm you agree.

## Adding a new language

Implement the `IAnalyzer` interface in `src/analyzers/` (see `javascript.ts` and `python.ts`), register it in `src/analyzers/index.ts`, and add the right file extensions in `src/discover.ts`. PRs welcome.

## PR process

- We’ll review your PR and may ask for changes.
- Once approved and the CLA is confirmed, we’ll merge. Thanks for contributing.
