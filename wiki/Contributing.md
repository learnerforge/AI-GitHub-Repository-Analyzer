# Contributing

Thanks for your interest in contributing to AI GitHub Repository Analyzer.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Getting Started

1. Fork the repository.
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/AI-GitHub-Repository-Analyzer.git`
3. Set up the development environment (see [Development Guide](Development-Guide)).
4. Create a feature branch: `git checkout -b feature/my-feature`
5. Make your changes.
6. Run linting and tests.
7. Push and open a Pull Request.

## Pull Request Guidelines

- **One change per PR** — Keeps reviews focused and fast.
- **Write tests** — New features should include tests. Bug fixes should add a test that catches the regression.
- **Update docs** — If your change affects usage, configuration, or the API, update the README and relevant Wiki pages.
- **Keep commits clean** — Use meaningful commit messages. Rebase before opening the PR.
- **Pass CI** — All PRs must pass `ruff check backend/` and `pytest`.

## Commit Message Style

```
component: brief description

Optional longer explanation of what and why.
```

Examples:
```
scorer: add trainable parameter for test coverage weight

fixes #42 where repos with high test coverage were under-scored
```

```
readme: strip mermaid code blocks before feature extraction

mermaid diagram lines like "A1[Assessment Tab]" were leaking
into the Key Features card because the fallback extraction path
scanned raw README text without filtering code blocks
```

## Development Workflow

### Finding work

Check the [issues](https://github.com/learnerforge/AI-GitHub-Repository-Analyzer/issues) tab for open bugs and feature requests. Good first issues are tagged.

### Making changes

The project structure is:

- `backend/models/` — Core analysis logic (summarizer, detectors, scorers)
- `backend/services/` — Orchestration (analyzer, GitHub client)
- `backend/api/` — REST endpoints
- `frontend/` — Single-page UI
- `workers/` — Batch analysis and training scripts
- `wiki/` — Documentation

### Testing your changes

```bash
# Lint
ruff check backend/

# Tests
pytest

# Manual test with the app
uvicorn backend.main:app --port 3000
# Open http://localhost:3000 and analyze a repo
```

### Adding a technology

Edit `backend/models/knowledge.py` and add an entry:

```python
{'name': 'TechnologyName', 'category': 'framework', 'patterns': ['keyword'], 'extensions': ['.ext']}
```

### Adding a code smell

Add a rule dict to the `SMELL_RULES` list in `backend/models/smell_detector.py`.

## Review Process

1. Maintainers review the PR within 3-5 business days.
2. Feedback is given directly on the PR.
3. Once approved, a maintainer merges.

## Getting Help

- Open a [GitHub Issue](https://github.com/learnerforge/AI-GitHub-Repository-Analyzer/issues) for questions.
- Check the Wiki for detailed documentation.
