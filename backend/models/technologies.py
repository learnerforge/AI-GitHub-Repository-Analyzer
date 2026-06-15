from __future__ import annotations
import re
from .knowledge import get_tech_database


def collect_files(tree: list[dict], prefix: str = '') -> list[str]:
    files: list[str] = []
    MAX_FILES = 5000
    for node in tree:
        if len(files) >= MAX_FILES:
            break
        full = f"{prefix}/{node['name']}" if prefix else node['name']
        if node.get('type') == 'blob':
            files.append(full)
        if node.get('children') and len(files) < MAX_FILES:
            files.extend(collect_files(node['children'], full))
    return files


def detect_technologies(
    languages: dict[str, int],
    file_tree: list[dict],
    dependency_files: dict[str, str],
    readme_content: str,
    topics: list[str],
) -> dict:
    detections: list[dict] = []
    all_files = collect_files(file_tree)

    for tech in get_tech_database():
        evidence: list[str] = []
        for pattern in tech['patterns']:
            try:
                regex = re.compile(pattern, re.IGNORECASE)
                for f in all_files:
                    if regex.search(f):
                        evidence.append(f)
                        break
                for fp, content in dependency_files.items():
                    if regex.search(fp) or regex.search(content):
                        evidence.append(fp)
                        break
            except re.error:
                pass
        if evidence:
            conf = min(tech['confidence'], 50 + len(evidence) * 15)
            detections.append({'name': tech['name'], 'category': tech['category'],
                               'confidence': conf, 'evidence': evidence})

    if readme_content:
        readme_lower = readme_content.lower()
        for tech in get_tech_database():
            existing = next((d for d in detections if d['name'] == tech['name']), None)
            if existing:
                for pattern in tech['patterns']:
                    try:
                        clean = pattern.replace('\\', '')
                        if re.search(clean, readme_lower, re.IGNORECASE):
                            existing['confidence'] = min(100, existing['confidence'] + 5)
                    except re.error:
                        pass
            else:
                for pattern in tech['patterns']:
                    try:
                        clean = pattern.replace('\\.', '.').replace('\\', '')
                        if clean.lower() in readme_lower:
                            detections.append({'name': tech['name'], 'category': tech['category'],
                                               'confidence': 60, 'evidence': ['README mention']})
                            break
                    except re.error:
                        pass

    for topic in topics:
        matched = next((t for t in get_tech_database()
                       if t['name'].lower() == topic.lower()), None)
        if matched and not any(d['name'] == matched['name'] for d in detections):
            detections.append({'name': matched['name'], 'category': matched['category'],
                               'confidence': 70, 'evidence': ['GitHub topic']})

    total_bytes = sum(languages.values()) or 1
    lang_entries = sorted(
        [{'name': k, 'percentage': round((v / total_bytes) * 1000) / 10, 'bytes': v}
         for k, v in languages.items()],
        key=lambda x: -x['bytes']
    )

    result = {'languages': lang_entries, 'frameworks': [], 'databases': [],
              'tools': [], 'infrastructure': []}
    grouped: dict[str, list[dict]] = {}
    for d in detections:
        grouped.setdefault(d['category'], []).append(d)
    for cat, items in grouped.items():
        sorted_items = sorted(items, key=lambda x: -x['confidence'])[:8]
        if cat == 'language':
            for item in sorted_items:
                if not any(l['name'] == item['name'] for l in result['languages']):
                    result['languages'].append({'name': item['name'], 'percentage': 0, 'bytes': 0})
        elif cat in result:
            result[cat].extend(f"{s['name']} ({s['confidence']}%)" for s in sorted_items)
    return result


def detect_package_manager(dependency_files: dict[str, str]) -> str:
    files = list(dependency_files.keys())
    if any('package-lock' in f for f in files): return 'npm'
    if any('yarn.lock' in f for f in files): return 'yarn'
    if any('pnpm-lock' in f for f in files): return 'pnpm'
    if any('Cargo' in f for f in files): return 'cargo'
    if any('Gemfile' in f for f in files): return 'bundler'
    if any('requirements' in f for f in files): return 'pip'
    if any('go.mod' in f for f in files): return 'go mod'
    if any('pom.xml' in f for f in files): return 'maven'
    if any('build.gradle' in f for f in files): return 'gradle'
    return 'npm'


def detect_dev_commands(dependency_files: dict[str, str],
                        languages: dict[str, int]) -> dict[str, str]:
    has_node = 'JavaScript' in languages or 'TypeScript' in languages
    has_python = 'Python' in languages
    has_go = 'Go' in languages
    has_rust = 'Rust' in languages
    dep_files = list(dependency_files.keys())
    if any('package.json' in f for f in dep_files):
        return {'dev': 'npm run dev', 'build': 'npm run build',
                'test': 'npm test', 'install': 'npm install'}
    if has_python or any(k in ' '.join(dep_files) for k in ['requirements', 'Pipfile', 'pyproject']):
        return {'dev': 'python main.py', 'build': 'python setup.py build',
                'test': 'pytest', 'install': 'pip install -r requirements.txt'}
    if has_go or any('go.mod' in f for f in dep_files):
        return {'dev': 'go run .', 'build': 'go build ./...',
                'test': 'go test ./...', 'install': 'go mod download'}
    if has_rust or any('Cargo.toml' in f for f in dep_files):
        return {'dev': 'cargo run', 'build': 'cargo build --release',
                'test': 'cargo test', 'install': 'cargo build'}
    if has_node:
        return {'dev': 'npm run dev', 'build': 'npm run build',
                'test': 'npm test', 'install': 'npm install'}
    return {'dev': 'npm run dev', 'build': 'npm run build',
            'test': 'npm test', 'install': 'npm install'}
