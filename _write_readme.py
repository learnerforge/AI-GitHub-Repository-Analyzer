content = r'''<font face="Times New Roman" size="3">

# *AI GitHub Repository Analyzer*

*Paste any GitHub URL, get back an instant analysis: tech stack, code quality, documentation health, improvement suggestions, and an auto-generated contributor guide. No external AI API required.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)

## *Is this for me?*

### *Who it's for*

- *Developers reviewing open-source projects before adopting them.*
- *Engineering leads evaluating dependencies for code quality and maintenance.*
- *Open-source maintainers who want an objective outside view of their project.*
- *Teams assessing their own repos for documentation gaps, code smells, and health.*

### *The core idea*

*Enter a GitHub repository URL. The analyzer fetches metadata, README, file tree, and languages, then runs a deterministic AI pipeline — summarizer, tech stack detector, architecture analyzer, code smell detector, quality scorer, self-healing layer, and RL parameter tuning. You get scored categories, a clean summary, detected tech stack, architecture patterns, code smells, and improvement suggestions. All in under 30 seconds.*

### *When you'd use this*

- *Evaluating a library before pulling it into your stack.*
- *Running a quarterly health check on your team's repos.*
- *Onboarding a new hire and giving them instant context on your codebase.*
- *Deciding whether a project is maintained enough to contribute to.*

### *What you're probably doing today instead*

- *Scanning README files manually and hoping they cover everything.*
- *Checking GitHub Insights tabs, stars, and commit graphs in separate tabs.*
- *Running `cloc` or `tokei` locally and stitching results together.*
- *Asking a teammate "is that repo any good?" and getting a subjective answer.*

### *Pain points it addresses*

- *Evaluating a repo takes 20+ minutes of clicking through GitHub tabs.*
- *Subjective judgement — two people look at the same repo and disagree.*
- *Documentation quality is hard to quantify without reading the whole README.*
- *No easy way to compare multiple repos on the same criteria.*

### *What changes in your architecture*

- *One URL input replaces 5+ GitHub tabs and manual analysis.*
- *The scoring model is deterministic and reproducible — same repo, same score.*
- *Reports can be exported, compared, and revisited later.*
- *The RL system gradually tunes scoring weights based on real-world usage.*

### *When not to use it*

- *The repo is a single-file script with no README.*
- *You need deep static analysis (type errors, dead code, vulnerability scanning).*
- *The repo is private and you can't provide a GitHub token with access.*

### *How it works*

1. *Fetch repo metadata, file tree, languages, and README via the GitHub API (5 calls per analysis).*
2. *Run the input through a pipeline of specialized modules — all deterministic rules and heuristics, no black-box ML.*
3. *A self-healing layer validates every output and retries with adapted strategies on failure.*
4. *An optional RL system tunes scoring weights based on repo characteristics.*

### *Limitations*

*The analysis is based on metadata, file structure, and README content — it never compiles or runs the code. The local model uses TextRank (extractive, not generative) and heuristic scoring. For generative summaries or deep code understanding, you can optionally plug in OpenAI, Gemini, or Groq.*

## *Features*

- ***Deterministic scoring** — 6 quality dimensions with weighted, reproducible scores and transparent breakdowns.*
- ***Tech stack detection** — Languages, frameworks, databases, tools, infrastructure from files, README, dependencies, and topics.*
- ***Architecture classification** — Detects Monorepo, Microservices, MVC, Clean Architecture, Serverless, and more from directory structure.*
- ***Documentation audit** — Scores README completeness across 10 sections, checks for contributing guide, license, changelog.*
- ***Code smell detection** — 10 checks (no README, no tests, no CI, single contributor, stale dependencies, poor structure, etc.).*
- ***Self-healing** — Every output is validated, corrected on failure, and retried with adapted strategies (relaxed → aggressive → minimal).*
- ***Reinforcement learning** — Q-learning engine (27 state features, 10 actions) adjusts 5 scoring weights based on repo characteristics. Q-table persists to disk.*
- ***Deep README analysis** — Per-section quality scoring, code block detection, table/image/badge counting, tone classification, readability scoring.*
- ***Markdown compilation** — Built-in markdown-to-HTML renders READMEs directly in the browser.*
- ***Search & compare** — Search past analyses. Compare two repos side by side.*

## *Quick Example*

```
Input: https://github.com/facebook/react

Overall:      82/100
Code Quality: 75/100
Documentation:68/100
Maintainability:80/100
Community:    95/100
Security:     70/100
```

*Plus: detected tech stack, architecture, code smells, improvement suggestions, and an onboarding guide.*

## *Architecture*

```mermaid
%%{init: {'theme': 'default', 'themeVariables': { 'fontFamily': 'Times New Roman' }}}%%
flowchart TD
    classDef browser font-family:'Times New Roman',font-style:italic,font-size:14px,fill:#e1f5fe,stroke:#01579b
    classDef server font-family:'Georgia',font-style:normal,font-size:14px,fill:#fff3e0,stroke:#e65100
    classDef github font-family:'Courier New',font-style:normal,font-size:13px,fill:#f3e5f5,stroke:#4a148c
    classDef pipeline font-family:'Times New Roman',font-style:italic,font-size:13px,fill:#e8f5e9,stroke:#1b5e20
    classDef metrics font-family:'Verdana',font-style:normal,font-size:13px,fill:#fce4ec,stroke:#880e4f
    classDef report font-family:'Times New Roman',font-weight:bold,font-size:14px,fill:#fff8e1,stroke:#f57f17

    B["Browser<br/>(HTML/JS)"]
    F["FastAPI Server<br/>/api/analyze"]
    G["GitHub API<br/>(metadata, tree,<br/>readme, langs)"]
    A["AI Pipeline<br/>(summarizer,<br/>detector,<br/>scorer, RL)"]
    M["Scored Metrics<br/>(complexity,<br/>docs, health,<br/>code smells)"]
    R["Analysis Report<br/>(scores, stack,<br/>smells, guide)"]

    B -->|HTTP POST| F
    F -->|API calls| G
    F --> A
    G --> M
    M --> A
    A --> R
    F --> R

    class B browser
    class F server
    class G github
    class A pipeline
    class M metrics
    class R report
```

```mermaid
%%{init: {'theme': 'default', 'themeVariables': { 'fontFamily': 'Georgia' }}}%%
flowchart LR
    classDef input font-family:'Courier New',font-style:italic,font-size:13px,fill:#e3f2fd,stroke:#1565c0
    classDef process font-family:'Times New Roman',font-style:italic,font-size:13px,fill:#f3e5f5,stroke:#6a1b9a
    classDef output font-family:'Georgia',font-style:normal,font-size:14px,fill:#e8f5e9,stroke:#2e7d32

    I["GitHub URL"]
    F["Fetch Metadata"]
    P["AI Pipeline"]
    S["Score & Validate"]
    O["Analysis Report"]

    I --> F --> P --> S --> O

    class I input
    class F,P,S process
    class O output
```

*A single `uvicorn backend.main:app --port 3000` process serves everything — the API at /api/*, the frontend at /, and static assets at /static/. No separate frontend server or Node.js runtime required.*

*The browser sends a URL → FastAPI fans out to GitHub API (metadata, file tree, README, languages) and the AI pipeline in parallel → results merge into a scored report. The default AI runs entirely in-process (TextRank, heuristic detectors, Q-learning) — zero network calls, zero cost. An `AIProvider` interface lets you swap in OpenAI, Gemini, or Groq.*

*Every output is validated before returning; on failure the system corrects, logs, and retries with relaxed → aggressive → minimal strategies. All scores include a `breakdown` field — no black box.*

### *Processing modules*

- ***README Processor** — Cleans markdown, extracts features, detects difficulty, extracts tech keywords and overview.*
- ***Deep README Analyzer** — Per-section analysis: code blocks, tables, images, badges, links, readability, tone, installation/usage/api/contributing quality.*
- ***TextRank Summarizer** — Cosine-similarity matrix between sentences, PageRank (30 iterations, d=0.85), returns top 30% of sentences.*
- ***Tech Stack Detector** — Matches file names, directories, dependencies, README content, and topics against 147+ technology patterns.*
- ***Architecture Analyzer** — Scans directory structure for known patterns.*
- ***Code Smell Detector** — 10 independent rule checks, each returning a severity level.*
- ***Quality Scorer** — 5 weighted dimensions (Code Quality 25%, Documentation 20%, Maintainability 20%, Community Health 20%, Security 15%).*
- ***Self-Healing Layer** — Validate → correct → retry (up to 3×) → track. Component health logged and exposed via stats API.*
- ***Reinforcement Learning** — Q-learning (27-state, 10-action) adjusts 5 scoring weights. ε-greedy exploration, mini-batch training, disk-persisted Q-table.*

### *Batch analysis*

```bash
python workers/worker.py https://github.com/facebook/react
python workers/train.py
python workers/compact_train.py
python workers/evaluate_edges.py
```

*Results saved as JSON in `data/results/`. Pipeline supports clone-based fallback when GitHub API is unavailable.*

## *Setup*

### *Prerequisites*

- *Python 3.11+*
- *A [GitHub token](https://github.com/settings/tokens) (optional — without one you get 60 unauthenticated requests/hour)*

### *Quick start*

```bash
git clone https://github.com/learnerforge/AI-GitHub-Repository-Analyzer.git
cd AI-GitHub-Repository-Analyzer
pip install -r requirements.txt
uvicorn backend.main:app --port 3000
```

*Open http://localhost:3000, paste a URL, click Analyze. That's it.*

*The app works with no configuration. The `.env` file is optional:*

```
# Only if you want higher GitHub rate limits:
GITHUB_TOKEN=ghp_your_token_here
```

### *Docker*

```bash
docker compose up -d
```

*Builds and starts on port 3000.*

## *Usage*

### *Report sections*

| Section | What it shows |
|---------|---------------|
| Summary | Structured overview with difficulty badge, key features, quick stats |
| Quality Scores | 6 circular gauges with detailed breakdowns |
| Tech Stack | Languages with %, frameworks, databases, tools |
| Architecture | Detected patterns and plain-English description |
| Code Complexity | File/language breakdown, avg file size, nesting depth |
| Deep README Analysis | Section scoring, code blocks, tables, images, tone, readability |
| Documentation | Green/red checklist across 10 README sections |
| Health | Stars, forks, contributors, recency, CI/CD, bus factor |
| Code Smells | Color-coded issues (critical / warning / info) |
| Suggestions | Prioritized, actionable recommendations |
| Onboarding Guide | Auto-generated contributor guide |
| Compiled README | Rendered markdown with syntax-highlighted code blocks |

### *Export, compare, direct URLs*

- *Click **Export Markdown** to download the report as `.md`.*
- *Navigate to `/compare` for side-by-side repo comparison.*
- *Access any report at `/report/owner:name` (e.g., `/report/facebook:react`).*

## *Configuration*

| Variable | Default | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` | — | GitHub token (5,000/hr vs 60/hr unauthenticated) |
| `OPENAI_API_KEY` | — | Fallback AI provider |
| `GEMINI_API_KEY` | — | Recommended AI provider (takes priority) |
| `GROQ_API_KEY` | — | Alternative AI provider |
| `AI_PROVIDER` | `localai` | Which AI provider to use |

*The app works with **zero configuration**. Setting `GITHUB_TOKEN` is recommended.*

## *Testing*

```bash
ruff check backend/
pytest
```

## *Project Structure*

```
backend/
  main.py          FastAPI app entry point
  config.py        Environment and path configuration
  schemas.py       Pydantic models
  api/
    routes.py      REST endpoints (/api/analyze, /search, /compare, etc.)
  services/
    analyzer.py    Main analysis orchestrator
    github.py      GitHub API client
  models/
    local_ai.py      AI provider orchestrator
    readme_processor.py  README cleaning and feature extraction
    deep_readme.py      Per-section README quality analysis
    md_compiler.py      Markdown-to-HTML compiler
    summarizer.py       TextRank extractive summarization
    text_analyzer.py    NLP utilities (tokenization, keywords, readability)
    technologies.py     Tech stack detection
    advanced_signals.py Personality, completeness, risk, learning value
    smell_detector.py   Code smell rules
    quality_scorer.py   Trainable quality scoring
    reinforcement.py    Q-learning engine
    knowledge.py        147-entry technology knowledge base
frontend/
  index.html       Single-page dark-themed UI
workers/           Batch analysis and training scripts
data/              Checkpoints, results, training data
```

## *Extending*

### *Add a technology pattern*

```python
# backend/models/knowledge.py
{'name': 'Svelte', 'category': 'framework', 'patterns': ['svelte', 'sveltekit'], 'extensions': ['.svelte']}
```

### *Add a code smell rule*

```python
# backend/models/smell_detector.py
{
    'id': 'no-codeowners',
    'severity': 'info',
    'category': 'DevOps',
    'title': 'Missing CODEOWNERS',
    'description': 'No CODEOWNERS file found.',
    'check': lambda inp: not any(f.get('name') == 'CODEOWNERS' for f in (inp.get('fileTree') or [])),
}
```

### *Swap the AI provider*

```python
class MyProvider:
    async def analyze(self, input_data: dict) -> dict:
        # Your analysis
        pass
```

*Then register it in `backend/services/analyzer.py`.*

## *Status*

***Active** — The local AI pipeline, self-healing, and RL systems are fully functional. Cloud AI integrations (OpenAI, Gemini, Groq) are available but rate-limited.*

## *Support*

*Use GitHub Issues for bug reports and feature requests. See the [changelog](CHANGELOG.md) for version history.*

## *Contributing*

*Please read [CONTRIBUTING.md](CONTRIBUTING.md) and review our [Code of Conduct](CODE_OF_CONDUCT.md) before submitting.*

1. *Fork the repository.*
2. *Create a feature branch (`git checkout -b feature/my-feature`).*
3. *Commit your changes (`git commit -m 'Add my feature'`).*
4. *Push to the branch (`git push origin feature/my-feature`).*
5. *Open a Pull Request.*

*All PRs must pass: `ruff check backend/` and `pytest`.*

*See the generated **Onboarding Guide** in the app for more details (it analyzes itself too).*

## *License*

*MIT — use it freely for anything.*

</font>
'''

with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print('README.md written')
