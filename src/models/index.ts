import { AIAnalysisInput, AIAnalysisResult, TechStack, CodeSmell, QualityScores } from '@/types'
import { AIProvider } from '@/services/ai'
import { generateSummary } from './summarizer'
import { detectTechnologies } from './technologies'
import { analyzeArchitecture, ArchitectureAnalysis } from './architecture'
import { detectCodeSmells, SmellDetectionInput } from './smellDetector'
import { computeQualityScores } from './qualityScorer'
import { generateOnboardingGuide } from './onboarding'
import { selfHealingLayer, SelfHealingLayer } from './selfHealing'
import { reinforcementLearner, ReinforcementLearner, State, computeReadmeMetrics } from './reinforcement'
import { extractKeywords } from './textAnalyzer'

export class LocalAIProvider implements AIProvider {
  private selfHealing: SelfHealingLayer
  private rl: ReinforcementLearner
  private options: {
    useReinforcementLearning: boolean
    useSelfHealing: boolean
    verbosity: 'minimal' | 'normal' | 'verbose'
  }

  constructor(options?: Partial<{
    useReinforcementLearning: boolean
    useSelfHealing: boolean
    verbosity: 'minimal' | 'normal' | 'verbose'
  }>) {
    this.selfHealing = selfHealingLayer
    this.rl = reinforcementLearner
    this.options = {
      useReinforcementLearning: options?.useReinforcementLearning ?? true,
      useSelfHealing: options?.useSelfHealing ?? true,
      verbosity: options?.verbosity ?? 'normal',
    }
  }

  async analyze(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    if (!input) throw new Error('AIAnalysisInput is required')
    if (input.readme && input.readme.length > 100000) {
      input.readme = input.readme.slice(0, 100000) + '\n\n<!-- TRUNCATED at 100KB -->'
    }
    this.selfHealing.resetForNewAnalysis()
    const startTime = Date.now()

    // Cache repeated computations once
    const hasTests = this.detectHasTests(input.fileTree)
    const hasCI = this.detectHasCI(input.fileTree)
    const langCount = Object.keys(input.languages).length
    const totalBytes = Object.values(input.languages).reduce((a, b) => a + b, 0)

    // Run independent analysis steps in parallel
    const [summaryResult, techStack, architectureResult] = await Promise.all([
      this.runWithHealing('summary', () => this.generateSummaryInternal(input)),
      this.runWithHealing('techStack', () => this.detectTechStackInternal(input, totalBytes)),
      this.runWithHealing('architecture', () => this.analyzeArchitectureInternal(input)),
    ])

    const smellInput: SmellDetectionInput = {
      fileTree: input.fileTree,
      readmeContent: input.readme || '',
      languages: input.languages,
      dependencyFiles: input.dependencyFiles,
      hasTests,
      hasCI,
      contributorCount: input.contributorCount ?? 0,
    }

    const codeSmells = this.runWithHealing('codeSmells', () =>
      detectCodeSmells(smellInput)
    )

    const suggestions = this.runWithHealing('suggestions', () =>
      this.generateSuggestionsInternal(codeSmells, techStack, input.fileTree)
    )

    const onboardingGuide = this.runWithHealing('onboardingGuide', () =>
      this.generateOnboardingInternal(input, techStack, architectureResult)
    )

    const qualityScores = this.runWithHealing('qualityScores', () =>
      this.scoreQualityInternal(input, techStack, codeSmells, hasTests, hasCI, langCount, totalBytes)
    )

    if (this.options.useReinforcementLearning) {
      await this.runReinforcementLearning(input, qualityScores)
    }

    const executionTime = Date.now() - startTime
    this.selfHealing.recordAdaptation('full_analysis', { executionTime }, {})

    return {
      summary: summaryResult,
      techStack,
      architecture: architectureResult.description,
      codeSmells,
      suggestions,
      onboardingGuide,
      qualityScores,
    }
  }

  private runWithHealing<T>(component: string, fn: () => T): T {
    if (this.options.useSelfHealing && this.selfHealing.isCircuitTripped(component)) {
      return this.selfHealing.getDefaultFor(component) as T
    }

    let result = fn()

    if (this.options.useSelfHealing) {
      const strategy = this.selfHealing.getAdaptedStrategy(component)
      const validation = this.selfHealing.validateComponent(component, result, strategy)
      if (!validation.valid) {
        this.selfHealing.recordFailure(component)
        const healed = this.selfHealing.healOutput(component, result, validation)
        result = healed as T

        if (this.selfHealing.shouldRetry(component)) {
          this.selfHealing.recordRetry(component)
          const retryResult = fn()
          const retryStrategy = this.selfHealing.getAdaptedStrategy(component)
          const retryValidation = this.selfHealing.validateComponent(component, retryResult, retryStrategy)
          if (retryValidation.valid || retryValidation.confidence > validation.confidence) {
            result = retryResult as T
            this.selfHealing.resetCircuit(component)
          }
        }
      }
    }

    return result
  }

  private generateSummaryInternal(input: AIAnalysisInput): string {
    const parts: string[] = []

    const langNames = Object.keys(input.languages)
    const totalBytes = langNames.reduce((s, l) => s + (input.languages[l] || 0), 0)
    const starCount = input.stars ?? 0
    const forkCount = input.forks ?? 0
    const readmeLen = input.readme?.length ?? 0
    const fileCount = countFiles(input.fileTree)
    const depCount = Object.keys(input.dependencyFiles || {}).length

    if (input.description) {
      parts.push(input.description)
    }

    if (langNames.length > 0 && totalBytes > 0) {
      const topLangs = langNames
        .sort((a, b) => (input.languages[b] || 0) - (input.languages[a] || 0))
        .slice(0, 4)
        .map(l => `${l} (${Math.round(((input.languages[l] || 0) / totalBytes) * 100)}%)`)
      parts.push(`Tech stack: ${topLangs.join(', ')}${input.topics.length ? ` — topics: ${input.topics.slice(0, 5).join(', ')}` : ''}.`)
    } else if (input.topics.length > 0) {
      parts.push(`Topics: ${input.topics.slice(0, 5).join(', ')}.`)
    }

    if (readmeLen > 0) {
      const headingCount = input.readme!.match(/^## /gm)?.length ?? 0
      parts.push(`Documentation: ${headingCount} sections across ${readmeLen.toLocaleString()} characters.`)
    } else {
      parts.push('Documentation: no README found.')
    }

    if (starCount > 0 || forkCount > 0) {
      parts.push(`Community: ${starCount.toLocaleString()} stars, ${forkCount.toLocaleString()} forks.`)
    }

    if (fileCount > 0) {
      parts.push(`Repository spans ${fileCount} files${depCount > 0 ? ` across ${depCount} dependency manifests` : ''}.`)
    }

    let readmeInsights = ''
    if (input.readme && input.readme.length > 100) {
      const extracted = generateSummary(input.readme)
      if (extracted.summary && extracted.summary.length > 60) {
        readmeInsights = extracted.summary
      }
    }

    const structured = parts.join(' ')
    if (readmeInsights) {
      return `${structured}\n\n${readmeInsights}`
    }
    return structured || 'A code repository with multiple file types and organized project structure.'
  }

  private detectTechStackInternal(input: AIAnalysisInput, totalBytes?: number): TechStack {
    const techStack = detectTechnologies(
      input.languages,
      input.fileTree,
      input.dependencyFiles,
      input.readme || '',
      input.topics
    )

    const languageNames = Object.keys(input.languages)
    const bytesTotal = totalBytes ?? Object.values(input.languages).reduce((a, b) => a + b, 0)
    for (const lang of languageNames) {
      if (!techStack.languages.find(l => l.name === lang)) {
        const bytes = input.languages[lang]
        techStack.languages.push({
          name: lang,
          percentage: bytesTotal > 0 ? Math.round((bytes / bytesTotal) * 1000) / 10 : 0,
          bytes,
        })
      }
    }
    techStack.languages.sort((a, b) => b.percentage - a.percentage)

    return techStack
  }

  private analyzeArchitectureInternal(input: AIAnalysisInput): ArchitectureAnalysis {
    return analyzeArchitecture(
      input.fileTree,
      input.readme || '',
      input.dependencyFiles
    )
  }

  private detectHasTests(fileTree: any[]): boolean {
    return fileTree.some((f: any) =>
      ['tests', '__tests__', 'test'].includes(f.name) ||
      f.name?.includes('.test.') ||
      f.name?.includes('.spec.')
    ) || false
  }

  private detectHasCI(fileTree: any[]): boolean {
    return fileTree.some((f: any) =>
      f.path?.includes('.github/workflows')
    ) || false
  }

  private generateSuggestionsInternal(codeSmells: CodeSmell[], techStack: TechStack, fileTree: any[]): string[] {
    const suggestions: string[] = []

    const hasCriticalSmell = codeSmells.some(s => s.severity === 'critical')
    const hasWarningSmell = codeSmells.some(s => s.severity === 'warning')

    if (hasCriticalSmell) {
      suggestions.push('Address critical issues first: ' +
        codeSmells.filter(s => s.severity === 'critical').map(s => s.title).join(', ') +
        '. These have the highest impact on project quality.')
    }

    if (hasWarningSmell) {
      suggestions.push('Review warning-level issues: ' +
        codeSmells.filter(s => s.severity === 'warning').map(s => s.title).join(', ') +
        '. Addressing these will improve maintainability.')
    }

    if (!this.detectHasTests(fileTree)) {
      suggestions.push('Add automated tests to improve code reliability and make contributions safer.')
    }

    const keywords = extractKeywords(techStack.languages.map(l => l.name).join(' '), 5)
    if (keywords.length > 0) {
      suggestions.push(`Consider adding more ${keywords.slice(0, 3).map(k => k.word).join(', ')} examples and use cases in the documentation.`)
    }

    if (techStack.databases.length > 0) {
      suggestions.push(`Document database setup instructions for ${techStack.databases.join(', ')} to help new contributors get started faster.`)
    }

    if (techStack.frameworks.length > 0) {
      suggestions.push(`Include framework-specific best practices for ${techStack.frameworks.slice(0, 2).join(' and ')} to ensure consistent code quality.`)
    }

    if (techStack.tools.length > 0) {
      suggestions.push(`Add configuration examples for ${techStack.tools.slice(0, 3).join(', ')} to standardize the development environment.`)
    }

    suggestions.push('Create or update CONTRIBUTING.md with clear guidelines for submitting issues, PRs, and code review processes.')

    return suggestions.slice(0, 8)
  }

  private generateOnboardingInternal(
    input: AIAnalysisInput,
    techStack: TechStack,
    architecture: ArchitectureAnalysis
  ): string {
    const repoForOnboarding = {
      url: `https://github.com/${input.topics[0] || 'owner'}/${'repo'}`,
      name: 'repository',
      owner: 'owner',
      description: input.description || '',
      defaultBranch: 'main',
      stars: 0,
      forks: 0,
      openIssues: 0,
      watchers: 0,
      topics: input.topics,
      license: null,
      createdAt: '',
      updatedAt: '',
      pushedAt: '',
      size: 0,
      languages: input.languages,
      contributors: [],
      readmeContent: input.readme || '',
      fileTree: input.fileTree,
      dependencyFiles: input.dependencyFiles,
    }

    return generateOnboardingGuide(
      repoForOnboarding as any,
      techStack,
      architecture
    )
  }

  private scoreQualityInternal(
    input: AIAnalysisInput,
    techStack: TechStack,
    codeSmells: CodeSmell[],
    hasTests: boolean,
    hasCI: boolean,
    langCount: number,
    totalBytes: number
  ): QualityScores {
    const complexity = {
      overall: 0,
      fileCount: countFiles(input.fileTree),
      totalLines: totalBytes / 50,
      averageFileSize: 0,
      deepestNesting: 0,
      languageBreakdown: [],
    }
    complexity.averageFileSize = complexity.fileCount > 0
      ? Math.round(complexity.totalLines / complexity.fileCount) : 0
    const docRepo = langCount === 0 && complexity.fileCount > 0 && (input.readme?.length ?? 0) > 200
    complexity.overall = Math.min(100, Math.round(
      (langCount === 0 ? (docRepo ? 15 : 0) : 20) +
      (complexity.fileCount < 50 ? 25 : complexity.fileCount < 200 ? 15 : 5) +
      (complexity.averageFileSize < 100 ? 25 : (complexity.averageFileSize < 300 || docRepo) ? 15 : 5) +
      (complexity.totalLines < 10000 ? 30 : complexity.totalLines < 50000 ? 20 : 10)
    ))

    const readmeText = input.readme || ''
    const readmeLower = readmeText.toLowerCase()
    const headingCount = readmeText.match(/^## /gm)?.length ?? 0
    const hasHeadingStructure = headingCount >= 1
    const sections = [
      { section: 'Description', present: readmeText.length > 50 },
      { section: 'Installation', present: readmeLower.includes('install') || (hasHeadingStructure && headingCount >= 2) },
      { section: 'Usage', present: readmeLower.includes('usage') || readmeLower.includes('example') || (hasHeadingStructure && headingCount >= 3) },
      { section: 'API Documentation', present: readmeLower.includes('api') || (hasHeadingStructure && headingCount >= 4) },
      { section: 'Configuration', present: readmeLower.includes('config') || (hasHeadingStructure && headingCount >= 5) },
      { section: 'Contributing', present: readmeLower.includes('contributing') },
      { section: 'License', present: readmeLower.includes('license') },
      { section: 'Code of Conduct', present: readmeLower.includes('code of conduct') },
      { section: 'Changelog', present: readmeLower.includes('changelog') },
      { section: 'Tests', present: readmeLower.includes('test') },
    ]
    const hasGoodStructure = headingCount >= 3
    const docs = {
      readmeScore: input.readme
        ? Math.min(100, Math.round(
            (readmeText.length > 500 ? 30 : readmeText.length > 100 ? 15 : 5) +
            (readmeText.includes('## ') ? 20 : 0) +
            (readmeLower.includes('install') ? 15 : 0) +
            (readmeLower.includes('usage') || readmeLower.includes('example') ? 15 : 0) +
            (readmeLower.includes('api') || readmeLower.includes('config') ? 10 : 0) +
            (readmeLower.includes('license') ? 10 : 0) +
            (hasGoodStructure && !readmeLower.includes('install') ? 10 : 0)
          ))
        : 0,
      hasReadme: !!input.readme,
      readmeLength: readmeText.length,
      hasContributing: readmeLower.includes('contributing'),
      hasCodeOfConduct: readmeLower.includes('code of conduct'),
      hasLicense: readmeLower.includes('license'),
      hasChangelog: readmeLower.includes('changelog'),
      hasApiDocs: readmeLower.includes('api'),
      hasWiki: false,
      sectionCoverage: sections,
      suggestions: [],
    }

    const lastCommitDays = input.pushedAt
      ? Math.round((Date.now() - new Date(input.pushedAt).getTime()) / 86400000)
      : 30
    const hasRecentActivity = lastCommitDays < 90

    const health = {
      overall: 50,
      stars: input.stars ?? 0,
      forks: input.forks ?? 0,
      openIssues: 0,
      issuesPerStar: 0,
      lastCommitDays,
      hasRecentActivity,
      contributorCount: input.contributorCount ?? 0,
      busFactor: 1,
      releaseCount: 0,
      hasCI,
      hasTests,
    }

    let weightParams = this.rl.getCurrentParams()
    if (this.options.useReinforcementLearning) {
      const readme = input.readme || ''
      const readmeMetrics = computeReadmeMetrics(readme)
      const hasDocker = checkHasDockerfile(input.fileTree)
      const state: State = {
        repoStars: health.stars,
        repoForks: health.forks,
        fileCount: complexity.fileCount,
        languageCount: langCount,
        readmeLength: readme.length,
        contributorCount: health.contributorCount,
        hasTests: health.hasTests,
        hasCI: health.hasCI,
        readmeScore: docs.readmeScore,
        docsSectionCount: this.computeDocsSectionCount(readme),
        hasApiDocs: docs.hasApiDocs,
        hasLicense: docs.hasLicense,
        lastCommitDays,
        hasDockerfile: hasDocker,
        hasContributing: docs.hasContributing,
        ...readmeMetrics,
      }
      const stateValidation = this.selfHealing.validateComponent('rlState', state)
      if (!stateValidation.valid) {
        const healed = this.selfHealing.healOutput('rlState', state, stateValidation)
        Object.assign(state, healed)
      }
      weightParams = this.rl.getOptimalParams(state)
    }
    const params = this.rl.mergeWithDefaults(weightParams, {
      repoStars: health.stars,
      repoForks: health.forks,
      fileCount: complexity.fileCount,
      languageCount: langCount,
      readmeLength: (input.readme || '').length,
      contributorCount: health.contributorCount,
      hasTests: health.hasTests,
      hasCI: health.hasCI,
      readmeScore: docs.readmeScore,
      docsSectionCount: this.computeDocsSectionCount(input.readme || ''),
      hasApiDocs: docs.hasApiDocs,
      hasLicense: docs.hasLicense,
      lastCommitDays,
      hasDockerfile: checkHasDockerfile(input.fileTree),
      hasContributing: docs.hasContributing,
      ...computeReadmeMetrics(input.readme || ''),
    })

    if (this.options.useSelfHealing) {
      const docsValidation = this.selfHealing.validateComponent('docs', docs)
      if (!docsValidation.valid) {
        const healed = this.selfHealing.healOutput('docs', docs, docsValidation)
        Object.assign(docs, healed)
      }
    }

    const scores = computeQualityScores(
      { languages: input.languages, fileTree: input.fileTree, dependencyFiles: input.dependencyFiles } as any,
      complexity as any,
      docs as any,
      health as any,
      params
    )

    const numberOfCriticalSmells = codeSmells.filter(s => s.severity === 'critical').length
    if (numberOfCriticalSmells > 0) {
      scores.codeQuality = Math.max(10, scores.codeQuality - numberOfCriticalSmells * 10)
      scores.security = Math.max(10, scores.security - numberOfCriticalSmells * 5)
    }

    return scores
  }

  private computeDocsSectionCount(readme: string): number {
    if (!readme) return 0
    const headingCount = readme.match(/^## /gm)?.length ?? 0
    const hasHeadingStructure = headingCount >= 1
    let count = 0
    if (readme.length > 50) count++
    if (readme.toLowerCase().includes('install') || (hasHeadingStructure && headingCount >= 2)) count++
    if (readme.toLowerCase().includes('usage') || readme.toLowerCase().includes('example') || (hasHeadingStructure && headingCount >= 3)) count++
    if (readme.toLowerCase().includes('api') || (hasHeadingStructure && headingCount >= 4)) count++
    if (readme.toLowerCase().includes('config') || (hasHeadingStructure && headingCount >= 5)) count++
    if (readme.toLowerCase().includes('contributing')) count++
    if (readme.toLowerCase().includes('license')) count++
    if (readme.toLowerCase().includes('code of conduct')) count++
    if (readme.toLowerCase().includes('changelog')) count++
    if (readme.toLowerCase().includes('test')) count++
    return Math.min(10, count)
  }

  private async runReinforcementLearning(
    input: AIAnalysisInput,
    scores: QualityScores
  ): Promise<void> {
    if (!this.options.useReinforcementLearning) return

    const readme = input.readme || ''
    const headingCount = readme.match(/^## /gm)?.length ?? 0
    const hasGoodStructure = headingCount >= 3
    const fileCount = countFiles(input.fileTree)
    const readmeScore = Math.min(100, Math.round(
      (readme.length > 500 ? 30 : readme.length > 100 ? 15 : 5) +
      (readme.includes('## ') ? 20 : 0) +
      (readme.toLowerCase().includes('install') ? 15 : 0) +
      (readme.toLowerCase().includes('usage') || readme.toLowerCase().includes('example') ? 15 : 0) +
      (readme.toLowerCase().includes('api') || readme.toLowerCase().includes('config') ? 10 : 0) +
      (readme.toLowerCase().includes('license') ? 10 : 0) +
      (hasGoodStructure && !readme.toLowerCase().includes('install') ? 10 : 0)
    ))
    const docsSectionCount = this.computeDocsSectionCount(readme)
    const hasApiDocs = readme.toLowerCase().includes('api')
    const hasLicense = readme.toLowerCase().includes('license')
    const hasContributing = readme.toLowerCase().includes('contributing')
    const lastCommitDays = input.pushedAt
      ? Math.round((Date.now() - new Date(input.pushedAt).getTime()) / 86400000)
      : 30
    const readmeMetrics = computeReadmeMetrics(readme)
    const hasDocker = checkHasDockerfile(input.fileTree)

    const state: State = {
      repoStars: input.stars ?? 0,
      repoForks: input.forks ?? 0,
      fileCount,
      languageCount: Object.keys(input.languages).length,
      readmeLength: readme.length,
      contributorCount: input.contributorCount ?? 0,
      hasTests: this.detectHasTests(input.fileTree),
      hasCI: this.detectHasCI(input.fileTree),
      readmeScore,
      docsSectionCount,
      hasApiDocs,
      hasLicense,
      lastCommitDays,
      hasDockerfile: hasDocker,
      hasContributing,
      ...readmeMetrics,
    }

    const baselineParams = this.rl.getCurrentParams()
    for (let exploreStep = 0; exploreStep < 3; exploreStep++) {
      const action = this.rl.selectAction(state, 0.4)
      const trialWeightParams = this.rl.applyAction(baselineParams, action)
      const trialParams = this.rl.mergeWithDefaults(trialWeightParams, state)
      const trialScores = computeQualityScores(
        { languages: input.languages, fileTree: input.fileTree, dependencyFiles: input.dependencyFiles } as any,
        { overall: 0, fileCount, totalLines: 0, averageFileSize: 0, deepestNesting: 0, languageBreakdown: [] },
        { readmeScore, hasReadme: readme.length > 0, readmeLength: readme.length, hasContributing, hasCodeOfConduct: false, hasLicense, hasChangelog: false, hasApiDocs, hasWiki: false, sectionCoverage: [], suggestions: [] },
        { overall: 0, stars: state.repoStars, forks: state.repoForks, openIssues: 0, issuesPerStar: 0, lastCommitDays, hasRecentActivity: lastCommitDays < 90, contributorCount: state.contributorCount, busFactor: 1, releaseCount: 0, hasCI: state.hasCI, hasTests: state.hasTests },
        trialParams
      )

      const compHealth = this.selfHealing.getComponentHealth('qualityScores')
      const reward = this.rl.computeReward(trialScores.overall, compHealth)
      const nextState: State = { ...state }
      nextState.repoStars = Math.max(0, state.repoStars + (action.paramName === 'communityWeight' ? Math.round(action.delta * 1000) : 0))
      nextState.repoForks = Math.max(0, state.repoForks + (action.paramName === 'communityWeight' ? Math.round(action.delta * 100) : 0))

      this.rl.storeExperience(state, action, reward, nextState)
    }
    this.rl.trainMultiple(3, 16)
    this.rl.persist()
  }

  getSelfHealingLayer(): SelfHealingLayer {
    return this.selfHealing
  }

  getReinforcementLearner(): ReinforcementLearner {
    return this.rl
  }
}

function countFiles(tree: any[]): number {
  let count = 0
  for (const node of tree) {
    if (node.type === 'blob') count++
    if (node.children) count += countFiles(node.children)
  }
  return count
}

function checkHasDockerfile(tree: any[]): boolean {
  for (const node of tree) {
    if (node.type === 'blob' && ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'].includes(node.name)) return true
    if (node.children && checkHasDockerfile(node.children)) return true
  }
  return false
}
