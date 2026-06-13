interface ValidationResult {
  valid: boolean
  issues: string[]
  corrections: Record<string, any>
  confidence: number
}

interface ComponentOutput {
  component: string
  data: any
  raw: any
}

const MIN_CONFIDENCE_THRESHOLD = 30
const RETRY_STRATEGIES = ['relaxed', 'aggressive', 'minimal']

export class SelfHealingLayer {
  private errorLog: { component: string; error: string; timestamp: number }[] = []
  private retryCounts: Record<string, number> = {}
  private strategyIndex: Record<string, number> = {}
  private adaptationHistory: Record<string, any[]> = {}

  validateComponent(component: string, data: any): ValidationResult {
    const issues: string[] = []
    const corrections: Record<string, any> = {}

    switch (component) {
      case 'summary':
        if (!data || typeof data !== 'string') {
          issues.push('Summary is missing or invalid type')
          corrections.summary = 'Repository analysis summary could not be generated.'
        } else if (data.length < 20) {
          issues.push('Summary is too short')
          corrections.summary = data.length > 0 ? data : 'Repository analysis summary could not be generated.'
        }
        break

      case 'techStack':
        if (!data || typeof data !== 'object') {
          issues.push('Tech stack data is missing')
          corrections.techStack = { languages: [], frameworks: [], databases: [], tools: [], infrastructure: [] }
        } else {
          if (!Array.isArray(data.languages)) {
            issues.push('Languages list is missing')
            corrections['techStack.languages'] = []
          }
          if (!Array.isArray(data.frameworks)) {
            issues.push('Frameworks list is missing')
            corrections['techStack.frameworks'] = []
          }
        }
        break

      case 'architecture':
        if (!data || typeof data.description !== 'string') {
          issues.push('Architecture description is missing')
          corrections.architecture = 'Standard project structure with conventional organization patterns.'
        }
        break

      case 'codeSmells':
        if (!Array.isArray(data)) {
          issues.push('Code smells data is not an array')
          corrections.codeSmells = []
        }
        break

      case 'qualityScores':
        if (!data || typeof data.overall !== 'number') {
          issues.push('Quality scores are missing or invalid')
          corrections.qualityScores = {
            overall: 50, codeQuality: 50, documentation: 50,
            maintainability: 50, communityHealth: 50, security: 50,
          }
        } else {
          for (const key of ['overall', 'codeQuality', 'documentation', 'maintainability', 'communityHealth', 'security']) {
            if (typeof (data as any)[key] !== 'number' || (data as any)[key] < 0 || (data as any)[key] > 100) {
              issues.push(`Score "${key}" is out of range`)
              corrections[`qualityScores.${key}`] = 50
            }
          }
        }
        break

      case 'suggestions':
        if (!Array.isArray(data)) {
          issues.push('Suggestions is not an array')
          corrections.suggestions = []
        }
        break

      case 'onboardingGuide':
        if (!data || typeof data !== 'string') {
          issues.push('Onboarding guide is missing')
          corrections.onboardingGuide = 'No onboarding guide could be generated automatically.'
        }
        break

      case 'docs':
        if (!data || typeof data !== 'object') {
          issues.push('Docs data is missing')
          corrections.docs = { readmeScore: 0, hasReadme: false, readmeLength: 0, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, sectionCoverage: [], suggestions: [] }
        } else {
          if (typeof data.readmeScore !== 'number' || data.readmeScore < 0 || data.readmeScore > 100) {
            issues.push('readmeScore out of range')
            corrections['docs.readmeScore'] = 0
          }
          if (!Array.isArray(data.sectionCoverage)) {
            issues.push('sectionCoverage missing')
            corrections['docs.sectionCoverage'] = []
          }
          if (typeof data.hasReadme !== 'boolean') {
            issues.push('hasReadme missing')
            corrections['docs.hasReadme'] = false
          }
        }
        break

      case 'rlState':
        if (!data || typeof data !== 'object') {
          issues.push('RL state is missing')
          corrections.rlState = { repoStars: 0, repoForks: 0, fileCount: 0, languageCount: 1, readmeLength: 0, contributorCount: 0, hasTests: false, hasCI: false, readmeScore: 0, docsSectionCount: 0, hasApiDocs: false, hasLicense: false }
        } else {
          const numericFields = ['repoStars', 'repoForks', 'fileCount', 'languageCount', 'readmeLength', 'contributorCount', 'readmeScore', 'docsSectionCount']
          for (const k of numericFields) {
            if (typeof data[k] !== 'number' || data[k] < 0 || (k === 'docsSectionCount' && (data[k] > 10 || !Number.isInteger(data[k])))) {
              issues.push(`rlState.${k} invalid`)
            }
          }
          const boolFields = ['hasTests', 'hasCI', 'hasApiDocs', 'hasLicense']
          for (const k of boolFields) {
            if (typeof data[k] !== 'boolean') issues.push(`rlState.${k} invalid`)
          }
        }
        break
    }

    const severity = issues.length === 0 ? 0 :
      issues.length <= 1 ? 1 :
      issues.length <= 3 ? 2 : 3

    const confidence = Math.max(0, 100 - severity * 25)

    return {
      valid: issues.length === 0,
      issues,
      corrections,
      confidence,
    }
  }

  autoTuneThresholds(): { adjusted: boolean; reason: string } {
    const health = this.getSystemHealth()
    const highErrorComps = Object.entries(health.components)
      .filter(([, h]: [string, any]) => h.errorRate > 0.3)
      .map(([c]) => c)
    if (highErrorComps.length > 3 && health.overallHealth === 'unhealthy') {
      return { adjusted: true, reason: `degraded components: ${highErrorComps.join(', ')}` }
    }
    return { adjusted: false, reason: 'within normal thresholds' }
  }

  healOutput(
    component: string,
    data: any,
    validation: ValidationResult
  ): any {
    if (validation.valid) return data

    const corrected = { ...data }
    for (const [key, value] of Object.entries(validation.corrections)) {
      const path = key.split('.')
      if (path.length === 1) {
        (corrected as any)[path[0]] = value
      } else if (path.length === 2) {
        if (!corrected[path[0]]) corrected[path[0]] = {}
        corrected[path[0]][path[1]] = value
      }
    }

    this.logError(component, validation.issues.join('; '))
    return corrected
  }

  getAdaptedStrategy(component: string): string {
    const currentIndex = this.strategyIndex[component] || 0
    return RETRY_STRATEGIES[currentIndex % RETRY_STRATEGIES.length]
  }

  shouldRetry(component: string): boolean {
    const count = this.retryCounts[component] || 0
    return count < 3
  }

  recordRetry(component: string): void {
    this.retryCounts[component] = (this.retryCounts[component] || 0) + 1
    this.strategyIndex[component] = (this.strategyIndex[component] || 0) + 1
  }

  logError(component: string, error: string): void {
    this.errorLog.push({ component, error, timestamp: Date.now() })
    if (this.errorLog.length > 100) {
      this.errorLog.shift()
    }
  }

  recordAdaptation(component: string, params: any, result: any): void {
    if (!this.adaptationHistory[component]) {
      this.adaptationHistory[component] = []
    }
    this.adaptationHistory[component].push({ params, result, timestamp: Date.now() })
    if (this.adaptationHistory[component].length > 50) {
      this.adaptationHistory[component].shift()
    }
  }

  getComponentHealth(component: string): { errorRate: number; avgConfidence: number; retries: number } {
    const recentErrors = this.errorLog.filter(
      e => e.component === component && Date.now() - e.timestamp < 3600000
    )
    const totalAttempts = (this.retryCounts[component] || 0) + Math.max(1, recentErrors.length)
    return {
      errorRate: totalAttempts > 0 ? recentErrors.length / totalAttempts : 0,
      avgConfidence: 100 - recentErrors.length * 20,
      retries: this.retryCounts[component] || 0,
    }
  }

  getSystemHealth(): { components: Record<string, any>; overallHealth: 'healthy' | 'degraded' | 'unhealthy' } {
    const components: Record<string, any> = {}
    let totalErrorRate = 0
    let componentCount = 0

    for (const component of ['summary', 'techStack', 'architecture', 'codeSmells', 'qualityScores', 'suggestions', 'onboardingGuide']) {
      const health = this.getComponentHealth(component)
      components[component] = health
      totalErrorRate += health.errorRate
      componentCount++
    }

    const avgErrorRate = componentCount > 0 ? totalErrorRate / componentCount : 0

    const overallHealth = avgErrorRate === 0 ? 'healthy' :
      avgErrorRate < 0.2 ? 'degraded' :
      'unhealthy'

    return { components, overallHealth }
  }

  resetForNewAnalysis(): void {
    this.retryCounts = {}
  }
}

export const selfHealingLayer = new SelfHealingLayer()
