# Architecture

A single `uvicorn backend.main:app --port 3000` process serves everything — API, frontend, and static assets. No separate frontend server or Node.js runtime required.

```
  ┌──────────┐     ┌───────────────────┐     ┌──────────────────┐
  │ Browser   │     │  FastAPI Server   │     │   GitHub API     │
  │ (HTML/JS) │────▶│  /api/analyze     │────▶│ (metadata, tree, │
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

## Request flow

1. Browser sends GitHub URL to `POST /api/analyze`
2. FastAPI fans out to GitHub API (metadata, file tree via Git Trees API, README, languages) and AI pipeline in parallel
3. Results merge into a scored report
4. Report saved to `data/results/` as JSON
5. Frontend renders the report

## AI Pipeline modules

All modules run in-process — zero network calls, zero API cost.

### README Processor (`readme_processor.py`)
- Cleans markdown (strips HTML, images, URLs, code blocks)
- Extracts features from bullet lists
- Detects difficulty level (Beginner/Intermediate/Advanced)
- Extracts tech keywords and overview text

### Deep README Analyzer (`deep_readme.py`)
- Per-section analysis using heading detection
- Counts code blocks (tagged/untagged), tables, images, badges, links
- Scores installation, usage, API docs, and contributing quality
- Classifies tone (formal/casual/academic/neutral)
- Identifies license from text patterns
- Computes structure score and readability

### TextRank Summarizer (`summarizer.py`)
- Cosine-similarity matrix between sentences
- PageRank with 30 iterations (d=0.85)
- Returns top 30% of sentences
- Pure Python implementation (NumPy)

### Tech Stack Detector (`technologies.py`)
- Matches file extensions, directory names, dependency file contents, README text, and topics
- 147+ technology patterns across 5 categories
- Confidence-weighted detection

### Architecture Analyzer (`advanced_signals.py`)
- Scans directory structure for known patterns
- Classifies: Monorepo, Microservices, MVC, Clean Architecture, Serverless, etc.

### Code Smell Detector (`smell_detector.py`)
- 10 independent rule checks with severity levels
- Checks: no README, no tests, no CI, single contributor, stale deps, poor structure

### Quality Scorer (`quality_scorer.py`)
- 5 weighted dimensions with trainable parameters
- 44 trainable parameters
- RL system adjusts weights based on repo characteristics

### Self-Healing Layer (`self_healing.py`)
- Validates every output component
- Retries with adapted strategies: relaxed → aggressive → minimal
- Logs component health, exposed via stats API

### Reinforcement Learning (`reinforcement.py`)
- Q-learning with 27 state features and 9 actions
- Epsilon-greedy exploration
- Mini-batch training with persisted Q-table
- 35,444 Q-values across ~406 states
