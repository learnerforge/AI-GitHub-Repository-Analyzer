import { FileNode, RepoPersonality, OnboardingLevel, RiskLevel, MaturityLevel, ProjectCompleteness, ReadmeLevelScores, RepoInfo, DocsQuality } from '@/types'

export function computeReadmeLevelScores(readme: string, repo: RepoInfo, docs: DocsQuality): ReadmeLevelScores {
  if (!readme) {
    return { existence: 0, projectIdentity: 0, problemStatement: 0, features: 0, installation: 0, usage: 0, examples: 0, architecture: 0, techStack: 0, configuration: 0, apiDocs: 0, screenshots: 0, contributing: 0, testing: 0, deployment: 0, license: 0, maintenance: 0, community: 0, readability: 0, advancedSignals: 0, total: 0 }
  }

  const lower = readme.toLowerCase()
  const lines = readme.split('\n')
  const words = readme.split(/\s+/).length
  const headingCount = readme.match(/^## /gm)?.length ?? 0

  const l1 = computeLevel1Existence(readme, words)
  const l2 = computeLevel2Identity(readme, lower, repo)
  const l3 = computeLevel3Problem(lower)
  const l4 = computeLevel4Features(lower)
  const l5 = computeLevel5Installation(lower, repo)
  const l6 = computeLevel6Usage(lower)
  const l7 = computeLevel7Examples(lower)
  const l8 = computeLevel8Architecture(lower, repo)
  const l9 = computeLevel9TechStack(lower)
  const l10 = computeLevel10Configuration(lower, repo)
  const l11 = computeLevel11ApiDocs(lower)
  const l12 = computeLevel12Screenshots(readme)
  const l13 = computeLevel13Contributing(lower, repo)
  const l14 = computeLevel14Testing(lower, repo)
  const l15 = computeLevel15Deployment(lower, repo)
  const l16 = computeLevel16License(lower, repo)
  const l17 = computeLevel17Maintenance(lower)
  const l18 = computeLevel18Community(lower)
  const l19 = computeLevel19Readability(readme, lines, headingCount)
  const l20 = computeLevel20AdvancedSignals(readme)

  const total = Math.min(100, Math.round(
    l1 * 0.10 + l2 * 0.10 + l3 * 0.05 + l4 * 0.10 + l5 * 0.10 +
    l6 * 0.08 + l7 * 0.08 + l8 * 0.08 + l9 * 0.05 + l10 * 0.05 +
    l11 * 0.05 + l12 * 0.03 + l13 * 0.03 + l14 * 0.03 + l15 * 0.03 +
    l16 * 0.02 + l17 * 0.02 + l18 * 0.02 + l19 * 0.05 + l20 * 0.03
  ))

  return { existence: l1, projectIdentity: l2, problemStatement: l3, features: l4, installation: l5, usage: l6, examples: l7, architecture: l8, techStack: l9, configuration: l10, apiDocs: l11, screenshots: l12, contributing: l13, testing: l14, deployment: l15, license: l16, maintenance: l17, community: l18, readability: l19, advancedSignals: l20, total }
}

function computeLevel1Existence(readme: string, words: number): number {
  if (words < 20) return 10
  if (words < 100) return 40
  if (words < 500) return 70
  return 100
}

function computeLevel2Identity(readme: string, lower: string, repo: RepoInfo): number {
  let score = 0
  const firstLine = readme.split('\n')[0]?.trim() ?? ''
  if (firstLine.startsWith('#') && firstLine.length > 3) score += 30
  const desc = repo.description?.trim()
  if (desc && desc.length > 10) score += 25
  if (lower.includes('## ') && (readme.match(/^## /gm) ?? []).length >= 2) score += 20
  const purposeWords = ['what is', 'about', 'introduction', 'overview', 'what this']
  if (purposeWords.some(w => lower.includes(w))) score += 25
  return Math.min(100, score)
}

function computeLevel3Problem(lower: string): number {
  let score = 0
  const problemWords = ['why', 'problem', 'use case', 'target', 'audience', 'who this', 'built for', 'motivation', 'goal', 'objective']
  if (problemWords.some(w => lower.includes(w))) score += 50
  const sections = readmeSectionContent(lower, ['why', 'problem', 'motivation', 'use case'])
  if (sections && sections.length > 50) score += 50
  return Math.min(100, score)
}

function computeLevel4Features(lower: string): number {
  let score = 0
  if (lower.includes('feature') || lower.includes('capabilities') || lower.includes('what you can')) score += 30
  const featureSection = readmeSectionContent(lower, ['features', 'capabilities', 'what you can do'])
  if (featureSection) {
    const bullets = (featureSection.match(/^[-*+]\s/gm) ?? []).length
    score += Math.min(70, bullets * 15)
  }
  return Math.min(100, score)
}

function computeLevel5Installation(lower: string, repo: RepoInfo): number {
  let score = 0
  if (lower.includes('install') || lower.includes('setup') || lower.includes('getting started')) score += 25
  const installSection = readmeSectionContent(lower, ['installation', 'setup', 'getting started', 'quick start'])
  if (installSection) {
    const codeBlocks = (installSection.match(/```/g) ?? []).length / 2
    score += Math.min(40, codeBlocks * 15)
  }
  if (lower.includes('clone') || lower.includes('download')) score += 10
  if (lower.includes('npm install') || lower.includes('pip install') || lower.includes('cargo build') || lower.includes('go get') || lower.includes('brew')) score += 15
  const hasEnvExample = Object.keys(repo.dependencyFiles).some(f => f.includes('.env.example') || f.includes('.env.sample'))
  if (hasEnvExample) score += 10
  const depNames = Object.keys(repo.dependencyFiles)
  if (depNames.some(f => f.includes('docker-compose'))) score += 10
  return Math.min(100, score)
}

function computeLevel6Usage(lower: string): number {
  let score = 0
  if (lower.includes('usage') || lower.includes('how to use') || lower.includes('quick start')) score += 30
  const usageSection = readmeSectionContent(lower, ['usage', 'how to use', 'examples', 'quick start'])
  if (usageSection) {
    const codeBlocks = (usageSection.match(/```/g) ?? []).length / 2
    score += Math.min(40, codeBlocks * 10)
  }
  if (lower.includes('example') && (lower.match(/example/g) ?? []).length >= 2) score += 30
  return Math.min(100, score)
}

function computeLevel7Examples(lower: string): number {
  let score = 0
  if (lower.includes('example') || lower.includes('demo')) score += 20
  if ((lower.match(/```/g) ?? []).length >= 4) score += 30
  const exampleSection = readmeSectionContent(lower, ['examples', 'demo', 'sample', 'usage examples'])
  if (exampleSection) {
    const codeBlocks = (exampleSection.match(/```/g) ?? []).length / 2
    score += Math.min(50, codeBlocks * 12)
  }
  return Math.min(100, score)
}

function computeLevel8Architecture(lower: string, repo: RepoInfo): number {
  let score = 0
  if (lower.includes('architecture') || lower.includes('structure') || lower.includes('overview')) score += 25
  if (lower.includes('data flow') || lower.includes('flow') || lower.includes('pipeline')) score += 15
  const archSection = readmeSectionContent(lower, ['architecture', 'structure', 'project structure', 'overview'])
  if (archSection && archSection.length > 100) score += 20
  const dirDepths = countDirDepths(repo.fileTree)
  const maxDepth = Math.max(...dirDepths, 0)
  if (maxDepth >= 2) score += 20
  if (lower.match(/```(mermaid|ascii|graph)/)) score += 20
  return Math.min(100, score)
}

function computeLevel9TechStack(lower: string): number {
  let score = 0
  if (lower.includes('built with') || lower.includes('tech stack') || lower.includes('technologies') || lower.includes('powered by')) score += 30
  const stackSection = readmeSectionContent(lower, ['built with', 'tech stack', 'technologies', 'powered by', 'stack'])
  if (stackSection) {
    const bullets = (stackSection.match(/^[-*+]\s/gm) ?? []).length
    score += Math.min(40, bullets * 10)
  }
  const langKeywords = ['react', 'node', 'python', 'go', 'rust', 'typescript', 'javascript', 'docker', 'postgres', 'redis', 'kubernetes']
  const found = langKeywords.filter(k => lower.includes(k)).length
  score += Math.min(30, found * 5)
  return Math.min(100, score)
}

function computeLevel10Configuration(lower: string, repo: RepoInfo): number {
  let score = 0
  if (lower.includes('config') || lower.includes('environment') || lower.includes('.env') || lower.includes('settings')) score += 25
  const configSection = readmeSectionContent(lower, ['configuration', 'environment', 'setup', 'env'])
  if (configSection) {
    const codeBlocks = (configSection.match(/```/g) ?? []).length / 2
    score += Math.min(35, codeBlocks * 10)
  }
  const depFiles = Object.keys(repo.dependencyFiles)
  if (depFiles.some(f => f.includes('.env.example') || f.includes('.env.sample') || f.includes('config'))) score += 25
  if (depFiles.some(f => f.includes('docker-compose'))) score += 15
  return Math.min(100, score)
}

function computeLevel11ApiDocs(lower: string): number {
  let score = 0
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) score += 20
  const apiSection = readmeSectionContent(lower, ['api', 'api reference', 'api documentation', 'endpoints', 'routes'])
  if (apiSection) {
    const codeBlocks = (apiSection.match(/```/g) ?? []).length / 2
    score += Math.min(50, codeBlocks * 12)
    if (apiSection.length > 200) score += 30
  }
  return Math.min(100, score)
}

function computeLevel12Screenshots(readme: string): number {
  if (!readme) return 0
  let score = 0
  const imgMarkdown = readme.match(/!\[.*?\]\(.*?\)/g) ?? []
  const imgHtml = readme.match(/<img[^>]+>/gi) ?? []
  const totalImages = imgMarkdown.length + imgHtml.length
  if (totalImages >= 3) score = 100
  else if (totalImages === 2) score = 70
  else if (totalImages === 1) score = 40
  if (readme.includes('.gif') || readme.includes('demo')) score = Math.max(score, 50)
  return score
}

function computeLevel13Contributing(lower: string, repo: RepoInfo): number {
  let score = 0
  if (lower.includes('contributing') || lower.includes('contribute') || lower.includes('how to contribute')) score += 30
  const contribSection = readmeSectionContent(lower, ['contributing', 'contribute', 'how to contribute'])
  if (contribSection && contribSection.length > 100) score += 20
  if (lower.includes('pull request') || lower.includes('pr')) score += 15
  if (lower.includes('code of conduct')) score += 15
  const fileNames = repo.fileTree.map(f => f.name.toLowerCase())
  if (fileNames.includes('contributing.md') || fileNames.includes('contributing')) score += 20
  return Math.min(100, score)
}

function computeLevel14Testing(lower: string, repo: RepoInfo): number {
  let score = 0
  if (lower.includes('test') || lower.includes('testing') || lower.includes('coverage')) score += 25
  const testSection = readmeSectionContent(lower, ['testing', 'tests', 'running tests'])
  if (testSection) {
    const codeBlocks = (testSection.match(/```/g) ?? []).length / 2
    score += Math.min(35, codeBlocks * 10)
  }
  const fileNames = repo.fileTree.map(f => f.name.toLowerCase())
  if (fileNames.some(f => f.includes('jest') || f.includes('.test.') || f.includes('.spec.'))) score += 20
  if (lower.includes('ci') || lower.includes('github actions') || lower.includes('travis')) score += 20
  return Math.min(100, score)
}

function computeLevel15Deployment(lower: string, repo: RepoInfo): number {
  let score = 0
  if (lower.includes('deploy') || lower.includes('deployment') || lower.includes('hosting') || lower.includes('production')) score += 25
  const deploySection = readmeSectionContent(lower, ['deployment', 'deploy', 'hosting', 'production'])
  if (deploySection) {
    const codeBlocks = (deploySection.match(/```/g) ?? []).length / 2
    score += Math.min(35, codeBlocks * 10)
  }
  const depFiles = Object.keys(repo.dependencyFiles)
  if (depFiles.some(f => f.includes('Dockerfile'))) score += 20
  if (depFiles.some(f => f.includes('docker-compose'))) score += 20
  return Math.min(100, score)
}

function computeLevel16License(lower: string, repo: RepoInfo): number {
  if (repo.license) return 100
  if (lower.includes('mit') || lower.includes('apache') || lower.includes('gpl') || lower.includes('bsd')) return 80
  if (lower.includes('license')) return 40
  return 0
}

function computeLevel17Maintenance(lower: string): number {
  let score = 0
  if (lower.includes('roadmap') || lower.includes('future') || lower.includes('planned')) score += 30
  if (lower.includes('changelog') || lower.includes('what\'s new') || lower.includes('release notes')) score += 25
  if (lower.includes('status') || lower.includes('stable') || lower.includes('active')) score += 25
  if (lower.includes('todo') || lower.includes('coming soon')) score += 20
  return Math.min(100, score)
}

function computeLevel18Community(lower: string): number {
  let score = 0
  if (lower.includes('discord') || lower.includes('slack') || lower.includes('chat')) score += 25
  if (lower.includes('discussion') || lower.includes('forum') || lower.includes('community')) score += 20
  if (lower.includes('contact') || lower.includes('support') || lower.includes('help')) score += 20
  if (lower.includes('twitter') || lower.includes('@') || lower.includes('email')) score += 15
  if (lower.includes('stack overflow') || lower.includes('github discussions')) score += 20
  return Math.min(100, score)
}

function computeLevel19Readability(readme: string, lines: string[], headingCount: number): number {
  let score = 30
  if (headingCount >= 3) score += 15
  if (headingCount >= 6) score += 10
  if (headingCount >= 10) score += 5
  const codeBlocks = (readme.match(/```/g) ?? []).length / 2
  if (codeBlocks >= 2) score += 10
  if (codeBlocks >= 5) score += 10
  if (readme.includes('- [') || readme.includes('* [')) score += 5
  if (readme.includes('|') && readme.includes('---')) score += 5
  const hasToc = readme.includes('## Table of Contents') || readme.includes('## Contents') || readme.includes('<!-- TOC') || readme.match(/\[.*\]\(#.*\)/)
  if (hasToc) score += 10
  return Math.min(100, score)
}

function computeLevel20AdvancedSignals(readme: string): number {
  let score = 0
  const badges = readme.match(/!\[.*?\]\(https:\/\/img\.shields\.io/g) ?? []
  score += Math.min(40, badges.length * 10)
  if (readme.includes('build status') || readme.includes('build passing')) score += 10
  if (readme.includes('coverage') || readme.includes('codecov')) score += 10
  if (readme.includes('security') || readme.includes('dependabot') || readme.includes('security policy')) score += 10
  if (readme.includes('benchmark') || readme.includes('performance')) score += 10
  if (readme.includes('faq') || readme.includes('troubleshooting') || readme.includes('common issues')) score += 10
  if (readme.includes('migration') || readme.includes('upgrading') || readme.includes('breaking changes')) score += 10
  return Math.min(100, score)
}

function readmeSectionContent(lower: string, sectionNames: string[]): string | null {
  const lines = lower.split('\n')
  let inSection = false
  const content: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('## ') && sectionNames.some(s => line.includes(s))) {
      inSection = true
      continue
    }
    if (inSection) {
      if (line.startsWith('## ')) break
      content.push(line)
    }
  }
  return content.length > 0 ? content.join('\n').trim() : null
}

function countDirDepths(tree: FileNode[], depth = 0): number[] {
  const depths: number[] = []
  for (const node of tree) {
    if (node.type === 'tree') {
      depths.push(depth + 1)
      if (node.children) depths.push(...countDirDepths(node.children, depth + 1))
    }
  }
  return depths
}

export function classifyRepoPersonality(
  repo: RepoInfo,
  hasSourceCode: boolean,
  totalFiles: number,
  langCount: number,
  isDocRepo: boolean
): RepoPersonality {
  const topics = repo.topics.map(t => t.toLowerCase())
  const readmeLower = repo.readmeContent?.toLowerCase() ?? ''
  const depKeys = Object.keys(repo.dependencyFiles)

  if (isDocRepo || topics.some(t => ['education', 'learning', 'books', 'documentation', 'tutorial', 'awesome-list', 'curated'].includes(t))) {
    const titleLine = repo.readmeContent?.split('\n')[0] ?? ''
    if (titleLine.toLowerCase().includes('book') || titleLine.toLowerCase().includes('list') || titleLine.toLowerCase().includes('awesome') || topics.includes('awesome-list')) {
      return 'Documentation Repository'
    }
    if (topics.some(t => ['education', 'learning', 'study', 'tutorial'].includes(t)) || readmeLower.includes('learn') || readmeLower.includes('study')) {
      return 'Educational Resource'
    }
    return 'Documentation Repository'
  }

  if (topics.some(t => ['dataset', 'data', 'csv', 'json-dataset'].includes(t)) || (langCount <= 2 && totalFiles > 50 && depKeys.length === 0)) {
    return 'Dataset Repository'
  }

  if (topics.some(t => ['framework', 'library', 'sdk', 'api', 'package'].includes(t)) || depKeys.some(f => f.includes('package.json') || f.includes('setup.py') || f.includes('Cargo.toml'))) {
    if (totalFiles < 100) return 'Library'
    return 'Open Source Framework'
  }

  if (topics.some(t => ['cli', 'command-line', 'terminal'].includes(t)) || (depKeys.some(f => f.includes('package.json')) && !readmeLower.includes('ui') && !readmeLower.includes('component'))) {
    return 'CLI Tool'
  }

  if (topics.some(t => ['research', 'paper', 'academic', 'science'].includes(t)) || readmeLower.includes('research') || readmeLower.includes('paper')) {
    return 'Research Project'
  }

  if (repo.stars > 1000 && totalFiles > 100 && langCount >= 3) {
    return 'Enterprise Application'
  }

  if (topics.some(t => ['hackathon', 'demo', 'mvp', 'prototype'].includes(t)) || (repo.stars < 100 && totalFiles < 50 && langCount <= 3)) {
    return 'Startup MVP'
  }

  if (readmeLower.includes('portfolio') || (repo.stars === 0 && totalFiles < 30)) {
    return 'Portfolio'
  }

  if (totalFiles > 200 && langCount >= 3) {
    return 'Open Source Framework'
  }

  return 'Learning Project'
}

export function computeProjectCompleteness(
  hasReadme: boolean,
  hasTests: boolean,
  hasLicense: boolean,
  hasCI: boolean,
  totalFiles: number,
  depKeys: string[]
): ProjectCompleteness {
  const hasSourceCode = totalFiles > 5
  const hasConfig = depKeys.length > 0 || hasCI
  const hasDeployment = depKeys.some(f => f.includes('Dockerfile') || f.includes('docker-compose') || f.includes('.github/workflows'))

  let count = 0
  const checks = [hasReadme, hasSourceCode, hasConfig, hasTests, hasLicense, hasDeployment]
  for (const c of checks) if (c) count++

  return {
    hasReadme,
    hasSourceCode,
    hasConfig,
    hasTests,
    hasLicense,
    hasDeployment,
    percentage: Math.round((count / 6) * 100),
  }
}

export function computeOnboardingDifficulty(
  docs: DocsQuality,
  totalFiles: number,
  depKeys: string[],
  maxDepth: number,
  hasTests: boolean,
  hasCI: boolean
): OnboardingLevel {
  let difficulty = 0

  if (!docs.hasReadme || docs.readmeScore < 30) difficulty += 3
  else if (docs.readmeScore < 60) difficulty += 2
  else difficulty += 1

  if (!docs.sectionCoverage.find(s => s.section === 'Installation')?.present) difficulty += 2
  if (!docs.sectionCoverage.find(s => s.section === 'Usage')?.present) difficulty += 2

  if (depKeys.length === 0 && !hasCI) difficulty += 2
  if (depKeys.length > 5) difficulty += 1

  if (totalFiles > 1000) difficulty += 2
  else if (totalFiles > 200) difficulty += 1

  if (maxDepth > 6) difficulty += 1
  if (!hasTests) difficulty += 1

  if (difficulty <= 2) return 'Easy'
  if (difficulty <= 4) return 'Medium'
  if (difficulty <= 6) return 'Hard'
  return 'Very Hard'
}

export function computeAbandonmentRisk(
  lastCommitDays: number,
  hasRecentActivity: boolean,
  contributorCount: number,
  stars: number,
  healthScore: number
): RiskLevel {
  if (lastCommitDays > 730) return 'Archived'
  if (!hasRecentActivity && contributorCount <= 1) return 'High Risk'
  if (!hasRecentActivity) return 'Medium Risk'
  if (lastCommitDays > 180) return 'Medium Risk'
  if (contributorCount <= 1 && stars > 100) return 'Medium Risk'
  return 'Low Risk'
}

export function computeConfigComplexity(depKeys: string[]): { count: number; level: OnboardingLevel } {
  const configFiles = depKeys.filter(f =>
    f.includes('.env') || f.includes('config') || f.includes('.yml') || f.includes('.yaml') || f.includes('.json') || f.includes('.toml') || f.includes('docker-compose') || f.includes('Dockerfile') || f.includes('Makefile')
  )
  const count = configFiles.length
  let level: OnboardingLevel
  if (count <= 3) level = 'Easy'
  else if (count <= 8) level = 'Medium'
  else if (count <= 15) level = 'Hard'
  else level = 'Very Hard'
  return { count, level }
}

export function computeDocCoverage(repo: RepoInfo): { percentage: number; level: string } {
  const elements = [
    !!repo.readmeContent,
    Object.keys(repo.dependencyFiles).some(f => f.toLowerCase().includes('contributing') || f.toLowerCase().includes('contributing.md')),
    repo.fileTree.some(f => f.name.toLowerCase() === 'code_of_conduct.md'),
    repo.fileTree.some(f => f.name.toLowerCase() === 'changelog.md' || f.name.toLowerCase() === 'changelog'),
    repo.fileTree.some(f => f.name.toLowerCase() === 'security.md'),
    repo.fileTree.some(f => f.name === 'LICENSE' || f.name === 'LICENSE.md' || f.name === 'LICENSE.txt'),
    repo.fileTree.some(f => f.type === 'tree' && (f.name === 'docs' || f.name === 'documentation' || f.name === 'wiki')),
    repo.fileTree.some(f => f.type === 'tree' && (f.name === 'examples' || f.name === 'samples')),
    repo.fileTree.some(f => f.type === 'tree' && f.name === 'tutorials'),
  ]
  const count = elements.filter(Boolean).length
  const max = elements.length
  const percentage = Math.round((count / max) * 100)
  let level: string
  if (percentage >= 75) level = 'Comprehensive'
  else if (percentage >= 50) level = 'Good'
  else if (percentage >= 25) level = 'Minimal'
  else level = 'Poor'
  return { percentage, level }
}

export function computeContributorFriendliness(
  readmeLower: string,
  fileNames: string[],
  hasIssueTemplates: boolean,
  hasPRTemplates: boolean
): OnboardingLevel {
  let score = 0
  if (fileNames.includes('contributing.md') || readmeLower.includes('contributing')) score += 2
  if (readmeLower.includes('pull request') || readmeLower.includes('pr')) score += 1
  if (readmeLower.includes('code of conduct')) score += 1
  if (hasIssueTemplates) score += 1
  if (hasPRTemplates) score += 1
  if (readmeLower.includes('good first issue') || readmeLower.includes('help wanted')) score += 1
  if (readmeLower.includes('development') || readmeLower.includes('local setup') || readmeLower.includes('getting started')) score += 1
  if (score >= 6) return 'Easy'
  if (score >= 4) return 'Medium'
  if (score >= 2) return 'Hard'
  return 'Very Hard'
}

export function computeSecurityMaturity(
  repo: RepoInfo,
  readmeLower: string,
  hasCI: boolean
): MaturityLevel {
  let score = 0
  const depKeys = Object.keys(repo.dependencyFiles)
  if (depKeys.some(f => f.includes('package-lock') || f.includes('yarn.lock') || f.includes('pnpm-lock') || f.includes('Cargo.lock') || f.includes('go.sum'))) score += 1
  if (readmeLower.includes('security') || readmeLower.includes('security policy') || repo.fileTree.some(f => f.name.toLowerCase() === 'security.md')) score += 1
  if (hasCI) score += 1
  if (repo.license) score += 1
  if (repo.fileTree.some(f => f.path.includes('.github/workflows'))) score += 1
  const codeFileCount = repo.fileTree.filter(f => f.type === 'blob' && !f.name.match(/\.(md|txt|yml|yaml|json|toml)$/)).length
  if (codeFileCount > 0) score += 1
  if (score >= 5) return 'Advanced'
  if (score >= 3) return 'Intermediate'
  if (score >= 1) return 'Beginner'
  return 'None'
}

export function computeDeploymentReadiness(
  depKeys: string[],
  hasCI: boolean,
  hasTests: boolean,
  readmeLower: string
): OnboardingLevel {
  let score = 0
  if (depKeys.some(f => f.includes('Dockerfile'))) score += 2
  if (depKeys.some(f => f.includes('docker-compose'))) score += 1
  if (hasCI) score += 2
  if (hasTests) score += 1
  if (readmeLower.includes('deploy') || readmeLower.includes('deployment') || readmeLower.includes('production')) score += 1
  if (depKeys.some(f => f.includes('.env.example') || f.includes('.env.sample'))) score += 1
  if (score >= 6) return 'Easy'
  if (score >= 4) return 'Medium'
  if (score >= 2) return 'Hard'
  return 'Very Hard'
}

export function computeLearningValue(
  readme: string,
  headingCount: number,
  totalFiles: number,
  isDocRepo: boolean
): number {
  if (!readme) return 0
  let score = 20
  const lower = readme.toLowerCase()
  const examplesCount = (lower.match(/example/g) ?? []).length
  const explanationWords = ['how', 'why', 'explain', 'understand', 'guide', 'tutorial', 'concept', 'overview', 'walkthrough', 'learn']
  const explanationsFound = explanationWords.filter(w => lower.includes(w)).length
  if (examplesCount >= 3) score += 15
  if (examplesCount >= 5) score += 10
  if (explanationsFound >= 4) score += 15
  if (explanationsFound >= 6) score += 10
  if (headingCount >= 8) score += 10
  if (headingCount >= 12) score += 5
  if (lower.match(/```/g) && (lower.match(/```/g) ?? []).length >= 4) score += 10
  if (isDocRepo) score += 10
  if (totalFiles > 0 && totalFiles <= 50) score += 5
  return Math.min(100, score)
}

export function computeReadmeCodeConsistency(
  readmeLower: string,
  depKeys: string[],
  techStack: { frameworks: string[]; databases: string[]; tools: string[]; languages: { name: string }[] }
): number {
  let consistencyScore = 100
  const claimedTech: string[] = []
  const stackKeywords = [
    { name: 'react', keywords: ['react', 'reactjs'] },
    { name: 'next.js', keywords: ['next.js', 'nextjs', 'next'] },
    { name: 'vue', keywords: ['vue', 'vuejs', 'vue.js'] },
    { name: 'angular', keywords: ['angular'] },
    { name: 'express', keywords: ['express', 'express.js'] },
    { name: 'django', keywords: ['django'] },
    { name: 'flask', keywords: ['flask'] },
    { name: 'fastapi', keywords: ['fastapi'] },
    { name: 'postgresql', keywords: ['postgresql', 'postgres', 'pg'] },
    { name: 'mongodb', keywords: ['mongodb', 'mongo'] },
    { name: 'redis', keywords: ['redis'] },
    { name: 'docker', keywords: ['docker'] },
    { name: 'kubernetes', keywords: ['kubernetes', 'k8s'] },
    { name: 'typescript', keywords: ['typescript'] },
    { name: 'python', keywords: ['python'] },
    { name: 'rust', keywords: ['rust'] },
    { name: 'go', keywords: ['golang', 'go language'] },
  ]

  for (const tech of stackKeywords) {
    if (tech.keywords.some(k => readmeLower.includes(k))) {
      claimedTech.push(tech.name)
    }
  }

  const allStackItems = [
    ...techStack.frameworks.map(f => f.toLowerCase()),
    ...techStack.databases.map(d => d.toLowerCase()),
    ...techStack.tools.map(t => t.toLowerCase()),
    ...techStack.languages.map(l => l.name.toLowerCase()),
  ]

  for (const tech of claimedTech) {
    const found = allStackItems.some(item => item.includes(tech) || tech.includes(item.replace(/\(.*?\)/g, '').trim()))
    if (!found) {
      consistencyScore -= 15
    }
  }

  return Math.max(0, consistencyScore)
}

export function computeTechDebtIndicators(repo: RepoInfo): { total: number; level: 'Low' | 'Medium' | 'High' } {
  const readme = repo.readmeContent ?? ''
  const todos = (readme.match(/\bTODO\b/gi) ?? []).length
  const fixmes = (readme.match(/\bFIXME\b/gi) ?? []).length
  const hacks = (readme.match(/\bHACK\b/gi) ?? []).length
  const temps = (readme.match(/\bTEMP\b/gi) ?? []).length
  const total = todos + fixmes + hacks + temps
  let level: 'Low' | 'Medium' | 'High'
  if (total <= 3) level = 'Low'
  else if (total <= 10) level = 'Medium'
  else level = 'High'
  return { total, level }
}

export function computeMaintainabilityIndex(
  maxDepth: number,
  fileCount: number,
  averageFileSize: number,
  hasTests: boolean,
  hasCI: boolean,
  hasReadme: boolean
): 'Excellent' | 'Good' | 'Moderate' | 'Poor' {
  let score = 50
  if (maxDepth <= 3) score += 10
  else if (maxDepth <= 5) score += 5
  else score -= 5
  if (fileCount < 100) score += 10
  else if (fileCount < 500) score += 5
  else if (fileCount > 5000) score -= 5
  if (averageFileSize < 50) score += 10
  else if (averageFileSize < 150) score += 5
  else if (averageFileSize > 500) score -= 5
  if (hasTests) score += 15
  if (hasCI) score += 10
  if (hasReadme) score += 10
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Moderate'
  return 'Poor'
}
