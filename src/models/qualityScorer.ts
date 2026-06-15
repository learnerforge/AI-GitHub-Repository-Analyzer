export interface ParamDef {
  name: string
  default: number
  min: number
  max: number
  deltas: number[]
}

export const PARAM_DEFS: ParamDef[] = [
  { name: 'w_codeQuality', default: 0.25, min: 0, max: 1, deltas: [0.05, -0.05, 0.1, -0.1] },
  { name: 'w_docs', default: 0.20, min: 0, max: 1, deltas: [0.05, -0.05, 0.1, -0.1] },
  { name: 'w_maintainability', default: 0.20, min: 0, max: 1, deltas: [0.05, -0.05, 0.1, -0.1] },
  { name: 'w_community', default: 0.20, min: 0, max: 1, deltas: [0.05, -0.05, 0.1, -0.1] },
  { name: 'w_security', default: 0.15, min: 0, max: 1, deltas: [0.05, -0.05, 0.1, -0.1] },
  { name: 'b_complexity', default: 10, min: 0, max: 50, deltas: [5, -5, 10, -10] },
  { name: 'b_readme', default: 10, min: 0, max: 50, deltas: [5, -5, 10, -10] },
  { name: 'b_activity', default: 5, min: 0, max: 50, deltas: [5, -5, 10, -10] },
  { name: 'base_codeQuality', default: 50, min: 0, max: 100, deltas: [5, -5, 10, -10] },
  { name: 'base_documentation', default: 30, min: 0, max: 100, deltas: [5, -5, 10, -10] },
  { name: 'base_maintainability', default: 50, min: 0, max: 100, deltas: [5, -5, 10, -10] },
  { name: 'base_community', default: 20, min: 0, max: 100, deltas: [5, -5, 10, -10] },
  { name: 'base_security', default: 30, min: 0, max: 100, deltas: [5, -5, 10, -10] },
  { name: 'cq_lang2plus', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'cq_lang4plus', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'cq_files10to200', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'cq_files5to500', default: 5, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'cq_avgFile50to300', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'cq_flatStructurePenalty', default: 5, min: 0, max: 40, deltas: [1, -1, 3, -3] },
  { name: 'doc_readmeExists', default: 20, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'doc_scoreOver30', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'doc_scoreOver60', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'doc_hasContributing', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'doc_hasLicense', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'doc_hasApiDocs', default: 5, min: 0, max: 20, deltas: [2, -2, 3, -3] },
  { name: 'doc_sectionMax', default: 5, min: 0, max: 20, deltas: [1, -1, 2, -2] },
  { name: 'maint_lang2to5', default: 15, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'maint_files10to300', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'maint_avgFileUpTo200', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'maint_linesUnder50k', default: 10, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'maint_linesUnder10k', default: 5, min: 0, max: 40, deltas: [2, -2, 3, -3] },
  { name: 'comm_starsMax', default: 25, min: 0, max: 50, deltas: [3, -3, 5, -5] },
  { name: 'comm_starsLogFactor', default: 5, min: 0, max: 20, deltas: [0.5, -0.5, 1, -1] },
  { name: 'comm_forksMax', default: 15, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'comm_forksLogFactor', default: 3, min: 0, max: 20, deltas: [0.5, -0.5, 1, -1] },
  { name: 'comm_contributors2plus', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'comm_contributors5plus', default: 5, min: 0, max: 30, deltas: [2, -2, 3, -3] },
  { name: 'comm_recentDays30', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'comm_recentDays180', default: 5, min: 0, max: 30, deltas: [2, -2, 3, -3] },
  { name: 'comm_hasCI', default: 10, min: 0, max: 30, deltas: [3, -3, 5, -5] },
  { name: 'comm_hasTests', default: 5, min: 0, max: 30, deltas: [2, -2, 3, -3] },
  { name: 'sec_lockFile', default: 20, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'sec_hasCI', default: 20, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'sec_hasTests', default: 15, min: 0, max: 40, deltas: [3, -3, 5, -5] },
  { name: 'sec_licenseFile', default: 15, min: 0, max: 40, deltas: [3, -3, 5, -5] },
]

export const DEFAULT_PARAMS: Record<string, number> = {}
for (const p of PARAM_DEFS) {
  DEFAULT_PARAMS[p.name] = p.default
}

const DOC_REPO_TOPICS = new Set(['documentation', 'docs', 'book', 'wiki', 'knowledge', 'learning', 'tutorial', 'guide'])

function safeGet(d: any, key: string, defaultVal: number = 0): number {
  if (!d) return defaultVal
  const v = d[key]
  return typeof v === 'number' ? v : defaultVal
}

function hasFlatStructure(fileTree: any[]): boolean {
  const dirs = fileTree.filter(n => n.type === 'tree')
  return dirs.length > 50 || dirs.length === 0
}

function scoreCodeQuality(
  langCount: number, fileCount: number, avgFileSize: number,
  fileTree: any[], p: Record<string, number>,
): number {
  let score = p.base_codeQuality
  if (langCount >= 2) score += p.cq_lang2plus
  if (langCount >= 4) score += p.cq_lang4plus
  if (fileCount >= 10 && fileCount <= 200) score += p.cq_files10to200
  if (fileCount >= 5 && fileCount <= 500) score += p.cq_files5to500
  if (avgFileSize >= 50 && avgFileSize <= 300) score += p.cq_avgFile50to300
  if (hasFlatStructure(fileTree)) score -= p.cq_flatStructurePenalty
  return Math.max(0, Math.min(100, score))
}

function scoreDocumentation(
  readmeLength: number, docs: any, p: Record<string, number>,
): number {
  let score = p.base_documentation
  if (readmeLength > 20) score += p.doc_readmeExists
  if (docs) {
    const rscore = typeof docs.readmeScore === 'number' ? docs.readmeScore : 0
    if (rscore > 30) score += p.doc_scoreOver30
    if (rscore > 60) score += p.doc_scoreOver60
    if (docs.hasContributing) score += p.doc_hasContributing
    if (docs.hasLicense) score += p.doc_hasLicense
    if (docs.hasApiDocs) score += p.doc_hasApiDocs
    const sections = docs.sectionCoverage || []
    const presentCount = sections.filter((s: any) => s.present).length
    score += Math.min(p.doc_sectionMax, presentCount)
  }
  return Math.max(0, Math.min(100, score))
}

function scoreMaintainability(
  langCount: number, fileCount: number, avgFileSize: number, totalLines: number,
  p: Record<string, number>,
): number {
  let score = p.base_maintainability
  if (langCount >= 2 && langCount <= 5) score += p.maint_lang2to5
  if (fileCount >= 10 && fileCount <= 300) score += p.maint_files10to300
  if (avgFileSize <= 200) score += p.maint_avgFileUpTo200
  if (totalLines < 50000) score += p.maint_linesUnder50k
  if (totalLines < 10000) score += p.maint_linesUnder10k
  return Math.max(0, Math.min(100, score))
}

function scoreCommunity(
  stars: number, forks: number, contributors: number,
  lastCommitDays: number, hasCI: boolean, hasTests: boolean,
  p: Record<string, number>,
): number {
  let score = p.base_community
  if (stars > 0) {
    score += Math.min(p.comm_starsMax, p.comm_starsLogFactor * Math.log2(Math.max(1, stars)))
  }
  if (forks > 0) {
    score += Math.min(p.comm_forksMax, p.comm_forksLogFactor * Math.log2(Math.max(1, forks)))
  }
  if (contributors > 1) score += p.comm_contributors2plus
  if (contributors > 5) score += p.comm_contributors5plus
  if (lastCommitDays < 30) {
    score += p.comm_recentDays30
  } else if (lastCommitDays < 180) {
    score += p.comm_recentDays180
  }
  if (hasCI) score += p.comm_hasCI
  if (hasTests) score += p.comm_hasTests
  return Math.max(0, Math.min(100, score))
}

function scoreSecurity(
  dependencyFiles: Record<string, string>, hasCI: boolean, hasTests: boolean,
  p: Record<string, number>,
): number {
  let score = p.base_security
  const hasLockfile = Object.keys(dependencyFiles || {}).length > 0
  if (hasLockfile) score += p.sec_lockFile
  if (hasCI) score += p.sec_hasCI
  if (hasTests) score += p.sec_hasTests
  const licenseFiles = Object.keys(dependencyFiles || {}).filter(f => f.toLowerCase().includes('license'))
  if (licenseFiles.length > 0) score += p.sec_licenseFile
  return Math.max(0, Math.min(100, score))
}

export function computeQualityScores(
  repoInfoArg: { languages?: Record<string, number>; fileTree?: any[]; dependencyFiles?: Record<string, string>; topics?: string[] },
  complexityArg: any,
  docsArg: any,
  healthArg: any,
  params?: Record<string, number>,
): { overall: number; codeQuality: number; documentation: number; maintainability: number; communityHealth: number; security: number; breakdown?: Record<string, { score: number; reason: string }> } {
  const p = { ...DEFAULT_PARAMS, ...(params || {}) }
  const languages = repoInfoArg?.languages || {}
  const fileTree = repoInfoArg?.fileTree || []
  const dependencyFiles = repoInfoArg?.dependencyFiles || {}
  const topics = repoInfoArg?.topics || []

  const langCount = Object.keys(languages).length
  const fileCount = safeGet(complexityArg, 'fileCount', fileTree.length)
  const avgFileSize = safeGet(complexityArg, 'averageFileSize', 0)
  const totalLines = safeGet(complexityArg, 'totalLines', 0)

  const stars = safeGet(healthArg, 'stars', 0)
  const forks = safeGet(healthArg, 'forks', 0)
  const contributors = safeGet(healthArg, 'contributorCount', 0)
  const lastCommitDays = safeGet(healthArg, 'lastCommitDays', 999)
  const hasCI = !!healthArg?.hasCI
  const hasTests = !!healthArg?.hasTests

  const readmeLength = safeGet(docsArg, 'readmeLength', 0)

  const codeQuality = scoreCodeQuality(langCount, fileCount, avgFileSize, fileTree, p)
  const documentation = scoreDocumentation(readmeLength, docsArg, p)
  const maintainability = scoreMaintainability(langCount, fileCount, avgFileSize, totalLines, p)
  const community = scoreCommunity(stars, forks, contributors, lastCommitDays, hasCI, hasTests, p)
  const security = scoreSecurity(dependencyFiles, hasCI, hasTests, p)

  let total =
    p.w_codeQuality * codeQuality +
    p.w_docs * documentation +
    p.w_maintainability * maintainability +
    p.w_community * community +
    p.w_security * security

  const bonusAdj = ((p.b_complexity - 10) + (p.b_readme - 10) + (p.b_activity - 5)) / 4

  const isDocRepo = topics.some(t => DOC_REPO_TOPICS.has(t.toLowerCase()))
  if (isDocRepo) {
    total = total * 0.4 + documentation * 0.6
  }

  const overall = Math.max(0, Math.min(100, Math.round(total + bonusAdj)))

  return {
    overall,
    codeQuality: Math.round(codeQuality),
    documentation: Math.round(documentation),
    maintainability: Math.round(maintainability),
    communityHealth: Math.round(community),
    security: Math.round(security),
    breakdown: {
      'Code Quality': { score: Math.round(codeQuality), reason: `${langCount} langs, ${fileCount} files, ${avgFileSize} avg lines/file` },
      'Documentation': { score: Math.round(documentation), reason: `README score ${safeGet(docsArg, 'readmeScore', 50)}/100` },
      'Maintainability': { score: Math.round(maintainability), reason: `${langCount} languages, ${fileCount} files` },
      'Community': { score: Math.round(community), reason: `${stars} stars, ${forks} forks, ${contributors} contributors` },
      'Security': { score: Math.round(security), reason: `CI: ${hasCI}, Tests: ${hasTests}, Lockfile: ${Object.keys(dependencyFiles).length > 0}` },
    },
  }
}
