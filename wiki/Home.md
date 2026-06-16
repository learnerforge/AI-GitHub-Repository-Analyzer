# AI GitHub Repository Analyzer

Paste any GitHub URL, get back an instant analysis: tech stack, code quality, documentation health, improvement suggestions, and an auto-generated contributor guide.

## What it does

The analyzer fetches repository metadata via the GitHub API, runs a deterministic AI pipeline (TextRank summarizer, tech stack detector, architecture analyzer, code smell detector, quality scorer, self-healing layer, RL parameter tuning), and returns a scored report with clear breakdowns.

## Quick start

```bash
pip install -r requirements.txt
uvicorn backend.main:app --port 3000
```

Open http://localhost:3000, paste a URL, click Analyze.

## Key features

- **Deterministic scoring** — 6 quality dimensions with transparent breakdowns
- **Tech stack detection** — 147+ patterns across languages, frameworks, databases, tools
- **Architecture classification** — Monorepo, Microservices, MVC, Clean Architecture, Serverless
- **Deep README analysis** — Per-section scoring, code blocks, tables, tone, readability
- **Code smell detection** — 10 rule checks
- **Self-healing pipeline** — Automatic retry with adapted strategies
- **Reinforcement learning** — Q-learning engine for scoring weight tuning
- **Search & compare** — Cross-repo comparison and report search

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.11+, FastAPI 0.115 |
| Frontend | Single-page HTML/CSS/JS (no framework) |
| AI Pipeline | TextRank, heuristic detectors, scikit-learn |
| Reinforcement Learning | Custom Q-learning (NumPy) |
| Markdown | Custom compiler (no external deps) |

## Project structure

```
backend/
  main.py          FastAPI app entry point
  config.py        Environment and path config
  schemas.py       Pydantic models
  api/routes.py    REST endpoints
  services/
    analyzer.py    Analysis orchestrator
    github.py      GitHub API client
  models/
    local_ai.py      AI provider orchestrator
    readme_processor.py  README extraction
    deep_readme.py      Section quality analysis
    md_compiler.py      Markdown-to-HTML
    summarizer.py       TextRank
    text_analyzer.py    NLP utilities
    technologies.py     Tech detection
    advanced_signals.py Scoring signals
    smell_detector.py   Code smells
    quality_scorer.py   Quality scoring
    reinforcement.py    Q-learning
    knowledge.py        Tech patterns
frontend/
  index.html       Single-page UI
workers/           Batch scripts
data/              Checkpoints and results
```
