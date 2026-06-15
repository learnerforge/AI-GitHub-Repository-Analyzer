import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { RepoInfo, FileNode, AnalysisReport, AnalysisMethod } from '@/types'
import { analyzeRepository } from '@/services/analyzer'

const RESULTS_DIR = path.join(process.cwd(), 'data', 'results')
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
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        if (res.status >= 500 && attempt < 2) {
          console.log(`  Retry ${attempt + 1}/2 for ${url} (HTTP ${res.status})`)
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
          continue
        }
        throw new Error(`HTTP ${res.status}`)
      }
      return res.json()
    } catch (e: any) {
      lastErr = e
      if (attempt < 2) {
        console.log(`  Retry ${attempt + 1}/2 for ${url} (${e.message})`)
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
  }
  throw lastErr || new Error('Fetch failed after 3 attempts')
}

function buildTreeFromPaths(paths: string[]): FileNode[] {
  const root: FileNode[] = []
  for (const p of paths) {
    const parts = p.split('/')
    let current = root
    let cp = ''
    for (let i = 0; i < parts.length; i++) {
      cp = cp ? `${cp}/${parts[i]}` : parts[i]
      if (i === parts.length - 1) {
        if (!current.some(n => n.name === parts[i])) {
          current.push({ name: parts[i], path: cp, type: 'blob', size: 0 })
        }
      } else {
        let dir = current.find(n => n.name === parts[i] && n.type === 'tree') as (FileNode & { children: FileNode[] }) | undefined
        if (!dir) {
          dir = { name: parts[i], path: cp, type: 'tree', children: [] }
          current.push(dir)
        }
        current = dir.children
      }
    }
  }
  return root
}

async function fetchRawFile(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'parallel-batch/1.0' } })
    if (res.ok) return await res.text()
  } catch {}
  return null
}

async function fetchApi(url: string): Promise<Partial<RepoInfo> | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'your_github_token_here' || token.length <= 10) return null
  try {
    url = toFullUrl(url)
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

function toFullUrl(url: string): string {
  if (url.startsWith('http')) return url
  const parts = url.split('/')
  if (parts.length >= 2) return `https://github.com/${parts[0]}/${parts.slice(1).join('/')}`
  return url
}

async function analyzeOne(url: string): Promise<boolean> {
  url = toFullUrl(url)
  const m = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
  if (!m) return false
  const [owner, repoName] = [m[1], m[2].replace(/\.git$/, '')]
  const cloneDir = path.join(TMP_DIR, `${sanitizeName(owner)}-${sanitizeName(repoName)}`)

  const apiData = await fetchApi(url)

  if (fs.existsSync(cloneDir)) { try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {} }
  fs.mkdirSync(cloneDir, { recursive: true })

  let fileTree: FileNode[] = []
  let cloneLanguages: Record<string, number> = {}
  let readmeContent = ''
  let dependencyFiles: Record<string, string> = {}

  let isPartialClone = false
  try {
    execSync(`git -c core.longpaths=true -c core.protectNTFS=false clone --depth 1 "${url}" "${cloneDir}"`, {
      stdio: 'pipe', timeout: 300000, env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' }
    })
    fileTree = walkDir(cloneDir)
    cloneLanguages = countLanguages(fileTree)
    readmeContent = findReadme(fileTree, cloneDir)
    dependencyFiles = findDepFiles(fileTree, cloneDir)
  } catch {
    isPartialClone = true
    // Attempt partial clone recovery
    try {
      execSync(`git -C "${cloneDir}" rev-parse HEAD`, { stdio: 'pipe' })
      console.log(`  Partial clone detected, extracting git tree...`)
      const lsOutput = execSync(`git -c core.protectNTFS=false -C "${cloneDir}" ls-tree -r HEAD --name-only`, {
        stdio: 'pipe', maxBuffer: 10 * 1024 * 1024, timeout: 60000
      }).toString().trim()
      if (!lsOutput) throw new Error('Empty ls-tree')

      const allPaths = lsOutput.split('\n').filter(p => p.length > 0)
      const paths = allPaths.length > 10000 ? allPaths.slice(0, 10000) : allPaths
      fileTree = buildTreeFromPaths(paths)
      cloneLanguages = countLanguages(fileTree)

      try {
        execSync(`git -c core.protectNTFS=false -C "${cloneDir}" checkout HEAD -- .`, { stdio: 'pipe', timeout: 120000 })
        fileTree = walkDir(cloneDir)
        cloneLanguages = countLanguages(fileTree)
        readmeContent = findReadme(fileTree, cloneDir)
        dependencyFiles = findDepFiles(fileTree, cloneDir)
      } catch {}

      const rawBase = `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD`
      if (!readmeContent) {
        for (const name of ['README.md', 'readme.md', 'Readme.md', 'README.rst', 'README']) {
          const c = await fetchRawFile(`${rawBase}/${name}`)
          if (c) { readmeContent = c; break }
        }
      }
      if (Object.keys(dependencyFiles).length === 0) {
        for (const name of ['package.json', 'Cargo.toml', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Gemfile', 'Pipfile', 'composer.json']) {
          const c = await fetchRawFile(`${rawBase}/${name}`)
          if (c) dependencyFiles[name] = c.slice(0, 5000)
        }
      }
    } catch {
      try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {}
      return false
    }
  }

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

  const analysisMethod: AnalysisMethod = {
    cloneMethod: isPartialClone ? 'partial' : 'full',
    apiData: apiData ? 'full' : 'none',
    aiProvider: 'localai',
    confidence: (() => {
      let c = 100
      if (isPartialClone) c -= 40
      if (!apiData) c -= 20
      return Math.max(20, c)
    })(),
  }

  let report: AnalysisReport
  try { report = await analyzeRepository(repoInfo) } catch { try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {}; return false }
  report.analysisMethod = analysisMethod

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
