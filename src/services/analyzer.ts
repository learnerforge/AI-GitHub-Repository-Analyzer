import { RepoInfo, AnalysisReport, ComplexityMetrics, DocsQuality, HealthMetrics, QualityScores, AIAnalysisInput, FileNode, AdvancedSignals, ReadmeLevelScores } from '@/types'
import { createAIProvider, AIProvider } from './ai'
import { computeReadmeLevelScores, classifyRepoPersonality, computeProjectCompleteness, computeOnboardingDifficulty, computeAbandonmentRisk, computeConfigComplexity, computeDocCoverage, computeContributorFriendliness, computeSecurityMaturity, computeDeploymentReadiness, computeLearningValue, computeReadmeCodeConsistency, computeTechDebtIndicators, computeMaintainabilityIndex } from '@/models/advancedSignals'
import { processReadme } from '@/models/readmeProcessor'

let aiProvider: AIProvider | null = null

function getAIProvider(): AIProvider {
  if (!aiProvider) {
    aiProvider = createAIProvider()
  }
  return aiProvider
}

function findInTree(nodes: FileNode[], predicate: (n: FileNode) => boolean): boolean {
  for (const n of nodes) {
    if (predicate(n)) return true
    if (n.children && findInTree(n.children, predicate)) return true
  }
  return false
}

function computeMaxDepth(nodes: FileNode[], depth = 0): number {
  let maxDepth = depth
  for (const node of nodes) {
    if (node.type === 'tree' && node.children) {
      maxDepth = Math.max(maxDepth, computeMaxDepth(node.children, depth + 1))
    }
  }
  return maxDepth
}

function computeComplexity(repo: RepoInfo): ComplexityMetrics {
  let totalLines = 0
  let fileCount = 0
  let testFileCount = 0
  let apiEndpointCount = 0
  let fixmeCount = 0
  let todoCount = 0
  const langCounts: Record<string, number> = {}
  const langLines: Record<string, number> = {}

  const walkAll = (nodes: typeof repo.fileTree) => {
    for (const node of nodes) {
      if (node.type === 'blob') {
        fileCount++
        if (node.name.match(/\.(test|spec)\.\w+$/) || node.name.match(/^test_.*\.\w+$/)) testFileCount++
        if (node.name.match(/\.(api|route|controller|endpoint)\.\w+$/i) || node.name.match(/^api\.\w+$/i)) apiEndpointCount++
      }
      if (node.children) walkAll(node.children)
    }
  }
  walkAll(repo.fileTree)

  const deepestNesting = computeMaxDepth(repo.fileTree)

  const totalBytes = Object.values(repo.languages).reduce((a, b) => a + b, 0)
  for (const [lang, bytes] of Object.entries(repo.languages)) {
    const percentage = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0
    const estLines = Math.round(bytes / 50)
    langCounts[lang] = Math.round(percentage * 10) / 10
    langLines[lang] = estLines
    totalLines += estLines
  }

  const languageBreakdown = Object.entries(repo.languages)
    .sort(([, a], [, b]) => b - a)
    .map(([language, bytes]) => ({
      language,
      files: Math.max(1, fileCount > 0 ? Math.round((bytes / Math.max(1, totalBytes)) * fileCount) : 1),
      lines: Math.round(bytes / 50),
    }))

  const averageFileSize = fileCount > 0 ? Math.round(totalLines / fileCount) : 0
  const langCount = Object.keys(repo.languages).length

  const docRepo = fileCount > 0 && langCount === 0 && repo.readmeContent.length > 200

  let fileCountScore: number
  if (fileCount === 0) {
    fileCountScore = docRepo ? 15 : 0
  } else if (docRepo) {
    fileCountScore = fileCount < 50 ? 20 : Math.max(10, Math.round(25 - Math.log2(fileCount / 50) * 5))
  } else if (fileCount < 20) {
    fileCountScore = 20
  } else {
    fileCountScore = Math.max(5, Math.round(25 - Math.log2(fileCount / 20) * 3))
  }

  const fileSizeScore = averageFileSize === 0
    ? (docRepo ? 15 : 0)
    : averageFileSize < 50 ? 20 : Math.max(5, Math.round(22 - Math.log2(averageFileSize / 50) * 4))

  const linesScore = totalLines === 0
    ? (docRepo ? 25 : 0)
    : totalLines < 3000 ? 30 : Math.max(10, Math.round(35 - Math.log2(totalLines / 3000) * 5))

  const langDiversityScore = langCount > 0
    ? Math.min(30, langCount * 6)
    : (docRepo ? 10 : 0)

  const overall = Math.min(100, Math.round(fileCountScore + fileSizeScore + linesScore + langDiversityScore))

  const testCoverageEstimate = fileCount > 0 ? Math.round(testFileCount / fileCount * 100) : 0

  return { overall, fileCount, totalLines, averageFileSize, deepestNesting, languageBreakdown, testFileCount, totalFileCount: fileCount, testCoverageEstimate, apiEndpointCount, techDebtScore: 0, fixmeCount, todoCount }
}

function computeDocsQuality(repo: RepoInfo): DocsQuality {
  const headingCount = repo.readmeContent ? (repo.readmeContent.match(/^## /gm) || []).length : 0
  const hasGoodStructure = headingCount >= 3

  const readmeScore = repo.readmeContent
    ? Math.min(100, Math.round(
        (repo.readmeContent.length > 500 ? 30 : repo.readmeContent.length > 100 ? 15 : 5) +
        (repo.readmeContent.includes('## ') ? 20 : 0) +
        (repo.readmeContent.toLowerCase().includes('install') ? 15 : 0) +
        (repo.readmeContent.toLowerCase().includes('usage') || repo.readmeContent.toLowerCase().includes('example') ? 15 : 0) +
        (repo.readmeContent.toLowerCase().includes('api') || repo.readmeContent.toLowerCase().includes('config') ? 10 : 0) +
        (repo.readmeContent.toLowerCase().includes('license') || repo.readmeContent.toLowerCase().includes('contributing') ? 10 : 0) +
        (hasGoodStructure && !repo.readmeContent.toLowerCase().includes('install') ? 10 : 0)
      ))
    : 0

  const fileNames = repo.fileTree.map(f => f.name.toLowerCase())

  const hasHeadingStructure = repo.readmeContent ? /^## /m.test(repo.readmeContent) : false

  const sectionCoverage = [
    { section: 'Description', present: repo.readmeContent.length > 50 },
    { section: 'Installation', present: repo.readmeContent.toLowerCase().includes('install') || (hasHeadingStructure && headingCount >= 2) },
    { section: 'Usage', present: repo.readmeContent.toLowerCase().includes('usage') || repo.readmeContent.toLowerCase().includes('example') || (hasHeadingStructure && headingCount >= 3) },
    { section: 'API Documentation', present: repo.readmeContent.toLowerCase().includes('api') || (hasHeadingStructure && headingCount >= 4) },
    { section: 'Configuration', present: repo.readmeContent.toLowerCase().includes('config') || (hasHeadingStructure && headingCount >= 5) },
    { section: 'Contributing', present: fileNames.includes('contributing.md') || repo.readmeContent.toLowerCase().includes('contributing') },
    { section: 'License', present: repo.readmeContent.toLowerCase().includes('license') || repo.license !== null },
    { section: 'Code of Conduct', present: fileNames.includes('code_of_conduct.md') },
    { section: 'Changelog', present: fileNames.includes('changelog.md') || fileNames.includes('changelog') },
    { section: 'Tests', present: repo.readmeContent.toLowerCase().includes('test') || repo.fileTree.some(f => f.name === 'tests' || f.name === '__tests__') },
  ]

  const suggestions: string[] = []
  if (!repo.readmeContent) suggestions.push('Add a README.md file')
  if (repo.readmeContent.length < 200) suggestions.push('Expand the README with more details')
  if (!sectionCoverage.find(s => s.section === 'Installation')?.present) suggestions.push('Add installation instructions')
  if (!sectionCoverage.find(s => s.section === 'Usage')?.present) suggestions.push('Add usage examples')
  if (!sectionCoverage.find(s => s.section === 'Contributing')?.present) suggestions.push('Add contributing guidelines')
  if (!sectionCoverage.find(s => s.section === 'License')?.present) suggestions.push('Add a license file')

  return {
    readmeScore,
    hasReadme: !!repo.readmeContent,
    readmeLength: repo.readmeContent.length,
    hasContributing: fileNames.includes('contributing.md'),
    hasCodeOfConduct: fileNames.includes('code_of_conduct.md'),
    hasLicense: repo.license !== null || fileNames.includes('license.md'),
    hasChangelog: fileNames.includes('changelog.md'),
    hasApiDocs: repo.readmeContent.toLowerCase().includes('api'),
    hasWiki: false,
    sectionCoverage,
    suggestions,
  }
}

function computeBusFactor(contributors: { login: string; contributions: number }[]): number {
  if (contributors.length === 0) return 1
  const sorted = [...contributors].sort((a, b) => b.contributions - a.contributions)
  const total = sorted.reduce((s, c) => s + c.contributions, 0)
  let cumulative = 0
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].contributions
    if (cumulative > total * 0.5) return Math.max(1, i + 1)
  }
  return contributors.length
}

function computeHealth(repo: RepoInfo): HealthMetrics {
  const lastCommitDays = repo.pushedAt
    ? Math.round((Date.now() - new Date(repo.pushedAt).getTime()) / 86400000)
    : 999

  const contributorCount = repo.contributors.length
  const busFactor = computeBusFactor(repo.contributors)
  const issuesPerStar = repo.stars > 0 ? repo.openIssues / repo.stars : repo.openIssues

  const isLocalOnly = repo.stars === 0 && repo.forks === 0 && contributorCount === 0

  const starScore = repo.stars === 0 ? 0 : Math.min(25, Math.round(Math.log2(Math.max(1, repo.stars)) * 2.2))
  const forkScore = repo.forks === 0 ? 0 : Math.min(15, Math.round(Math.log2(Math.max(1, repo.forks)) * 2))
  const activityScore = lastCommitDays < 30 ? 25 : lastCommitDays < 90 ? 20 : lastCommitDays < 365 ? 10 : lastCommitDays < 730 ? 5 : 0
  const contributorScore = Math.min(20, Math.round(Math.log2(Math.max(1, contributorCount)) * 4))
  const issueScore = issuesPerStar < 0.1 ? 15 : issuesPerStar < 0.5 ? 12 : issuesPerStar < 2 ? 8 : issuesPerStar < 10 ? 4 : 2

  const overall = isLocalOnly
    ? Math.min(30, Math.round(activityScore + issueScore))
    : Math.min(100, Math.round(starScore + activityScore + contributorScore + issueScore + forkScore))

  return {
    overall,
    stars: repo.stars,
    forks: repo.forks,
    openIssues: repo.openIssues,
    issuesPerStar,
    lastCommitDays,
    hasRecentActivity: lastCommitDays < 90,
    contributorCount,
    busFactor,
    releaseCount: 0,
    hasCI: findInTree(repo.fileTree, n => n.path.includes('.github/workflows') || n.path === '.github/workflows'),
    hasTests: findInTree(repo.fileTree, n =>
      n.type === 'tree' && ['tests', '__tests__', 'test', 'spec', '__test__'].includes(n.name) ||
      n.type === 'blob' && (!!n.name.match(/\.(test|spec)\.\w+$/) || !!n.name.match(/^test_.*\.\w+$/))
    ),
  }
}

export async function analyzeRepository(repo: RepoInfo): Promise<AnalysisReport> {
  // Outlier detection alerts
  const outlierAlerts: string[] = []
  if (repo.fileTree.length > 0) {
    let totalBlobs = 0
    const walk = (nodes: typeof repo.fileTree) => { for (const n of nodes) { if (n.type === 'blob') totalBlobs++; if (n.children) walk(n.children) } }
    walk(repo.fileTree)
    if (totalBlobs > 10000) outlierAlerts.push(`Extremely large repo: ${totalBlobs} files — complexity metrics may be less accurate`)
    if (totalBlobs === 0) outlierAlerts.push('No source files detected — repo may be empty or contain only non-code files')
  }
  if (repo.readmeContent.length > 50000) outlierAlerts.push('README exceeds 50KB — analysis prioritizes first 20KB')
  if (Object.keys(repo.languages).length > 12) outlierAlerts.push('Unusually high language diversity (>12 languages) — may indicate generated/vendor files')
  if (repo.stars > 50000 && !repo.fileTree.some(f => f.path.includes('.github/workflows'))) {
    outlierAlerts.push('High-profile repo (>50K stars) with no CI detected — CI check may have missed the workflow path')
  }

  // Chunking: truncate very long READMEs to prevent memory issues
  const maxReadmeChars = 20000
  const chunkedReadme = repo.readmeContent.length > maxReadmeChars
    ? repo.readmeContent.slice(0, maxReadmeChars) + '\n\n<!-- README TRUNCATED — analysis uses first 20KB -->'
    : repo.readmeContent

  // Tech debt estimation from README patterns
  const fixmeCountReadme = (repo.readmeContent.match(/\bFIXME\b/gi) || []).length
  const todoCountReadme = (repo.readmeContent.match(/\bTODO\b/gi) || []).length
  const techDebtScore = Math.min(100, Math.round(Math.log2(Math.max(1, fixmeCountReadme + todoCountReadme)) * 15))

  // Dependency analysis: extract version info from key files
  const depAnalysis: Record<string, string> = {}
  for (const [name, content] of Object.entries(repo.dependencyFiles)) {
    if (name === 'package.json') {
      try {
        const parsed = JSON.parse(content)
        const deps = { ...parsed.dependencies, ...parsed.devDependencies }
        const entries = Object.entries(deps as Record<string, string>).slice(0, 20)
        depAnalysis['npm'] = entries.map(([pkg, ver]) => `${pkg}@${ver.replace(/[\^~]/g, '')}`).join(', ')
      } catch {}
    } else if (name === 'Cargo.toml') {
      const lines = content.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('['))
      depAnalysis['cargo'] = lines.slice(0, 20).map(l => l.trim()).join(', ')
    } else if (name === 'requirements.txt') {
      depAnalysis['pip'] = content.split('\n').filter(l => l.includes('==') || l.includes('>=')).slice(0, 20).join(', ')
    }
  }

  const aiInput: AIAnalysisInput = {
    readme: chunkedReadme,
    languages: repo.languages,
    fileTree: repo.fileTree,
    dependencyFiles: repo.dependencyFiles,
    topics: repo.topics,
    description: repo.description,
    stars: repo.stars,
    forks: repo.forks,
    contributorCount: repo.contributors.length,
    pushedAt: repo.pushedAt,
  }

  const aiResult = await getAIProvider().analyze(aiInput)
  const complexity = computeComplexity(repo)
  complexity.techDebtScore = techDebtScore
  complexity.fixmeCount = fixmeCountReadme
  complexity.todoCount = todoCountReadme
  const docsQuality = computeDocsQuality(repo)
  const health = computeHealth(repo)

  const readmeLevels = computeReadmeLevelScores(repo.readmeContent, repo, docsQuality)
  docsQuality.readmeLevels = readmeLevels

  const depKeys = Object.keys(repo.dependencyFiles)
  const fileNames = repo.fileTree.map(f => f.name.toLowerCase())
  const totalBlobs = complexity.fileCount
  const langCount = Object.keys(repo.languages).length
  const docRepo = langCount === 0 && totalBlobs > 0 && repo.readmeContent.length > 200

  const advancedSignals: AdvancedSignals = {
    personality: classifyRepoPersonality(repo, totalBlobs > 5, totalBlobs, langCount, docRepo),
    completeness: computeProjectCompleteness(!!repo.readmeContent, health.hasTests, !!repo.license, health.hasCI, totalBlobs, depKeys),
    onboardingDifficulty: computeOnboardingDifficulty(docsQuality, totalBlobs, depKeys, complexity.deepestNesting, health.hasTests, health.hasCI),
    abandonmentRisk: computeAbandonmentRisk(health.lastCommitDays, health.hasRecentActivity, health.contributorCount, health.stars, health.overall),
    configComplexity: computeConfigComplexity(depKeys),
    docCoverage: computeDocCoverage(repo),
    contributorFriendliness: computeContributorFriendliness(repo.readmeContent.toLowerCase(), fileNames, repo.fileTree.some(f => f.path.includes('issue_template') || f.path.includes('.github/ISSUE_TEMPLATE')), repo.fileTree.some(f => f.path.includes('pull_request_template') || f.path.includes('.github/PULL_REQUEST_TEMPLATE'))),
    securityMaturity: computeSecurityMaturity(repo, repo.readmeContent.toLowerCase(), health.hasCI),
    deploymentReadiness: computeDeploymentReadiness(depKeys, health.hasCI, health.hasTests, repo.readmeContent.toLowerCase()),
    learningValue: computeLearningValue(repo.readmeContent, (repo.readmeContent.match(/^## /gm) ?? []).length, totalBlobs, docRepo),
    readmeCodeConsistency: computeReadmeCodeConsistency(repo.readmeContent.toLowerCase(), depKeys, aiResult.techStack),
    techDebtIndicators: computeTechDebtIndicators(repo),
    maintainabilityIndex: computeMaintainabilityIndex(complexity.deepestNesting, totalBlobs, complexity.averageFileSize, health.hasTests, health.hasCI, !!repo.readmeContent),
  }

  const personalityWeights: Record<string, { rw: number; cw: number }> = {
    'Documentation Repository': { rw: 0.70, cw: 0.30 },
    'Educational Resource': { rw: 0.70, cw: 0.30 },
    'Research Project': { rw: 0.50, cw: 0.50 },
    'Library': { rw: 0.35, cw: 0.65 },
    'Open Source Framework': { rw: 0.35, cw: 0.65 },
    'Dataset Repository': { rw: 0.60, cw: 0.40 },
  }
  const w = personalityWeights[advancedSignals.personality] ?? { rw: 0.25, cw: 0.75 }

  const codeComposite = Math.round(
    aiResult.qualityScores.codeQuality * 0.35 +
    complexity.overall * 0.25 +
    health.overall * 0.20 +
    aiResult.qualityScores.maintainability * 0.20
  )
  const correctedOverall = Math.round(
    docsQuality.readmeScore * w.rw +
    codeComposite * w.cw
  )

  const overallQualityScore = correctedOverall

  const qualityScores: QualityScores = {
    overall: overallQualityScore,
    codeQuality: aiResult.qualityScores.codeQuality,
    documentation: aiResult.qualityScores.documentation,
    maintainability: aiResult.qualityScores.maintainability,
    communityHealth: aiResult.qualityScores.communityHealth,
    security: aiResult.qualityScores.security,
    breakdown: {
      'Code Quality': { score: aiResult.qualityScores.codeQuality, reason: `Based on lang diversity (${Object.keys(repo.languages).length} langs), ${complexity.fileCount} files, ${complexity.averageFileSize} avg lines/file` },
      'Documentation': { score: aiResult.qualityScores.documentation, reason: `README score ${docsQuality.readmeScore}/100, ${docsQuality.sectionCoverage.filter(s => s.present).length}/10 sections covered` },
      'Maintainability': { score: aiResult.qualityScores.maintainability, reason: `${complexity.languageBreakdown.length} languages, ${complexity.fileCount} files, ${complexity.deepestNesting} dir depth` },
      'Community': { score: aiResult.qualityScores.communityHealth, reason: `${health.stars} stars, ${health.forks} forks, ${health.contributorCount} contributors` },
      'Security': { score: aiResult.qualityScores.security, reason: `Lockfile: ${!!repo.dependencyFiles['package-lock.json'] || !!repo.dependencyFiles['Cargo.lock']}, CI: ${health.hasCI}, Tests: ${health.hasTests}` },
      'Tech Debt': { score: 100 - techDebtScore, reason: `${fixmeCountReadme} FIXMEs, ${todoCountReadme} TODOs in README` },
    },
  }

  const processedReadme = processReadme(repo.readmeContent, repo.description)

  return {
    id: `${repo.owner}/${repo.name}`,
    repoUrl: repo.url,
    repoName: repo.name,
    owner: repo.owner,
    topics: repo.topics,
    summary: aiResult.summary,
    processedReadme,
    techStack: aiResult.techStack,
    architecture: aiResult.architecture,
    complexity,
    docsQuality,
    health,
    codeSmells: aiResult.codeSmells,
    suggestions: aiResult.suggestions,
    onboardingGuide: aiResult.onboardingGuide,
    qualityScores,
    fileTree: repo.fileTree,
    generatedAt: new Date().toISOString(),
    status: 'completed',
    analysisSource: repo.stars === 0 && repo.forks === 0 && repo.contributors.length === 0 && !repo.pushedAt
      ? 'local-clone'
      : 'github-api',
    outlierAlerts: outlierAlerts.length > 0 ? outlierAlerts : undefined,
    advancedSignals,
  }
}
