from __future__ import annotations
import base64
import re
import httpx
from ..config import GITHUB_TOKEN

GITHUB_API = 'https://api.github.com'
HEADERS = {'Accept': 'application/vnd.github.v3+json'}
TOKEN = GITHUB_TOKEN.strip() if GITHUB_TOKEN.strip() and GITHUB_TOKEN.strip() != 'your_github_token_here' else None
if TOKEN:
    HEADERS['Authorization'] = f'token {TOKEN}'


async def fetch_repo_info(url: str) -> dict:
    match = re.match(r'(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/.*)?$', url)
    if not match:
        raise ValueError(f'Invalid GitHub URL: {url}')
    owner, repo = match.group(1), match.group(2)
    repo = repo.rstrip('/').replace('.git', '')

    async with httpx.AsyncClient(timeout=30) as client:
        repo_resp = await client.get(f'{GITHUB_API}/repos/{owner}/{repo}', headers=HEADERS)
        repo_resp.raise_for_status()
        repo_data = repo_resp.json()
        default_branch = repo_data.get('default_branch', 'main')

        langs_resp = await client.get(repo_data['languages_url'], headers=HEADERS)
        langs = langs_resp.json() if langs_resp.status_code == 200 else {}

        file_tree: list[dict] = []
        tree_resp = await client.get(
            f'{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1',
            headers=HEADERS,
        )
        if tree_resp.status_code == 200:
            file_tree = _build_nested_tree(tree_resp.json().get('tree', []))

        readme_text = ''
        readme_resp = await client.get(f'{GITHUB_API}/repos/{owner}/{repo}/readme', headers=HEADERS, params={'ref': default_branch})
        if readme_resp.status_code == 200:
            readme_data = readme_resp.json()
            readme_text = base64.b64decode(readme_data['content']).decode('utf-8', errors='replace')

        dep_files = {}
        for dep_name in ['package.json', 'requirements.txt', 'Cargo.toml', 'Gemfile', 'go.mod',
                         'Pipfile', 'pyproject.toml', 'build.gradle', 'Dockerfile',
                         'docker-compose.yml', 'docker-compose.yaml', '.gitignore']:
            dep_resp = await client.get(f'{GITHUB_API}/repos/{owner}/{repo}/contents/{dep_name}', headers=HEADERS)
            if dep_resp.status_code == 200:
                dep_data = dep_resp.json()
                dep_files[dep_name] = base64.b64decode(dep_data['content']).decode('utf-8', errors='replace')

        contrib_resp = await client.get(repo_data['contributors_url'], headers=HEADERS)
        contributors = []
        if contrib_resp.status_code == 200:
            for c in contrib_resp.json()[:30]:
                contributors.append({'login': c['login'], 'avatarUrl': c.get('avatar_url', ''),
                                     'contributions': c['contributions']})

        return {
            'id': f'{owner}/{repo}',
            'url': repo_data['html_url'],
            'owner': owner,
            'name': repo,
            'description': repo_data.get('description', ''),
            'defaultBranch': default_branch,
            'stars': repo_data.get('stargazers_count', 0),
            'forks': repo_data.get('forks_count', 0),
            'openIssues': repo_data.get('open_issues_count', 0),
            'watchers': repo_data.get('watchers_count', 0),
            'topics': repo_data.get('topics', []),
            'license': repo_data['license']['spdx_id'] if repo_data.get('license') else None,
            'createdAt': repo_data.get('created_at', ''),
            'updatedAt': repo_data.get('updated_at', ''),
            'pushedAt': repo_data.get('pushed_at', ''),
            'size': repo_data.get('size', 0),
            'languages': langs,
            'contributors': contributors,
            'readmeContent': readme_text,
            'fileTree': file_tree,
            'dependencyFiles': dep_files,
        }


def _build_nested_tree(entries: list[dict]) -> list[dict]:
    nodes_by_path: dict[str, dict] = {}
    roots: list[dict] = []

    for entry in entries:
        path = entry['path']
        name = path.rstrip('/').split('/')[-1]
        is_dir = entry['type'] == 'tree'
        node: dict = {
            'name': name,
            'path': path,
            'type': 'tree' if is_dir else 'blob',
            'size': entry.get('size', 0),
        }
        if is_dir:
            node['children'] = []
        nodes_by_path[path] = node

    for path, node in nodes_by_path.items():
        parts = path.split('/')
        parent_path = '/'.join(parts[:-1])
        if parent_path and parent_path in nodes_by_path:
            parent = nodes_by_path[parent_path]
            if 'children' not in parent:
                parent['children'] = []
            parent['children'].append(node)
        elif not parent_path:
            roots.append(node)

    return roots
