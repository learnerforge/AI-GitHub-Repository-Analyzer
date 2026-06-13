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
