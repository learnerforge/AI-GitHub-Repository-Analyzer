import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { RepoInfo, FileNode, AnalysisReport } from '../src/types'
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

function countFilesInTree(fileTree: FileNode[]): number {
  let count = 0
  function walk(nodes: FileNode[]) {
    for (const n of nodes) {
      if (n.type === 'blob') count++
      if (n.children) walk(n.children)
    }
  }
  walk(fileTree)
  return count
}

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function fetchJson(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AI-GitHub-Repo-Analyzer/1.0',
  }
  if (token && token.length > 10 && token !== 'your_github_token_here') {
    headers['Authorization'] = `token ${token}`
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

async function fetchGitHubApi(url: string): Promise<Partial<RepoInfo> | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'your_github_token_here' || token.length <= 10) return null

  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
    if (!match) return null
    const owner = match[1], name = match[2].replace(/\.git$/, '')
    const baseUrl = `https://api.github.com/repos/${owner}/${name}`

    const [repoData, languagesData, contributorsData] = await Promise.all([
      fetchJson(baseUrl, token),
      fetchJson(`${baseUrl}/languages`, token),
      fetchJson(`${baseUrl}/contributors?per_page=30`, token).catch(() => []),
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
      languages: languagesData as Record<string, number>,
      contributors: (contributorsData as any[]).slice(0, 30).map((c: any) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
      })),
    }
  } catch (e: any) {
    console.error(`[Batch] GitHub API fetch failed for ${url}: ${e.message}`)
    return null
  }
}

async function analyzeOne(url: string, index: number, total: number): Promise<boolean> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
  if (!match) { console.error(`[Batch] Invalid GitHub URL: ${url}`); return false }
  const owner = match[1], repoName = match[2].replace(/\.git$/, '')
  const cloneDir = path.join(TMP_DIR, `${sanitizeName(owner)}-${sanitizeName(repoName)}`)
  const label = `[${index + 1}/${total}] ${owner}/${repoName}`

  // Phase 1: Fetch GitHub API metadata (optional, requires GITHUB_TOKEN)
  console.log(`\n${label} Fetching GitHub API metadata...`)
  const apiData = await fetchGitHubApi(url)
  if (apiData) {
    console.log(`${label} API: ${apiData.stars} stars, ${apiData.forks} forks, ${Object.keys(apiData.languages || {}).length} langs`)
  } else {
    console.log(`${label} API: No token or fetch failed — clone-only mode`)
  }

  // Phase 2: Clone repo locally
  console.log(`${label} Cloning repository...`)
  if (fs.existsSync(cloneDir)) {
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) }
    catch { execSync(`cmd /c rmdir /s /q "${cloneDir}"`, { stdio: 'pipe' }) }
  }
  fs.mkdirSync(cloneDir, { recursive: true })

  try {
    execSync(`git -c core.longpaths=true clone --depth 1 "${url}" "${cloneDir}"`, { stdio: 'pipe', timeout: 300000 })
  } catch (e: any) {
    console.error(`${label} Clone failed: ${e.stderr?.toString?.() || e.message}`)
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {}
    return false
  }

  // Phase 3: Extract data from clone
  console.log(`${label} Scanning files...`)
  const fileTree = walkDir(cloneDir)
  const cloneLanguages = countLanguages(fileTree)
  const readmeContent = findReadme(fileTree, cloneDir)
  const dependencyFiles = findDepFiles(fileTree, cloneDir)
  const fileCount = countFilesInTree(fileTree)
  console.log(`${label} Files: ${fileCount}, Languages: ${Object.keys(cloneLanguages).length}, Readme: ${readmeContent.length} chars`)

  // Phase 4: Build RepoInfo — merge API data with clone data
  // Clone data (file tree, languages, README) takes priority since it's more accurate
  // API data (stars, forks, topics, dates) fills in metadata
  const repoInfo: RepoInfo = {
    id: `${owner}/${repoName}`,
    url,
    owner,
    name: repoName,
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
    readmeContent,
    fileTree,
    dependencyFiles,
  }
  const sourceTag = apiData ? 'api-clone' : 'clone-only'
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && process.env.GEMINI_API_KEY.length > 10)
  const hasGroq = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here' && process.env.GROQ_API_KEY.length > 10)
  const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
  const aiLabel = hasGemini ? 'Gemini' : hasGroq ? 'Groq' : hasOpenAI ? 'OpenAI' : 'LocalAI'
  console.log(`${label} Source: ${sourceTag}, AI: ${aiLabel}`)

  // Phase 5: Run analysis pipeline (uses whichever AI provider is configured)
  console.log(`${label} Analyzing...`)
  let report: AnalysisReport
  try {
    report = await analyzeRepository(repoInfo)
  } catch (e: any) {
    console.error(`${label} Analysis failed: ${e.message}`)
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) } catch {}
    return false
  }

  // Phase 6: Save report
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const tag = aiLabel.toLowerCase()
  const filename = `${sanitizeName(owner)}-${sanitizeName(repoName)}-${tag}-${Date.now()}.json`
  fs.writeFileSync(path.join(RESULTS_DIR, filename), JSON.stringify(report, null, 2))
  console.log(`${label} Report saved: analysis-results/${filename}`)

  // Phase 7: Cleanup
  console.log(`${label} Cleaning up...`)
  if (fs.existsSync(cloneDir)) {
    try { fs.rmSync(cloneDir, { recursive: true, force: true }) }
    catch { try { execSync(`cmd /c rmdir /s /q "${cloneDir}"`, { stdio: 'pipe' }) } catch {} }
  }
  console.log(`${label} Done`)
  return true
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npm run analyze:batch -- <github-url1> [github-url2 ...]')
    console.log('  npm run analyze:batch -- repos.txt')
    console.log()
    console.log('Examples:')
    console.log('  npm run analyze:batch -- https://github.com/facebook/react https://github.com/torvalds/linux')
    console.log('  npm run analyze:batch -- repos.txt')
    console.log()
    console.log('Environment variables:')
    console.log('  GEMINI_API_KEY  — Google Gemini AI key (recommended)')
    console.log('  GITHUB_TOKEN    — GitHub API token (for stars/forks metadata)')
    console.log('  OPENAI_API_KEY  — Fallback if Gemini not set')
    process.exit(1)
  }

  // Determine URLs: either a file (one URL per line) or inline arguments
  let urls: string[]
  if (args.length === 1 && fs.existsSync(args[0])) {
    urls = fs.readFileSync(args[0], 'utf-8')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'))
    console.log(`[Batch] Loaded ${urls.length} URLs from ${args[0]}`)
  } else {
    urls = args.filter(u => u.startsWith('http'))
    console.log(`[Batch] ${urls.length} repo(s) from command line`)
  }

  if (urls.length === 0) {
    console.error('[Batch] No valid URLs found')
    process.exit(1)
  }

  // Print configuration
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && process.env.GEMINI_API_KEY.length > 10)
  const hasGroq = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here' && process.env.GROQ_API_KEY.length > 10)
  const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
  const hasGitHub = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'your_github_token_here' && process.env.GITHUB_TOKEN.length > 10)
  const aiSummaryLabel = hasGemini ? 'Gemini' : hasGroq ? 'Groq' : hasOpenAI ? 'OpenAI' : 'LocalAI (no API keys set)'
  console.log(`[Batch] AI: ${aiSummaryLabel}`)
  console.log(`[Batch] GitHub API: ${hasGitHub ? 'enabled' : 'disabled (no valid token)'}`)
  console.log()

  // Process each repo
  let ok = 0, fail = 0
  for (let i = 0; i < urls.length; i++) {
    if (await analyzeOne(urls[i], i, urls.length)) ok++
    else fail++
  }

  // Summary
  console.log()
  console.log('═'.repeat(55))
  console.log(`  BATCH ANALYSIS COMPLETE`)
  console.log(`  ${ok + fail} total, ${ok} succeeded, ${fail} failed`)
  if (ok > 0) console.log(`  Reports: ${RESULTS_DIR}${path.sep}*-gemini-*.json`)
  console.log('═'.repeat(55))

  const stats = { total: ok + fail, ok, fail, timestamp: new Date().toISOString() }
  const statsFile = path.join(RESULTS_DIR, '_batch-summary.json')
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2))

  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
