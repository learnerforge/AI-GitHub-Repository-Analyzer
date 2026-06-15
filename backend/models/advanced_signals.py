from __future__ import annotations
import re
from typing import Any


def compute_readme_level_scores(readme: str, repo: dict, docs: dict) -> dict:
    if not readme:
        return {k: 0 for k in [
            'existence', 'projectIdentity', 'problemStatement', 'features', 'installation',
            'usage', 'examples', 'architecture', 'techStack', 'configuration', 'apiDocs',
            'screenshots', 'contributing', 'testing', 'deployment', 'license', 'maintenance',
            'community', 'readability', 'advancedSignals', 'total',
        ]}
    lower = readme.lower()
    lines = readme.split('\n')
    words = len(readme.split())
    heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))

    l1 = _level1_existence(readme, words)
    l2 = _level2_identity(readme, lower, repo)
    l3 = _level3_problem(lower)
    l4 = _level4_features(lower)
    l5 = _level5_installation(lower, repo)
    l6 = _level6_usage(lower)
    l7 = _level7_examples(lower)
    l8 = _level8_architecture(lower, repo)
    l9 = _level9_tech_stack(lower)
    l10 = _level10_configuration(lower, repo)
    l11 = _level11_api_docs(lower)
    l12 = _level12_screenshots(readme)
    l13 = _level13_contributing(lower, repo)
    l14 = _level14_testing(lower, repo)
    l15 = _level15_deployment(lower, repo)
    l16 = _level16_license(lower, repo)
    l17 = _level17_maintenance(lower)
    l18 = _level18_community(lower)
    l19 = _level19_readability(readme, lines, heading_count)
    l20 = _level20_advanced_signals(readme)

    total = min(100, round(
        l1 * 0.10 + l2 * 0.10 + l3 * 0.05 + l4 * 0.10 + l5 * 0.10 +
        l6 * 0.08 + l7 * 0.08 + l8 * 0.08 + l9 * 0.05 + l10 * 0.05 +
        l11 * 0.05 + l12 * 0.03 + l13 * 0.03 + l14 * 0.03 + l15 * 0.03 +
        l16 * 0.02 + l17 * 0.02 + l18 * 0.02 + l19 * 0.05 + l20 * 0.03
    ))
    return {
        'existence': l1, 'projectIdentity': l2, 'problemStatement': l3, 'features': l4,
        'installation': l5, 'usage': l6, 'examples': l7, 'architecture': l8, 'techStack': l9,
        'configuration': l10, 'apiDocs': l11, 'screenshots': l12, 'contributing': l13,
        'testing': l14, 'deployment': l15, 'license': l16, 'maintenance': l17, 'community': l18,
        'readability': l19, 'advancedSignals': l20, 'total': total,
    }


def _level1_existence(readme: str, words: int) -> float:
    if words < 20: return 10
    if words < 100: return 40
    if words < 500: return 70
    return 100


def _level2_identity(readme: str, lower: str, repo: dict) -> float:
    score = 0
    first = readme.split('\n')[0].strip() if readme else ''
    if first.startswith('#') and len(first) > 3:
        score += 30
    desc = (repo.get('description') or '').strip()
    if desc and len(desc) > 10:
        score += 25
    if '## ' in lower and len(re.findall(r'^## ', readme, re.MULTILINE)) >= 2:
        score += 20
    purpose = ['what is', 'about', 'introduction', 'overview', 'what this']
    if any(w in lower for w in purpose):
        score += 25
    return min(100, score)


def _level3_problem(lower: str) -> float:
    score = 0
    problem = ['why', 'problem', 'use case', 'target', 'audience', 'who this', 'built for', 'motivation', 'goal', 'objective']
    if any(w in lower for w in problem):
        score += 50
    content = _section_content(lower, ['why', 'problem', 'motivation', 'use case'])
    if content and len(content) > 50:
        score += 50
    return min(100, score)


def _level4_features(lower: str) -> float:
    score = 0
    if 'feature' in lower or 'capabilities' in lower or 'what you can' in lower:
        score += 30
    section = _section_content(lower, ['features', 'capabilities', 'what you can do'])
    if section:
        bullets = len(re.findall(r'^[-*+]\s', section, re.MULTILINE))
        score += min(70, bullets * 15)
    return min(100, score)


def _level5_installation(lower: str, repo: dict) -> float:
    score = 0
    if 'install' in lower or 'setup' in lower or 'getting started' in lower:
        score += 25
    section = _section_content(lower, ['installation', 'setup', 'getting started', 'quick start'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(40, code * 15)
    if 'clone' in lower or 'download' in lower:
        score += 10
    if any(kw in lower for kw in ['npm install', 'pip install', 'cargo build', 'go get', 'brew']):
        score += 15
    dep_files = list((repo.get('dependencyFiles') or {}).keys())
    if any('docker-compose' in f for f in dep_files):
        score += 10
    return min(100, score)


def _level6_usage(lower: str) -> float:
    score = 0
    if 'usage' in lower or 'how to use' in lower or 'quick start' in lower:
        score += 30
    section = _section_content(lower, ['usage', 'how to use', 'examples', 'quick start'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(40, code * 10)
    if 'example' in lower and len(re.findall(r'example', lower)) >= 2:
        score += 30
    return min(100, score)


def _level7_examples(lower: str) -> float:
    score = 0
    if 'example' in lower or 'demo' in lower:
        score += 20
    if len(re.findall(r'```', lower)) >= 4:
        score += 30
    section = _section_content(lower, ['examples', 'demo', 'sample', 'usage examples'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(50, code * 12)
    return min(100, score)


def _level8_architecture(lower: str, repo: dict) -> float:
    score = 0
    if 'architecture' in lower or 'structure' in lower or 'overview' in lower:
        score += 25
    if 'data flow' in lower or 'flow' in lower or 'pipeline' in lower:
        score += 15
    section = _section_content(lower, ['architecture', 'structure', 'project structure', 'overview'])
    if section and len(section) > 100:
        score += 20
    depths = _count_dir_depths(repo.get('fileTree', []) or [])
    max_depth = max(depths) if depths else 0
    if max_depth >= 2:
        score += 20
    if re.search(r'```(mermaid|ascii|graph)', lower):
        score += 20
    return min(100, score)


def _level9_tech_stack(lower: str) -> float:
    score = 0
    if 'built with' in lower or 'tech stack' in lower or 'technologies' in lower or 'powered by' in lower:
        score += 30
    section = _section_content(lower, ['built with', 'tech stack', 'technologies', 'powered by', 'stack'])
    if section:
        bullets = len(re.findall(r'^[-*+]\s', section, re.MULTILINE))
        score += min(40, bullets * 10)
    keywords = ['react', 'node', 'python', 'go', 'rust', 'typescript', 'javascript', 'docker', 'postgres', 'redis', 'kubernetes']
    found = sum(1 for k in keywords if k in lower)
    score += min(30, found * 5)
    return min(100, score)


def _level10_configuration(lower: str, repo: dict) -> float:
    score = 0
    if 'config' in lower or 'environment' in lower or '.env' in lower or 'settings' in lower:
        score += 25
    section = _section_content(lower, ['configuration', 'environment', 'setup', 'env'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(35, code * 10)
    dep_files = list((repo.get('dependencyFiles') or {}).keys())
    if any(f.startswith('.env') or 'config' in f for f in dep_files):
        score += 25
    if any('docker-compose' in f for f in dep_files):
        score += 15
    return min(100, score)


def _level11_api_docs(lower: str) -> float:
    score = 0
    if 'api' in lower or 'endpoint' in lower or 'route' in lower:
        score += 20
    section = _section_content(lower, ['api', 'api reference', 'api documentation', 'endpoints', 'routes'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(50, code * 12)
        if len(section) > 200:
            score += 30
    return min(100, score)


def _level12_screenshots(readme: str) -> float:
    if not readme:
        return 0
    score = 0
    md_imgs = len(re.findall(r'!\[.*?\]\(.*?\)', readme))
    html_imgs = len(re.findall(r'<img[^>]+>', readme, re.IGNORECASE))
    total = md_imgs + html_imgs
    if total >= 3: score = 100
    elif total == 2: score = 70
    elif total == 1: score = 40
    if '.gif' in readme or 'demo' in readme:
        score = max(score, 50)
    return score


def _level13_contributing(lower: str, repo: dict) -> float:
    score = 0
    if 'contributing' in lower or 'contribute' in lower or 'how to contribute' in lower:
        score += 30
    section = _section_content(lower, ['contributing', 'contribute', 'how to contribute'])
    if section and len(section) > 100:
        score += 20
    if 'pull request' in lower or 'pr' in lower:
        score += 15
    if 'code of conduct' in lower:
        score += 15
    file_names = [f.get('name', '').lower() for f in (repo.get('fileTree', []) or [])]
    if 'contributing.md' in file_names or 'contributing' in file_names:
        score += 20
    return min(100, score)


def _level14_testing(lower: str, repo: dict) -> float:
    score = 0
    if 'test' in lower or 'testing' in lower or 'coverage' in lower:
        score += 25
    section = _section_content(lower, ['testing', 'tests', 'running tests'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(35, code * 10)
    file_names = [f.get('name', '').lower() for f in (repo.get('fileTree', []) or [])]
    if any('jest' in f or '.test.' in f or '.spec.' in f for f in file_names):
        score += 20
    if 'ci' in lower or 'github actions' in lower or 'travis' in lower:
        score += 20
    return min(100, score)


def _level15_deployment(lower: str, repo: dict) -> float:
    score = 0
    if 'deploy' in lower or 'deployment' in lower or 'hosting' in lower or 'production' in lower:
        score += 25
    section = _section_content(lower, ['deployment', 'deploy', 'hosting', 'production'])
    if section:
        code = len(re.findall(r'```', section)) / 2
        score += min(35, code * 10)
    dep_files = list((repo.get('dependencyFiles') or {}).keys())
    if any('Dockerfile' in f for f in dep_files):
        score += 20
    if any('docker-compose' in f for f in dep_files):
        score += 20
    return min(100, score)


def _level16_license(lower: str, repo: dict) -> float:
    if repo.get('license'):
        return 100
    if any(kw in lower for kw in ['mit', 'apache', 'gpl', 'bsd']):
        return 80
    if 'license' in lower:
        return 40
    return 0


def _level17_maintenance(lower: str) -> float:
    score = 0
    if 'roadmap' in lower or 'future' in lower or 'planned' in lower:
        score += 30
    if 'changelog' in lower or "what's new" in lower or 'release notes' in lower:
        score += 25
    if 'status' in lower or 'stable' in lower or 'active' in lower:
        score += 25
    if 'todo' in lower or 'coming soon' in lower:
        score += 20
    return min(100, score)


def _level18_community(lower: str) -> float:
    score = 0
    if 'discord' in lower or 'slack' in lower or 'chat' in lower:
        score += 25
    if 'discussion' in lower or 'forum' in lower or 'community' in lower:
        score += 20
    if 'contact' in lower or 'support' in lower or 'help' in lower:
        score += 20
    if 'twitter' in lower or '@' in lower or 'email' in lower:
        score += 15
    if 'stack overflow' in lower or 'github discussions' in lower:
        score += 20
    return min(100, score)


def _level19_readability(readme: str, lines: list[str], heading_count: int) -> float:
    score = 30
    if heading_count >= 3: score += 15
    if heading_count >= 6: score += 10
    if heading_count >= 10: score += 5
    code = len(re.findall(r'```', readme)) / 2
    if code >= 2: score += 10
    if code >= 5: score += 10
    if '- [' in readme or '* [' in readme: score += 5
    if '|' in readme and '---' in readme: score += 5
    if '## Table of Contents' in readme or '## Contents' in readme or '<!-- TOC' in readme or re.search(r'\[.*\]\(#.*\)', readme):
        score += 10
    return min(100, score)


def _level20_advanced_signals(readme: str) -> float:
    score = 0
    badges = len(re.findall(r'!\[.*?\]\(https://img\.shields\.io', readme))
    score += min(40, badges * 10)
    if 'build status' in readme or 'build passing' in readme: score += 10
    if 'coverage' in readme or 'codecov' in readme: score += 10
    if 'security' in readme or 'dependabot' in readme or 'security policy' in readme: score += 10
    if 'benchmark' in readme or 'performance' in readme: score += 10
    if 'faq' in readme or 'troubleshooting' in readme or 'common issues' in readme: score += 10
    if 'migration' in readme or 'upgrading' in readme or 'breaking changes' in readme: score += 10
    return min(100, score)


def _section_content(lower: str, names: list[str]) -> str | None:
    lines = lower.split('\n')
    in_section = False
    content: list[str] = []
    for line in lines:
        if line.startswith('## ') and any(n in line for n in names):
            in_section = True
            continue
        if in_section:
            if line.startswith('## '):
                break
            content.append(line)
    return '\n'.join(content).strip() if content else None


def _count_dir_depths(tree: list[dict], depth: int = 0) -> list[int]:
    depths: list[int] = []
    for node in tree:
        if node.get('type') == 'tree':
            depths.append(depth + 1)
            if node.get('children'):
                depths.extend(_count_dir_depths(node['children'], depth + 1))
    return depths


def classify_repo_personality(
    repo: dict, has_source_code: bool, total_files: int,
    lang_count: int, is_doc_repo: bool,
) -> str:
    topics = [t.lower() for t in (repo.get('topics') or [])]
    readme_lower = (repo.get('readmeContent') or '').lower()
    dep_keys = list((repo.get('dependencyFiles') or {}).keys())

    if is_doc_repo or any(t in topics for t in ['education', 'learning', 'books', 'documentation', 'tutorial', 'awesome-list', 'curated']):
        title = (repo.get('readmeContent') or '').split('\n')[0] or ''
        tl = title.lower()
        if 'book' in tl or 'list' in tl or 'awesome' in tl or 'awesome-list' in topics:
            return 'Documentation Repository'
        if any(t in topics for t in ['education', 'learning', 'study', 'tutorial']) or 'learn' in readme_lower or 'study' in readme_lower:
            return 'Educational Resource'
        return 'Documentation Repository'

    if any(t in topics for t in ['dataset', 'data', 'csv', 'json-dataset']):
        return 'Dataset Repository'

    if any(t in topics for t in ['framework', 'library', 'sdk', 'api', 'package']) or any(f in dep_keys for f in ['package.json', 'setup.py', 'Cargo.toml']):
        return 'Library' if total_files < 100 else 'Open Source Framework'

    if any(t in topics for t in ['cli', 'command-line', 'terminal']):
        return 'CLI Tool'

    if any(t in topics for t in ['research', 'paper', 'academic', 'science']) or 'research' in readme_lower or 'paper' in readme_lower:
        return 'Research Project'

    if repo.get('stars', 0) > 1000 and total_files > 100 and lang_count >= 3:
        return 'Enterprise Application'

    if any(t in topics for t in ['hackathon', 'demo', 'mvp', 'prototype']) or (repo.get('stars', 0) < 100 and total_files < 50 and lang_count <= 3):
        return 'Startup MVP'

    if 'portfolio' in readme_lower or (repo.get('stars', 0) == 0 and total_files < 30):
        return 'Portfolio'

    if total_files > 200 and lang_count >= 3:
        return 'Open Source Framework'

    return 'Learning Project'


def compute_project_completeness(
    has_readme: bool, has_tests: bool, has_license: bool,
    has_ci: bool, total_files: int, dep_keys: list[str],
) -> dict:
    has_source_code = total_files > 5
    has_config = len(dep_keys) > 0 or has_ci
    has_deployment = any(f for f in dep_keys if 'Dockerfile' in f or 'docker-compose' in f or '.github/workflows' in f)
    checks = [has_readme, has_source_code, has_config, has_tests, has_license, has_deployment]
    count = sum(1 for c in checks if c)
    return {
        'hasReadme': has_readme, 'hasSourceCode': has_source_code, 'hasConfig': has_config,
        'hasTests': has_tests, 'hasLicense': has_license, 'hasDeployment': has_deployment,
        'percentage': round((count / 6) * 100),
    }


def compute_onboarding_difficulty(
    docs: dict, total_files: int, dep_keys: list[str],
    max_depth: int, has_tests: bool, has_ci: bool,
) -> str:
    diff = 0
    if not docs.get('hasReadme') or docs.get('readmeScore', 0) < 30:
        diff += 3
    elif docs.get('readmeScore', 0) < 60:
        diff += 2
    else:
        diff += 1

    coverage = docs.get('sectionCoverage', []) or []
    if not any(s.get('section') == 'Installation' and s.get('present') for s in coverage):
        diff += 2
    if not any(s.get('section') == 'Usage' and s.get('present') for s in coverage):
        diff += 2
    if len(dep_keys) == 0 and not has_ci:
        diff += 2
    if len(dep_keys) > 5:
        diff += 1
    if total_files > 1000: diff += 2
    elif total_files > 200: diff += 1
    if max_depth > 6: diff += 1
    if not has_tests: diff += 1
    if diff <= 2: return 'Easy'
    if diff <= 4: return 'Medium'
    if diff <= 6: return 'Hard'
    return 'Very Hard'


def compute_abandonment_risk(
    last_commit_days: int, has_recent_activity: bool,
    contributor_count: int, stars: int, health_score: float,
) -> str:
    if last_commit_days > 730: return 'Archived'
    if not has_recent_activity and contributor_count <= 1: return 'High Risk'
    if not has_recent_activity: return 'Medium Risk'
    if last_commit_days > 180: return 'Medium Risk'
    if contributor_count <= 1 and stars > 100: return 'Medium Risk'
    return 'Low Risk'


def compute_config_complexity(dep_keys: list[str]) -> dict:
    config = [f for f in dep_keys if any(x in f for x in
              ['.env', 'config', '.yml', '.yaml', '.json', '.toml', 'docker-compose', 'Dockerfile', 'Makefile'])]
    count = len(config)
    if count <= 3: level = 'Easy'
    elif count <= 8: level = 'Medium'
    elif count <= 15: level = 'Hard'
    else: level = 'Very Hard'
    return {'count': count, 'level': level}


def compute_doc_coverage(repo: dict) -> dict:
    readme = repo.get('readmeContent')
    dep_files = list((repo.get('dependencyFiles') or {}).keys())
    file_names = [f.get('name', '').lower() for f in (repo.get('fileTree', []) or [])]
    dir_names = [f.get('name', '') for f in (repo.get('fileTree', []) or []) if f.get('type') == 'tree']

    elements = [
        bool(readme),
        any('contributing' in f.lower() for f in dep_files),
        'code_of_conduct.md' in file_names,
        any(f in file_names for f in ['changelog.md', 'changelog']),
        'security.md' in file_names,
        any(f in file_names for f in ['LICENSE', 'LICENSE.md', 'LICENSE.txt']),
        any(d in dir_names for d in ['docs', 'documentation', 'wiki']),
        any(d in dir_names for d in ['examples', 'samples']),
        'tutorials' in dir_names,
    ]
    count = sum(1 for e in elements if e)
    max_e = len(elements)
    pct = round((count / max_e) * 100)
    level = 'Comprehensive' if pct >= 75 else ('Good' if pct >= 50 else ('Minimal' if pct >= 25 else 'Poor'))
    return {'percentage': pct, 'level': level}


def compute_contributor_friendliness(
    readme_lower: str, file_names: list[str],
    has_issue_templates: bool, has_pr_templates: bool,
) -> str:
    score = 0
    if 'contributing.md' in file_names or 'contributing' in readme_lower: score += 2
    if 'pull request' in readme_lower or 'pr' in readme_lower: score += 1
    if 'code of conduct' in readme_lower: score += 1
    if has_issue_templates: score += 1
    if has_pr_templates: score += 1
    if 'good first issue' in readme_lower or 'help wanted' in readme_lower: score += 1
    if 'development' in readme_lower or 'local setup' in readme_lower or 'getting started' in readme_lower: score += 1
    if score >= 6: return 'Easy'
    if score >= 4: return 'Medium'
    if score >= 2: return 'Hard'
    return 'Very Hard'


def compute_security_maturity(repo: dict, readme_lower: str, has_ci: bool) -> str:
    score = 0
    dep_keys = list((repo.get('dependencyFiles') or {}).keys())
    lock_files = ['package-lock', 'yarn.lock', 'pnpm-lock', 'Cargo.lock', 'go.sum']
    if any(f in dep for dep in dep_keys for f in lock_files if f in dep):
        score += 1
    if 'security' in readme_lower or 'security policy' in readme_lower:
        score += 1
    file_names = [f.get('name', '').lower() for f in (repo.get('fileTree', []) or [])]
    if 'security.md' in file_names:
        score += 1
    if has_ci: score += 1
    if repo.get('license'): score += 1
    if any('.github/workflows' in f.get('path', '') for f in (repo.get('fileTree', []) or [])):
        score += 1
    code_files = [f for f in (repo.get('fileTree', []) or []) if f.get('type') == 'blob' and not re.search(r'\.(md|txt|yml|yaml|json|toml)$', f.get('name', ''))]
    if code_files: score += 1
    if score >= 5: return 'Advanced'
    if score >= 3: return 'Intermediate'
    if score >= 1: return 'Beginner'
    return 'None'


def compute_deployment_readiness(
    dep_keys: list[str], has_ci: bool, has_tests: bool, readme_lower: str,
) -> str:
    score = 0
    if any('Dockerfile' in f for f in dep_keys): score += 2
    if any('docker-compose' in f for f in dep_keys): score += 1
    if has_ci: score += 2
    if has_tests: score += 1
    if 'deploy' in readme_lower or 'deployment' in readme_lower or 'production' in readme_lower: score += 1
    if any('.env.example' in f or '.env.sample' in f for f in dep_keys): score += 1
    if score >= 6: return 'Easy'
    if score >= 4: return 'Medium'
    if score >= 2: return 'Hard'
    return 'Very Hard'


def compute_learning_value(
    readme: str, heading_count: int, total_files: int, is_doc_repo: bool,
) -> float:
    if not readme: return 0
    score = 20
    lower = readme.lower()
    examples_count = len(re.findall(r'example', lower))
    explanation = ['how', 'why', 'explain', 'understand', 'guide', 'tutorial', 'concept', 'overview', 'walkthrough', 'learn']
    explanations_found = sum(1 for w in explanation if w in lower)
    if examples_count >= 3: score += 15
    if examples_count >= 5: score += 10
    if explanations_found >= 4: score += 15
    if explanations_found >= 6: score += 10
    if heading_count >= 8: score += 10
    if heading_count >= 12: score += 5
    if len(re.findall(r'```', lower)) >= 4: score += 10
    if is_doc_repo: score += 10
    if 0 < total_files <= 50: score += 5
    return min(100, score)


def compute_readme_code_consistency(
    readme_lower: str, dep_keys: list[str], tech_stack: dict,
) -> float:
    consistency = 100
    claimed: list[str] = []
    mapping = [
        ('react', ['react', 'reactjs']), ('next.js', ['next.js', 'nextjs', 'next']),
        ('vue', ['vue', 'vuejs', 'vue.js']), ('angular', ['angular']),
        ('express', ['express', 'express.js']), ('django', ['django']),
        ('flask', ['flask']), ('fastapi', ['fastapi']),
        ('postgresql', ['postgresql', 'postgres', 'pg']),
        ('mongodb', ['mongodb', 'mongo']), ('redis', ['redis']),
        ('docker', ['docker']), ('kubernetes', ['kubernetes', 'k8s']),
        ('typescript', ['typescript']), ('python', ['python']),
        ('rust', ['rust']), ('go', ['golang', 'go language']),
    ]
    for name, kws in mapping:
        if any(k in readme_lower for k in kws):
            claimed.append(name)
    all_items = [s.lower() for s in (tech_stack.get('frameworks') or [])] \
        + [s.lower() for s in (tech_stack.get('databases') or [])] \
        + [s.lower() for s in (tech_stack.get('tools') or [])] \
        + [l.get('name', '').lower() for l in (tech_stack.get('languages') or [])]
    for tech in claimed:
        if not any(tech in item or re.sub(r'\(.*?\)', '', item).strip() in tech for item in all_items):
            consistency -= 15
    return max(0, consistency)


def compute_tech_debt_indicators(repo: dict) -> dict:
    readme = repo.get('readmeContent') or ''
    todos = len(re.findall(r'\bTODO\b', readme))
    fixmes = len(re.findall(r'\bFIXME\b', readme))
    hacks = len(re.findall(r'\bHACK\b', readme))
    temps = len(re.findall(r'\bTEMP\b', readme))
    total = todos + fixmes + hacks + temps
    level = 'Low' if total <= 3 else ('Medium' if total <= 10 else 'High')
    return {'total': total, 'level': level}


def compute_maintainability_index(
    max_depth: int, file_count: int, average_file_size: float,
    has_tests: bool, has_ci: bool, has_readme: bool,
) -> str:
    score = 50
    if max_depth <= 3: score += 10
    elif max_depth <= 5: score += 5
    else: score -= 5
    if file_count < 100: score += 10
    elif file_count < 500: score += 5
    elif file_count > 5000: score -= 5
    if average_file_size < 50: score += 10
    elif average_file_size < 150: score += 5
    elif average_file_size > 500: score -= 5
    if has_tests: score += 15
    if has_ci: score += 10
    if has_readme: score += 10
    if score >= 90: return 'Excellent'
    if score >= 70: return 'Good'
    if score >= 50: return 'Moderate'
    return 'Poor'
