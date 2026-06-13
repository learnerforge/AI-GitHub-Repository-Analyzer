import { Octokit } from 'octokit'
import { RepoInfo, Contributor, FileNode } from '@/types'

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

function parseRepoUrl(url: string): { owner: string; name: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  return { owner: match[1], name: match[2].replace(/\.git$/, '') }
}

async function fetchFileTree(
  owner: string,
  name: string,
  branch: string,
  path = ''
): Promise<FileNode[]> {
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo: name,
    path,
    ref: branch,
  })

  if (Array.isArray(data)) {
    const results = await Promise.all(
      data.map(async (item) => {
        const node: FileNode = {
          name: item.name,
          path: item.path,
          type: item.type === 'dir' ? 'tree' as const : 'blob' as const,
          size: item.type === 'file' ? (item as any).size : undefined,
        }
        if (item.type === 'dir' && item.path.split('/').length < 6) {
          node.children = await fetchFileTree(owner, name, branch, item.path)
        }
        return node
      })
    )
    return results
  }
  return []
}

function extractDependencyFiles(
  tree: FileNode[],
  files: Record<string, string> = {}
): Record<string, string> {
  const depFiles = new Set([
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'requirements.txt', 'Pipfile', 'Pipfile.lock', 'pyproject.toml',
    'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum',
    'Gemfile', 'Gemfile.lock', 'build.gradle', 'pom.xml',
    'composer.json', 'composer.lock', 'CMakeLists.txt',
    'Dockerfile', 'docker-compose.yml', '.github/workflows',
    'tsconfig.json', '.eslintrc', 'Makefile',
  ])

  for (const node of tree) {
    if (node.type === 'blob') {
      if (depFiles.has(node.name)) {
        files[node.path] = node.name
      }
    } else if (node.children) {
      extractDependencyFiles(node.children, files)
    }
  }
  return files
}

export async function fetchRepoInfo(url: string): Promise<RepoInfo> {
  const { owner, name } = parseRepoUrl(url)

  const [repoRes, languagesRes, contributorsRes, readmeRes, tree] =
    await Promise.all([
      octokit.rest.repos.get({ owner, repo: name }),
      octokit.rest.repos.listLanguages({ owner, repo: name }),
      octokit.rest.repos.listContributors({ owner, repo: name }).catch(() => ({
        data: [] as any[],
      })),
      octokit.rest.repos.getReadme({ owner, repo: name }).catch(() => null),
      fetchFileTree(owner, name, 'HEAD').catch(() => []),
    ])

  const repo = repoRes.data

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
    defaultBranch: repo.default_branch,
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
    contributors: (contributorsRes.data as any[]).slice(0, 30).map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
    })),
    readmeContent,
    fileTree: tree,
    dependencyFiles: extractDependencyFiles(tree),
  }
}
