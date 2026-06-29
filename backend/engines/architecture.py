from __future__ import annotations
from typing import Any
import re
from . import Engine, register

ARCH_PATTERNS: dict[str, list[str]] = {
    'mvc': [
        r'(?:^|/)controllers?/', r'(?:^|/)models?/', r'(?:^|/)views?/',
        r'(?:^|/)routes?/',
    ],
    'clean_architecture': [
        r'(?:^|/)entities/', r'(?:^|/)use[_-]?cases?/',
        r'(?:^|/)interfaces?/', r'(?:^|/)repositories?/',
        r'(?:^|/)domain/', r'(?:^|/)application/',
        r'(?:^|/)infrastructure/', r'(?:^|/)presentation/',
    ],
    'layered': [
        r'(?:^|/)presentation/', r'(?:^|/)business/',
        r'(?:^|/)data/', r'(?:^|/)services?/',
        r'(?:^|/)dal/', r'(?:^|/)bll/',
        r'(?:^|/)api/', r'(?:^|/)logic/',
    ],
    'hexagonal': [
        r'(?:^|/)adapters?/', r'(?:^|/)ports?/',
        r'(?:^|/)core/', r'(?:^|/)driven/',
        r'(?:^|/)driving/',
    ],
    'ddd': [
        r'(?:^|/)aggregates?/', r'(?:^|/)value[_-]objects?/',
        r'(?:^|/)events?/', r'(?:^|/)commands?/',
        r'(?:^|/)queries?/', r'(?:^|/)bounded[_-]contexts?/',
    ],
    'microservices': [
        r'(?:^|/)services?/[^/]+/',
        r'(?:^|/)modules?/[^/]+/',
        r'(?:^|/)microservices?/',
        r'docker-compose',
    ],
    'monorepo': [
        r'(?:^|/)packages?/[^/]+/',
        r'(?:^|/)apps?/[^/]+/',
        r'(?:^|/)libs?/[^/]+/',
        r'lerna\.json', r'pnpm-workspace\.yaml',
        r'nx\.json', r'turborepo',
    ],
    'feature_based': [
        r'(?:^|/)features?/[^/]+/',
        r'(?:^|/)modules?/[^/]+/(?:components?|services?|hooks?)/',
    ],
}

LAYER_SCORES: dict[str, float] = {
    'mvc': 8,
    'clean_architecture': 10,
    'layered': 7,
    'hexagonal': 9,
    'ddd': 10,
    'microservices': 8,
    'monorepo': 6,
    'feature_based': 7,
}


def _flatten_tree(tree: dict, path: str = '') -> list[str]:
    paths = []
    for name, child in tree.items():
        full = f'{path}/{name}' if path else name
        if isinstance(child, dict):
            paths.append(full)
            paths.extend(_flatten_tree(child, full))
        else:
            paths.append(full)
    return paths


def _detect_architectures(file_paths: list[str]) -> list[dict]:
    found = []
    for arch, patterns in ARCH_PATTERNS.items():
        matches = [p for p in patterns for f in file_paths if re.search(p, f, re.IGNORECASE)]
        confidence = min(100, len(matches) * 20)
        if matches:
            found.append({
                'pattern': arch,
                'confidence': confidence,
                'matches': matches[:5],
                'score': LAYER_SCORES.get(arch, 5),
            })
    return found


def _compute_organization_score(file_paths: list[str]) -> dict:
    top_dirs = set()
    for fp in file_paths:
        parts = fp.replace('\\', '/').split('/')
        if len(parts) >= 2:
            top_dirs.add(parts[0])
    covered = len(top_dirs)
    ideal_top_dirs = ['src', 'test', 'docs', 'config', 'scripts', 'docker']
    matched = sum(1 for d in ideal_top_dirs if d in top_dirs)
    org_score = min(100, matched * 15 + covered * 5)
    return {
        'topLevelDirs': sorted(top_dirs),
        'topLevelCount': covered,
        'standardDirsFound': matched,
        'organizationScore': org_score,
    }


def _detect_monorepo(file_paths: list[str], dep_files: list[str]) -> dict:
    signals = {
        'hasLerna': any('lerna.json' in f for f in file_paths + dep_files),
        'hasPnpmWorkspace': any('pnpm-workspace.yaml' in f for f in file_paths + dep_files),
        'hasNx': any('nx.json' in f for f in file_paths + dep_files),
        'hasTurborepo': any('turbo' in f.lower() for f in dep_files),
        'hasMultiPackage': sum(1 for f in file_paths if re.search(r'(?:^|/)packages?/[^/]+/package\.json$', f)) >= 2,
    }
    is_monorepo = sum(signals.values()) >= 2
    return {
        'isMonorepo': is_monorepo,
        'confidence': min(100, sum(signals.values()) * 25),
        'signals': signals,
    }


def _detect_framework_structure(file_paths: list[str]) -> list[dict]:
    frameworks = []
    if any(re.search(r'(?:^|/)pages/', f) for f in file_paths):
        frameworks.append({'framework': 'Next.js (pages router)', 'confidence': 80})
    if any(re.search(r'(?:^|/)app/', f) and f.endswith(('layout.tsx', 'page.tsx')) for f in file_paths):
        frameworks.append({'framework': 'Next.js (app router)', 'confidence': 90})
    if any(re.search(r'(?:^|/)src/App\.(tsx|jsx|vue)', f) for f in file_paths):
        frameworks.append({'framework': 'React/Vue (CRA/Vite)', 'confidence': 70})
    if any(re.search(r'(?:^|/)routes/', f) for f in file_paths):
        frameworks.append({'framework': 'Router-based SPA', 'confidence': 60})
    return frameworks


class ArchitectureEngine(Engine):
    name = 'architecture'
    description = 'Analyzes repository structure, folder organization, and architecture patterns'
    version = '1.0.0'

    def analyze(self, repo: dict[str, Any]) -> dict[str, Any]:
        file_tree = repo.get('fileTree', {})
        dep_files = repo.get('dependencyFiles', [])
        file_paths = _flatten_tree(file_tree)

        if not file_paths:
            return {'score': 0, 'maxScore': 100, 'findings': [], 'details': {}}

        archs = _detect_architectures(file_paths)
        org = _compute_organization_score(file_paths)
        mono = _detect_monorepo(file_paths, dep_files)
        frameworks = _detect_framework_structure(file_paths)

        arch_score = 0
        if archs:
            arch_score = max(a['confidence'] * a['score'] / 10 for a in archs)
        org_score = org['organizationScore']
        mono_score = 60 if mono['isMonorepo'] else 100

        has_some_structure = len(file_paths) > 3
        total = arch_score * 0.40 + org_score * 0.35 + mono_score * 0.15 + (80 if has_some_structure else 0) * 0.10
        total = min(100, round(total))

        findings = []
        for a in archs:
            label = a['pattern'].replace('_', ' ').title()
            findings.append({
                'type': 'architecture_detected',
                'message': f'{label} detected ({a["confidence"]}% confidence)',
                'severity': 'info',
                'score': round(a['confidence'] * a['score'] / 10),
            })
        if not archs:
            findings.append({
                'type': 'no_architecture',
                'message': 'No recognized architecture pattern detected',
                'severity': 'warning',
                'score': 20,
            })
        if org_score < 50:
            findings.append({
                'type': 'poor_organization',
                'message': f'Only {org["standardDirsFound"]}/6 standard top-level directories found',
                'severity': 'warning',
                'score': org_score,
            })
        if frameworks:
            for fw in frameworks:
                findings.append({
                    'type': 'framework_detected',
                    'message': f'{fw["framework"]} detected',
                    'severity': 'info',
                    'score': fw['confidence'],
                })

        return {
            'score': total,
            'maxScore': 100,
            'findings': findings,
            'details': {
                'architectures': archs,
                'organization': org,
                'monorepo': mono,
                'frameworks': frameworks,
                'topLevelDirs': org['topLevelDirs'],
                'architectureScore': round(arch_score),
                'organizationScore': org_score,
                'monorepoScore': mono_score,
            },
        }


register(ArchitectureEngine())
