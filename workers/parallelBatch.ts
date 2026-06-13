import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { RepoInfo, FileNode, AnalysisReport } from '@/types'
import { analyzeRepository } from '@/services/analyzer'

const RESULTS_DIR = path.join(process.cwd(), 'analysis-results')
const TMP_DIR = path.join(process.cwd(), '.tmp-clone')
const CONCURRENCY = 3

const LANGUAGE_MAP: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', rs: 'Rust', go: 'Go',
  java: 'Java', rb: 'Ruby', php: 'PHP',
  c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', cc: 'C++', cxx: 'C++',
  cs: 'C#', swift: 'Swift', kt: 'Kotlin', scala: 'Scala',
  r: 'R', lua: 'Lua', sh: 'Shell', ps1: 'PowerShell',
  sql: 'SQL', html: 'HTML', css: 'CSS', vue: 'Vue',
  svelte: 'Svelte', astro: 'Astro', json: 'JSON',
  yaml: 'YAML', toml: 'TOML', md: 'Markdown',
  dockerfile: 'Docker', tf: 'Terraform',
}

function extToLang(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile') return 'Docker'
  const ext = path.extname(lower).replace('.', '')
  return LANGUAGE_MAP[ext] || null
}

function walkDir(dir: string): FileNode[] {
  const nodes: FileNode[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return nodes }
  for (const e of entries) {
    if (e.name.startsWith('.git') || e.name === 'node_modules' || e.name === '.next') continue
    const full = path.join(dir, e.name)
    const rel = e.name
    if (e.isDirectory()) {
      nodes.push({ name: e.name, path: rel, type: 'tree', children: walkDir(full) })
    } else {
      let size = 0
      try { size = fs.statSync(full).size } catch {}
      nodes.push({ name: e.name, path: rel, type: 'blob', size })
    }
  }
  return nodes
}

function countLanguages(tree: FileNode[]): Record<string, number> {
  const bytes: Record<string, number> = {}
  function walk(ns: FileNode[]) {
    for (const n of ns) {
      if (n.type === 'blob' && n.size) {
        const lang = extToLang(n.name)
        if (lang) bytes[lang] = (bytes[lang] || 0) + n.size
      }
      if (n.children) walk(n.children)
    }
  }
  walk(tree)
  return bytes
}

function findReadme(tree: FileNode[], dir: string): string {
  function walk(ns: FileNode[]): string | null {
    for (const n of ns) {
      if (n.type === 'blob' && n.name.toLowerCase() === 'readme.md') {
        try { return fs.readFileSync(path.join(dir, n.path), 'utf-8') } catch {}
      }
      if (n.children) { const f = walk(n.children); if (f) return f }
    }
    return null
  }
  return walk(tree) || ''
}

function findDepFiles(tree: FileNode[], dir: string): Record<string, string> {
  const names = new Set(['package.json', 'Cargo.toml', 'requirements.txt', 'Gemfile', 'Pipfile', 'pyproject.toml', 'go.mod', 'build.gradle', 'CMakeLists.txt', 'Makefile', 'composer.json', 'Project.toml'])
  const deps: Record<string, string> = {}
  function walk(ns: FileNode[]) {
    for (const n of ns) {
      if (n.type === 'blob' && names.has(n.name)) {
        try { deps[n.name] = fs.readFileSync(path.join(dir, n.path), 'utf-8').slice(0, 5000) } catch {}
      }
      if (n.children) walk(n.children)
    }
  }
  walk(tree)
  return deps
}

function countFilesInTree(tree: FileNode[]): number {
  let c = 0
  function walk(ns: FileNode[]) { for (const n of ns) { if (n.type === 'blob') c++; if (n.children) walk(n.children) } }
  walk(tree)
  return c
}

function sanitizeName(s: string) { return s.replace(/[^a-zA-Z0-9_-]/g, '_') }

async function fetchJson(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'parallel-batch/1.0' }
  if (token && token.length > 10 && token !== 'your_github_token_here') headers['Authorization'] = `token ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchApi(url: string): Promise<Partial<RepoInfo> | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'your_github_token_here' || token.length <= 10) return null
  try {
    const m = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
    if (!m) return null
    const [owner, name] = [m[1], m[2].replace(/\.git$/, '')]
    const baseUrl = `https://api.github.com/repos/${owner}/${name}`
    const [repoData, langsData] = await Promise.all([
      fetchJson(baseUrl, token),
      fetchJson(`${baseUrl}/languages`, token).catch(() => ({})),
    ])
    return {
      description: repoData.description,
      defaultBranch: repoData.default_branch,
      stars: repoData.stargazers_count ?? 0,
      forks: repoData.forks_count ?? 0,
      openIssues: repoData.open_issues_count ?? 0,
      watchers: repoData.subscribers_count ?? 0,
      topics: repoData.topics ?? [],
      license: repoData.license?.spdx_id ?? null,
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
      size: repoData.size,
      languages: langsData as Record<string, number>,
      contributors: [],
    }
  } catch { return null }
}

async function analyzeOne(url: string): Promise<boolean> {
  const m = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
  if (!m) return false
  const [owner, repoName] = [m[1], m[2].replace(/\.git$/, '')]
  const cloneDir = path.join(TMP_DIR, `${sanitizeName(owner)}-${sanitizeName(repoName)}`)

  const apiData = await fetchApi(url)

  if (fs.existsSync(cloneDir)) { try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {} }
  fs.mkdirSync(cloneDir, { recursive: true })

  try {
    execSync(`git -c core.longpaths=true clone --depth 1 "${url}" "${cloneDir}"`, { stdio: 'pipe', timeout: 300000 })
  } catch {
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {}
    return false
  }

  const fileTree = walkDir(cloneDir)
  const cloneLanguages = countLanguages(fileTree)
  const readmeContent = findReadme(fileTree, cloneDir)
  const dependencyFiles = findDepFiles(fileTree, cloneDir)

  const repoInfo: RepoInfo = {
    id: `${owner}/${repoName}`, url, owner, name: repoName,
    description: apiData?.description ?? null, defaultBranch: apiData?.defaultBranch ?? 'main',
    stars: apiData?.stars ?? 0, forks: apiData?.forks ?? 0,
    openIssues: apiData?.openIssues ?? 0, watchers: apiData?.watchers ?? 0,
    topics: apiData?.topics ?? [], license: apiData?.license ?? null,
    createdAt: apiData?.createdAt ?? '', updatedAt: apiData?.updatedAt ?? '', pushedAt: apiData?.pushedAt ?? '',
    size: apiData?.size ?? 0, languages: cloneLanguages, contributors: [],
    readmeContent, fileTree, dependencyFiles,
  }

  let report: AnalysisReport
  try { report = await analyzeRepository(repoInfo) } catch { try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {}; return false }

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const filename = `${sanitizeName(owner)}-${sanitizeName(repoName)}-localai-${Date.now()}.json`
  fs.writeFileSync(path.join(RESULTS_DIR, filename), JSON.stringify(report, null, 2))

  if (fs.existsSync(cloneDir)) { try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {} }
  return true
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) { console.error('Usage: npx tsx workers/parallelBatch.ts repos.txt'); process.exit(1) }

  const urls = fs.readFileSync(args[0], 'utf-8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  console.log(`[Parallel] ${urls.length} repos, concurrency=${CONCURRENCY}`)

  let ok = 0, fail = 0
  const startTime = Date.now()
  const queue = [...urls]

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()!
      const label = url.split('/').slice(-2).join('/')
      const done = ok + fail + 1
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`\n[${done}/${urls.length} ${elapsed}s] ${label}`)
      if (await analyzeOne(url)) {
        ok++
        console.log(`  ✅ ${label} — ${ok} ok, ${fail} failed`)
      } else {
        fail++
        console.log(`  ❌ ${label} — ${ok} ok, ${fail} failed`)
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)

  const totalTime = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  PARALLEL BATCH COMPLETE (${totalTime}s)`)
  console.log(`  ${ok} ok, ${fail} failed, ${urls.length} total`)
  console.log(`${'═'.repeat(50)}`)

  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
