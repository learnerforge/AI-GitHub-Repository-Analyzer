from __future__ import annotations
import math

# ---------------------------------------------------------------------------
# Complete trainable parameter definitions
# ---------------------------------------------------------------------------
# Each param: (name, default, min, max, deltas_for_training)

PARAM_DEFS: list[tuple[str, float, float, float, list[float]]] = [
    # ---- Weights (range 0-1) ----
    ('w_codeQuality', 0.25, 0, 1, [0.05, -0.05, 0.1, -0.1]),
    ('w_docs', 0.20, 0, 1, [0.05, -0.05, 0.1, -0.1]),
    ('w_maintainability', 0.20, 0, 1, [0.05, -0.05, 0.1, -0.1]),
    ('w_community', 0.20, 0, 1, [0.05, -0.05, 0.1, -0.1]),
    ('w_security', 0.15, 0, 1, [0.05, -0.05, 0.1, -0.1]),

    # ---- Post-weight bonuses (range 0-50) ----
    ('b_complexity', 10, 0, 50, [5, -5, 10, -10]),
    ('b_readme', 10, 0, 50, [5, -5, 10, -10]),
    ('b_activity', 5, 0, 50, [5, -5, 10, -10]),

    # ---- Sub-score base values (range 0-100) ----
    ('base_codeQuality', 50, 0, 100, [5, -5, 10, -10]),
    ('base_documentation', 30, 0, 100, [5, -5, 10, -10]),
    ('base_maintainability', 50, 0, 100, [5, -5, 10, -10]),
    ('base_community', 20, 0, 100, [5, -5, 10, -10]),
    ('base_security', 30, 0, 100, [5, -5, 10, -10]),

    # ---- Code Quality adjustments (range 0-40) ----
    ('cq_lang2plus', 10, 0, 40, [3, -3, 5, -5]),
    ('cq_lang4plus', 10, 0, 40, [3, -3, 5, -5]),
    ('cq_files10to200', 10, 0, 40, [3, -3, 5, -5]),
    ('cq_files5to500', 5, 0, 40, [3, -3, 5, -5]),
    ('cq_avgFile50to300', 10, 0, 40, [3, -3, 5, -5]),
    ('cq_flatStructurePenalty', 5, 0, 40, [1, -1, 3, -3]),

    # ---- Documentation adjustments (range 0-40) ----
    ('doc_readmeExists', 20, 0, 40, [3, -3, 5, -5]),
    ('doc_scoreOver30', 10, 0, 30, [3, -3, 5, -5]),
    ('doc_scoreOver60', 10, 0, 30, [3, -3, 5, -5]),
    ('doc_hasContributing', 10, 0, 30, [3, -3, 5, -5]),
    ('doc_hasLicense', 10, 0, 30, [3, -3, 5, -5]),
    ('doc_hasApiDocs', 5, 0, 20, [2, -2, 3, -3]),
    ('doc_sectionMax', 5, 0, 20, [1, -1, 2, -2]),

    # ---- Maintainability adjustments (range 0-40) ----
    ('maint_lang2to5', 15, 0, 40, [3, -3, 5, -5]),
    ('maint_files10to300', 10, 0, 40, [3, -3, 5, -5]),
    ('maint_avgFileUpTo200', 10, 0, 40, [3, -3, 5, -5]),
    ('maint_linesUnder50k', 10, 0, 40, [3, -3, 5, -5]),
    ('maint_linesUnder10k', 5, 0, 40, [2, -2, 3, -3]),

    # ---- Community adjustments (range 0-40) ----
    ('comm_starsMax', 25, 0, 50, [3, -3, 5, -5]),
    ('comm_starsLogFactor', 5, 0, 20, [0.5, -0.5, 1, -1]),
    ('comm_forksMax', 15, 0, 40, [3, -3, 5, -5]),
    ('comm_forksLogFactor', 3, 0, 20, [0.5, -0.5, 1, -1]),
    ('comm_contributors2plus', 10, 0, 30, [3, -3, 5, -5]),
    ('comm_contributors5plus', 5, 0, 30, [2, -2, 3, -3]),
    ('comm_recentDays30', 10, 0, 30, [3, -3, 5, -5]),
    ('comm_recentDays180', 5, 0, 30, [2, -2, 3, -3]),
    ('comm_hasCI', 10, 0, 30, [3, -3, 5, -5]),
    ('comm_hasTests', 5, 0, 30, [2, -2, 3, -3]),

    # ---- Security adjustments (range 0-40) ----
    ('sec_lockFile', 20, 0, 40, [3, -3, 5, -5]),
    ('sec_hasCI', 20, 0, 40, [3, -3, 5, -5]),
    ('sec_hasTests', 15, 0, 40, [3, -3, 5, -5]),
    ('sec_licenseFile', 15, 0, 40, [3, -3, 5, -5]),
]

DEFAULT_PARAMS: dict[str, float] = {name: default for name, default, *_ in PARAM_DEFS}

# Parameter group metadata for the RL system
PARAM_GROUPS: dict[str, dict] = {
    name: {
        'range': (lo, hi),
        'deltas': deltas,
        'category': (
            'weight' if name.startswith('w_') else
            'bonus' if name.startswith('b_') else
            'base' if name.startswith('base_') else
            'subscore'
        ),
    }
    for name, _, lo, hi, deltas in PARAM_DEFS
}

DOC_REPO_TOPICS = {'documentation', 'docs', 'book', 'wiki', 'knowledge', 'learning', 'tutorial', 'guide'}


def compute_quality_scores(
    languages: dict[str, int],
    file_tree: list[dict],
    readme_content: str,
    dependency_files: dict[str, str],
    topics: list[str],
    stars: int = 0,
    forks: int = 0,
    contributors: int = 0,
    has_tests: bool = False,
    has_ci: bool = False,
    pushed_at: str = '',
    params: dict | None = None,
    complexity: dict | None = None,
    docs_quality: dict | None = None,
    health: dict | None = None,
) -> dict:
    p = {**DEFAULT_PARAMS, **(params or {})}
    file_count = _safe_get(complexity, 'fileCount', len(file_tree))
    avg_file_size = _safe_get(complexity, 'averageFileSize', 0)
    total_lines = _safe_get(complexity, 'totalLines', 0)
    lang_count = len(languages)

    code_quality = _score_code_quality(lang_count, file_count, avg_file_size, file_tree, p)
    documentation = _score_documentation(readme_content, docs_quality, p)
    maintainability = _score_maintainability(lang_count, file_count, avg_file_size, total_lines, p)
    community = _score_community(stars, forks, contributors, pushed_at, has_ci, has_tests, file_count, p)
    security = _score_security(dependency_files, has_ci, has_tests, p)

    total = (
        p['w_codeQuality'] * code_quality
        + p['w_docs'] * documentation
        + p['w_maintainability'] * maintainability
        + p['w_community'] * community
        + p['w_security'] * security
    )

    bonus_adj = (
        (p.get('b_complexity', 10) - 10)
        + (p.get('b_readme', 10) - 10)
        + (p.get('b_activity', 5) - 5)
    ) / 4

    is_doc_repo = bool(topics and any(t.lower() in DOC_REPO_TOPICS for t in topics))
    if is_doc_repo:
        total = total * 0.4 + documentation * 0.6

    overall = min(100, max(0, round(total + bonus_adj)))
    return {
        'overall': overall,
        'codeQuality': round(code_quality),
        'documentation': round(documentation),
        'maintainability': round(maintainability),
        'communityHealth': round(community),
        'security': round(security),
        'breakdown': {
            'Code Quality': {'score': round(code_quality),
                             'reason': f'{lang_count} langs, {file_count} files, {avg_file_size} avg lines/file'},
            'Documentation': {'score': round(documentation),
                              'reason': f'README score {_safe_get(docs_quality, "readmeScore", 50)}/100'},
            'Maintainability': {'score': round(maintainability),
                                'reason': f'{lang_count} languages, {file_count} files'},
            'Community': {'score': round(community),
                          'reason': f'{stars} stars, {forks} forks, {contributors} contributors'},
            'Security': {'score': round(security),
                         'reason': f'CI: {has_ci}, Tests: {has_tests}, Lockfile: {bool(dependency_files)}'},
        },
    }


def _score_code_quality(
    lang_count: int, file_count: int, avg_file_size: float,
    file_tree: list[dict], p: dict,
) -> float:
    score = p['base_codeQuality']
    if lang_count >= 2:
        score += p['cq_lang2plus']
    if lang_count >= 4:
        score += p['cq_lang4plus']
    if 10 <= file_count <= 200:
        score += p['cq_files10to200']
    if 5 <= file_count <= 500:
        score += p['cq_files5to500']
    if 50 <= avg_file_size <= 300:
        score += p['cq_avgFile50to300']
    if _has_flat_structure(file_tree):
        score -= p['cq_flatStructurePenalty']
    return min(100, max(0, score))


def _has_flat_structure(tree: list[dict]) -> bool:
    dirs = [n for n in tree if n.get('type') == 'tree']
    return len(dirs) > 50 or len(dirs) == 0


def _score_documentation(readme_content: str, docs_quality: dict | None, p: dict) -> float:
    score = p['base_documentation']
    if readme_content and len(readme_content) > 20:
        score += p['doc_readmeExists']
    if docs_quality:
        rscore = docs_quality.get('readmeScore', 0)
        if rscore > 30:
            score += p['doc_scoreOver30']
        if rscore > 60:
            score += p['doc_scoreOver60']
        if docs_quality.get('hasContributing'):
            score += p['doc_hasContributing']
        if docs_quality.get('hasLicense'):
            score += p['doc_hasLicense']
        if docs_quality.get('hasApiDocs'):
            score += p['doc_hasApiDocs']
        sections = docs_quality.get('sectionCoverage', [])
        score += min(p['doc_sectionMax'], sum(1 for s in sections if s.get('present', False)))
    return min(100, max(0, score))


def _score_maintainability(
    lang_count: int, file_count: int,
    avg_file_size: float, total_lines: int, p: dict,
) -> float:
    score = p['base_maintainability']
    if 2 <= lang_count <= 5:
        score += p['maint_lang2to5']
    if 10 <= file_count <= 300:
        score += p['maint_files10to300']
    if avg_file_size <= 200:
        score += p['maint_avgFileUpTo200']
    if total_lines < 50000:
        score += p['maint_linesUnder50k']
    if total_lines < 10000:
        score += p['maint_linesUnder10k']
    return min(100, max(0, score))


def _score_community(
    stars: int, forks: int, contributors: int,
    pushed_at: str, has_ci: bool, has_tests: bool,
    file_count: int, p: dict,
) -> float:
    score = p['base_community']
    if stars > 0:
        score += min(p['comm_starsMax'], p['comm_starsLogFactor'] * math.log2(max(1, stars)))
    if forks > 0:
        score += min(p['comm_forksMax'], p['comm_forksLogFactor'] * math.log2(max(1, forks)))
    if contributors > 1:
        score += p['comm_contributors2plus']
    if contributors > 5:
        score += p['comm_contributors5plus']
    if pushed_at:
        try:
            from datetime import datetime, timezone
            pushed = datetime.fromisoformat(pushed_at.replace('Z', '+00:00'))
            days = (datetime.now(timezone.utc) - pushed).days
            if days < 30:
                score += p['comm_recentDays30']
            elif days < 180:
                score += p['comm_recentDays180']
        except Exception:
            pass
    if has_ci:
        score += p['comm_hasCI']
    if has_tests:
        score += p['comm_hasTests']
    return min(100, max(0, score))


def _score_security(
    dependency_files: dict[str, str],
    has_ci: bool, has_tests: bool, p: dict,
) -> float:
    score = p['base_security']
    has_lockfile = bool(dependency_files)
    if has_lockfile:
        score += p['sec_lockFile']
    if has_ci:
        score += p['sec_hasCI']
    if has_tests:
        score += p['sec_hasTests']
    license_files = [f for f in dependency_files if 'license' in f.lower()]
    if license_files:
        score += p['sec_licenseFile']
    return min(100, max(0, score))


def _safe_get(d: dict | None, key: str, default: float = 0) -> float:
    if d is None:
        return default
    return d.get(key, default)


def get_default_params() -> dict[str, float]:
    return dict(DEFAULT_PARAMS)


def compute_validation_score(scores: dict, params: dict | None = None) -> float:
    p = {**DEFAULT_PARAMS, **(params or {})}
    bonus_adj = (
        (p.get('b_complexity', 10) - 10)
        + (p.get('b_readme', 10) - 10)
        + (p.get('b_activity', 5) - 5)
    ) / 4
    return (
        scores.get('codeQuality', 0) * p['w_codeQuality']
        + scores.get('documentation', 0) * p['w_docs']
        + scores.get('maintainability', 0) * p['w_maintainability']
        + scores.get('communityHealth', 0) * p['w_community']
        + scores.get('security', 0) * p['w_security']
    ) + bonus_adj


def compute_reward(validation_score: float, error_penalty: float = 0.0) -> float:
    base = (validation_score - 50) / 50.0
    return max(-1.0, min(1.0, base - error_penalty))
