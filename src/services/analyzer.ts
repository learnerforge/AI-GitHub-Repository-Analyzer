import { RepoInfo, AnalysisReport, ComplexityMetrics, DocsQuality, HealthMetrics, QualityScores, AIAnalysisInput } from '@/types'
import { createAIProvider, AIProvider } from './ai'

let aiProvider: AIProvider | null = null

function getAIProvider(): AIProvider {
  if (!aiProvider) {
    aiProvider = createAIProvider()
  }
  return aiProvider
}

export function setAIProvider(provider: AIProvider): void {
  aiProvider = provider
}

function computeComplexity(repo: RepoInfo): ComplexityMetrics {
  let totalLines = 0
  let fileCount = 0
  const langCounts: Record<string, number> = {}
  const langLines: Record<string, number> = {}

  function countFiles(nodes: typeof repo.fileTree, depth = 0) {
    for (const node of nodes) {
      if (node.type === 'blob') {
        fileCount++
      }
      if (node.children) {
        countFiles(node.children, depth + 1)
      }
    }
  }
  countFiles(repo.fileTree)

  const totalBytes = Object.values(repo.languages).reduce((a, b) => a + b, 0) || 1
  for (const [lang, bytes] of Object.entries(repo.languages)) {
    const percentage = (bytes / totalBytes) * 100
    const estLines = Math.round(bytes / 50)
    langCounts[lang] = Math.round(percentage * 10) / 10
    langLines[lang] = estLines
    totalLines += estLines
  }

  const languageBreakdown = Object.entries(repo.languages)
    .sort(([, a], [, b]) => b - a)
    .map(([language, bytes]) => ({
      language,
      files: Math.max(1, Math.round((bytes / totalBytes) * fileCount)),
      lines: Math.round(bytes / 50),
    }))

  const averageFileSize = fileCount > 0 ? Math.round(totalLines / fileCount) : 0
  const overall = Math.min(100, Math.round(
    (repo.languages && Object.keys(repo.languages).length > 0 ? 30 : 0) +
    (fileCount < 50 ? 20 : fileCount < 200 ? 10 : 5) +
    (averageFileSize < 100 ? 20 : averageFileSize < 300 ? 10 : 5) +
    (totalLines < 10000 ? 30 : totalLines < 50000 ? 20 : 10)
  ))

  return { overall, fileCount, totalLines, averageFileSize, deepestNesting: 0, languageBreakdown }
}

function computeDocsQuality(repo: RepoInfo): DocsQuality {
  const readmeScore = repo.readmeContent
    ? Math.min(100, Math.round(
        (repo.readmeContent.length > 500 ? 30 : repo.readmeContent.length > 100 ? 15 : 5) +
        (repo.readmeContent.includes('## ') ? 20 : 0) +
        (repo.readmeContent.toLowerCase().includes('install') ? 15 : 0) +
        (repo.readmeContent.toLowerCase().includes('usage') || repo.readmeContent.toLowerCase().includes('example') ? 15 : 0) +
        (repo.readmeContent.toLowerCase().includes('api') || repo.readmeContent.toLowerCase().includes('config') ? 10 : 0) +
        (repo.readmeContent.toLowerCase().includes('license') || repo.readmeContent.toLowerCase().includes('contributing') ? 10 : 0)
      ))
    : 0

  const fileNames = repo.fileTree.map(f => f.name.toLowerCase())

  const sectionCoverage = [
    { section: 'Description', present: repo.readmeContent.length > 50 },
    { section: 'Installation', present: repo.readmeContent.toLowerCase().includes('install') },
    { section: 'Usage', present: repo.readmeContent.toLowerCase().includes('usage') || repo.readmeContent.toLowerCase().includes('example') },
    { section: 'API Documentation', present: repo.readmeContent.toLowerCase().includes('api') },
    { section: 'Configuration', present: repo.readmeContent.toLowerCase().includes('config') },
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

function computeHealth(repo: RepoInfo): HealthMetrics {
  const lastCommitDays = repo.pushedAt
    ? Math.round((Date.now() - new Date(repo.pushedAt).getTime()) / 86400000)
    : 999

  const contributorCount = repo.contributors.length
  const busFactor = Math.min(contributorCount, 20)
  const issuesPerStar = repo.stars > 0 ? repo.openIssues / repo.stars : repo.openIssues

  const overall = Math.min(100, Math.round(
    (repo.stars > 100 ? 25 : repo.stars > 10 ? 15 : repo.stars > 0 ? 5 : 0) +
    (lastCommitDays < 30 ? 25 : lastCommitDays < 90 ? 15 : lastCommitDays < 365 ? 5 : 0) +
    (contributorCount > 10 ? 20 : contributorCount > 3 ? 10 : 5) +
    (issuesPerStar < 0.5 ? 15 : issuesPerStar < 2 ? 10 : 5) +
    (repo.forks > 10 ? 15 : repo.forks > 0 ? 10 : 0)
  ))

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
    hasCI: repo.fileTree.some(f => f.path.includes('.github/workflows')),
    hasTests: repo.fileTree.some(f =>
      f.name === 'tests' || f.name === '__tests__' || f.name === 'test' || f.name.endsWith('.test.ts') || f.name.endsWith('.spec.ts')
    ),
  }
}

export async function analyzeRepository(repo: RepoInfo): Promise<AnalysisReport> {
  const aiInput: AIAnalysisInput = {
    readme: repo.readmeContent,
    languages: repo.languages,
    fileTree: repo.fileTree,
    dependencyFiles: repo.dependencyFiles,
    topics: repo.topics,
    description: repo.description,
  }

  const aiResult = await getAIProvider().analyze(aiInput)
  const complexity = computeComplexity(repo)
  const docsQuality = computeDocsQuality(repo)
  const health = computeHealth(repo)

  const overallQualityScore = Math.round(
    (aiResult.qualityScores.overall * 0.4) +
    (docsQuality.readmeScore * 0.15) +
    (health.overall * 0.2) +
    (complexity.overall * 0.15) +
    (aiResult.qualityScores.security * 0.1)
  )

  const qualityScores: QualityScores = {
    overall: overallQualityScore,
    codeQuality: aiResult.qualityScores.codeQuality,
    documentation: aiResult.qualityScores.documentation,
    maintainability: aiResult.qualityScores.maintainability,
    communityHealth: aiResult.qualityScores.communityHealth,
    security: aiResult.qualityScores.security,
  }

  return {
    id: `${repo.owner}/${repo.name}`,
    repoUrl: repo.url,
    repoName: repo.name,
    owner: repo.owner,
    summary: aiResult.summary,
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
  }
}
