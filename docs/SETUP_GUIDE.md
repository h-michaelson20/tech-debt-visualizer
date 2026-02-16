# GitHub Repository Setup Guide

This guide will help you make your `tech-debt-visualizer` repo look professional and attract contributors.

## 1. Add Repository Topics

Go to your repo → About → Settings (gear icon) → Add topics:

```
technical-debt
code-quality
static-analysis
git-analysis
developer-tools
typescript
nodejs
cli-tool
llm
ai-tools
code-metrics
```

## 2. Create Issue Labels

**Option A: GitHub CLI (fastest)**
```bash
cd /path/to/tech-debt-visualizer
bash setup-labels.sh  # Use the script from LABELS.md
```

**Option B: Manual**
- Go to Issues → Labels → New label
- Copy from LABELS.md file

## 3. Add Issue Templates

Create folder: `.github/ISSUE_TEMPLATE/`

Add these files:
- `bug_report.md` (use template from this folder)
- `feature_request.md` (use template from this folder)

**Also create:** `.github/pull_request_template.md`

## 4. Create Initial Issues

Post 4-5 issues from SAMPLE_ISSUES.md:
- Choose a mix: 2 "good first issue", 1 "help wanted", 1 feature, 1 bug
- This makes the repo look active
- Pin 1-2 important ones

**Recommended first issues:**
1. Issue #3 (Add configurable ignore patterns) - good first issue
2. Issue #4 (GitHub Actions integration) - good first issue  
3. Issue #6 (Monorepo support) - help wanted
4. Issue #7 (Performance optimization) - help wanted
5. Issue #11 (FAQ section) - good first issue

## 5. Create a GitHub Project Board

1. Go to Projects → New project → Board
2. Name it "Tech Debt Roadmap"
3. Add columns:
   - 📋 Backlog
   - 🎯 Ready
   - 🏗️ In Progress
   - 👀 In Review
   - ✅ Done

4. Add your issues to appropriate columns
5. Pin the project board to your repo

## 6. Add a ROADMAP.md

See [ROADMAP.md](../ROADMAP.md) in the repo root.

## 7. Add Badges to README

Badges are already in the README. Ensure the CI badge matches your workflow file.

## 8. Create a CHANGELOG.md

See [CHANGELOG.md](../CHANGELOG.md) in the repo root.

## 9. Add GitHub Actions Workflows

See `.github/workflows/ci.yml`.

## 10. Social Proof

### Add to Your Profile README
If you have a GitHub profile README (username/username repo), add:
```markdown
## 🔧 Projects I'm Working On
- [tech-debt-visualizer](https://github.com/h-michaelson20/tech-debt-visualizer) - Analyze technical debt with AI-powered insights
```

### Share on Social Media
- Post on Twitter/X with #opensource #typescript #devtools
- Post on Reddit r/programming or r/node
- Post on Hacker News "Show HN: Tech Debt Visualizer"
- Post on Dev.to

### Sample Tweet
```
🚀 Just open-sourced tech-debt-visualizer!

Analyze your codebase's technical debt:
✅ Complexity metrics
✅ Git hotspots  
✅ AI-powered insights
✅ Beautiful reports

Looking for contributors! 
⭐ github.com/h-michaelson20/tech-debt-visualizer

#opensource #typescript #DevTools
```

## 11. Enable Discussions

1. Go to Settings → Features
2. Enable Discussions
3. Create categories:
   - 💬 General
   - 💡 Ideas
   - 🙏 Q&A
   - 📣 Show and Tell
   - 🎉 Announcements

## 12. Add Security Policy

See [SECURITY.md](../SECURITY.md).

## 13. Community Health Files

See [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md).

## Quick Wins Checklist

- [ ] Add repository topics (Step 1)
- [ ] Create labels using script (Step 2)
- [ ] Add issue templates (Step 3)
- [ ] Post 3-5 initial issues (Step 4)
- [ ] Add badges to README (Step 7)
- [ ] Enable GitHub Discussions (Step 11)
- [ ] Share on Twitter/Reddit (Step 10)
- [ ] Star your own repo (shows in feed!)
- [ ] Add to awesome lists (search "awesome static analysis")

This will make your repo look professional and active! 🚀
