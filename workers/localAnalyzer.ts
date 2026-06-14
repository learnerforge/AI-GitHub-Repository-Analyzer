import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { RepoInfo, FileNode, AnalysisReport, AnalysisMethod } from '../src/types'
import { analyzeRepository } from '../src/services/analyzer'

const RESULTS_DIR = path.join(process.cwd(), 'analysis-results')
const TMP_DIR = path.join(process.cwd(), '.tmp-clone')

const LANGUAGE_MAP: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java', jar: 'Java',
  rb: 'Ruby',
  php: 'PHP',
  c: 'C', h: 'C',
  cpp: 'C++', hpp: 'C++', cc: 'C++', cxx: 'C++',
  cs: 'C#',
  swift: 'Swift',
  kt: 'Kotlin', kts: 'Kotlin',
  scala: 'Scala',
  r: 'R', R: 'R',
  lua: 'Lua',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell',
  ps1: 'PowerShell', psm1: 'PowerShell',
  sql: 'SQL',
  html: 'HTML', htm: 'HTML',
  css: 'CSS', scss: 'CSS', less: 'CSS',
  vue: 'Vue',
  svelte: 'Svelte',
  astro: 'Astro',
  json: 'JSON',
  yaml: 'YAML', yml: 'YAML',
  toml: 'TOML',
  md: 'Markdown', mdx: 'Markdown',
  dockerfile: 'Docker',
  tf: 'Terraform',
  yara: 'YARA',
}

function extToLang(filename: string): string | null {
  const lower = filename.toLowerCase()
  if (lower === 'dockerfile') return 'Docker'
  const ext = path.extname(lower).replace('.', '')
  return LANGUAGE_MAP[ext] || null
}

function walkDir(dir: string, basePath: string = ''): FileNode[] {
  const nodes: FileNode[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return nodes }
  for (const entry of entries) {
    if (entry.name.startsWith('.git') || entry.name === 'node_modules' || entry.name === '.next') continue
    const fullPath = path.join(dir, entry.name)
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'tree',
        children: walkDir(fullPath, relPath),
      })
    } else {
      let size = 0
      try { size = fs.statSync(fullPath).size } catch {}
      nodes.push({ name: entry.name, path: relPath, type: 'blob', size })
    }
  }
  return nodes
}

function countLanguages(fileTree: FileNode[]): Record<string, number> {
  const bytes: Record<string, number> = {}
  function walk(nodes: FileNode[]) {
    for (const n of nodes) {
      if (n.type === 'blob' && n.size) {
        const lang = extToLang(n.name)
        if (lang) bytes[lang] = (bytes[lang] || 0) + n.size
      }
      if (n.children) walk(n.children)
    }
  }
  walk(fileTree)
  return bytes
}

function findReadme(fileTree: FileNode[], dir: string): string {
  function walk(nodes: FileNode[]): string | null {
    for (const n of nodes) {
      if (n.type === 'blob' && n.name.toLowerCase() === 'readme.md') {
        try { return fs.readFileSync(path.join(dir, n.path), 'utf-8') }
        catch { return null }
      }
      if (n.children) {
        const found = walk(n.children)
        if (found) return found
      }
    }
    return null
  }
  return walk(fileTree) || ''
}

function findDepFiles(fileTree: FileNode[], dir: string): Record<string, string> {
  const depNames = new Set(['package.json', 'Cargo.toml', 'requirements.txt', 'Gemfile', 'Pipfile', 'pyproject.toml', 'go.mod', 'build.gradle', 'CMakeLists.txt', 'Makefile', 'composer.json', 'Project.toml'])
  const deps: Record<string, string> = {}
  function walk(nodes: FileNode[]) {
    for (const n of nodes) {
      if (n.type === 'blob' && depNames.has(n.name)) {
        try { deps[n.name] = fs.readFileSync(path.join(dir, n.path), 'utf-8').slice(0, 5000) } catch {}
      }
      if (n.children) walk(n.children)
    }
  }
  walk(fileTree)
  return deps
}

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function fetchGitHubApi(url: string): Promise<Partial<RepoInfo> | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'your_github_token_here' || token.length <= 10) return null

  try {
    const { Octokit } = require('octokit')
    const octokit = new Octokit({ auth: token })
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
    if (!match) return null
    const owner = match[1], name = match[2].replace(/\.git$/, '')

    const [repoRes, languagesRes, contributorsRes] = await Promise.all([
      octokit.rest.repos.get({ owner, repo: name }),
      octokit.rest.repos.listLanguages({ owner, repo: name }),
      octokit.rest.repos.listContributors({ owner, repo: name }).catch(() => ({ data: [] })),
    ])

    const repo = repoRes.data
    return {
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
      contributors: (contributorsRes.data as any[]).slice(0, 30).map((c: any) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
      })),
    }
  } catch (e: any) {
    console.error(`[LocalAnalyzer] GitHub API fetch failed for ${url}: ${e.message}`)
    return null
  }
}

async function analyzeOne(url: string): Promise<boolean> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
  if (!match) { console.error(`[LocalAnalyzer] Invalid GitHub URL: ${url}`); return false }
  const owner = match[1]
  const repoName = match[2]
  const cloneDir = path.join(TMP_DIR, `${sanitizeName(owner)}-${sanitizeName(repoName)}`)

  // Phase 1: Fetch GitHub API metadata (optional, requires GITHUB_TOKEN)
  console.log(`[LocalAnalyzer] (${url}) Fetching GitHub API metadata...`)
  const apiData = await fetchGitHubApi(url)
  if (apiData) {
    console.log(`[LocalAnalyzer] API: ${apiData.stars} stars, ${apiData.forks} forks, ${Object.keys(apiData.languages || {}).length} langs`)
  } else {
    console.log(`[LocalAnalyzer] API: no token or fetch failed — clone-only mode`)
  }

  // Phase 2: Clone repo
  console.log(`[LocalAnalyzer] Cloning ${owner}/${repoName}...`)
  if (fs.existsSync(cloneDir)) {
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) }
    catch { execSync(`cmd /c rmdir /s /q "${cloneDir}"`, { stdio: 'pipe' }) }
  }
  fs.mkdirSync(cloneDir, { recursive: true })

  try {
    execSync(`git clone --depth 1 "${url}" "${cloneDir}"`, { stdio: 'pipe', timeout: 300000 })
  } catch (e: any) {
    console.error(`[LocalAnalyzer] Clone failed for ${url}: ${e.stderr?.toString?.() || e.message}`)
    if (fs.existsSync(cloneDir)) {
      try { fs.rmSync(cloneDir, { recursive: true, force: true }) }
      catch { try { execSync(`cmd /c rmdir /s /q "${cloneDir}"`, { stdio: 'pipe' }) } catch {} }
    }
    return false
  }

  // Phase 3: Extract data from clone
  console.log(`[LocalAnalyzer] Scanning files...`)
  const fileTree = walkDir(cloneDir)
  const cloneLanguages = countLanguages(fileTree)
  const readmeContent = findReadme(fileTree, cloneDir)
  const dependencyFiles = findDepFiles(fileTree, cloneDir)
  const fileCount = fileTree.reduce((c, n) => { function w(ns: FileNode[]): void { for (const x of ns) { if (x.type === 'blob') c++; if (x.children) w(x.children) } }; w([n]); return c }, 0)

  console.log(`[LocalAnalyzer] Files: ${fileCount}, Languages: ${Object.keys(cloneLanguages).length}, Readme: ${readmeContent.length} chars`)

  // Phase 4: Build RepoInfo — merge API metadata with clone filesystem data
  const repoInfo: RepoInfo = {
    id: `${owner}/${repoName}`, url, owner, name: repoName,
    description: apiData?.description ?? null,
    defaultBranch: apiData?.defaultBranch ?? 'main',
    stars: apiData?.stars ?? 0,
    forks: apiData?.forks ?? 0,
    openIssues: apiData?.openIssues ?? 0,
    watchers: apiData?.watchers ?? 0,
    topics: apiData?.topics ?? [],
    license: apiData?.license ?? null,
    createdAt: apiData?.createdAt ?? '',
    updatedAt: apiData?.updatedAt ?? '',
    pushedAt: apiData?.pushedAt ?? '',
    size: apiData?.size ?? 0,
    languages: cloneLanguages,
    contributors: apiData?.contributors ?? [],
    readmeContent, fileTree, dependencyFiles,
  }

  const hasApi = !!apiData
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && process.env.GEMINI_API_KEY.length > 10)
  const hasGroq = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here' && process.env.GROQ_API_KEY.length > 10)
  const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
  const aiLabel = hasGemini ? 'Gemini' : hasGroq ? 'Groq' : hasOpenAI ? 'OpenAI' : 'LocalAI'
  console.log(`[LocalAnalyzer] Source: ${hasApi ? 'api-clone' : 'clone-only'}, AI: ${aiLabel}`)

  const analysisMethod: AnalysisMethod = {
    cloneMethod: 'full',
    apiData: apiData ? 'full' : 'none',
    aiProvider: aiLabel.toLowerCase() as AnalysisMethod['aiProvider'],
    confidence: (() => {
      let c = 100
      if (!apiData) c -= 20
      if (aiLabel === 'LocalAI') c -= 25
      return Math.max(20, c)
    })(),
  }

  // Phase 5: Run analysis pipeline
  console.log(`[LocalAnalyzer] Analyzing...`)
  const report: AnalysisReport = await analyzeRepository(repoInfo)
  report.analysisMethod = analysisMethod

  // Phase 6: Save report
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const tag = aiLabel.toLowerCase()
  const filename = `${sanitizeName(owner)}-${sanitizeName(repoName)}-${tag}-${Date.now()}.json`
  fs.writeFileSync(path.join(RESULTS_DIR, filename), JSON.stringify(report, null, 2))
  console.log(`[LocalAnalyzer] Report saved: analysis-results/${filename}`)

  // Phase 7: Cleanup
  console.log(`[LocalAnalyzer] Cleaning up...`)
  if (fs.existsSync(cloneDir)) {
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) }
    catch { try { execSync(`cmd /c rmdir /s /q "${cloneDir}"`, { stdio: 'pipe' }) } catch {} }
  }
  console.log(`[LocalAnalyzer] Done ${owner}/${repoName}`)
  return true
}

async function main() {
  const urls = process.argv.slice(2)
  if (urls.length === 0) {
    console.log('Usage: npx tsx workers/localAnalyzer.ts <github-url1> [github-url2 ...]')
    console.log('Example: npx tsx workers/localAnalyzer.ts https://github.com/torvalds/linux https://github.com/facebook/react')
    console.log()
    console.log('Environment:')
    console.log('  GEMINI_API_KEY  — Gemini AI (recommended)')
    console.log('  GITHUB_TOKEN    — GitHub API (stars/forks metadata)')
    console.log('  OPENAI_API_KEY  — fallback AI')
    process.exit(1)
  }

  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && process.env.GEMINI_API_KEY.length > 10)
  const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
  const hasGitHub = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'your_github_token_here' && process.env.GITHUB_TOKEN.length > 10)
  console.log(`[LocalAnalyzer] AI: ${hasGemini ? 'Gemini' : hasOpenAI ? 'OpenAI' : 'LocalAI'}`)
  console.log(`[LocalAnalyzer] GitHub API: ${hasGitHub ? 'enabled' : 'disabled'}`)
  console.log(`[LocalAnalyzer] Batch: ${urls.length} repo(s)`)
  console.log()

  let ok = 0, fail = 0
  for (const url of urls) {
    if (await analyzeOne(url)) ok++
    else fail++
    console.log()
  }
  console.log(`[LocalAnalyzer] Batch complete — ${ok} succeeded, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
