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

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function analyzeOne(url: string): Promise<boolean> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.#?]+)/)
  if (!match) { console.error(`[LocalAnalyzer] Invalid GitHub URL: ${url}`); return false }
  const owner = match[1]
  const repoName = match[2]
  const cloneDir = path.join(TMP_DIR, `${sanitizeName(owner)}-${sanitizeName(repoName)}`)

  console.log(`[LocalAnalyzer] (${url}) Cloning ${owner}/${repoName}...`)
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

  console.log(`[LocalAnalyzer] Scanning files...`)
  const fileTree = walkDir(cloneDir)
  const languages = countLanguages(fileTree)
  const readmeContent = findReadme(fileTree, cloneDir)
  const dependencyFiles = findDepFiles(fileTree, cloneDir)
  const fileCount = fileTree.reduce((c, n) => { function w(ns: FileNode[]): void { for (const x of ns) { if (x.type === 'blob') c++; if (x.children) w(x.children) } }; w([n]); return c }, 0)

  console.log(`[LocalAnalyzer] Files: ${fileCount}, Languages: ${Object.keys(languages).length}, Readme: ${readmeContent.length} chars`)

  const repoInfo: RepoInfo = {
    id: `${owner}/${repoName}`, url, owner, name: repoName,
    description: null, defaultBranch: 'main',
    stars: 0, forks: 0, openIssues: 0, watchers: 0,
    topics: [], license: null,
    createdAt: '', updatedAt: '', pushedAt: '', size: 0,
    languages, contributors: [],
    readmeContent, fileTree, dependencyFiles,
  }

  console.log(`[LocalAnalyzer] Analyzing...`)
  const report: AnalysisReport = await analyzeRepository(repoInfo)

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const filename = `${sanitizeName(owner)}-${sanitizeName(repoName)}-local-${Date.now()}.json`
  fs.writeFileSync(path.join(RESULTS_DIR, filename), JSON.stringify(report, null, 2))
  console.log(`[LocalAnalyzer] Report saved: analysis-results/${filename}`)

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
    process.exit(1)
  }

  console.log(`[LocalAnalyzer] Batch: ${urls.length} repo(s)`)
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
