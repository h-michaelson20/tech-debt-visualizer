#!/bin/bash

# GitHub Labels Setup Script for tech-debt-visualizer
# Run this from your repo root after installing GitHub CLI (gh)

echo "🏷️  Setting up GitHub labels for tech-debt-visualizer..."
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is installed and authenticated"
echo ""
echo "Creating labels..."
echo ""

# Priority labels
echo "📊 Creating priority labels..."
gh label create "priority: critical" --color d73a4a --description "Needs immediate attention" --force
gh label create "priority: high" --color e99695 --description "Important but not blocking" --force
gh label create "priority: medium" --color fbca04 --description "Normal priority" --force
gh label create "priority: low" --color 0e8a16 --description "Nice to have" --force

# Type labels
echo "🏷️  Creating type labels..."
gh label create "type: bug" --color d73a4a --description "Something isn't working" --force
gh label create "type: feature" --color a2eeef --description "New feature or request" --force
gh label create "type: enhancement" --color 84b6eb --description "Improvement to existing feature" --force
gh label create "type: documentation" --color 0075ca --description "Improvements or additions to documentation" --force
gh label create "type: refactor" --color d4c5f9 --description "Code cleanup or restructuring" --force
gh label create "type: performance" --color f9d0c4 --description "Performance improvements" --force
gh label create "type: security" --color ee0701 --description "Security-related issues" --force

# Difficulty labels
echo "🎯 Creating difficulty labels..."
gh label create "good first issue" --color 7057ff --description "Good for newcomers" --force
gh label create "help wanted" --color 008672 --description "Extra attention is needed" --force
gh label create "difficulty: easy" --color c2e0c6 --description "Can be completed quickly" --force
gh label create "difficulty: medium" --color fef2c0 --description "Requires some experience" --force
gh label create "difficulty: hard" --color f9d0c4 --description "Complex, needs deep knowledge" --force

# Area labels
echo "📍 Creating area labels..."
gh label create "area: analyzers" --color bfdadc --description "Language analyzers (JS/TS/Python)" --force
gh label create "area: llm" --color c5def5 --description "LLM integration and prompts" --force
gh label create "area: git-analysis" --color bfd4f2 --description "Git metrics and hotspots" --force
gh label create "area: reporting" --color d4c5f9 --description "HTML/JSON/CLI output" --force
gh label create "area: scoring" --color fbca04 --description "Debt score calculation" --force
gh label create "area: cli" --color 0e8a16 --description "Command-line interface" --force
gh label create "area: ci" --color e99695 --description "CI/CD integration" --force

# Status labels
echo "🚦 Creating status labels..."
gh label create "status: blocked" --color d93f0b --description "Blocked by other issues" --force
gh label create "status: in-progress" --color fbca04 --description "Currently being worked on" --force
gh label create "status: needs-review" --color 0e8a16 --description "Ready for review" --force
gh label create "status: needs-info" --color d876e3 --description "More information needed" --force

# Special labels
echo "⭐ Creating special labels..."
gh label create "breaking-change" --color b60205 --description "Will require major version bump" --force
gh label create "dependencies" --color 0366d6 --description "Pull requests that update dependencies" --force
gh label create "hacktoberfest" --color ff6b35 --description "Participating in Hacktoberfest" --force

echo ""
echo "✅ All labels created successfully!"
echo ""
echo "Next steps:"
echo "1. Create issue templates in .github/ISSUE_TEMPLATE/"
echo "2. Add pull request template in .github/pull_request_template.md"
echo "3. Post some initial issues to make the repo look active"
echo ""
echo "See docs/SETUP_GUIDE.md for full instructions!"
