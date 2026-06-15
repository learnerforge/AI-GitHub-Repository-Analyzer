from __future__ import annotations
import json
import math
import re
import time
from pathlib import Path
from datetime import datetime, timezone
from ..config import RESULTS_DIR
from ..schemas import AnalysisReport
from ..models.local_ai import LocalAIProvider


ai_provider = LocalAIProvider()


def _find_in_tree(nodes: list[dict], predicate) -> bool:
    for n in nodes:
        if predicate(n):
            return True
        if n.get('children') and _find_in_tree(n['children'], predicate):
            return True
    return False


def _compute_max_depth(nodes: list[dict], depth: int = 0) -> int:
    max_depth = depth
    for node in nodes:
        if node.get('type') == 'tree' and node.get('children'):
            max_depth = max(max_depth, _compute_max_depth(node['children'], depth + 1))
    return max_depth


def _compute_complexity(repo: dict) -> dict:
    total_lines = 0
    file_count = 0
    test_file_count = 0
    api_endpoint_count = 0
    walk_all = lambda nodes: None

    def walk_all_fn(nodes):
        nonlocal file_count, test_file_count, api_endpoint_count
        for node in nodes:
            if node.get('type') == 'blob':
                file_count += 1
                name = node.get('name', '')
                if re.search(r'\.(test|spec)\.\w+$', name) or re.match(r'^test_.*\.\w+$', name):
                    test_file_count += 1
                if re.search(r'\.(api|route|controller|endpoint)\.\w+$', name, re.I) or re.match(r'^api\.\w+$', name, re.I):
                    api_endpoint_count += 1
            if node.get('children'):
                walk_all_fn(node['children'])

    walk_all_fn(repo.get('fileTree', []))
    deepest_nesting = _compute_max_depth(repo.get('fileTree', []))
    total_bytes = sum(repo.get('languages', {}).values())
    lang_count = len(repo.get('languages', {}))
    readme = repo.get('readmeContent', '') or ''
    doc_repo = file_count > 0 and lang_count == 0 and len(readme) > 200

    for lang, bytes_val in repo.get('languages', {}).items():
        total_lines += max(1, bytes_val // 50)

    average_file_size = round(total_lines / file_count) if file_count > 0 else 0

    def _score(val, threshold, base, doc_val, log_base=50):
        if val == 0:
            return doc_val if doc_repo else 0
        if val < threshold:
            return base
        return max(5, round(base + 5 - math.log2(val / threshold) * 3))

    file_count_score = _score(file_count, 20, 20, 15)
    file_size_score = _score(average_file_size, 50, 20, 15)
    lines_score = 0
    if total_lines == 0:
        lines_score = 25 if doc_repo else 0
    elif total_lines < 3000:
        lines_score = 30
    else:
        lines_score = max(10, round(35 - math.log2(total_lines / 3000) * 5))

    lang_diversity_score = min(30, lang_count * 6) if lang_count > 0 else (10 if doc_repo else 0)
    overall = min(100, round(file_count_score + file_size_score + lines_score + lang_diversity_score))
    test_coverage = round(test_file_count / file_count * 100) if file_count > 0 else 0

    lang_breakdown = sorted(
        [{'language': lang, 'files': max(1, round((bytes_val / max(1, total_bytes)) * file_count)),
          'lines': max(1, bytes_val // 50)} for lang, bytes_val in repo.get('languages', {}).items()],
        key=lambda x: -x['lines'],
    )

    return {
        'overall': overall, 'fileCount': file_count, 'totalLines': total_lines,
        'averageFileSize': average_file_size, 'deepestNesting': deepest_nesting,
        'languageBreakdown': lang_breakdown, 'testFileCount': test_file_count,
        'totalFileCount': file_count, 'testCoverageEstimate': test_coverage,
        'apiEndpointCount': api_endpoint_count, 'techDebtScore': 0,
        'fixmeCount': 0, 'todoCount': 0,
    }


def _compute_docs_quality(repo: dict) -> dict:
    readme = repo.get('readmeContent', '') or ''
    lower = readme.lower()
    heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))
    has_good = heading_count >= 3
    has_heading = heading_count >= 1
    file_names = [f.get('name', '').lower() for f in (repo.get('fileTree', []) or [])]

    readme_score = 0
    if readme:
        score = 0
        if len(readme) > 500: score += 30
        elif len(readme) > 100: score += 15
        else: score += 5
        if '## ' in readme: score += 20
        if 'install' in lower: score += 15
        if 'usage' in lower or 'example' in lower: score += 15
        if 'api' in lower or 'config' in lower: score += 10
        if 'license' in lower or 'contributing' in lower: score += 10
        if has_good and 'install' not in lower: score += 10
        readme_score = min(100, score)

    section_coverage = [
        {'section': 'Description', 'present': len(readme) > 50},
        {'section': 'Installation', 'present': 'install' in lower or (has_heading and heading_count >= 2)},
        {'section': 'Usage', 'present': 'usage' in lower or 'example' in lower or (has_heading and heading_count >= 3)},
        {'section': 'API Documentation', 'present': 'api' in lower or (has_heading and heading_count >= 4)},
        {'section': 'Configuration', 'present': 'config' in lower or (has_heading and heading_count >= 5)},
        {'section': 'Contributing', 'present': 'contributing.md' in file_names or 'contributing' in lower},
        {'section': 'License', 'present': 'license' in lower or repo.get('license') is not None},
        {'section': 'Code of Conduct', 'present': 'code_of_conduct.md' in file_names},
        {'section': 'Changelog', 'present': 'changelog.md' in file_names or 'changelog' in file_names},
        {'section': 'Tests', 'present': 'test' in lower or any(f.get('name') in ['tests', '__tests__'] for f in (repo.get('fileTree', []) or []))},
    ]

    suggestions = []
    if not readme: suggestions.append('Add a README.md file')
    if len(readme) < 200: suggestions.append('Expand the README with more details')
    if not any(s['section'] == 'Installation' and s['present'] for s in section_coverage):
        suggestions.append('Add installation instructions')
    if not any(s['section'] == 'Usage' and s['present'] for s in section_coverage):
        suggestions.append('Add usage examples')
    if not any(s['section'] == 'Contributing' and s['present'] for s in section_coverage):
        suggestions.append('Add contributing guidelines')
    if not any(s['section'] == 'License' and s['present'] for s in section_coverage):
        suggestions.append('Add a license file')

    return {
        'readmeScore': readme_score, 'hasReadme': bool(readme),
        'readmeLength': len(readme), 'hasContributing': 'contributing.md' in file_names,
        'hasCodeOfConduct': 'code_of_conduct.md' in file_names,
        'hasLicense': repo.get('license') is not None or 'license.md' in file_names,
        'hasChangelog': 'changelog.md' in file_names, 'hasApiDocs': 'api' in lower,
        'hasWiki': False, 'sectionCoverage': section_coverage, 'suggestions': suggestions,
    }


def _compute_bus_factor(contributors: list[dict]) -> int:
    if not contributors:
        return 1
    sorted_c = sorted(contributors, key=lambda c: -c.get('contributions', 0))
    total = sum(c.get('contributions', 0) for c in sorted_c)
    cumulative = 0
    for i, c in enumerate(sorted_c):
        cumulative += c.get('contributions', 0)
        if cumulative > total * 0.5:
            return max(1, i + 1)
    return len(contributors)


def _compute_health(repo: dict) -> dict:
    pushed = repo.get('pushedAt', '')
    last_commit_days = 999
    if pushed:
        try:
            pushed_dt = datetime.fromisoformat(pushed.replace('Z', '+00:00'))
            last_commit_days = max(0, (datetime.now(timezone.utc) - pushed_dt).days)
        except Exception:
            pass

    contributors = repo.get('contributors', []) or []
    contributor_count = len(contributors)
    bus_factor = _compute_bus_factor(contributors)
    stars = repo.get('stars', 0) or 0
    forks = repo.get('forks', 0) or 0
    open_issues = repo.get('openIssues', 0) or 0
    issues_per_star = (open_issues / stars) if stars > 0 else open_issues
    is_local = stars == 0 and forks == 0 and contributor_count == 0

    star_score = 0 if stars == 0 else min(25, round(math.log2(max(1, stars)) * 2.2))
    fork_score = 0 if forks == 0 else min(15, round(math.log2(max(1, forks)) * 2))
    activity_score = 25 if last_commit_days < 30 else (20 if last_commit_days < 90 else (
        10 if last_commit_days < 365 else (5 if last_commit_days < 730 else 0)))
    contrib_score = min(20, round(math.log2(max(1, contributor_count)) * 4))
    issue_score = 15 if issues_per_star < 0.1 else (12 if issues_per_star < 0.5 else (
        8 if issues_per_star < 2 else (4 if issues_per_star < 10 else 2)))
    overall = min(30, round(activity_score + issue_score)) if is_local else min(
        100, round(star_score + activity_score + contrib_score + issue_score + fork_score))

    file_tree = repo.get('fileTree', []) or []

    def _has_ci(nodes):
        for n in nodes:
            if '.github/workflows' in n.get('path', ''):
                return True
        return False

    def _has_tests(nodes):
        for n in nodes:
            if n.get('type') == 'tree' and n.get('name') in ['tests', '__tests__', 'test', 'spec', '__test__']:
                return True
            if n.get('type') == 'blob' and (re.search(r'\.(test|spec)\.\w+$', n.get('name', '')) or re.match(r'^test_.*\.\w+$', n.get('name', ''))):
                return True
        return False

    return {
        'overall': overall, 'stars': stars, 'forks': forks, 'openIssues': open_issues,
        'issuesPerStar': round(issues_per_star, 2), 'lastCommitDays': last_commit_days,
        'hasRecentActivity': last_commit_days < 90, 'contributorCount': contributor_count,
        'busFactor': bus_factor, 'releaseCount': 0,
        'hasCI': _has_ci(file_tree),
        'hasTests': _has_tests(file_tree),
    }


async def analyze_repository(repo: dict) -> dict:
    outlier_alerts: list[str] = []
    ft = repo.get('fileTree', []) or []
    total_blobs = 0

    def count_blobs(nodes):
        nonlocal total_blobs
        for n in nodes:
            if n.get('type') == 'blob':
                total_blobs += 1
            if n.get('children'):
                count_blobs(n['children'])
    count_blobs(ft)

    if total_blobs > 10000:
        outlier_alerts.append(f'Extremely large repo: {total_blobs} files')
    if total_blobs == 0:
        outlier_alerts.append('No source files detected')

    readme = repo.get('readmeContent', '') or ''
    if len(readme) > 50000:
        outlier_alerts.append('README exceeds 50KB')

    max_readme = 20000
    chunked = readme[:max_readme] + '\n\n<!-- README TRUNCATED -->' if len(readme) > max_readme else readme

    fixme_count = len(re.findall(r'\bFIXME\b', readme))
    todo_count = len(re.findall(r'\bTODO\b', readme))
    tech_debt = min(100, round(math.log2(max(1, fixme_count + todo_count)) * 15))

    ai_input = {
        'readme': chunked,
        'languages': repo.get('languages', {}),
        'fileTree': ft,
        'dependencyFiles': repo.get('dependencyFiles', {}),
        'topics': repo.get('topics', []),
        'description': repo.get('description', ''),
        'stars': repo.get('stars', 0),
        'forks': repo.get('forks', 0),
        'contributorCount': len(repo.get('contributors', []) or []),
        'pushedAt': repo.get('pushedAt', ''),
    }

    ai_result = ai_provider.analyze(ai_input)
    complexity = _compute_complexity(repo)
    complexity['techDebtScore'] = tech_debt
    complexity['fixmeCount'] = fixme_count
    complexity['todoCount'] = todo_count
    docs_quality = _compute_docs_quality(repo)
    health = _compute_health(repo)

    from ..models.advanced_signals import (
        compute_readme_level_scores, classify_repo_personality, compute_project_completeness,
        compute_onboarding_difficulty, compute_abandonment_risk, compute_config_complexity,
        compute_doc_coverage, compute_contributor_friendliness, compute_security_maturity,
        compute_deployment_readiness, compute_learning_value, compute_readme_code_consistency,
        compute_tech_debt_indicators, compute_maintainability_index,
    )

    readme_levels = compute_readme_level_scores(readme, repo, docs_quality)
    docs_quality['readmeLevels'] = readme_levels

    dep_keys = list(repo.get('dependencyFiles', {}).keys())
    file_names = [f.get('name', '').lower() for f in ft]
    lang_count = len(repo.get('languages', {}))
    doc_repo = lang_count == 0 and total_blobs > 0 and len(readme) > 200
    has_tests = health['hasTests']
    has_ci = health['hasCI']
    heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))

    file_paths = [f.get('path', '') for f in ft]
    has_issue_templates = any('issue_template' in p or '.github/ISSUE_TEMPLATE' in p for p in file_paths)
    has_pr_templates = any('pull_request_template' in p or '.github/PULL_REQUEST_TEMPLATE' in p for p in file_paths)

    advanced_signals = {
        'personality': classify_repo_personality(repo, total_blobs > 5, total_blobs, lang_count, doc_repo),
        'completeness': compute_project_completeness(bool(readme), has_tests, repo.get('license') is not None, has_ci, total_blobs, dep_keys),
        'onboardingDifficulty': compute_onboarding_difficulty(docs_quality, total_blobs, dep_keys, complexity['deepestNesting'], has_tests, has_ci),
        'abandonmentRisk': compute_abandonment_risk(health['lastCommitDays'], health['hasRecentActivity'], health['contributorCount'], health['stars'], health['overall']),
        'configComplexity': compute_config_complexity(dep_keys),
        'docCoverage': compute_doc_coverage(repo),
        'contributorFriendliness': compute_contributor_friendliness(readme.lower(), file_names, has_issue_templates, has_pr_templates),
        'securityMaturity': compute_security_maturity(repo, readme.lower(), has_ci),
        'deploymentReadiness': compute_deployment_readiness(dep_keys, has_ci, has_tests, readme.lower()),
        'learningValue': compute_learning_value(readme, heading_count, total_blobs, doc_repo),
        'readmeCodeConsistency': compute_readme_code_consistency(readme.lower(), dep_keys, ai_result['techStack']),
        'techDebtIndicators': compute_tech_debt_indicators(repo),
        'maintainabilityIndex': compute_maintainability_index(complexity['deepestNesting'], total_blobs, complexity['averageFileSize'], has_tests, has_ci, bool(readme)),
    }

    weights = {
        'Documentation Repository': {'rw': 0.70, 'cw': 0.30},
        'Educational Resource': {'rw': 0.70, 'cw': 0.30},
        'Research Project': {'rw': 0.50, 'cw': 0.50},
        'Library': {'rw': 0.35, 'cw': 0.65},
        'Open Source Framework': {'rw': 0.35, 'cw': 0.65},
        'Dataset Repository': {'rw': 0.60, 'cw': 0.40},
    }
    w = weights.get(advanced_signals['personality'], {'rw': 0.25, 'cw': 0.75})

    code_composite = round(
        ai_result['qualityScores']['codeQuality'] * 0.35 +
        complexity['overall'] * 0.25 +
        health['overall'] * 0.20 +
        ai_result['qualityScores']['maintainability'] * 0.20
    )
    corrected_overall = round(docs_quality['readmeScore'] * w['rw'] + code_composite * w['cw'])

    qs = ai_result['qualityScores']
    quality_scores = {
        'overall': corrected_overall,
        'codeQuality': qs['codeQuality'],
        'documentation': qs['documentation'],
        'maintainability': qs['maintainability'],
        'communityHealth': qs['communityHealth'],
        'security': qs['security'],
        'breakdown': {
            'Code Quality': {'score': qs['codeQuality'],
                             'reason': f'Based on lang diversity ({lang_count} langs), {complexity["fileCount"]} files, {complexity["averageFileSize"]} avg lines/file'},
            'Documentation': {'score': qs['documentation'],
                              'reason': f'README score {docs_quality["readmeScore"]}/100, {sum(1 for s in docs_quality["sectionCoverage"] if s["present"])}/10 sections covered'},
            'Maintainability': {'score': qs['maintainability'],
                                'reason': f'{len(complexity["languageBreakdown"])} languages, {complexity["fileCount"]} files, {complexity["deepestNesting"]} dir depth'},
            'Community': {'score': qs['communityHealth'],
                          'reason': f'{health["stars"]} stars, {health["forks"]} forks, {health["contributorCount"]} contributors'},
            'Security': {'score': qs['security'],
                         'reason': f'Lockfile: {bool(repo.get("dependencyFiles", {}).get("package-lock.json")) or bool(repo.get("dependencyFiles", {}).get("Cargo.lock"))}, CI: {has_ci}, Tests: {has_tests}'},
            'Tech Debt': {'score': 100 - tech_debt,
                          'reason': f'{fixme_count} FIXMEs, {todo_count} TODOs in README'},
        },
    }

    from ..models.readme_processor import process_readme as proc_readme
    processed = proc_readme(readme, repo.get('description', ''))

    report = {
        'id': f"{repo.get('owner', '')}/{repo.get('name', '')}",
        'repoUrl': repo.get('url', ''),
        'repoName': repo.get('name', ''),
        'owner': repo.get('owner', ''),
        'topics': repo.get('topics', []),
        'summary': ai_result['summary'],
        'processedReadme': processed,
        'techStack': ai_result['techStack'],
        'architecture': ai_result['architecture'],
        'complexity': complexity,
        'docsQuality': docs_quality,
        'health': health,
        'codeSmells': ai_result['codeSmells'],
        'suggestions': ai_result['suggestions'],
        'onboardingGuide': ai_result['onboardingGuide'],
        'qualityScores': quality_scores,
        'fileTree': ft,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'status': 'completed',
        'analysisSource': 'local-clone' if (stars := repo.get('stars', 0)) == 0 and repo.get('forks', 0) == 0 and len(repo.get('contributors', []) or []) == 0 else 'github-api',
        'outlierAlerts': outlier_alerts if outlier_alerts else None,
        'advancedSignals': advanced_signals,
    }

    _save_report(report)
    return report


def _save_report(report: dict) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = report['id'].replace('/', '-').lower()
    fpath = RESULTS_DIR / f'{safe_name}.json'
    fpath.write_text(json.dumps(report, indent=2), encoding='utf-8')


def load_report(repo_id: str) -> dict | None:
    safe = repo_id.replace('/', '-').lower()
    fpath = RESULTS_DIR / f'{safe}.json'
    if fpath.exists():
        return json.loads(fpath.read_text(encoding='utf-8'))
    prefix = safe[:safe.index('-')] if '-' in safe else safe
    for f in RESULTS_DIR.iterdir():
        if f.suffix == '.json' and f.stem.lower().startswith(prefix):
            return json.loads(f.read_text(encoding='utf-8'))
    return None


def list_reports(limit: int = 50, offset: int = 0) -> list[dict]:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(RESULTS_DIR.glob('*.json'), key=lambda f: f.stat().st_mtime, reverse=True)
    results = []
    for f in files[offset:offset + limit]:
        try:
            data = json.loads(f.read_text(encoding='utf-8'))
            results.append({
                'id': data.get('id', f.stem),
                'repoName': data.get('repoName', ''),
                'owner': data.get('owner', ''),
                'summary': (data.get('summary', '') or '')[:200],
                'overall': data.get('qualityScores', {}).get('overall', 0),
                'status': data.get('status', 'unknown'),
                'generatedAt': data.get('generatedAt', ''),
            })
        except Exception:
            pass
    return results


def search_reports(query: str, limit: int = 20) -> list[dict]:
    q = query.lower()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    matches = []
    for f in RESULTS_DIR.glob('*.json'):
        try:
            data = json.loads(f.read_text(encoding='utf-8'))
            if q in (data.get('repoName', '') or '').lower() or q in (data.get('owner', '') or '').lower():
                matches.append(data)
        except Exception:
            pass
    matches.sort(key=lambda x: x.get('qualityScores', {}).get('overall', 0), reverse=True)
    return [{
        'id': m.get('id', ''),
        'repoName': m.get('repoName', ''),
        'owner': m.get('owner', ''),
        'overall': m.get('qualityScores', {}).get('overall', 0),
        'generatedAt': m.get('generatedAt', ''),
    } for m in matches[:limit]]
