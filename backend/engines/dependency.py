from __future__ import annotations
from typing import Any
import re
from . import Engine, register

ECOSYSTEM_PATTERNS: dict[str, dict] = {
    'npm': {
        'files': ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
        'manager': 'npm/yarn/pnpm',
        'manifest': 'package.json',
    },
    'python': {
        'files': ['requirements.txt', 'Pipfile', 'Pipfile.lock', 'pyproject.toml', 'setup.py', 'setup.cfg'],
        'manager': 'pip/poetry/pipenv',
        'manifest': 'pyproject.toml',
    },
    'java': {
        'files': ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        'manager': 'maven/gradle',
        'manifest': 'pom.xml',
    },
    'go': {
        'files': ['go.mod', 'go.sum'],
        'manager': 'go mod',
        'manifest': 'go.mod',
    },
    'rust': {
        'files': ['Cargo.toml', 'Cargo.lock'],
        'manager': 'cargo',
        'manifest': 'Cargo.toml',
    },
    'ruby': {
        'files': ['Gemfile', 'Gemfile.lock'],
        'manager': 'bundler',
        'manifest': 'Gemfile',
    },
    'php': {
        'files': ['composer.json', 'composer.lock'],
        'manager': 'composer',
        'manifest': 'composer.json',
    },
    'dotnet': {
        'files': ['*.csproj', '*.fsproj', 'packages.config'],
        'manager': 'nuget',
        'manifest': '*.csproj',
    },
    'swift': {
        'files': ['Package.swift', 'Package.resolved'],
        'manager': 'spm',
        'manifest': 'Package.swift',
    },
    'docker': {
        'files': ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
        'manager': 'docker',
        'manifest': 'Dockerfile',
    },
}

LICENSE_CONFLICTS: dict[str, list[str]] = {
    'GPL': ['MIT', 'Apache-2.0', 'BSD', 'MPL', 'LGPL'],
}

LICENSE_FAMILIES: dict[str, str] = {
    'mit': 'MIT', 'apache': 'Apache-2.0', 'gpl': 'GPL', 'lgpl': 'LGPL',
    'bsd': 'BSD', 'mpl': 'MPL', 'unlicense': 'Unlicense', 'cc0': 'CC0',
}


def _detect_ecosystems(dep_files: list[str]) -> list[dict]:
    ecosystems = []
    detected_files = set(dep_files)
    for ecosystem, info in ECOSYSTEM_PATTERNS.items():
        found = [f for f in info['files'] for df in detected_files if df.endswith(f) or f.replace('*', '') in df.lower()]
        if found:
            ecosystems.append({
                'ecosystem': ecosystem,
                'manager': info['manager'],
                'files': found,
                'hasLockfile': any('lock' in f.lower() or 'sum' in f.lower() or 'resolved' in f.lower() for f in found),
            })
    return ecosystems


def _parse_package_json(content: str) -> dict:
    try:
        import json
        data = json.loads(content)
        deps = list(data.get('dependencies', {}).keys())
        dev_deps = list(data.get('devDependencies', {}).keys())
        peer_deps = list(data.get('peerDependencies', {}).keys())
        return {
            'dependencies': deps,
            'devDependencies': dev_deps,
            'peerDependencies': peer_deps,
            'totalDeps': len(deps) + len(dev_deps) + len(peer_deps),
            'hasScripts': bool(data.get('scripts')),
        }
    except (json.JSONDecodeError, Exception):
        return {'dependencies': [], 'devDependencies': [], 'peerDependencies': [], 'totalDeps': 0, 'hasScripts': False}


def _parse_requirements_txt(content: str) -> dict:
    deps = []
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('-'):
            parts = re.split(r'[=<>!~]', line, maxsplit=1)
            deps.append(parts[0].strip())
    return {'dependencies': deps, 'totalDeps': len(deps)}


def _detect_license_conflicts(ecosystems: list[dict], dep_licenses: dict) -> list[dict]:
    findings = []
    for eco in ecosystems:
        repo_license = dep_licenses.get('repo', '').lower()
        for fam in LICENSE_FAMILIES:
            if fam in repo_license:
                repo_family = LICENSE_FAMILIES[fam]
                for conflict_family in LICENSE_CONFLICTS.get(repo_family, []):
                    findings.append({
                        'type': 'license_conflict_warning',
                        'message': f'{repo_family} license may conflict with {conflict_family} dependencies',
                        'severity': 'warning',
                    })
                break
    return findings


def _compute_dep_health(file_contents: dict, file_paths: list[str]) -> dict:
    npm_data = None
    pip_data = None

    for fname, content in file_contents.items():
        if not isinstance(content, str):
            continue
        low = fname.lower()
        if 'package.json' in low and npm_data is None:
            npm_data = _parse_package_json(content)
        if 'requirements.txt' in low and pip_data is None:
            pip_data = _parse_requirements_txt(content)

    findings = []
    total_deps = 0
    has_lockfile = False
    eco_scores = []

    npm_files = [f for f in file_paths if 'package.json' in f.lower()]
    has_npm = bool(npm_files)
    has_lockfile = any('lock' in f.lower() for f in file_paths if any(ef in f.lower() for ef in ['yarn', 'package-lock', 'pnpm-lock']))

    if npm_data:
        total_deps += npm_data['totalDeps']
        if npm_data['totalDeps'] > 50:
            findings.append({
                'type': 'heavy_dependencies', 'message': f'{npm_data["totalDeps"]} npm dependencies — heavy project',
                'severity': 'warning',
            })
        if not npm_data['hasScripts']:
            findings.append({
                'type': 'no_scripts', 'message': 'package.json has no scripts defined',
                'severity': 'info',
            })

    if pip_data:
        total_deps += pip_data['totalDeps']

    if has_lockfile:
        findings.append({
            'type': 'lockfile_present', 'message': 'Lockfile found — reproducible builds',
            'severity': 'info', 'score': 10,
        })
    else:
        findings.append({
            'type': 'missing_lockfile', 'message': 'No lockfile — builds may not be reproducible',
            'severity': 'warning',
        })

    score = 100
    if total_deps > 100:
        score -= 15
    elif total_deps > 50:
        score -= 5
    elif total_deps == 0 and has_npm:
        score -= 20
        findings.append({
            'type': 'no_dependencies', 'message': 'package.json found but no dependencies declared',
            'severity': 'warning',
        })
    if not has_lockfile and has_npm:
        score -= 10

    return {
        'totalDependencies': total_deps,
        'hasLockfile': has_lockfile,
        'npmData': npm_data,
        'pipData': pip_data,
        'findings': findings,
        'score': max(0, score),
    }


class DependencyEngine(Engine):
    name = 'dependency'
    description = 'Analyzes dependency ecosystems, package health, lockfiles, and license conflicts'
    version = '1.0.0'

    def analyze(self, repo: dict[str, Any]) -> dict[str, Any]:
        dep_files = repo.get('dependencyFiles', [])
        file_contents = repo.get('fileContents', {})
        file_paths = _flatten_tree(repo.get('fileTree', {}))
        dep_licenses = repo.get('licenses', {})

        ecosystems = _detect_ecosystems(dep_files)
        dep_health = _compute_dep_health(file_contents, file_paths)
        license_findings = _detect_license_conflicts(ecosystems, dep_licenses)

        all_findings = dep_health['findings'] + license_findings

        for eco in ecosystems:
            all_findings.append({
                'type': 'ecosystem_detected',
                'message': f'{eco["ecosystem"]} ({eco["manager"]})',
                'severity': 'info',
                'score': 10,
            })

        score = dep_health['score']

        return {
            'score': score,
            'maxScore': 100,
            'findings': all_findings,
            'details': {
                'ecosystems': ecosystems,
                'totalDependencies': dep_health['totalDependencies'],
                'hasLockfile': dep_health['hasLockfile'],
                'npmData': dep_health['npmData'],
                'pipData': dep_health['pipData'],
                'ecosystemCount': len(ecosystems),
            },
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


register(DependencyEngine())
