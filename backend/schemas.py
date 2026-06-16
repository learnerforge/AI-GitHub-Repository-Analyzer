from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class Contributor(BaseModel):
    login: str
    avatarUrl: str
    contributions: int


class FileNode(BaseModel):
    name: str
    path: str
    type: str
    size: int | None = None
    children: list[FileNode] | None = None


class LanguageInfo(BaseModel):
    name: str
    percentage: float
    bytes: int


class TechStack(BaseModel):
    languages: list[LanguageInfo] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    infrastructure: list[str] = Field(default_factory=list)


class ComplexityMetrics(BaseModel):
    overall: float = 0
    fileCount: int = 0
    totalLines: int = 0
    averageFileSize: float = 0
    deepestNesting: int = 0
    languageBreakdown: list[dict[str, Any]] = []
    testFileCount: int | None = None
    totalFileCount: int | None = None
    testCoverageEstimate: float | None = None
    apiEndpointCount: int | None = None
    techDebtScore: float | None = None
    fixmeCount: int | None = None
    todoCount: int | None = None


class SectionCoverage(BaseModel):
    section: str
    present: bool


class ReadmeLevelScores(BaseModel):
    existence: float = 0
    projectIdentity: float = 0
    problemStatement: float = 0
    features: float = 0
    installation: float = 0
    usage: float = 0
    examples: float = 0
    architecture: float = 0
    techStack: float = 0
    configuration: float = 0
    apiDocs: float = 0
    screenshots: float = 0
    contributing: float = 0
    testing: float = 0
    deployment: float = 0
    license: float = 0
    maintenance: float = 0
    community: float = 0
    readability: float = 0
    advancedSignals: float = 0
    total: float = 0


class DocsQuality(BaseModel):
    readmeScore: float = 0
    hasReadme: bool = False
    readmeLength: int = 0
    hasContributing: bool = False
    hasCodeOfConduct: bool = False
    hasLicense: bool = False
    hasChangelog: bool = False
    hasApiDocs: bool = False
    hasWiki: bool = False
    sectionCoverage: list[SectionCoverage] = []
    suggestions: list[str] = []
    readmeLevels: ReadmeLevelScores | None = None


class HealthMetrics(BaseModel):
    overall: float = 0
    stars: int = 0
    forks: int = 0
    openIssues: int = 0
    issuesPerStar: float = 0
    lastCommitDays: int = 999
    hasRecentActivity: bool = False
    contributorCount: int = 0
    busFactor: int = 0
    releaseCount: int = 0
    hasCI: bool = False
    hasTests: bool = False


class QualityScores(BaseModel):
    overall: float = 0
    codeQuality: float = 0
    documentation: float = 0
    maintainability: float = 0
    communityHealth: float = 0
    security: float = 0
    breakdown: dict[str, dict[str, Any]] | None = None


class CodeSmell(BaseModel):
    severity: str
    category: str
    title: str
    description: str
    location: str | None = None


class AnalysisMethod(BaseModel):
    cloneMethod: str = 'none'
    apiData: str = 'full'
    aiProvider: str = 'localai'
    confidence: float = 1.0


class ProjectCompleteness(BaseModel):
    hasReadme: bool = False
    hasSourceCode: bool = False
    hasConfig: bool = False
    hasTests: bool = False
    hasLicense: bool = False
    hasDeployment: bool = False
    percentage: float = 0


class AdvancedSignals(BaseModel):
    personality: str = 'Library'
    completeness: ProjectCompleteness = ProjectCompleteness()
    onboardingDifficulty: str = 'Medium'
    abandonmentRisk: str = 'Low Risk'
    configComplexity: dict[str, Any] = {'count': 0, 'level': 'Easy'}
    docCoverage: dict[str, Any] = {'percentage': 0, 'level': 'Low'}
    contributorFriendliness: str = 'Medium'
    securityMaturity: str = 'Beginner'
    deploymentReadiness: str = 'Medium'
    learningValue: float = 0
    readmeCodeConsistency: float = 0
    techDebtIndicators: dict[str, Any] = {'total': 0, 'level': 'Low'}
    maintainabilityIndex: str = 'Moderate'


class ProcessedReadme(BaseModel):
    cleanText: str = ''
    overview: str = ''
    features: list[str] = []
    headings: list[dict[str, Any]] = []
    hasInstallSection: bool = False
    hasUsageSection: bool = False
    hasApiSection: bool = False
    difficulty: str = 'Intermediate'
    techKeywords: list[str] = []


class RepoInfo(BaseModel):
    id: str = ''
    url: str = ''
    owner: str = ''
    name: str = ''
    description: str | None = None
    defaultBranch: str = 'main'
    stars: int = 0
    forks: int = 0
    openIssues: int = 0
    watchers: int = 0
    topics: list[str] = []
    license: str | None = None
    createdAt: str = ''
    updatedAt: str = ''
    pushedAt: str = ''
    size: int = 0
    languages: dict[str, int] = {}
    contributors: list[Contributor] = []
    readmeContent: str = ''
    fileTree: list[FileNode] = []
    dependencyFiles: dict[str, str] = {}


class AIAnalysisInput(BaseModel):
    readme: str = ''
    languages: dict[str, int] = {}
    fileTree: list[FileNode] = []
    dependencyFiles: dict[str, str] = {}
    topics: list[str] = []
    description: str | None = None
    stars: int | None = None
    forks: int | None = None
    contributorCount: int | None = None
    pushedAt: str | None = None


class AIAnalysisResult(BaseModel):
    summary: str = ''
    techStack: TechStack = TechStack()
    architecture: str = ''
    codeSmells: list[CodeSmell] = []
    suggestions: list[str] = []
    onboardingGuide: str = ''
    qualityScores: QualityScores = QualityScores()


class AnalysisReport(BaseModel):
    id: str = ''
    repoUrl: str = ''
    repoName: str = ''
    owner: str = ''
    topics: list[str] = []
    summary: str = ''
    techStack: TechStack = TechStack()
    architecture: str = ''
    complexity: ComplexityMetrics = ComplexityMetrics()
    docsQuality: DocsQuality = DocsQuality()
    health: HealthMetrics = HealthMetrics()
    codeSmells: list[CodeSmell] = []
    suggestions: list[str] = []
    onboardingGuide: str = ''
    qualityScores: QualityScores = QualityScores()
    fileTree: list[FileNode] = []
    generatedAt: str = ''
    status: str = 'pending'
    error: str | None = None
    analysisSource: str | None = None
    analysisMethod: AnalysisMethod | None = None
    outlierAlerts: list[str] | None = None
    advancedSignals: AdvancedSignals | None = None
    processedReadme: ProcessedReadme | None = None
