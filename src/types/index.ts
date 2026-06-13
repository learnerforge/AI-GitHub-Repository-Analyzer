export interface RepoInfo {
  id: string
  url: string
  owner: string
  name: string
  description: string | null
  defaultBranch: string
  stars: number
  forks: number
  openIssues: number
  watchers: number
  topics: string[]
  license: string | null
  createdAt: string
  updatedAt: string
  pushedAt: string
  size: number
  languages: Record<string, number>
  contributors: Contributor[]
  readmeContent: string
  fileTree: FileNode[]
  dependencyFiles: Record<string, string>
}

export interface Contributor {
  login: string
  avatarUrl: string
  contributions: number
}

export interface FileNode {
  name: string
  path: string
  type: 'blob' | 'tree'
  size?: number
  children?: FileNode[]
}

export interface TechStack {
  languages: LanguageInfo[]
  frameworks: string[]
  databases: string[]
  tools: string[]
  infrastructure: string[]
}

export interface LanguageInfo {
  name: string
  percentage: number
  bytes: number
}

export interface ComplexityMetrics {
  overall: number
  fileCount: number
  totalLines: number
  averageFileSize: number
  deepestNesting: number
  languageBreakdown: { language: string; files: number; lines: number }[]
  testFileCount?: number
  totalFileCount?: number
  testCoverageEstimate?: number
  apiEndpointCount?: number
  techDebtScore?: number
  fixmeCount?: number
  todoCount?: number
}

export interface DocsQuality {
  readmeScore: number
  hasReadme: boolean
  readmeLength: number
  hasContributing: boolean
  hasCodeOfConduct: boolean
  hasLicense: boolean
  hasChangelog: boolean
  hasApiDocs: boolean
  hasWiki: boolean
  sectionCoverage: { section: string; present: boolean }[]
  suggestions: string[]
  readmeLevels?: ReadmeLevelScores
}

export interface ReadmeLevelScores {
  existence: number
  projectIdentity: number
  problemStatement: number
  features: number
  installation: number
  usage: number
  examples: number
  architecture: number
  techStack: number
  configuration: number
  apiDocs: number
  screenshots: number
  contributing: number
  testing: number
  deployment: number
  license: number
  maintenance: number
  community: number
  readability: number
  advancedSignals: number
  total: number
}

export type RepoPersonality =
  | 'Learning Project'
  | 'Portfolio'
  | 'Research Project'
  | 'Startup MVP'
  | 'Enterprise Application'
  | 'Open Source Framework'
  | 'CLI Tool'
  | 'Dataset Repository'
  | 'Library'
  | 'Documentation Repository'
  | 'Educational Resource'

export type OnboardingLevel = 'Easy' | 'Medium' | 'Hard' | 'Very Hard'
export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Archived'
export type MaturityLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'None'

export interface ProjectCompleteness {
  hasReadme: boolean
  hasSourceCode: boolean
  hasConfig: boolean
  hasTests: boolean
  hasLicense: boolean
  hasDeployment: boolean
  percentage: number
}

export interface AdvancedSignals {
  personality: RepoPersonality
  completeness: ProjectCompleteness
  onboardingDifficulty: OnboardingLevel
  abandonmentRisk: RiskLevel
  configComplexity: { count: number; level: OnboardingLevel }
  docCoverage: { percentage: number; level: string }
  contributorFriendliness: OnboardingLevel
  securityMaturity: MaturityLevel
  deploymentReadiness: OnboardingLevel
  learningValue: number
  readmeCodeConsistency: number
  techDebtIndicators: { total: number; level: 'Low' | 'Medium' | 'High' }
  maintainabilityIndex: 'Excellent' | 'Good' | 'Moderate' | 'Poor'
}

export interface HealthMetrics {
  overall: number
  stars: number
  forks: number
  openIssues: number
  issuesPerStar: number
  lastCommitDays: number
  hasRecentActivity: boolean
  contributorCount: number
  busFactor: number
  releaseCount: number
  hasCI: boolean
  hasTests: boolean
}

export interface CodeSmell {
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
  location?: string
}

export interface AnalysisReport {
  id: string
  repoUrl: string
  repoName: string
  owner: string
  summary: string
  techStack: TechStack
  architecture: string
  complexity: ComplexityMetrics
  docsQuality: DocsQuality
  health: HealthMetrics
  codeSmells: CodeSmell[]
  suggestions: string[]
  onboardingGuide: string
  qualityScores: QualityScores
  fileTree: FileNode[]
  generatedAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  analysisSource?: 'github-api' | 'local-clone'
  outlierAlerts?: string[]
  advancedSignals?: AdvancedSignals
}

export interface QualityScores {
  overall: number
  codeQuality: number
  documentation: number
  maintainability: number
  communityHealth: number
  security: number
  breakdown?: Record<string, { score: number; reason: string }>
}

export interface AIAnalysisInput {
  readme: string
  languages: Record<string, number>
  fileTree: FileNode[]
  dependencyFiles: Record<string, string>
  topics: string[]
  description: string | null
  stars?: number
  forks?: number
  contributorCount?: number
  pushedAt?: string
}

export interface AIAnalysisResult {
  summary: string
  techStack: TechStack
  architecture: string
  codeSmells: CodeSmell[]
  suggestions: string[]
  onboardingGuide: string
  qualityScores: QualityScores
}
