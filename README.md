# AI GitHub Repository Analyzer

Paste any GitHub URL, get back an instant analysis: tech stack, code quality, documentation health, improvement suggestions, and an auto-generated contributor guide. No external AI API required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org)

## Is this for me?

### Who it's for

- Developers reviewing open-source projects before adopting them.
- Engineering leads evaluating dependencies for code quality and maintenance.
- Open-source maintainers who want an objective outside view of their project.
- Teams assessing their own repos for documentation gaps, code smells, and health.

### The core idea

Enter a GitHub repository URL. The analyzer fetches metadata, README, file tree, and languages, then runs a deterministic AI pipeline — summarizer, tech stack detector, architecture analyzer, code smell detector, quality scorer, self-healing layer, and RL parameter tuning. You get scored categories, a clean summary, detected tech stack, architecture patterns, code smells, and improvement suggestions. All in under 30 seconds.

### When you'd use this

- Evaluating a library before pulling it into your stack.
- Running a quarterly health check on your team's repos.
- Onboarding a new hire and giving them instant context on your codebase.
- Deciding whether a project is maintained enough to contribute to.

### What you're probably doing today instead

- Scanning README files manually and hoping they cover everything.
- Checking GitHub Insights tabs, stars, and commit graphs in separate tabs.
- Running `cloc` or `tokei` locally and stitching results together.
- Asking a teammate "is that repo any good?" and getting a subjective answer.

### Pain points it addresses

- Evaluating a repo takes 20+ minutes of clicking through GitHub tabs.
- Subjective judgement — two people look at the same repo and disagree.
- Documentation quality is hard to quantify without reading the whole README.
- No easy way to compare multiple repos on the same criteria.

### What changes in your architecture

- One URL input replaces 5+ GitHub tabs and manual analysis.
- The scoring model is deterministic and reproducible — same repo, same score.
- Reports can be exported, compared, and revisited later.
- The RL system gradually tunes scoring weights based on real-world usage.

### When not to use it

- The repo is a single-file script with no README.
- You need deep static analysis (type errors, dead code, vulnerability scanning).
- The repo is private and you can't provide a GitHub token with access.

### How it works

1. Fetch repo metadata, file tree, languages, and README via the GitHub API (5 calls per analysis).
2. Run the input through a pipeline of specialized modules — all deterministic rules and heuristics, no black-box ML.
3. A self-healing layer validates every output and retries with adapted strategies on failure.
4. An optional RL system tunes scoring weights based on repo characteristics.

### Limitations

The analysis is based on metadata, file structure, and README content — it never compiles or runs the code. The local model uses TextRank (extractive, not generative) and heuristic scoring. For generative summaries or deep code understanding, you can optionally plug in OpenAI.

## Features

- **Deterministic scoring** — 6 quality dimensions with weighted, reproducible scores and transparent breakdowns.
- **Tech stack detection** — Languages, frameworks, databases, tools, infrastructure from files, README, dependencies, and topics.
- **Architecture classification** — Detects Monorepo, Microservices, MVC, Clean Architecture, Serverless, and more from directory structure.
- **Documentation audit** — Scores README completeness across 10 sections, checks for contributing guide, license, changelog.
- **Code smell detection** — 10 checks (no README, no tests, no CI, single contributor, stale dependencies, poor structure, etc.).
- **Self-healing** — Every output is validated, corrected on failure, and retried with adapted strategies (relaxed → aggressive → minimal).
- **Reinforcement learning** — Q-learning engine (27 state features, 10 actions) adjusts 5 scoring weights based on repo characteristics. Q-table persists to disk.
- **Export & compare** — Download any analysis as Markdown. Compare two repos side by side.

## Quick Example

```
Input: https://github.com/facebook/react

Overall:      82/100
Code Quality: 75/100
Documentation:68/100
Maintainability:80/100
Community:    95/100
Security:     70/100
```

Plus: detected tech stack, architecture, code smells, improvement suggestions, and an onboarding guide.

## Setup

### Prerequisites

- Node.js 18+
- A [GitHub token](https://github.com/settings/tokens) (optional — without one you get 60 unauthenticated requests/hour)

### Quick start

```bash
git clone https://github.com/learnerforge/AI-GitHub-Repository-Analyzer.git
cd AI-GitHub-Repository-Analyzer
npm install
npm run dev
```

Open http://localhost:3000, paste a URL, click Analyze. That's it.

The app works with no configuration. The `.env` file is optional:

```
# Only if you want higher GitHub rate limits:
GITHUB_TOKEN=ghp_your_token_here
```

### Docker

```bash
docker compose up -d
```

Builds and starts on port 3000.

### One-click setup (Windows)

```bash
.\scripts\setup.bat
```

Checks Node.js, installs deps, creates `.env`, creates directories, verifies build.

## Packages

Tagged releases publish to GitHub with source archives and a `SHA256SUMS` file. The Docker image is published to GitHub Container Registry.

```bash
docker build -t repo-analyzer .
docker run -p 3000:3000 -e GITHUB_TOKEN=ghp_... repo-analyzer
```

## Usage

### Report sections

| Section | What it shows |
|---------|---------------|
| Summary | Structured overview with difficulty badge, key features, quick stats |
| Quality Scores | 6 circular gauges with detailed breakdowns |
| Tech Stack | Languages with %, frameworks, databases, tools |
| Architecture | Detected patterns and plain-English description |
| Code Complexity | File/language breakdown, avg file size, nesting depth |
| Documentation | Green/red checklist across 10 README sections |
| Health | Stars, forks, contributors, recency, CI/CD, bus factor |
| Code Smells | Color-coded issues (critical / warning / info) |
| Suggestions | Prioritized, actionable recommendations |
| Onboarding Guide | Auto-generated contributor guide |

### Export, compare, direct URLs

- Click **Export Markdown** to download the report as `.md`.
- Navigate to `/compare` for side-by-side repo comparison.
- Access any report at `/report/owner:name` (e.g., `/report/facebook:react`).

## Architecture

```
  ┌──────────┐     ┌───────────────────┐     ┌──────────────────┐
  │ Browser   │     │ Next.js API Route │     │   GitHub API     │
  │ (React)   │────▶│ /api/analyze      │────▶│ (metadata, tree, │
  │           │     │                   │     │  readme, langs)  │
  └──────────┘     └───────────────────┘     └──────────────────┘
                           │                           │
                           │                           │
                           ▼                           ▼
                    ┌──────────────────┐     ┌──────────────────┐
                    │  AI Pipeline     │     │  Scored Metrics  │
                    │  (summarizer,    │     │  (complexity,    │
                    │   detector,      │◀────│   docs, health,  │
                    │   scorer, RL)    │     │   code smells)   │
                    └──────────────────┘     └──────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ Analysis Report  │
                    │ (scores, stack,  │
                    │  smells, guide)  │
                    └──────────────────┘
```

Three layers: Browser sends a URL → Next.js API route fans out to GitHub API (metadata, file tree, README, languages) and the AI pipeline in parallel → results merge into a scored report. The default AI runs entirely in-process (TextRank, heuristic detectors, Q-learning) — zero network calls, zero cost. An `AIProvider` interface lets you swap in OpenAI, Gemini, or Groq.

Every output is validated before returning; on failure the system corrects, logs, and retries with relaxed → aggressive → minimal strategies. All scores include a `breakdown` field — no black box.

### Local AI modules

- **TextRank Summarizer** — Cosine-similarity matrix between sentences, PageRank (30 iterations, d=0.85), returns top 30% of sentences.
- **Tech Stack Detector** — Matches file names, directories, dependencies, README content, and topics against 60+ technology patterns with confidence weights.
- **Architecture Analyzer** — Scans directory structure for known patterns (`packages/` → Monorepo, `services/` → Microservices, `controllers/` → MVC).
- **Code Smell Detector** — 10 independent rule checks, each returning a severity level.
- **Quality Scorer** — 5 weighted dimensions (Code Quality 25%, Documentation 20%, Maintainability 20%, Community Health 20%, Security 15%).
- **Self-Healing Layer** — Validate → correct → retry (up to 3×) → track. Component health logged and exposed via stats API.
- **Reinforcement Learning** — Q-learning (27-state, 10-action) adjusts 5 scoring weights. ε-greedy exploration, mini-batch training, disk-persisted Q-table.

### Batch analysis

```bash
npm run worker -- https://github.com/facebook/react
npm run train
npm run train:compact
npm run evaluate:edges
```

Results saved as JSON in `analysis-results/`. Pipeline supports clone-based fallback when GitHub API is unavailable.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` | — | GitHub token (5,000/hr vs 60/hr unauthenticated) |
| `OPENAI_API_KEY` | — | If set, uses OpenAI instead of local model |
| `GEMINI_API_KEY` | — | Takes priority over OpenAI |
| `GROQ_API_KEY` | — | Fallback if Gemini is unavailable |

The app works with **zero configuration**. Setting `GITHUB_TOKEN` is recommended.

## Testing

```bash
npm run lint       # ESLint
npm run build      # TypeScript check + production build
npx tsc --noEmit   # Type-check only
```

## Project Structure

```
src/
  pages/       Next.js pages and API routes
  components/  React components
  services/    GitHub API client, AI provider selector, pipeline
  models/      Local AI modules (summarizer, scorer, RL, etc.)
  types/       TypeScript interfaces
  utils/       Helpers
  styles/      Global CSS
workers/       Batch analysis and training scripts
config/        Repo URL mappings, edge-case definitions
scripts/       setup.bat
model-checkpoints/  Persisted Q-table
```

## Extending

### Add a technology pattern

```typescript
// src/models/knowledge.ts
{ name: 'Svelte', category: 'framework', patterns: ['svelte', 'sveltekit'], confidence: 85 }
```

### Add a code smell rule

```typescript
// src/models/smellDetector.ts
{
  id: 'no-codeowners',
  severity: 'info',
  category: 'DevOps',
  title: 'Missing CODEOWNERS',
  description: 'No CODEOWNERS file found.',
  check: (input) => !input.fileTree.some(f => f.path === 'CODEOWNERS'),
}
```

### Swap the AI provider

```typescript
class MyProvider implements AIProvider {
  async analyze(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    // Your analysis
  }
}
```

Then register it in `src/services/ai.ts`.

## Status

**Active** — The local AI pipeline, self-healing, and RL systems are fully functional. Cloud AI integrations (OpenAI, Gemini, Groq) are available but rate-limited.

## Support

Use GitHub Issues for bug reports and feature requests.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -m 'Add my feature'`).
4. Push to the branch (`git push origin feature/my-feature`).
5. Open a Pull Request.

All PRs must pass: `npx tsc --noEmit`, `npm run build`, `npm run lint`.

See the generated **Onboarding Guide** in the app for more details (it analyzes itself too).

## License

MIT — use it freely for anything.
