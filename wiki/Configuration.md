# Configuration

All configuration is via environment variables in `.env`.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` | — | GitHub personal access token (5,000 requests/hr vs 60/hr unauthenticated) |
| `GITHUB_TOKEN_BACKUP` | — | Fallback when primary token is rate-limited |
| `GEMINI_API_KEY` | — | Gemini AI provider key (recommended) |
| `GROQ_API_KEY` | — | Groq AI provider key (alternative) |
| `OPENAI_API_KEY` | — | OpenAI AI provider key (fallback) |
| `AI_PROVIDER` | `localai` | Active AI provider: `localai`, `gemini`, `groq`, `openai` |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model when using Gemini provider |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model when using Groq provider |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model when using OpenAI provider |
| `WORKER_PORT` | `3001` | Port for worker process |

## Minimal config

The app works with **zero configuration**. Without `GITHUB_TOKEN`, you get 60 unauthenticated GitHub API requests per hour.

```
# .env (optional)
GITHUB_TOKEN=ghp_your_token_here
```

## AI providers

The default `localai` provider runs entirely in-process with no external dependencies. It uses:

- **TextRank** for summarization (cosine similarity + PageRank)
- **Heuristic rules** for tech detection, architecture, code smells
- **Custom Q-learning** for scoring weight tuning

To use a cloud AI provider, set the corresponding API key and `AI_PROVIDER`:

```
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
```

## Data directories

The app creates these directories under `data/`:

| Directory | Purpose |
|-----------|---------|
| `data/results/` | Analysis report JSON files |
| `data/checkpoints/` | RL Q-table checkpoints |
| `data/training/` | Training data and logs |
| `data/logs/` | Component health and error logs |
