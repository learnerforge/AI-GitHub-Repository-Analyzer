import { QualityScores, ComplexityMetrics, DocsQuality, HealthMetrics, RepoInfo } from '@/types'

export interface ScorerParams {
  codeQualityWeight: number
  docsWeight: number
  maintainabilityWeight: number
  communityWeight: number
  securityWeight: number
  complexityBonus: number
  readmeBonus: number
}

const DEFAULT_PARAMS: ScorerParams = {
  codeQualityWeight: 0.25,
  docsWeight: 0.20,
  maintainabilityWeight: 0.20,
  communityWeight: 0.20,
  securityWeight: 0.15,
  complexityBonus: 10,
  readmeBonus: 10,
}

const DOC_REPO_TOPICS = new Set([
  'education', 'learning', 'books', 'documentation', 'tutorial', 'reference',
  'awesome-list', 'cheatsheet', 'study', 'curated', 'resources',
])

function isDocRepo(repo: RepoInfo, complexity: ComplexityMetrics): boolean {
  if (complexity.fileCount > 50) return false
  if (repo.stars < 1000) return false
  const topics = (repo as any).topics ?? []
  if (topics.some((t: string) => DOC_REPO_TOPICS.has(t.toLowerCase().replace(/[_-]/g, '')))) return true
  const readme = (repo as any).readmeContent ?? ''
  if (readme.length < 200) return false
  const headMatch = readme.match(/^#\s+(.+)/m)
  const title = headMatch?.[1] ?? ''
  const docKeywords = ['book', 'guide', 'tutorial', 'list', 'curated', 'awesome', 'learn', 'study', 'reference', 'resource', 'roadmap', 'primer', 'interview', 'university']
  if (docKeywords.some(k => title.toLowerCase().includes(k))) return true
  const headingCount = readme.match(/^## /gm)?.length ?? 0
  if (headingCount >= 8) return true
  const knownEduRepos = ['developer-roadmap', 'free-programming-books', 'public-apis', 'system-design-primer', 'coding-interview-university']
  if (knownEduRepos.some(n => repo.name?.includes(n))) return true
  return false
}

function isLargeRepo(repo: RepoInfo, complexity: ComplexityMetrics): boolean {
  return complexity.fileCount > 10000 || complexity.totalLines > 500000
}

export function computeQualityScores(
  repo: RepoInfo,
  complexity: ComplexityMetrics,
  docsQuality: DocsQuality,
  health: HealthMetrics,
  params: ScorerParams = DEFAULT_PARAMS
): QualityScores {
  const docRepo = isDocRepo(repo, complexity)
  const largeRepo = isLargeRepo(repo, complexity)

  const codeQuality = computeCodeQuality(repo, complexity, params, docRepo, largeRepo)
  const documentation = computeDocumentationScore(docsQuality, params, docRepo)
  const maintainability = computeMaintainability(repo, complexity, params, largeRepo)
  const communityHealth = computeCommunityScore(health, params, docRepo)
  const security = computeSecurityScore(repo, params)

  let cqw = params.codeQualityWeight
  let dw = params.docsWeight
  let mw = params.maintainabilityWeight
  let cow = params.communityWeight
  let sw = params.securityWeight

  if (docRepo) {
    cqw = 0.05
    dw = 0.35
    mw = 0.10
    cow = 0.40
    sw = 0.10
  } else if (largeRepo) {
    cqw = 0.20
    dw = 0.15
    mw = 0.25
    cow = 0.25
    sw = 0.15
  }

  const overall = Math.round(
    codeQuality * cqw +
    documentation * dw +
    maintainability * mw +
    communityHealth * cow +
    security * sw
  )

  return {
    overall: Math.min(100, Math.max(0, overall)),
    codeQuality: Math.min(100, Math.max(0, codeQuality)),
    documentation: Math.min(100, Math.max(0, documentation)),
    maintainability: Math.min(100, Math.max(0, maintainability)),
    communityHealth: Math.min(100, Math.max(0, communityHealth)),
    security: Math.min(100, Math.max(0, security)),
  }
}

function computeCodeQuality(
  repo: RepoInfo, complexity: ComplexityMetrics, params: ScorerParams,
  docRepo: boolean, largeRepo: boolean
): number {
  let score = 50

  if (docRepo) {
    score = 70
    if (complexity.fileCount > 0) score += 10
    if (complexity.fileCount > 10) score += 10
    return Math.min(100, score)
  }

  const langCount = Object.keys(repo.languages).length
  if (langCount <= 3) score += 15
  else if (langCount <= 5) score += 10
  else if (langCount <= 8) score += 5
  else score += 3

  if (complexity.fileCount > 0) {
    if (largeRepo) {
      score += 5
    } else if (complexity.fileCount < 30) score += 10
    else if (complexity.fileCount < 100) score += 5
    else score += 2
  }

  if (complexity.averageFileSize < 50) score += 10
  else if (complexity.averageFileSize < 150) score += 5
  else if (complexity.averageFileSize > 500) score -= 5

  const hasStructuredDirs = repo.fileTree.some(n => n.type === 'tree')
  if (hasStructuredDirs) score += 15

  return score
}

function computeDocumentationScore(
  docs: DocsQuality, params: ScorerParams, docRepo: boolean
): number {
  let score = 30

  if (docs.hasReadme) {
    score += 20
    if (docs.readmeScore > 70) score += 15
    else if (docs.readmeScore > 40) score += 10
    else score += 5
  }

  if (docs.hasLicense) score += 10
  if (docs.hasContributing) score += 10
  if (docs.hasCodeOfConduct) score += 5
  if (docs.hasChangelog) score += 5
  if (docs.hasApiDocs) score += 5

  const sectionCount = docs.sectionCoverage.filter(s => s.present).length
  score += Math.min(10, sectionCount * 2)

  if (docRepo) score = Math.max(score, 70)

  return score
}

function computeMaintainability(
  repo: RepoInfo, complexity: ComplexityMetrics, params: ScorerParams,
  largeRepo: boolean
): number {
  let score = 50

  const langCount = Object.keys(repo.languages).length
  if (langCount <= 2) score += 15
  else if (langCount <= 4) score += 10
  else if (langCount <= 6) score += 5
  else score += 3

  if (largeRepo) {
    score += 10
  } else if (complexity.fileCount < 50) score += 10
  else if (complexity.fileCount < 200) score += 5
  else score -= 5

  if (complexity.averageFileSize < 100) score += 15
  else if (complexity.averageFileSize < 300) score += 10
  else score += 5

  if (complexity.totalLines < 10000) score += 10
  else if (complexity.totalLines < 50000) score += 5
  else if (largeRepo) score += 3
  else score += 0

  return score
}

function computeCommunityScore(
  health: HealthMetrics, params: ScorerParams, docRepo: boolean
): number {
  let score = 20

  let starMax = 30
  if (docRepo) starMax = 40
  if (health.stars > 0) score += Math.min(starMax, Math.round(Math.log2(health.stars) * 3))

  if (health.hasRecentActivity) score += 20
  else score += 5

  if (health.contributorCount > 0) score += Math.min(15, Math.round(Math.log2(health.contributorCount) * 4))
  if (health.forks > 0) score += Math.min(15, Math.round(Math.log2(health.forks) * 2.5))
  if (health.openIssues < 10) score += 5
  else if (health.openIssues < 50) score += 2

  return score
}

function computeSecurityScore(repo: RepoInfo, params: ScorerParams): number {
  let score = 30

  const hasLockFile = Object.keys(repo.dependencyFiles).some(f =>
    ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock', 'Cargo.lock'].includes(f)
  )
  if (hasLockFile) score += 15

  const hasCI = repo.fileTree.some(f => f.path.includes('.github/workflows'))
  if (hasCI) score += 10

  const hasTests = repo.fileTree.some(f =>
    ['tests', '__tests__', 'test'].includes(f.name) || f.name.includes('.test.') || f.name.includes('.spec.')
  )
  if (hasTests) score += 10

  if (repo.license) score += 5

  return score
}

export function getDefaultParams(): ScorerParams {
  return { ...DEFAULT_PARAMS }
}
