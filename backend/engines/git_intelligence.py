from __future__ import annotations
from typing import Any
import re
from collections import Counter
from datetime import datetime, timezone
from . import Engine, register


def _parse_commit_data(commits: list[dict]) -> dict:
    if not commits:
        return {}

    authors = Counter()
    dates = []
    messages = []

    for c in commits:
        author = (c.get('commit') or {}).get('author') or {}
        author_name = author.get('name', 'Unknown')
        authors[author_name] += 1
        date_str = author.get('date', '')
        if date_str:
            try:
                dates.append(datetime.fromisoformat(date_str.replace('Z', '+00:00')))
            except (ValueError, TypeError):
                pass
        msg = (c.get('commit') or {}).get('message', '')
        messages.append(msg)

    total = len(commits)
    unique_authors = len(authors)

    top_author, top_count = authors.most_common(1)[0] if authors else ('', 0)
    bus_factor = 0
    if total > 0 and top_count > 0:
        cumulative = 0
        for i, (_, count) in enumerate(authors.most_common()):
            cumulative += count
            if cumulative >= total * 0.5:
                bus_factor = i + 1
                break

    avg_commits_per_author = round(total / unique_authors, 1) if unique_authors else 0
    top_author_share = round(top_count / total * 100, 1) if total else 0

    quality_indicators = {
        'conventional_commits': sum(1 for m in messages if re.match(r'^(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert)(\(.+\))?:', m)),
        'merge_commits': sum(1 for m in messages if m.startswith('Merge ')),
        'short_messages': sum(1 for m in messages if len(m.strip()) < 15 and not m.startswith('Merge ')),
    }

    dates_sorted = sorted(dates)
    first_commit = dates_sorted[0].isoformat() if dates_sorted else ''
    last_commit = dates_sorted[-1].isoformat() if dates_sorted else ''
    span_days = (dates_sorted[-1] - dates_sorted[0]).days if len(dates_sorted) >= 2 else 0

    commit_frequency = round(total / max(1, span_days), 2) if span_days > 0 else 0

    return {
        'totalCommits': total,
        'uniqueAuthors': unique_authors,
        'topAuthor': top_author,
        'topAuthorShare': top_author_share,
        'busFactor': bus_factor,
        'avgCommitsPerAuthor': avg_commits_per_author,
        'commitFrequency': commit_frequency,
        'spanDays': span_days,
        'firstCommit': first_commit,
        'lastCommit': last_commit,
        'quality': quality_indicators,
    }


def _score_git_quality(data: dict) -> tuple[int, list[dict]]:
    findings = []
    score = 70

    if not data:
        return 0, [{'type': 'no_commits', 'message': 'No commit data available', 'severity': 'warning'}]

    total = data['totalCommits']
    unique = data['uniqueAuthors']
    bf = data['busFactor']

    if total >= 100:
        score += 10
        findings.append({'type': 'many_commits', 'message': f'{total} commits — healthy activity', 'severity': 'info', 'score': 10})
    elif total >= 20:
        score += 5
    else:
        score -= 10
        findings.append({'type': 'few_commits', 'message': f'Only {total} commits — limited activity', 'severity': 'warning'})

    if unique >= 5:
        score += 10
        findings.append({'type': 'diverse_team', 'message': f'{unique} contributors — good distribution', 'severity': 'info', 'score': 10})
    elif unique >= 3:
        score += 5
    elif unique <= 1:
        score -= 15
        findings.append({'type': 'solo_project', 'message': 'Single contributor — high bus factor risk', 'severity': 'warning'})

    if bf <= 1:
        score -= 10
        findings.append({'type': 'high_bus_factor', 'message': f'Bus factor = {bf} — one person holds 50%+ of commits', 'severity': 'critical'})
    elif bf <= 2:
        findings.append({'type': 'moderate_bus_factor', 'message': f'Bus factor = {bf}', 'severity': 'info'})

    q = data.get('quality', {})
    conventional = q.get('conventional_commits', 0)
    ratio = conventional / max(1, total)
    if ratio > 0.5:
        score += 10
        findings.append({'type': 'conventional_commits', 'message': f'{conventional}/{total} commits follow conventional format', 'severity': 'info', 'score': 10})
    elif ratio > 0.2:
        score += 5

    short = q.get('short_messages', 0)
    if short > total * 0.3:
        score -= 5
        findings.append({'type': 'short_messages', 'message': f'{short} commits have poor message quality', 'severity': 'warning'})

    freq = data.get('commitFrequency', 0)
    if freq > 1:
        score += 5
        findings.append({'type': 'frequent_commits', 'message': f'{freq} commits/day — active development', 'severity': 'info'})

    return max(0, min(100, score)), findings


class GitIntelligenceEngine(Engine):
    name = 'git_intelligence'
    description = 'Analyzes commit quality, frequency, contributor distribution, and bus factor'
    version = '1.0.0'

    def analyze(self, repo: dict[str, Any]) -> dict[str, Any]:
        commits = repo.get('commits', [])
        branches = repo.get('branches', {})
        data = _parse_commit_data(commits)
        score, findings = _score_git_quality(data)

        return {
            'score': score,
            'maxScore': 100,
            'findings': findings,
            'details': {
                'commitStats': data,
                'branchCount': branches.get('count', 0) if isinstance(branches, dict) else len(branches) if isinstance(branches, list) else 0,
                'defaultBranch': branches.get('default', '') if isinstance(branches, dict) else '',
            },
        }


register(GitIntelligenceEngine())
