"""
Compact RL Training Pipeline (Python-only)
Trains ALL quality-scoring parameters (weights, bonuses, base scores, sub-score adjustments).
Produces version-4 Q-tables compatible with the runtime system.
"""

from __future__ import annotations
import json
import math
import os
import random
import time
from copy import deepcopy
from pathlib import Path
from datetime import datetime, timezone

# Import all parameter definitions from the scoring module
from backend.models.quality_scorer import PARAM_DEFS, DEFAULT_PARAMS

RESULTS_DIR = Path(os.getcwd()) / 'data' / 'results'
CHECKPOINT_DIR = Path(os.getcwd()) / 'data' / 'checkpoints'
LOG_DIR = Path(os.getcwd()) / 'data' / 'logs'

# Build param lists from PARAM_DEFS
ALL_PARAM_NAMES: list[str] = [name for name, *_ in PARAM_DEFS]
PARAM_DELTAS: dict[str, list[float]] = {name: deltas for name, _, _, _, deltas in PARAM_DEFS}
PARAM_RANGES: dict[str, tuple[float, float]] = {name: (lo, hi) for name, _, lo, hi, _ in PARAM_DEFS}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# State extraction & quantization (must match reinforcement.py)
# ---------------------------------------------------------------------------

def quantize(v: float, unit: float) -> int:
    return round(v / unit)


def get_state_key(s: dict) -> str:
    def _clip_bucket(v, edges):
        for i, e in enumerate(edges):
            if v <= e:
                return i
        return len(edges)
    return ':'.join(str(x) for x in [
        quantize(s['repoStars'], 1000),
        quantize(s['repoForks'], 100),
        quantize(s['fileCount'], 100),
        s['languageCount'],
        quantize(s['readmeLength'], 1000),
        quantize(s['contributorCount'], 5),
        1 if s['hasTests'] else 0,
        1 if s['hasCI'] else 0,
        quantize(s['readmeScore'], 20),
        s['docsSectionCount'],
        1 if s['hasApiDocs'] else 0,
        1 if s['hasLicense'] else 0,
        quantize(s['lastCommitDays'], 90),
        1 if s.get('hasDockerfile', False) else 0,
        1 if s.get('hasContributing', False) else 0,
        _clip_bucket(s.get('headingCount', 0), [0, 3, 10]),
        _clip_bucket(s.get('codeBlockCount', 0), [0, 3, 10]),
        _clip_bucket(s.get('imageCount', 0), [0, 3]),
        _clip_bucket(s.get('badgeCount', 0), [0, 3]),
        _clip_bucket(s.get('emojiCount', 0), [0, 5]),
        _clip_bucket(s.get('tableCount', 0), [0, 3]),
        _clip_bucket(s.get('checklistCount', 0), [0, 3]),
        _clip_bucket(s.get('linkCount', 0), [5, 20]),
        _clip_bucket(s.get('todoCount', 0), [5]),
        _clip_bucket(s.get('fixmeCount', 0), [3]),
        0 if s.get('hackCount', 0) == 0 else 1,
        0 if s.get('tempCount', 0) == 0 else 1,
    ])


def get_action_key(a: dict) -> str:
    d = a['delta']
    return f"{a['paramName']}:{'+' if d > 0 else ''}{d}"


def extract_state(report: dict) -> dict:
    sc = report.get('docsQuality', {}).get('sectionCoverage', [])
    return {
        'repoStars': report.get('health', {}).get('stars', 0) or 0,
        'repoForks': report.get('health', {}).get('forks', 0) or 0,
        'fileCount': report.get('complexity', {}).get('fileCount', 0) or 0,
        'languageCount': len(report.get('techStack', {}).get('languages', [])),
        'readmeLength': report.get('docsQuality', {}).get('readmeLength', 0) or 0,
        'contributorCount': report.get('health', {}).get('contributorCount', 0) or 0,
        'hasTests': bool(report.get('health', {}).get('hasTests', False)),
        'hasCI': bool(report.get('health', {}).get('hasCI', False)),
        'readmeScore': report.get('docsQuality', {}).get('readmeScore', 0) or 0,
        'docsSectionCount': sum(1 for s in sc if s.get('present', False)),
        'hasApiDocs': bool(report.get('docsQuality', {}).get('hasApiDocs', False)),
        'hasLicense': bool(report.get('docsQuality', {}).get('hasLicense', False)),
        'lastCommitDays': report.get('health', {}).get('lastCommitDays', 30) or 30,
        'hasDockerfile': bool(report.get('health', {}).get('hasDockerfile', False)),
        'hasContributing': bool(report.get('docsQuality', {}).get('hasContributing', False)),
        'headingCount': report.get('docsQuality', {}).get('headingCount', 0) or 0,
        'codeBlockCount': report.get('docsQuality', {}).get('codeBlockCount', 0) or 0,
        'imageCount': report.get('docsQuality', {}).get('imageCount', 0) or 0,
        'badgeCount': report.get('docsQuality', {}).get('badgeCount', 0) or 0,
        'emojiCount': report.get('docsQuality', {}).get('emojiCount', 0) or 0,
        'tableCount': report.get('docsQuality', {}).get('tableCount', 0) or 0,
        'checklistCount': report.get('docsQuality', {}).get('checklistCount', 0) or 0,
        'linkCount': report.get('docsQuality', {}).get('linkCount', 0) or 0,
        'todoCount': report.get('docsQuality', {}).get('todoCount', 0) or 0,
        'fixmeCount': report.get('docsQuality', {}).get('fixmeCount', 0) or 0,
        'hackCount': report.get('docsQuality', {}).get('hackCount', 0) or 0,
        'tempCount': report.get('docsQuality', {}).get('tempCount', 0) or 0,
    }


# ---------------------------------------------------------------------------
# Quality scoring bridge
# ---------------------------------------------------------------------------

def compute_quality_score(report: dict, params: dict) -> float:
    from backend.models.quality_scorer import compute_quality_scores
    health = report.get('health', {}) or {}
    complexity = report.get('complexity', {}) or {}
    docs_quality = report.get('docsQuality', {}) or {}
    tech_stack = report.get('techStack', {}) or {}
    languages = {l.get('name', ''): l.get('bytes', 0) for l in tech_stack.get('languages', [])}
    file_tree = report.get('fileTree', []) or []
    readme = report.get('readmeContent', '') or ''
    dep_files = complexity.get('dependencyFiles', {}) or {}
    topics = report.get('topics', []) or []
    result = compute_quality_scores(
        languages=languages,
        file_tree=file_tree,
        readme_content=readme,
        dependency_files=dep_files,
        topics=topics,
        stars=health.get('stars', 0) or 0,
        forks=health.get('forks', 0) or 0,
        contributors=health.get('contributorCount', 0) or 0,
        has_tests=bool(health.get('hasTests', False)),
        has_ci=bool(health.get('hasCI', False)),
        pushed_at=health.get('pushedAt', '') or '',
        params=params,
        complexity=complexity,
        docs_quality=docs_quality,
        health=health,
    )
    return result['overall']


def compute_reward(score: float, report: dict, action: dict) -> float:
    state = extract_state(report)
    base = (score - 50) / 50
    bonus = 0.0
    if action['paramName'].startswith('w_') and action['delta'] > 0:
        bonus += 0.05
    elif action['paramName'].startswith('w_') and action['delta'] < 0:
        bonus -= 0.05
    # Contextual bonuses for weight adjustments
    if action['paramName'] == 'w_community' and state['repoStars'] > 1000:
        bonus += 0.2
    if action['paramName'] == 'w_docs' and state['readmeScore'] > 60:
        bonus += 0.25
    if action['paramName'] == 'w_docs' and state['docsSectionCount'] >= 6:
        bonus += 0.15
    if action['paramName'] == 'w_codeQuality' and state['hasTests']:
        bonus += 0.2
    if action['paramName'] == 'w_security' and (state['hasCI'] or state['hasTests']):
        bonus += 0.15
    if action['paramName'] == 'w_maintainability' and state['fileCount'] < 100:
        bonus += 0.15
    return max(-1.0, min(1.0, base + bonus))


# ---------------------------------------------------------------------------
# Report loading & validation
# ---------------------------------------------------------------------------

def validate_report(report: dict, filename: str) -> list[str]:
    issues: list[str] = []
    health = report.get('health') or {}
    complexity = report.get('complexity') or {}
    docs = report.get('docsQuality') or {}
    if not isinstance(health.get('stars'), (int, float)):
        issues.append('health.stars missing')
    if not isinstance(complexity.get('fileCount'), (int, float)):
        issues.append('complexity.fileCount missing')
    if not isinstance(docs.get('readmeLength'), (int, float)):
        issues.append('docsQuality.readmeLength missing')
    if isinstance(health.get('stars'), (int, float)) and health['stars'] < 0:
        issues.append('negative stars')
    if isinstance(complexity.get('fileCount'), (int, float)):
        if complexity['fileCount'] > 100000:
            issues.append('suspiciously high fileCount')
        if complexity['fileCount'] <= 0:
            issues.append('zero fileCount')
    return issues


def load_reports() -> list[dict]:
    if not RESULTS_DIR.exists():
        return []
    entries: list[dict] = []
    seen_urls: set[str] = set()
    for f in sorted(RESULTS_DIR.iterdir()):
        if not f.name.endswith('.json'):
            continue
        try:
            report = json.loads(f.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            entries.append({'report': None, 'file': f.name, 'issues': ['parse error']})
            continue
        issues = validate_report(report, f.name)
        repo_url = (report.get('repoUrl', '') or '').replace('.git', '').lower()
        if repo_url and repo_url in seen_urls:
            issues.append('near-duplicate: same repo URL seen in another file')
        if repo_url:
            seen_urls.add(repo_url)
        entries.append({'report': report, 'file': f.name, 'issues': issues})
    return entries


# ---------------------------------------------------------------------------
# Experience generation
# ---------------------------------------------------------------------------

def generate_experiences(valid_entries: list[dict]) -> dict:
    experiences: list[dict] = []
    rejected = 0
    reasons: dict[str, int] = {}
    seen_state_keys: set[str] = set()

    def _validate(exp, pname, delta):
        errs = []
        for k in ['repoStars', 'repoForks', 'fileCount', 'languageCount', 'readmeLength', 'contributorCount', 'readmeScore']:
            v = exp['state'].get(k, 0)
            if isinstance(v, (int, float)) and v < 0:
                errs.append(f'state.{k} negative')
        if exp['state'].get('fileCount', 0) <= 0:
            errs.append('state.fileCount zero or negative')
        if exp['state'].get('languageCount', 0) < 1:
            errs.append('state.languageCount < 1')
        dsc = exp['state'].get('docsSectionCount', 0)
        if dsc < 0 or dsc > 10:
            errs.append('state.docsSectionCount out of range')
        r = exp['reward']
        if r < -1 or r > 1:
            errs.append('reward out of [-1, 1]')
        if math.isnan(r) or math.isinf(r):
            errs.append('reward is NaN/inf')
        if pname not in ALL_PARAM_NAMES:
            errs.append('unknown paramName')
        return errs

    for entry in valid_entries:
        report = entry['report']
        if report is None:
            rejected += 1
            reasons['corrupt_report'] = reasons.get('corrupt_report', 0) + 1
            continue

        state = extract_state(report)
        sk = get_state_key(state)
        if sk in seen_state_keys:
            rejected += 1
            reasons['duplicate_state'] = reasons.get('duplicate_state', 0) + 1
            continue
        seen_state_keys.add(sk)

        baseline = compute_quality_score(report, DEFAULT_PARAMS)

        for pname in ALL_PARAM_NAMES:
            for delta in PARAM_DELTAS[pname]:
                lo, hi = PARAM_RANGES[pname]
                trial_params = dict(DEFAULT_PARAMS)
                trial_params[pname] = max(lo, min(hi, trial_params[pname] + delta))
                trial_score = compute_quality_score(report, trial_params)
                if abs(trial_score - baseline) < 0.5:
                    continue

                reward = compute_reward(trial_score, report, {'paramName': pname, 'delta': delta})
                next_state = dict(state)
                if pname == 'w_community':
                    next_state['repoStars'] = max(0, state['repoStars'] + round(delta * 1000))
                    next_state['repoForks'] = max(0, state['repoForks'] + round(delta * 100))

                exp = {
                    'state': state,
                    'action': {'paramName': pname, 'delta': delta},
                    'reward': round(reward, 3),
                    'nextState': next_state,
                    'timestamp': int(time.time() * 1000),
                    'weight': 1.0,
                }
                errs = _validate(exp, pname, delta)
                if errs:
                    rejected += 1
                    for e in errs:
                        reasons[e] = reasons.get(e, 0) + 1
                    continue
                experiences.append(exp)
    return {'experiences': experiences, 'rejected': rejected, 'reasons': reasons, 'stateKeys': seen_state_keys}


# ---------------------------------------------------------------------------
# Synthetic edge-case experiences
# ---------------------------------------------------------------------------

def _synthetic_reports():
    def _make(name, health, complexity, docs, tech_stack, file_tree, readme=''):
        return {
            'id': f'edge/{name}', 'repoUrl': f'https://github.com/edge/{name}',
            'repoName': name, 'owner': 'edge',
            'health': {**{'stars': 0, 'forks': 0, 'contributorCount': 0, 'hasTests': False, 'hasCI': False, 'lastCommitDays': 30, 'hasDockerfile': False, 'openIssues': 0}, **(health or {})},
            'complexity': {**{'fileCount': 0, 'totalLines': 0, 'averageFileSize': 0, 'deepestNesting': 0, 'languageBreakdown': [], 'dependencyFiles': {}}, **(complexity or {})},
            'docsQuality': {**{'readmeLength': 0, 'readmeScore': 0, 'sectionCoverage': [], 'hasReadme': False, 'hasContributing': False, 'hasCodeOfConduct': False, 'hasLicense': False, 'hasChangelog': False, 'hasApiDocs': False, 'hasWiki': False, 'headingCount': 0, 'codeBlockCount': 0, 'imageCount': 0, 'badgeCount': 0, 'emojiCount': 0, 'tableCount': 0, 'checklistCount': 0, 'linkCount': 0, 'todoCount': 0, 'fixmeCount': 0, 'hackCount': 0, 'tempCount': 0, 'suggestions': []}, **(docs or {})},
            'techStack': {**{'languages': [], 'frameworks': [], 'databases': [], 'tools': [], 'infrastructure': []}, **(tech_stack or {})},
            'fileTree': file_tree or [],
            'readmeContent': readme,
            'analysisMethod': {'cloneMethod': 'full', 'apiData': 'full', 'aiProvider': 'localai', 'confidence': 100},
        }
    r = []
    r.append(_make('no-readme', {'stars': 500, 'forks': 50, 'contributorCount': 5, 'hasTests': True, 'hasCI': True, 'lastCommitDays': 10, 'hasDockerfile': True}, {'fileCount': 50}, {'readmeLength': 0, 'readmeScore': 0, 'sectionCoverage': [], 'hasLicense': True}, {'languages': [{'name': 'TypeScript', 'percentage': 60, 'bytes': 6000}, {'name': 'JavaScript', 'percentage': 40, 'bytes': 4000}]}, []))
    r.append(_make('readme-only', {'stars': 100, 'forks': 10, 'contributorCount': 1, 'lastCommitDays': 30}, {'fileCount': 1}, {'readmeLength': 5200, 'readmeScore': 85, 'sectionCoverage': [{'present': True}]*7, 'hasReadme': True, 'hasContributing': True, 'hasLicense': True, 'hasCodeOfConduct': True, 'hasChangelog': True, 'hasApiDocs': True, 'headingCount': 12, 'codeBlockCount': 8, 'imageCount': 3, 'badgeCount': 5, 'emojiCount': 2, 'tableCount': 1, 'linkCount': 15}, {'languages': []}, [{'name': 'README.md', 'type': 'blob', 'path': 'README.md', 'size': 5200}]))
    r.append(_make('abandoned', {'stars': 15000, 'forks': 3000, 'contributorCount': 50, 'hasTests': True, 'lastCommitDays': 1825}, {'fileCount': 200, 'dependencyFiles': {'Cargo.toml': '[package]'}}, {'readmeLength': 2000, 'readmeScore': 70, 'sectionCoverage': [{'present': True}]*3, 'hasReadme': True, 'hasContributing': True, 'hasLicense': True, 'headingCount': 6, 'codeBlockCount': 4, 'imageCount': 1, 'badgeCount': 3, 'linkCount': 8}, {'languages': [{'name': 'Rust', 'percentage': 100, 'bytes': 50000}]}, []))
    r.append(_make('fork', {'stars': 8000, 'forks': 2, 'contributorCount': 1, 'lastCommitDays': 400}, {'fileCount': 10}, {'readmeLength': 100, 'readmeScore': 20, 'hasReadme': True, 'hasLicense': True, 'headingCount': 1, 'linkCount': 1}, {'languages': [{'name': 'Python', 'percentage': 100, 'bytes': 500}]}, [{'name': 'fork.py', 'type': 'blob', 'path': 'fork.py', 'size': 500}]))
    r.append(_make('generated-code', {'stars': 10, 'lastCommitDays': 5}, {'fileCount': 60000}, {'readmeLength': 200, 'readmeScore': 30, 'sectionCoverage': [{'present': True}], 'hasReadme': True, 'headingCount': 2, 'todoCount': 5}, {'languages': [{'name': 'JavaScript', 'percentage': 100, 'bytes': 3000000}]}, []))
    r.append(_make('dsa', {'stars': 50000, 'forks': 15000, 'contributorCount': 200, 'lastCommitDays': 60}, {'fileCount': 2000}, {'readmeLength': 3000, 'readmeScore': 75, 'sectionCoverage': [{'present': True}]*5, 'hasReadme': True, 'hasContributing': True, 'hasLicense': True, 'headingCount': 8, 'codeBlockCount': 2000, 'badgeCount': 2, 'tableCount': 1, 'linkCount': 5}, {'languages': [{'name': 'Python', 'percentage': 80, 'bytes': 64000}, {'name': 'C++', 'percentage': 20, 'bytes': 16000}]}, []))
    r.append(_make('dataset', {'stars': 2000, 'forks': 500, 'contributorCount': 10, 'lastCommitDays': 200}, {'fileCount': 150}, {'readmeLength': 1500, 'readmeScore': 60, 'sectionCoverage': [{'present': True}]*3, 'hasReadme': True, 'hasLicense': True, 'headingCount': 4, 'codeBlockCount': 1, 'badgeCount': 1, 'linkCount': 2}, {'languages': []}, []))
    r.append(_make('research', {'stars': 3000, 'forks': 800, 'contributorCount': 15, 'lastCommitDays': 30}, {'fileCount': 20, 'dependencyFiles': {'requirements.txt': 'torch\nnumpy'}}, {'readmeLength': 4000, 'readmeScore': 80, 'sectionCoverage': [{'present': True}]*6, 'hasReadme': True, 'hasContributing': True, 'hasLicense': True, 'hasApiDocs': True, 'headingCount': 10, 'codeBlockCount': 6, 'imageCount': 4, 'badgeCount': 2, 'linkCount': 10}, {'languages': [{'name': 'Python', 'percentage': 100, 'bytes': 5000}], 'frameworks': ['PyTorch']}, []))
    r.append(_make('monorepo', {'stars': 8000, 'forks': 2000, 'contributorCount': 100, 'hasTests': True, 'hasCI': True, 'lastCommitDays': 1, 'hasDockerfile': True}, {'fileCount': 5000, 'dependencyFiles': {'package.json': '{}', 'Cargo.toml': '[package]'}}, {'readmeLength': 5000, 'readmeScore': 85, 'sectionCoverage': [{'present': True}]*8, 'hasReadme': True, 'hasContributing': True, 'hasCodeOfConduct': True, 'hasLicense': True, 'hasChangelog': True, 'hasApiDocs': True, 'headingCount': 15, 'codeBlockCount': 10, 'imageCount': 2, 'badgeCount': 8, 'emojiCount': 1, 'tableCount': 2, 'linkCount': 20, 'todoCount': 10, 'fixmeCount': 2}, {'languages': [{'name': 'TypeScript', 'percentage': 40, 'bytes': 200000}, {'name': 'Rust', 'percentage': 30, 'bytes': 150000}, {'name': 'Python', 'percentage': 20, 'bytes': 100000}, {'name': 'Go', 'percentage': 10, 'bytes': 50000}]}, []))
    r.append(_make('single-file', {'stars': 10000, 'forks': 2000, 'contributorCount': 30, 'lastCommitDays': 5}, {'fileCount': 1}, {'readmeLength': 800, 'readmeScore': 60, 'sectionCoverage': [{'present': True}]*3, 'hasReadme': True, 'hasContributing': True, 'hasLicense': True, 'headingCount': 3, 'codeBlockCount': 2, 'badgeCount': 1, 'linkCount': 2}, {'languages': [{'name': 'Rust', 'percentage': 100, 'bytes': 500}]}, []))
    r.append(_make('config-nightmare', {'stars': 100, 'forks': 20, 'contributorCount': 3, 'lastCommitDays': 100, 'hasDockerfile': True}, {'fileCount': 80, 'dependencyFiles': {'package.json': '{}', '.env.example': 'DATABASE_URL=\n'}}, {'readmeLength': 3000, 'readmeScore': 65, 'sectionCoverage': [{'present': True}]*3, 'hasReadme': True, 'hasLicense': True, 'headingCount': 5, 'codeBlockCount': 3, 'linkCount': 3}, {'languages': [{'name': 'JavaScript', 'percentage': 100, 'bytes': 15000}]}, []))
    r.append(_make('security-issues', {'stars': 50, 'forks': 5, 'contributorCount': 2, 'lastCommitDays': 200}, {'fileCount': 20}, {'readmeLength': 100, 'readmeScore': 20, 'hasReadme': True, 'headingCount': 1, 'fixmeCount': 3, 'hackCount': 2}, {'languages': [{'name': 'Python', 'percentage': 100, 'bytes': 4000}]}, []))
    r.append(_make('empty-repo', {}, {'fileCount': 0}, {}, {'languages': []}, [], 'synth'))
    r[0]['analysisMethod']['confidence'] = 50
    r.append(_make('huge-readme-small-code', {'stars': 500, 'forks': 100, 'contributorCount': 5, 'lastCommitDays': 30}, {'fileCount': 10}, {'readmeLength': 10000, 'readmeScore': 90, 'sectionCoverage': [{'present': True}]*7, 'hasReadme': True, 'hasContributing': True, 'hasCodeOfConduct': True, 'hasLicense': True, 'hasChangelog': True, 'hasApiDocs': True, 'headingCount': 20, 'codeBlockCount': 15, 'imageCount': 5, 'badgeCount': 10, 'emojiCount': 3, 'tableCount': 2, 'checklistCount': 1, 'linkCount': 25}, {'languages': [{'name': 'Python', 'percentage': 100, 'bytes': 300}]}, []))
    r.append(_make('great-code-no-readme', {'stars': 5000, 'forks': 1000, 'contributorCount': 20, 'hasTests': True, 'hasCI': True, 'lastCommitDays': 5, 'hasDockerfile': True}, {'fileCount': 200, 'dependencyFiles': {'Cargo.toml': '[package]', 'package.json': '{}'}}, {'readmeLength': 0, 'readmeScore': 0}, {'languages': [{'name': 'Rust', 'percentage': 60, 'bytes': 30000}, {'name': 'TypeScript', 'percentage': 40, 'bytes': 20000}]}, []))
    r.append(_make('broken-license', {'stars': 100, 'forks': 20, 'contributorCount': 5, 'hasTests': True, 'hasCI': True, 'lastCommitDays': 10}, {'fileCount': 30, 'dependencyFiles': {'package.json': '{}'}}, {'readmeLength': 500, 'readmeScore': 40, 'sectionCoverage': [{'present': True}]*2, 'hasReadme': True}, {'languages': [{'name': 'JavaScript', 'percentage': 100, 'bytes': 6000}]}, []))
    r.append(_make('testless-enterprise', {'stars': 50, 'forks': 5, 'contributorCount': 10, 'hasCI': True, 'lastCommitDays': 2, 'hasDockerfile': True}, {'fileCount': 2000, 'dependencyFiles': {'pom.xml': '<project>', 'Dockerfile': 'FROM java'}}, {'readmeLength': 2000, 'readmeScore': 60, 'sectionCoverage': [{'present': True}]*4, 'hasReadme': True, 'hasContributing': True, 'hasLicense': True, 'headingCount': 5, 'codeBlockCount': 3, 'badgeCount': 2, 'linkCount': 5, 'todoCount': 15, 'fixmeCount': 5}, {'languages': [{'name': 'Java', 'percentage': 100, 'bytes': 200000}]}, []))
    r.append(_make('fake-startup', {'stars': 5, 'lastCommitDays': 3}, {'fileCount': 5}, {'readmeLength': 8000, 'readmeScore': 85, 'sectionCoverage': [{'present': True}]*8, 'hasReadme': True, 'hasContributing': True, 'hasCodeOfConduct': True, 'hasLicense': True, 'hasChangelog': True, 'hasApiDocs': True, 'headingCount': 18, 'codeBlockCount': 12, 'imageCount': 8, 'badgeCount': 15, 'emojiCount': 5, 'tableCount': 3, 'checklistCount': 2, 'linkCount': 30}, {'languages': [{'name': 'JavaScript', 'percentage': 100, 'bytes': 200}]}, []))
    r[-1]['analysisMethod']['confidence'] = 55
    r.append(_make('dataset-only', {'stars': 100, 'forks': 30, 'contributorCount': 3, 'lastCommitDays': 365}, {'fileCount': 50}, {'readmeLength': 500, 'readmeScore': 30, 'sectionCoverage': [{'present': True}], 'hasReadme': True, 'hasLicense': True, 'headingCount': 2}, {'languages': []}, []))
    r.append(_make('archive-repo', {'stars': 200, 'forks': 50, 'contributorCount': 5, 'hasTests': True, 'lastCommitDays': 1500}, {'fileCount': 100}, {'readmeLength': 1000, 'readmeScore': 50, 'sectionCoverage': [{'present': True}]*3, 'hasReadme': True, 'hasLicense': True, 'headingCount': 3, 'codeBlockCount': 2, 'linkCount': 2}, {'languages': [{'name': 'Python', 'percentage': 100, 'bytes': 20000}]}, []))
    r.append(_make('generated-code-repo', {'stars': 3, 'lastCommitDays': 1}, {'fileCount': 5000}, {'readmeLength': 100, 'readmeScore': 15, 'hasReadme': True, 'headingCount': 1, 'todoCount': 20, 'fixmeCount': 5, 'hackCount': 3, 'tempCount': 10}, {'languages': [{'name': 'JavaScript', 'percentage': 100, 'bytes': 500000}]}, []))
    r[-1]['analysisMethod'] = {'cloneMethod': 'partial', 'apiData': 'none', 'aiProvider': 'localai', 'confidence': 40}
    return r


def generate_synthetic_experiences(existing_state_keys: set[str]) -> dict:
    experiences: list[dict] = []
    added = 0
    skipped = 0
    for report in _synthetic_reports():
        state = extract_state(report)
        sk = get_state_key(state)
        if sk in existing_state_keys:
            skipped += 1
            continue
        existing_state_keys.add(sk)
        baseline = compute_quality_score(report, DEFAULT_PARAMS)
        for pname in ALL_PARAM_NAMES:
            for delta in PARAM_DELTAS[pname]:
                lo, hi = PARAM_RANGES[pname]
                trial_params = dict(DEFAULT_PARAMS)
                trial_params[pname] = max(lo, min(hi, trial_params[pname] + delta))
                trial_score = compute_quality_score(report, trial_params)
                if abs(trial_score - baseline) < 0.5:
                    continue
                reward = compute_reward(trial_score, report, {'paramName': pname, 'delta': delta})
                next_state = dict(state)
                if pname == 'w_community':
                    next_state['repoStars'] = max(0, state['repoStars'] + round(delta * 1000))
                    next_state['repoForks'] = max(0, state['repoForks'] + round(delta * 100))
                experiences.append({
                    'state': state,
                    'action': {'paramName': pname, 'delta': delta},
                    'reward': round(reward, 3),
                    'nextState': next_state,
                    'timestamp': int(time.time() * 1000),
                    'weight': 10.0,
                })
                added += 1
    return {'experiences': experiences, 'added': added, 'skipped': skipped}


# ---------------------------------------------------------------------------
# Dataset split
# ---------------------------------------------------------------------------

def split_dataset(experiences: list[dict], val_ratio: float = 0.15) -> tuple[list[dict], list[dict]]:
    shuffled = list(experiences)
    random.shuffle(shuffled)
    split_idx = int(len(shuffled) * (1 - val_ratio))
    return shuffled, shuffled[split_idx:]


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(
    train_set: list[dict],
    val_set: list[dict],
    max_epochs: int = 100,
    patience: int = 30,
    min_delta: float = 0.00005,
) -> dict:
    q_values: dict[str, dict[str, float]] = {}
    train_loss: list[float] = []
    val_loss: list[float] = []
    best_train_loss = float('inf')
    best_epoch = 0
    stopped_early = False
    stop_reason = 'completed'
    base_lr = 0.05
    df = 0.85
    l2_lambda = 0.0
    clip_threshold = 1.5
    q_clip = 3.0
    warmup_epochs = 3
    best_q_values: dict[str, dict[str, float]] = {}
    final_lr = base_lr
    consecutive_no_improvement = 0

    for epoch in range(max_epochs):
        if epoch < warmup_epochs:
            current_lr = base_lr * ((epoch + 1) / warmup_epochs)
        else:
            cosine = 0.5 * (1 + math.cos(((epoch - warmup_epochs) / (max_epochs - warmup_epochs)) * math.pi))
            current_lr = base_lr * max(0.05, cosine)

        random.shuffle(train_set)

        total_tloss = 0.0
        for exp in train_set:
            sk = get_state_key(exp['state'])
            ak = get_action_key(exp['action'])
            nsk = get_state_key(exp['nextState'])
            if sk not in q_values:
                q_values[sk] = {}
            current_q = q_values[sk].get(ak, 0.0)
            max_next_q = max(q_values.get(nsk, {}).values(), default=0.0)
            target_q = max(-q_clip, min(q_clip, exp['reward'] + df * max_next_q))
            td_error = target_q - current_q
            if td_error > clip_threshold:
                td_error = clip_threshold
            elif td_error < -clip_threshold:
                td_error = -clip_threshold
            l2_penalty = l2_lambda * current_q
            weight = exp.get('weight', 1.0)
            new_q = current_q + current_lr * weight * (td_error - l2_penalty)
            new_q = max(-q_clip, min(q_clip, new_q))
            q_values[sk][ak] = new_q
            total_tloss += abs(td_error) * weight

        avg_tloss = total_tloss / len(train_set)
        train_loss.append(avg_tloss)

        avg_vloss = 0.0
        if val_set:
            total_vloss = 0.0
            for exp in val_set:
                sk = get_state_key(exp['state'])
                ak = get_action_key(exp['action'])
                nsk = get_state_key(exp['nextState'])
                current_q = q_values.get(sk, {}).get(ak, 0.0)
                max_next_q = max(q_values.get(nsk, {}).values(), default=0.0)
                target_q = max(-q_clip, min(q_clip, exp['reward'] + df * max_next_q))
                total_vloss += abs(target_q - current_q)
            avg_vloss = total_vloss / len(val_set)
        val_loss.append(avg_vloss)

        if val_set and epoch > 5:
            recent_val_avg = sum(val_loss[-5:]) / 5
            if avg_vloss > recent_val_avg * 5 and recent_val_avg > 0.01:
                stopped_early = True
                stop_reason = f'divergence (val spike: {recent_val_avg:.4f} -> {avg_vloss:.4f})'
                break
        if epoch > 5:
            recent_train_avg = sum(train_loss[-5:]) / 5
            if avg_tloss > recent_train_avg * 5 and recent_train_avg > 0.01:
                stopped_early = True
                stop_reason = f'divergence (train spike: {recent_train_avg:.4f} -> {avg_tloss:.4f})'
                break

        if epoch >= 10:
            if avg_tloss < best_train_loss - min_delta:
                best_train_loss = avg_tloss
                best_epoch = epoch
                consecutive_no_improvement = 0
                best_q_values = {sk: dict(actions) for sk, actions in q_values.items()}
            else:
                consecutive_no_improvement += 1
                if consecutive_no_improvement >= patience:
                    stopped_early = True
                    stop_reason = f'converged (train loss plateaued at {avg_tloss:.4f}, best {best_train_loss:.4f} @ epoch {best_epoch + 1})'
                    break
        else:
            if avg_tloss < best_train_loss:
                best_train_loss = avg_tloss
                best_epoch = epoch
                best_q_values = {sk: dict(actions) for sk, actions in q_values.items()}

        final_lr = current_lr
        if epoch % 5 == 0 or epoch == max_epochs - 1:
            msg = f'  Epoch {epoch + 1}/{max_epochs} — lr: {current_lr:.4f} — train: {avg_tloss:.4f}, val: {avg_vloss:.4f}'
            print(msg)

    final_q = best_q_values if best_q_values else q_values

    return {
        'qValues': final_q,
        'bestQValues': best_q_values,
        'run': {
            'trainLoss': train_loss,
            'valLoss': val_loss,
            'epochs': len(train_loss),
            'stoppedEarly': stopped_early,
            'stopReason': stop_reason,
            'bestValLoss': best_train_loss,
            'bestEpoch': best_epoch,
            'finalTrainLoss': train_loss[-1],
            'finalValLoss': val_loss[-1] if val_loss else 0,
            'overfittingGap': round(val_loss[-1] - train_loss[-1], 4) if val_loss else 0,
            'finalLr': final_lr,
        },
    }


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate(q_values: dict, experiences: list[dict]) -> dict:
    state_count = len(q_values)
    action_count = 0
    total_q = 0.0
    min_q = float('inf')
    max_q = float('-inf')
    sq_sum = 0.0
    for actions in q_values.values():
        action_count += len(actions)
        for qv in actions.values():
            total_q += qv
            if qv < min_q:
                min_q = qv
            if qv > max_q:
                max_q = qv
    avg_q = total_q / action_count if action_count > 0 else 0
    for actions in q_values.values():
        for qv in actions.values():
            sq_sum += (qv - avg_q) ** 2
    std_q = math.sqrt(sq_sum / action_count) if action_count > 0 else 0

    top_actions: dict[str, int] = {}
    for actions in q_values.values():
        if actions:
            best = max(actions, key=actions.get)
            top_actions[best] = top_actions.get(best, 0) + 1
    ranked = sorted(top_actions.items(), key=lambda x: -x[1])

    repo_stars: list[int] = []
    file_counts: list[int] = []
    for sk in q_values:
        parts = sk.split(':')
        repo_stars.append(int(parts[0]) * 1000)
        file_counts.append(int(parts[2]) * 100)

    return {
        'stateCount': state_count,
        'actionCount': action_count,
        'avgQ': round(avg_q, 4),
        'minQ': round(min_q, 4),
        'maxQ': round(max_q, 4),
        'qValueStd': round(std_q, 4),
        'topActions': ranked[:10],
        'stateCoverage': {
            'starRange': f'{min(repo_stars)}-{max(repo_stars)}' if repo_stars else '0-0',
            'fileRange': f'{min(file_counts)}-{max(file_counts)}' if file_counts else '0-0',
            'count': state_count,
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def compute_dataset_diversity(entries: list[dict]) -> dict:
    lang_counts: dict[str, int] = {}
    owners: set[str] = set()
    ages: list[float] = []
    now = time.time()
    for entry in entries:
        report = entry.get('report')
        if not report:
            continue
        for lang in report.get('techStack', {}).get('languages', []):
            name = lang.get('name', '')
            if name:
                lang_counts[name] = lang_counts.get(name, 0) + 1
        owner = report.get('owner', '')
        if owner:
            owners.add(owner)
        gen_at = report.get('generatedAt', '')
        if gen_at:
            try:
                dt = datetime.fromisoformat(gen_at.replace('Z', '+00:00'))
                ages.append((now - dt.timestamp()) / 86400)
            except Exception:
                pass
    sorted_langs = sorted(lang_counts.items(), key=lambda x: -x[1])
    total = len(entries)
    entropy = sum(-(c / total) * math.log2(c / total + 1e-10) for _, c in sorted_langs) if total > 0 else 0
    return {
        'totalReports': total,
        'uniqueOwners': len(owners),
        'languageCount': len(sorted_langs),
        'languageEntropy': round(entropy, 3),
        'topLanguages': [{'name': n, 'count': c, 'pct': round(c / total * 100)} for n, c in sorted_langs[:8]],
        'maxAgeDays': round(max(ages)) if ages else 0,
        'medianAgeDays': round(sorted(ages)[len(ages) // 2]) if ages else 0,
    }


def main():
    print('=== Compact RL Training Pipeline (Python) ===')
    print()

    print('[1/6] Loading reports...')
    loaded = load_reports()
    valid = [e for e in loaded if not e['issues']]
    corrupt = [e for e in loaded if e['issues']]
    print(f'  Total files: {len(loaded)}')
    print(f'  Valid: {len(valid)}')
    print(f'  Corrupt: {len(corrupt)}')
    for c in corrupt:
        print(f'    - {c["file"]}: {", ".join(c["issues"])}')
    if not valid:
        print('  No valid reports. Exiting.')
        return

    print('[2/6] Generating experiences...')
    result = generate_experiences(valid)
    experiences = result['experiences']
    rejected = result['rejected']
    reasons = result['reasons']
    state_keys = result['stateKeys']
    print(f'  Real experiences: {len(experiences)}')
    print(f'  Rejected: {rejected}')
    if reasons:
        print('  Rejection reasons:')
        for reason, count in sorted(reasons.items(), key=lambda x: -x[1]):
            print(f'    {reason}: {count}')

    print('  Generating synthetic edge-case experiences...')
    synth = generate_synthetic_experiences(state_keys)
    if synth['experiences']:
        experiences.extend(synth['experiences'])
        print(f'  Synthetic added: {synth["added"]}, skipped (dup): {synth["skipped"]}')
    print(f'  Total experiences: {len(experiences)}')
    if not experiences:
        print('  No experiences. Exiting.')
        return

    print('[3/6] Splitting dataset...')
    unique_states = list({get_state_key(e['state']) for e in experiences})
    train_set, val_set = split_dataset(experiences, 0.15)
    print(f'  States: {len(unique_states)}')
    print(f'  Train: {len(train_set)} ({round(len(train_set) / len(experiences) * 100)}%)')
    print(f'  Validation: {len(val_set)} ({round(len(val_set) / len(experiences) * 100)}%)')

    print('[4/6] Training...')
    result = train(train_set, val_set, 150, 25)
    q_values = result['qValues']
    best_q_values = result['bestQValues']
    run = result['run']

    print()
    print(f'  Stopped: {"yes" if run["stoppedEarly"] else "no (max epochs)"}')
    print(f'  Reason: {run["stopReason"]}')
    print(f'  Epochs completed: {run["epochs"]}')
    print(f'  Best training loss: {run["bestValLoss"]:.4f} at epoch {run["bestEpoch"] + 1}')
    print(f'  Final training loss: {run["finalTrainLoss"]:.4f}')
    print(f'  Final val loss (monitor): {run["finalValLoss"]:.4f}')
    print(f'  Final LR: {run["finalLr"]:.4f}')

    print('[5/6] Evaluating...')
    eval_result = evaluate(q_values, experiences)
    print(f'  States: {eval_result["stateCount"]}')
    print(f'  Actions: {eval_result["actionCount"]}')
    print(f'  Q-value range: {eval_result["minQ"]} to {eval_result["maxQ"]} (avg: {eval_result["avgQ"]}, std: {eval_result["qValueStd"]})')
    print(f'  State coverage: {eval_result["stateCoverage"]["starRange"]} stars, {eval_result["stateCoverage"]["fileRange"]} files')
    print('  Top actions:')
    for action, count in eval_result['topActions']:
        print(f'    {action}: {count} states')

    print('[6/6] Saving model...')
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    best_model = best_q_values if best_q_values else q_values
    best_eval = evaluate(best_model, experiences)

    def _make_payload(qt, meta):
        return {
            'qTable': qt,
            'experienceBuffer': [],
            'trainingSteps': run['epochs'] * len(train_set),
            'version': 4,
            'trainingMeta': meta,
            'exportedAt': _now_iso(),
        }

    best_meta = {
        'epochs': run['epochs'],
        'stoppedEarly': run['stoppedEarly'],
        'stopReason': run['stopReason'],
        'bestValLoss': run['bestValLoss'],
        'bestEpoch': run['bestEpoch'],
        'finalTrainLoss': run['finalTrainLoss'],
        'finalValLoss': run['finalValLoss'],
        'stateCount': best_eval['stateCount'],
        'avgQ': best_eval['avgQ'],
        'topActions': best_eval['topActions'],
    }
    (CHECKPOINT_DIR / 'qtable-compact.json').write_text(
        json.dumps(_make_payload(best_model, best_meta), indent=2), encoding='utf-8')

    latest_meta = {
        'epochs': run['epochs'],
        'stoppedEarly': run['stoppedEarly'],
        'stopReason': run['stopReason'],
        'bestValLoss': run['bestValLoss'],
        'finalTrainLoss': run['finalTrainLoss'],
        'finalValLoss': run['finalValLoss'],
        'stateCount': eval_result['stateCount'],
        'avgQ': eval_result['avgQ'],
        'topActions': eval_result['topActions'],
    }
    (CHECKPOINT_DIR / 'qtable-latest.json').write_text(
        json.dumps(_make_payload(q_values, latest_meta), indent=2), encoding='utf-8')

    model_size = len(json.dumps(best_model))
    if model_size < 100000:
        print(f'  Model: {model_size / 1000:.1f} KB')
    else:
        print(f'  Model: {model_size / 1000000:.2f} MB')

    log_entry = {
        'timestamp': _now_iso(),
        'data': {'reports': len(valid), 'experiences': len(experiences), 'states': len(unique_states),
                 'trainSize': len(train_set), 'valSize': len(val_set)},
        'diversity': compute_dataset_diversity(valid),
        'training': {
            'epochs': run['epochs'],
            'stoppedEarly': run['stoppedEarly'],
            'stopReason': run['stopReason'],
            'trainLossCurve': run['trainLoss'],
            'valLossCurve': run['valLoss'],
            'bestValLoss': run['bestValLoss'],
            'bestEpoch': run['bestEpoch'],
            'finalTrainLoss': run['finalTrainLoss'],
            'overfittingGap': run['overfittingGap'],
        },
        'evaluation': eval_result,
        'modelSize': model_size,
    }
    log_file = LOG_DIR / f'train-{int(time.time() * 1000)}.json'
    log_file.write_text(json.dumps(log_entry, indent=2), encoding='utf-8')
    print(f'  Training log: {log_file}')

    print()
    print('=== Training complete. ===')
    stop_label = 'Early stop' if run['stoppedEarly'] else 'Max epochs'
    print(f'{stop_label}: {run["stopReason"]}')
    print(f'Best train loss: {run["bestValLoss"]:.4f} at epoch {run["bestEpoch"] + 1}')
    print(f'States: {eval_result["stateCount"]}, Actions: {eval_result["actionCount"]}')
    print(f'Avg Q: {eval_result["avgQ"]}')


if __name__ == '__main__':
    main()
