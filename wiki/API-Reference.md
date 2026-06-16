# API Reference

All endpoints are served by `uvicorn backend.main:app --port 3000`.

## Analyze a repository

```
POST /api/analyze
Content-Type: application/json

{"url": "https://github.com/psf/requests"}
```

**Response**: Full analysis report as JSON (see Report Schema below).

## List reports

```
GET /api/reports?limit=50&offset=0
```

Returns paginated recent analyses, ordered by most recent first.

## Get a specific report

```
GET /api/report/{repo_id}
```

`repo_id` is `owner/name` (e.g., `psf/requests`).

## Search reports

```
GET /api/reports/search?q=requests&limit=20
```

Searches by repo name, owner, topics, summary, description, and tech stack terms.

## Compare two reports

```
POST /api/compare
Content-Type: application/json

{"id1": "psf/requests", "id2": "psf/urllib3"}
```

Returns a side-by-side comparison of two analyses.

## Get health stats

```
GET /api/stats
```

Returns system health: total analyses, average scores, component status, RL training info.

## Train with feedback

```
POST /api/train/feedback
Content-Type: application/json

{"repoId": "psf/requests", "rating": 0.8}
```

Provides a rating (0.0 to 1.0) for a previous analysis to tune the RL system.

## Frontend

```
GET /
```

Serves the single-page frontend (`frontend/index.html`).

## Static assets

```
GET /static/{path}
```

Serves files from the `frontend/` directory.

## Favicon

```
GET /favicon.ico
```

Returns the SVG favicon.

---

## Report Schema

```json
{
  "id": "owner/repo",
  "repoUrl": "https://github.com/owner/repo",
  "repoName": "repo",
  "owner": "owner",
  "topics": ["python", "http"],
  "summary": "Structured text summary...",
  "processedReadme": {
    "overview": "...",
    "features": ["...", "..."],
    "difficulty": "Intermediate",
    "headings": [...],
    "hasInstallSection": true,
    "hasUsageSection": true,
    "hasApiSection": false,
    "techKeywords": ["python", "requests"]
  },
  "techStack": {
    "languages": [{"name": "Python", "percentage": 100}],
    "frameworks": [],
    "databases": [],
    "tools": [],
    "infrastructure": []
  },
  "architecture": {
    "pattern": "Monorepo",
    "details": "..."
  },
  "complexity": {
    "overall": 45,
    "fileCount": 120,
    "averageFileSize": 48,
    "deepestNesting": 4,
    "languageBreakdown": [...],
    "testFileCount": 8,
    "testCoverageEstimate": 6
  },
  "docsQuality": {
    "readmeScore": 75,
    "readmeLength": 2850,
    "sectionCount": 7,
    "sectionCoverage": [...],
    "suggestions": [...]
  },
  "health": {
    "overall": 85,
    "stars": 63200,
    "forks": 11600,
    "watchers": 1850,
    "openIssues": 140,
    "lastCommitDays": 12,
    "contributorCount": 780,
    "hasCI": true,
    "hasTests": true
  },
  "codeSmells": [...],
  "suggestions": [...],
  "onboardingGuide": "Generated contributor guide...",
  "qualityScores": {
    "overall": 82,
    "codeQuality": 75,
    "documentation": 68,
    "maintainability": 80,
    "communityHealth": 95,
    "security": 70,
    "breakdown": {...}
  },
  "deepReadme": {
    "sections": [...],
    "codeBlocks": [...],
    "tone": "neutral",
    "readability": 45.2,
    "license": {"identified": true, "license": "MIT"},
    ...
  },
  "compiledReadme": "<h1>Repo</h1><p>...</p>",
  "advancedSignals": {
    "personality": "Library",
    "completeness": {...},
    "abandonmentRisk": "Low Risk",
    ...
  },
  "generatedAt": "2026-06-16T17:28:00+00:00",
  "status": "completed"
}
```
