# Scoring Methodology

The quality score is a weighted composite of 5 dimensions, each scored 0-100. Default weights are trainable via the RL system.

## Score dimensions

| Dimension | Default Weight | What it measures |
|-----------|---------------|------------------|
| Code Quality | 25% | Language diversity, file count, file size, directory structure |
| Documentation | 20% | README presence, length, section coverage, contributing/license/API docs |
| Maintainability | 20% | Language count, file count, avg file size, total lines of code |
| Community Health | 20% | Stars, forks, contributors, recent activity, CI, tests |
| Security | 15% | Lock files, CI/CD, tests, license file |

## Documentation scoring

The README score (0-100) is calculated as:

| Condition | Points |
|-----------|--------|
| README length > 500 chars | +30 |
| Has `## ` headings | +20 |
| Has installation section | +15 |
| Has usage/example section | +15 |
| Has API docs or config section | +10 |
| Has license or contributing section | +10 |

**Max: 100**

### Section coverage (10 sections)

| Section | Detection Method |
|---------|-----------------|
| Description | README length > 50 |
| Installation | "install" keyword or >= 2 headings |
| Usage | "usage"/"example" keyword or >= 3 headings |
| API Documentation | "api" keyword or >= 4 headings |
| Configuration | "config" keyword or >= 5 headings |
| Contributing | "contributing" keyword or CONTRIBUTING.md file |
| License | "license" keyword or LICENSE file |
| Code of Conduct | "code of conduct" keyword or CODE_OF_CONDUCT.md file |
| Changelog | "changelog" keyword or CHANGELOG.md file |
| Tests | "test" keyword or tests directory |

## Overall score

```
overall = w_codeQuality * codeQuality
        + w_docs * documentation
        + w_maintainability * maintainability
        + w_community * community
        + w_security * security
        + bonus_adjustment
```

Weights are adjustable by the RL system based on repo characteristics (27 state features → 9 actions).

## Scoring features vs actual analysis

The system performs **metadata-only analysis**. It never:
- Compiles or runs source code
- Reads file contents beyond dependency manifests
- Executes AI models that require GPU
- Makes external API calls (except GitHub)

All detection is based on: file names, directory structure, dependency file strings, README text, and GitHub metadata (topics, stars, etc.).
