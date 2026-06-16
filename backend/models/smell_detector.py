from __future__ import annotations

def _find_in_tree(tree: list[dict], predicate) -> bool:
    for node in tree:
        if predicate(node):
            return True
        if node.get('children') and _find_in_tree(node['children'], predicate):
            return True
    return False


SMELL_RULES: list[dict] = [
    {
        'id': 'no-readme', 'severity': 'critical', 'category': 'Documentation',
        'title': 'Missing README',
        'description': 'The repository has no README file.',
        'check': lambda inp: not inp.get('readmeContent') or len(inp.get('readmeContent', '')) < 20,
    },
    {
        'id': 'short-readme', 'severity': 'warning', 'category': 'Documentation',
        'title': 'Insufficient README Content',
        'description': 'The README is too short to provide meaningful information.',
        'check': lambda inp: 0 < len(inp.get('readmeContent', '')) < 200,
    },
    {
        'id': 'no-tests', 'severity': 'warning', 'category': 'Testing',
        'title': 'No Test Files Detected',
        'description': 'No test files were found.',
        'check': lambda inp: not inp.get('hasTests', False),
    },
    {
        'id': 'no-ci', 'severity': 'warning', 'category': 'DevOps',
        'title': 'No CI/CD Pipeline',
        'description': 'No continuous integration configuration detected.',
        'check': lambda inp: not inp.get('hasCI', False),
    },
    {
        'id': 'single-contributor', 'severity': 'info', 'category': 'Community',
        'title': 'Bus Factor of 1',
        'description': 'Only one contributor. If they leave, the project could stall.',
        'check': lambda inp: inp.get('contributorCount', 0) <= 1,
    },
    {
        'id': 'large-monolith', 'severity': 'warning', 'category': 'Architecture',
        'title': 'Deeply Nested or Flat Structure',
        'description': 'Directory organization issues that may affect maintainability.',
        'check': lambda inp: _count_dirs(inp.get('fileTree', [])) > 20 or _count_dirs(inp.get('fileTree', [])) < 2,
    },
    {
        'id': 'no-license', 'severity': 'warning', 'category': 'Legal',
        'title': 'Missing License',
        'description': 'No license file found. Legal ambiguity for users and contributors.',
        'check': lambda inp: (
            'license' not in inp.get('readmeContent', '').lower()
            and not _find_in_tree(inp.get('fileTree', []), lambda n: 'license' in n.get('name', '').lower())
        ),
    },
    {
        'id': 'many-languages', 'severity': 'info', 'category': 'Complexity',
        'title': 'Many Languages Used',
        'description': 'Many programming languages increases cognitive load.',
        'check': lambda inp: len(inp.get('languages', {})) > 5,
    },
    {
        'id': 'no-contributing-guide', 'severity': 'info', 'category': 'Documentation',
        'title': 'No Contributing Guidelines',
        'description': 'Missing CONTRIBUTING.md helps standardize contributions.',
        'check': lambda inp: (
            'contribut' not in inp.get('readmeContent', '').lower()
            and not _find_in_tree(inp.get('fileTree', []), lambda n: 'contribut' in n.get('name', '').lower())
        ),
    },
    {
        'id': 'stale-dependencies', 'severity': 'info', 'category': 'Dependencies',
        'title': 'No Lock File',
        'description': 'No package lock file found — inconsistent installs possible.',
        'check': lambda inp: _check_lock_file(inp),
    },
]


def _count_dirs(tree: list[dict]) -> int:
    count = 0
    for node in tree:
        if node.get('type') == 'tree':
            count += 1
            if node.get('children'):
                count += _count_dirs(node['children'])
    return count


def _check_lock_file(inp: dict) -> bool:
    has_pkg = any(l in inp.get('languages', {})
                  for l in ['JavaScript', 'TypeScript', 'Python', 'Ruby', 'Rust', 'Go'])
    if not has_pkg:
        return False
    lock_files = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
                  'Gemfile.lock', 'Cargo.lock', 'go.sum']
    return not any(f in inp.get('dependencyFiles', {}) for f in lock_files)


def detect_code_smells(input_data: dict) -> list[dict]:
    smells: list[dict] = []
    for rule in SMELL_RULES:
        try:
            if rule['check'](input_data):
                smells.append({
                    'severity': rule['severity'],
                    'category': rule['category'],
                    'title': rule['title'],
                    'description': rule['description'],
                    'location': None,
                })
        except Exception:
            pass
    return smells
