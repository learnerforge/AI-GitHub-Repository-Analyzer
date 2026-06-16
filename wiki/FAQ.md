# FAQ

## General

### What makes this different from GitHub's own Insights?

GitHub Insights shows raw metrics (stars, forks, commit frequency). This analyzer adds:
- Quality scoring across 6 dimensions with transparent breakdowns
- Tech stack detection (languages, frameworks, databases, tools)
- Architecture pattern classification
- Documentation completeness audit (10 sections)
- Code smell detection (10 rule checks)
- Auto-generated contributor onboarding guide
- Deterministic, reproducible scoring (same repo always gets same score)

### Does it run the code?

No. The analyzer is metadata-only — it reads file names, directory structure, dependency file contents, and the README. It never compiles, executes, or statically analyzes source code.

### Can I use it on private repos?

Yes, if you provide a GitHub token that has access to those private repos. Set `GITHUB_TOKEN` in your `.env` file.

### How long does an analysis take?

Typically 5-15 seconds for most repos. Large repos (10,000+ files) may take 20-30 seconds. The GitHub API call for the file tree is usually the bottleneck.

## Scoring

### How is the overall score calculated?

A weighted composite of 5 dimensions: Code Quality (25%), Documentation (20%), Maintainability (20%), Community Health (20%), Security (15%). Weights are adjustable via the RL system.

### Why did my repo get a low score?

Common reasons:
- No README or very short README
- No documentation sections (installation, usage, contributing)
- Single contributor (bus factor = 1)
- No tests, no CI
- No license file
- Flat directory structure (all files in root)

### Can I tune the scoring?

Yes. The RL system adjusts weights based on repo characteristics. You can also manually retrain with `python workers/compact_train.py`.

## Technical

### What Python version is required?

Python 3.11 or later.

### What if I don't have a GitHub token?

The app works with 60 unauthenticated requests per hour from the GitHub API. For regular use, get a free token at https://github.com/settings/tokens.

### Can I use OpenAI/Gemini instead of the local AI?

Yes. Set the corresponding API key and `AI_PROVIDER` in `.env`. The local AI is the default and works without any configuration.

### Does the local AI require a GPU?

No. The local AI uses TextRank (cosine similarity + PageRank), heuristic rules, and NumPy. It runs entirely on CPU.

## Troubleshooting

### The app crashes on startup

Check that:
- Python 3.11+ is installed
- Dependencies are installed: `pip install -r requirements.txt`
- Port 3000 is not in use
- `.env` file doesn't have syntax errors

### The analysis fails with a timeout

Large repos may take longer. Try again. If it persists, check your GitHub token rate limit.

### The analysis returns empty results

Check that:
- The URL is a valid public GitHub repository
- The repo has a README (some repos have none)
- Your GitHub token hasn't expired

### Scores seem wrong

Scores are deterministic based on the repo metadata at the time of analysis. If the repo structure changes (e.g., README is updated), re-analyze to get updated scores.
