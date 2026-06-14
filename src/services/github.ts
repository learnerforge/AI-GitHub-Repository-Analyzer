import { Octokit } from 'octokit'
import { RepoInfo, FileNode } from '@/types'

let octokit: Octokit | null = null
function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN
    octokit = (token && token !== 'your_github_token_here' && token.length > 10)
      ? new Octokit({ auth: token })
      : new Octokit()
  }
  return octokit
}

function parseRepoUrl(url: string): { owner: string; name: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  return { owner: match[1], name: match[2].replace(/\.git$/, '') }
}

const DEP_FILE_NAMES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'requirements.txt', 'Pipfile', 'Pipfile.lock', 'pyproject.toml',
  'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum',
  'Gemfile', 'Gemfile.lock', 'build.gradle', 'pom.xml',
  'composer.json', 'composer.lock', 'CMakeLists.txt',
  'Dockerfile', 'docker-compose.yml', '.github/workflows',
  'tsconfig.json', '.eslintrc', 'Makefile',
])

async function fetchRepoTreeEntries(owner: string, name: string, branch: string): Promise<{ path: string; type: string; size?: number }[]> {
  try {
    const api = getOctokit()
    const treeRes = await api.rest.git.getTree({ owner, repo: name, tree_sha: branch, recursive: '1' })
    if (treeRes.data.truncated) return []
    return (treeRes.data.tree || []).filter((e: any) => e.type !== 'commit')
  } catch {
    return []
  }
}

function buildFileTree(
  entries: { path: string; type: string; size?: number }[],
  maxDepth: number
): FileNode[] {
  const allPaths = new Set<string>()
  for (const e of entries) {
    const parts = e.path.split('/')
    if (parts.length > maxDepth) continue
    allPaths.add(e.path)
    for (let i = 1; i < parts.length; i++) {
      allPaths.add(parts.slice(0, i).join('/'))
    }
  }

  const nodeMap = new Map<string, FileNode>()
  const entryByPath = new Map<string, { path: string; type: string; size?: number }>()
  for (const e of entries) entryByPath.set(e.path, e)

  for (const p of allPaths) {
    const parts = p.split('/')
    const entry = entryByPath.get(p)
    if (entry && entry.type === 'blob') {
      nodeMap.set(p, { name: parts[parts.length - 1], path: p, type: 'blob', size: entry.size })
    } else {
      nodeMap.set(p, { name: parts[parts.length - 1], path: p, type: 'tree', children: [] })
    }
  }

  const root: FileNode[] = []
  for (const [p, node] of nodeMap) {
    const parts = p.split('/')
    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentPath)
      if (parent?.children) parent.children.push(node)
    }
  }

  for (const [, node] of nodeMap) {
    if (node.type === 'tree' && node.children?.length === 0) delete node.children
  }
  return root
}

async function fetchContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const api = getOctokit()
    const res = await api.rest.repos.getContent({ owner, repo, path })
    if (!Array.isArray(res.data) && 'content' in res.data) {
      return Buffer.from(res.data.content, 'base64').toString('utf-8').slice(0, 5000)
    }
  } catch {}
  return null
}

export async function fetchRepoInfo(url: string): Promise<RepoInfo> {
  const { owner, name } = parseRepoUrl(url)
  const api = getOctokit()

  const [repoRes, languagesRes, contributorsRes, readmeRes] = await Promise.all([
    api.rest.repos.get({ owner, repo: name }),
    api.rest.repos.listLanguages({ owner, repo: name }),
    api.rest.repos.listContributors({ owner, repo: name }).catch(() => ({ data: [] as any[] })),
    api.rest.repos.getReadme({ owner, repo: name }).catch(() => null),
  ])

  const repo = repoRes.data
  const defaultBranch = repo.default_branch || 'HEAD'

  const treeEntries = await fetchRepoTreeEntries(owner, name, defaultBranch)
  const fileTree = buildFileTree(treeEntries, 5)

  const depEntries = treeEntries.filter(
    e => e.type === 'blob' && DEP_FILE_NAMES.has(e.path.split('/').pop() || '')
  )
  const depContents = await Promise.all(depEntries.map(e => fetchContent(owner, name, e.path)))
  const dependencyFiles: Record<string, string> = {}
  for (let i = 0; i < depEntries.length; i++) {
    if (depContents[i]) dependencyFiles[depEntries[i].path] = depContents[i]!
  }

  let readmeContent = ''
  if (readmeRes) {
    readmeContent = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8')
  }

  return {
    id: `${owner}/${name}`,
    url,
    owner,
    name,
    description: repo.description,
    defaultBranch,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    watchers: repo.subscribers_count ?? 0,
    topics: repo.topics ?? [],
    license: repo.license?.spdx_id ?? null,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    size: repo.size,
    languages: languagesRes.data as Record<string, number>,
    contributors: (contributorsRes.data as any[]).slice(0, 30).map(c => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
    })),
    readmeContent,
    fileTree,
    dependencyFiles,
  }
}
