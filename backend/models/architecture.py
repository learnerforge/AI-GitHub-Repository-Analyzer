from __future__ import annotations
from .knowledge import get_architecture_patterns


def analyze_architecture(file_tree: list[dict], file_count: int = 0) -> dict:
    patterns = get_architecture_patterns()
    all_paths = _collect_paths(file_tree)
    matched_patterns: list[dict] = []
    for pat in patterns:
        indicators_found = [ind for ind in pat['indicators']
                           if any(ind.lower() in p.lower() for p in all_paths)]
        if indicators_found:
            matched_patterns.append({
                'name': pat['name'],
                'indicators_found': indicators_found,
                'description': pat['description'],
                'score': len(indicators_found) / len(pat['indicators']),
            })
    matched_patterns.sort(key=lambda x: -x['score'])
    if matched_patterns:
        best = matched_patterns[0]
        arch_name = best['name']
        arch_desc = best['description']
        other = [p['name'] for p in matched_patterns[1:4]]
    else:
        arch_name = 'Monolithic'
        arch_desc = ('Single codebase deployed as one unit, '
                     'typically organized in a flat structure.')
        other = []
    result = f"This project follows a **{arch_name}** architecture pattern. {arch_desc}"
    if other and len(other) > 1:
        result += f" Secondary patterns detected: {', '.join(other)}."
    return {'architecture': result, 'patterns': matched_patterns, 'primary': arch_name}


def _collect_paths(tree: list[dict], prefix: str = '') -> list[str]:
    paths: list[str] = []
    for node in tree:
        full = f"{prefix}/{node['name']}" if prefix else node['name']
        paths.append(full)
        if node.get('children'):
            paths.extend(_collect_paths(node['children'], full))
    return paths


def detect_architecture_type(file_tree: list[dict]) -> str:
    result = analyze_architecture(file_tree)
    return result['primary']
