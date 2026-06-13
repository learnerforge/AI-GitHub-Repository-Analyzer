import { QualityScores, ComplexityMetrics, DocsQuality, HealthMetrics, RepoInfo } from '@/types'
import { calculateReadability } from './textAnalyzer'

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

export function computeQualityScores(
  repo: RepoInfo,
  complexity: ComplexityMetrics,
  docsQuality: DocsQuality,
  health: HealthMetrics,
  params: ScorerParams = DEFAULT_PARAMS
): QualityScores {
  const codeQuality = computeCodeQuality(repo, complexity, params)
  const documentation = computeDocumentationScore(docsQuality, params)
  const maintainability = computeMaintainability(repo, complexity, params)
  const communityHealth = computeCommunityScore(health, params)
  const security = computeSecurityScore(repo, params)

  const overall = Math.round(
    codeQuality * params.codeQualityWeight +
    documentation * params.docsWeight +
    maintainability * params.maintainabilityWeight +
    communityHealth * params.communityWeight +
    security * params.securityWeight
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

function computeCodeQuality(repo: RepoInfo, complexity: ComplexityMetrics, params: ScorerParams): number {
  let score = 50

  const langCount = Object.keys(repo.languages).length
  if (langCount <= 3) score += 15
  else if (langCount <= 5) score += 10
  else score += 5

  if (complexity.fileCount > 0) {
    if (complexity.fileCount < 30) score += 10
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

function computeDocumentationScore(docs: DocsQuality, params: ScorerParams): number {
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

  return score
}

function computeMaintainability(repo: RepoInfo, complexity: ComplexityMetrics, params: ScorerParams): number {
  let score = 50

  const langCount = Object.keys(repo.languages).length
  if (langCount <= 2) score += 15
  else if (langCount <= 4) score += 10
  else if (langCount <= 6) score += 5

  if (complexity.fileCount < 50) score += 10
  else if (complexity.fileCount < 200) score += 5
  else score -= 5

  if (complexity.averageFileSize < 100) score += 15
  else if (complexity.averageFileSize < 300) score += 10
  else score += 5

  if (complexity.totalLines < 10000) score += 10
  else if (complexity.totalLines < 50000) score += 5
  else score += 0

  return score
}

function computeCommunityScore(health: HealthMetrics, params: ScorerParams): number {
  let score = 30

  if (health.stars > 1000) score = 30
  else if (health.stars > 100) score += 20
  else if (health.stars > 10) score += 10
  else if (health.stars > 0) score += 5
  else score += 0

  if (health.hasRecentActivity) score += 20
  else score += 5

  if (health.contributorCount > 10) score += 15
  else if (health.contributorCount > 3) score += 10
  else if (health.contributorCount > 1) score += 5

  if (health.forks > 50) score += 15
  else if (health.forks > 10) score += 10
  else if (health.forks > 0) score += 5

  if (health.openIssues < 10) score += 5
  else if (health.openIssues < 50) score += 2

  return score
}

function computeSecurityScore(repo: RepoInfo, params: ScorerParams): number {
  let score = 60

  const hasLockFile = Object.values(repo.dependencyFiles).some(f =>
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
