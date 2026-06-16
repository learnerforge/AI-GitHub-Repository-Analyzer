# Development Guide

## Prerequisites

- Python 3.11+
- GitHub token (optional but recommended)

## Setup

```bash
git clone https://github.com/learnerforge/AI-GitHub-Repository-Analyzer.git
cd AI-GitHub-Repository-Analyzer
pip install -r requirements.txt
cp .env.example .env  # optional: add your GITHUB_TOKEN
```

## Running

```bash
uvicorn backend.main:app --port 3000 --reload
```

The `--reload` flag enables hot-reload on code changes.

## Project layout

```
backend/
  main.py             # FastAPI app, route mounting, CORS
  config.py           # Paths and env vars (loads .env)
  schemas.py          # Pydantic models for type safety
  api/routes.py       # All REST endpoints
  services/
    analyzer.py       # Main orchestrator, report assembly
    github.py         # GitHub API client
  models/
    local_ai.py       # Default AI provider, coordinates sub-modules
    readme_processor.py  # Markdown cleaning, feature extraction
    deep_readme.py       # Structure analysis, per-section scoring
    md_compiler.py       # Markdown to HTML compilation
    summarizer.py        # TextRank extractive summarization
    text_analyzer.py     # Sentence splitting, keyword extraction
    technologies.py      # Language/framework detection
    advanced_signals.py  # Personality, completeness, risk scoring
    smell_detector.py    # Code smell rule checks
    quality_scorer.py    # Weighted quality scoring with training
    reinforcement.py     # Q-learning engine
    self_healing.py      # Validation and retry logic
    knowledge.py         # Technology pattern database
    persistence.py       # Data persistence helpers
frontend/
  index.html          # Single-page application
```

## Code style

The project uses `ruff` for linting:

```bash
ruff check backend/
```

Run tests with:

```bash
pytest
```

## Common tasks

### Add a technology pattern

Add an entry to `backend/models/knowledge.py`:

```python
{'name': 'Svelte', 'category': 'framework', 'patterns': ['svelte', 'sveltekit'], 'extensions': ['.svelte']}
```

### Add a code smell rule

Add a dict to the `SMELL_RULES` list in `backend/models/smell_detector.py`:

```python
{
    'id': 'no-codeowners',
    'severity': 'info',
    'category': 'DevOps',
    'title': 'Missing CODEOWNERS',
    'description': 'No CODEOWNERS file found.',
    'check': lambda inp: not any(f.get('name') == 'CODEOWNERS' for f in (inp.get('fileTree') or [])),
}
```

### Modify scoring weights

Edit `PARAM_DEFS` in `backend/models/quality_scorer.py`. Each param has name, default, min, max, and training deltas.

### Retrain the RL model

```bash
python workers/compact_train.py
```

Or with full training data:

```bash
python workers/train.py
```

### Run batch analysis

```bash
python workers/worker.py https://github.com/psf/requests
```

## Environment

The `.env` file is loaded automatically by `config.py` via `python-dotenv`. No manual sourcing needed.

## Docker

```bash
docker compose up -d
```

Builds and runs on port 3000 with a `data/` volume.
