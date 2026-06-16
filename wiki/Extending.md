# Extending the Analyzer

This guide covers how to extend each component of the analyzer.

## Adding a technology pattern

Edit `backend/models/knowledge.py`. The knowledge base has entries by category:

```python
# Languages
{'name': 'Zig', 'category': 'language', 'patterns': ['zig'], 'extensions': ['.zig']},

# Frameworks
{'name': 'Svelte', 'category': 'framework', 'patterns': ['svelte', 'sveltekit'], 'extensions': ['.svelte']},

# Databases
{'name': 'DuckDB', 'category': 'database', 'patterns': ['duckdb'], 'extensions': ['.duckdb']},

# Tools
{'name': 'Pnpm', 'category': 'tool', 'patterns': ['pnpm'], 'files': ['pnpm-lock.yaml']},

# Infrastructure
{'name': 'Terraform', 'category': 'infrastructure', 'patterns': ['terraform'], 'extensions': ['.tf']},
```

The detection logic in `technologies.py` checks:
- File extensions in the repository file tree
- File names for known config/manifest files
- Directory names for project structure clues
- Dependency file contents for package references
- README text for technology mentions
- GitHub topics for tech tags

## Adding a code smell rule

Add a new dict to `SMELL_RULES` in `backend/models/smell_detector.py`. Each rule has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Unique identifier (kebab-case) |
| `severity` | `str` | `critical`, `warning`, or `info` |
| `category` | `str` | Grouping category |
| `title` | `str` | Human-readable title |
| `description` | `str` | Explanation of the issue |
| `check` | `callable` | Function receiving `inp` dict, returns `bool` (True = smell detected) |

The `inp` dict contains:
- `readmeContent` — raw README text
- `fileTree` — recursive file tree with `{name, path, type, size, children}`
- `dependencyFiles` — dict of dependency file path → content
- `languages` — dict of language → bytes
- `topics` — list of GitHub topics

## Modifying the scoring system

The scoring system in `quality_scorer.py` has 44 trainable parameters. To add a new parameter:

1. Add to `PARAM_DEFS`: `(name, default, min, max, deltas)`
2. Add the scoring logic in the relevant `_score_*` function
3. Optionally add an RL action delta in `reinforcement.py`

## Adding a new quality dimension

1. Add a weight param in `PARAM_DEFS` (e.g., `w_performance`)
2. Create `_score_performance()` in `quality_scorer.py`
3. Add to the `total` calculation in `compute_quality_scores()`
4. Add the field to the RL state in `local_ai.py`

## Creating a new AI provider

Implement the `analyze(input_data) -> dict` interface:

```python
class MyProvider:
    async def analyze(self, input_data: dict) -> dict:
        readme = input_data.get('readme', '')
        # ... your analysis logic ...
        return {
            'summary': '...',
            'techStack': {...},
            'architecture': {...},
            'codeSmells': [...],
            'suggestions': [...],
            'onboardingGuide': '...',
            'qualityScores': {...},
            'deepReadme': {...},
            'compiledReadme': '...',
        }
```

Then instantiate it in `analyzer.py` and pass `ai_input` to it.

## Modifying the frontend

The entire frontend is a single HTML file at `frontend/index.html`. To add a new card:

1. Add the card HTML structure in the relevant tab section
2. Add CSS styling in the `<style>` block
3. Add rendering logic in the relevant `render*` JavaScript function
4. The card reads from the report JSON returned by the API

## Adding a new API endpoint

1. Add the route function in `backend/api/routes.py`
2. Add any new schema models in `backend/schemas.py`
3. Mount it in `backend/main.py` if it needs a new prefix

## Training the RL system

```bash
# Compact training (uses existing reports)
python workers/compact_train.py

# Full training pipeline
python workers/train.py

# Evaluate edge cases
python workers/evaluate_edges.py
```
