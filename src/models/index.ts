import { AIAnalysisInput, AIAnalysisResult, TechStack, CodeSmell, QualityScores } from '@/types'
import { AIProvider } from '@/services/ai'
import { generateSummary } from './summarizer'
import { detectTechnologies, detectDevCommands } from './technologies'
import { analyzeArchitecture, ArchitectureAnalysis } from './architecture'
import { detectCodeSmells, SmellDetectionInput } from './smellDetector'
import { computeQualityScores } from './qualityScorer'
import { generateOnboardingGuide } from './onboarding'
import { selfHealingLayer, SelfHealingLayer } from './selfHealing'
import { reinforcementLearner, ReinforcementLearner, State } from './reinforcement'
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
    this.selfHealing.resetForNewAnalysis()
    const startTime = Date.now()

    const summaryResult = this.runWithHealing('summary', () =>
      this.generateSummaryInternal(input)
    )

    const techStack = this.runWithHealing('techStack', () =>
      this.detectTechStackInternal(input)
    )

    const architectureResult = this.runWithHealing('architecture', () =>
      this.analyzeArchitectureInternal(input)
    )

    const smellInput: SmellDetectionInput = {
      fileTree: input.fileTree,
      readmeContent: input.readme || '',
      languages: input.languages,
      dependencyFiles: input.dependencyFiles,
      hasTests: this.detectHasTests(input.fileTree),
      hasCI: this.detectHasCI(input.fileTree),
      contributorCount: 0,
    }

    const codeSmells = this.runWithHealing('codeSmells', () =>
      detectCodeSmells(smellInput)
    )

    const suggestions = this.runWithHealing('suggestions', () =>
      this.generateSuggestionsInternal(codeSmells, techStack)
    )

    const onboardingGuide = this.runWithHealing('onboardingGuide', () =>
      this.generateOnboardingInternal(input, techStack, architectureResult)
    )

    const qualityScores = this.runWithHealing('qualityScores', () =>
      this.scoreQualityInternal(input, techStack, codeSmells)
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
    let result = fn()

    if (this.options.useSelfHealing) {
      const validation = this.selfHealing.validateComponent(component, result)
      if (!validation.valid) {
        const healed = this.selfHealing.healOutput(component, result, validation)
        result = healed as T

        if (this.selfHealing.shouldRetry(component)) {
          this.selfHealing.recordRetry(component)
          const retryResult = fn()
          const retryValidation = this.selfHealing.validateComponent(component, retryResult)
          if (retryValidation.valid || retryValidation.confidence > validation.confidence) {
            result = retryResult as T
          }
        }
      }
    }

    return result
  }

  private generateSummaryInternal(input: AIAnalysisInput): string {
    const textToSummarize = [
      input.description || '',
      input.readme || '',
      `Topics: ${input.topics.join(', ')}`,
      `Languages: ${Object.keys(input.languages).join(', ')}`,
    ].filter(Boolean).join('\n\n')

    if (!textToSummarize.trim()) {
      return 'A code repository with multiple file types and organized project structure.'
    }

    const result = generateSummary(textToSummarize)

    if (result.confidence < 30 && input.readme) {
      const firstLines = input.readme.split('\n').slice(0, 5).join(' ').trim()
      if (firstLines.length > 30) return firstLines
    }

    return result.summary || textToSummarize.slice(0, 500)
  }

  private detectTechStackInternal(input: AIAnalysisInput): TechStack {
    const techStack = detectTechnologies(
      input.languages,
      input.fileTree,
      input.dependencyFiles,
      input.readme || '',
      input.topics
    )

    const languageNames = Object.keys(input.languages)
    for (const lang of languageNames) {
      if (!techStack.languages.find(l => l.name === lang)) {
        const bytes = input.languages[lang]
        const totalBytes = Object.values(input.languages).reduce((a, b) => a + b, 0)
        techStack.languages.push({
          name: lang,
          percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
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

  private generateSuggestionsInternal(codeSmells: CodeSmell[], techStack: TechStack): string[] {
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

    if (!this.detectHasTests([] as any)) {
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
    codeSmells: CodeSmell[]
  ): QualityScores {
    const complexity = {
      overall: 0,
      fileCount: countFiles(input.fileTree),
      totalLines: Object.values(input.languages).reduce((a, b) => a + b, 0) / 50,
      averageFileSize: 0,
      deepestNesting: 0,
      languageBreakdown: [],
    }
    complexity.averageFileSize = complexity.fileCount > 0
      ? Math.round(complexity.totalLines / complexity.fileCount) : 0
    complexity.overall = Math.min(100, Math.round(
      (Object.keys(input.languages).length === 0 ? 0 : 20) +
      (complexity.fileCount < 50 ? 25 : complexity.fileCount < 200 ? 15 : 5) +
      (complexity.averageFileSize < 100 ? 25 : complexity.averageFileSize < 300 ? 15 : 5) +
      (complexity.totalLines < 10000 ? 30 : complexity.totalLines < 50000 ? 20 : 10)
    ))

    const docs = {
      readmeScore: input.readme
        ? Math.min(100, Math.round(
            (input.readme.length > 500 ? 30 : input.readme.length > 100 ? 15 : 5) +
            (input.readme.includes('## ') ? 20 : 0) +
            (input.readme.toLowerCase().includes('install') ? 15 : 0) +
            (input.readme.toLowerCase().includes('usage') ? 15 : 0) +
            (input.readme.toLowerCase().includes('api') ? 10 : 0) +
            (input.readme.toLowerCase().includes('license') ? 10 : 0)
          ))
        : 0,
      hasReadme: !!input.readme,
      readmeLength: (input.readme || '').length,
      hasContributing: input.readme?.toLowerCase().includes('contributing') || false,
      hasCodeOfConduct: input.readme?.toLowerCase().includes('code of conduct') || false,
      hasLicense: input.readme?.toLowerCase().includes('license') || false,
      hasChangelog: input.readme?.toLowerCase().includes('changelog') || false,
      hasApiDocs: input.readme?.toLowerCase().includes('api') || false,
      hasWiki: false,
      sectionCoverage: [],
      suggestions: [],
    }

    const health = {
      overall: 50,
      stars: 0,
      forks: 0,
      openIssues: 0,
      issuesPerStar: 0,
      lastCommitDays: 30,
      hasRecentActivity: true,
      contributorCount: 0,
      busFactor: 1,
      releaseCount: 0,
      hasCI: this.detectHasCI(input.fileTree),
      hasTests: this.detectHasTests(input.fileTree),
    }

    let params = this.rl.getCurrentParams()
    if (this.options.useReinforcementLearning) {
      const state: State = {
        repoStars: health.stars,
        repoForks: health.forks,
        fileCount: complexity.fileCount,
        languageCount: Object.keys(input.languages).length,
        readmeLength: (input.readme || '').length,
        contributorCount: health.contributorCount,
        hasTests: health.hasTests,
        hasCI: health.hasCI,
      }
      params = this.rl.getOptimalParams(state)
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

  private async runReinforcementLearning(
    input: AIAnalysisInput,
    scores: QualityScores
  ): Promise<void> {
    if (!this.options.useReinforcementLearning) return

    const fileCount = countFiles(input.fileTree)
    const state: State = {
      repoStars: 0,
      repoForks: 0,
      fileCount,
      languageCount: Object.keys(input.languages).length,
      readmeLength: (input.readme || '').length,
      contributorCount: 0,
      hasTests: this.detectHasTests(input.fileTree),
      hasCI: this.detectHasCI(input.fileTree),
    }

    const componentHealth = this.selfHealing.getComponentHealth('qualityScores')
    const reward = this.rl.computeReward(scores.overall, componentHealth)
    const action = this.rl.selectAction(state, 0.3)

    this.rl.storeExperience(state, action, reward, state)
    this.rl.train()
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
