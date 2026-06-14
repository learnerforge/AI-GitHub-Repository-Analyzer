import { computeQualityScores, ScorerParams, getDefaultParams } from '../src/models/qualityScorer'

interface SyntheticReport {
  report: any
  file: string
  issues: string[]
}

interface Experience {
  state: any
  action: { paramName: string; delta: number }
  reward: number
  nextState: any
  timestamp: number
  weight?: number
}

const WEIGHT_DELTAS = [0.05, -0.05, 0.1, -0.1]
const PARAM_NAMES = ['codeQualityWeight', 'docsWeight', 'maintainabilityWeight', 'communityWeight', 'securityWeight'] as const

function extractState(report: any): any {
  const sectionCoverage = report.docsQuality?.sectionCoverage || []
  return {
    repoStars: report.health?.stars || 0,
    repoForks: report.health?.forks || 0,
    fileCount: report.complexity?.fileCount || 0,
    languageCount: (report.techStack?.languages || []).length,
    readmeLength: report.docsQuality?.readmeLength || 0,
    contributorCount: report.health?.contributorCount || 0,
    hasTests: report.health?.hasTests || false,
    hasCI: report.health?.hasCI || false,
    readmeScore: report.docsQuality?.readmeScore || 0,
    docsSectionCount: sectionCoverage.filter((s: any) => s.present).length,
    hasApiDocs: report.docsQuality?.hasApiDocs || false,
    hasLicense: report.docsQuality?.hasLicense || false,
    lastCommitDays: report.health?.lastCommitDays ?? 30,
    hasDockerfile: report.health?.hasDockerfile || false,
    hasContributing: report.docsQuality?.hasContributing || false,
    headingCount: report.docsQuality?.headingCount ?? 0,
    codeBlockCount: report.docsQuality?.codeBlockCount ?? 0,
    imageCount: report.docsQuality?.imageCount ?? 0,
    badgeCount: report.docsQuality?.badgeCount ?? 0,
    emojiCount: report.docsQuality?.emojiCount ?? 0,
    tableCount: report.docsQuality?.tableCount ?? 0,
    checklistCount: report.docsQuality?.checklistCount ?? 0,
    linkCount: report.docsQuality?.linkCount ?? 0,
    todoCount: report.docsQuality?.todoCount ?? 0,
    fixmeCount: report.docsQuality?.fixmeCount ?? 0,
    hackCount: report.docsQuality?.hackCount ?? 0,
    tempCount: report.docsQuality?.tempCount ?? 0,
  }
}

export function getStateKey(s: any): string {
  function q(v: number, u: number) { return Math.round(v / u) }
  return [
    q(s.repoStars, 1000), q(s.repoForks, 100), q(s.fileCount, 100),
    s.languageCount, q(s.readmeLength, 1000), q(s.contributorCount, 5),
    s.hasTests ? 1 : 0, s.hasCI ? 1 : 0, q(s.readmeScore, 20),
    s.docsSectionCount, s.hasApiDocs ? 1 : 0, s.hasLicense ? 1 : 0,
    q(s.lastCommitDays, 90), s.hasDockerfile ? 1 : 0, s.hasContributing ? 1 : 0,
    s.headingCount === 0 ? 0 : s.headingCount <= 3 ? 1 : s.headingCount <= 10 ? 2 : 3,
    s.codeBlockCount === 0 ? 0 : s.codeBlockCount <= 3 ? 1 : s.codeBlockCount <= 10 ? 2 : 3,
    s.imageCount === 0 ? 0 : s.imageCount <= 3 ? 1 : 2,
    s.badgeCount === 0 ? 0 : s.badgeCount <= 3 ? 1 : 2,
    s.emojiCount === 0 ? 0 : s.emojiCount <= 5 ? 1 : 2,
    s.tableCount === 0 ? 0 : s.tableCount <= 3 ? 1 : 2,
    s.checklistCount === 0 ? 0 : s.checklistCount <= 3 ? 1 : 2,
    s.linkCount === 0 ? 0 : s.linkCount <= 5 ? 1 : s.linkCount <= 20 ? 2 : 3,
    s.todoCount === 0 ? 0 : s.todoCount <= 5 ? 1 : 2,
    s.fixmeCount === 0 ? 0 : s.fixmeCount <= 3 ? 1 : 2,
    s.hackCount === 0 ? 0 : 1,
    s.tempCount === 0 ? 0 : 1,
  ].join(':')
}

function computeReward(score: number, report: any, action: { paramName: string; delta: number }): number {
  const state = extractState(report)
  const base = (score - 50) / 50
  let bonus = 0
  if (action.paramName === 'communityWeight' && state.repoStars > 1000) bonus += 0.2
  if (action.paramName === 'docsWeight' && state.readmeScore > 60) bonus += 0.25
  if (action.paramName === 'docsWeight' && state.docsSectionCount >= 6) bonus += 0.15
  if (action.paramName === 'codeQualityWeight' && state.hasTests) bonus += 0.2
  if (action.paramName === 'securityWeight' && (state.hasCI || state.hasTests)) bonus += 0.15
  if (action.paramName === 'maintainabilityWeight' && state.fileCount < 100) bonus += 0.15
  if (action.delta > 0) bonus += 0.05
  else bonus -= 0.05
  return Math.max(-1, Math.min(1, base + bonus))
}

function computeQualityScore(report: any, params: ScorerParams): number {
  const langMap: Record<string, number> = {}
  for (const lang of (report.techStack?.languages || [])) {
    langMap[lang.name] = lang.bytes || 1000
  }
  const repo = {
    id: report.id || '', url: report.repoUrl || '',
    owner: report.owner || '', name: report.repoName || '',
    description: '', defaultBranch: 'main',
    stars: report.health?.stars || 0,
    forks: report.health?.forks || 0,
    openIssues: report.health?.openIssues || 0,
    watchers: 0, topics: [], license: null,
    createdAt: '', updatedAt: '', pushedAt: '', size: 0,
    languages: langMap, contributors: [],
    readmeContent: '',
    fileTree: report.fileTree || [],
    dependencyFiles: report.complexity?.dependencyFiles || {},
  }
  return computeQualityScores(repo as any, report.complexity, report.docsQuality, report.health, params).overall
}

function makeSection(present: boolean) {
  return { section: '', present }
}

// ---------------------------------------------------------------------------
// 12 Edge Case Scenarios
// ---------------------------------------------------------------------------

function edgeCase1_noReadme(): SyntheticReport {
  return {
    file: 'EDGE-01-no-readme',
    issues: [],
    report: {
      id: 'edge/no-readme', repoUrl: 'https://github.com/edge/no-readme', repoName: 'no-readme', owner: 'edge',
      health: { stars: 500, forks: 50, contributorCount: 5, hasTests: true, hasCI: true, lastCommitDays: 10, hasDockerfile: true, openIssues: 10 },
      complexity: { fileCount: 50, totalLines: 10000, averageFileSize: 200, deepestNesting: 4, languageBreakdown: [], dependencyFiles: { 'package.json': '{}' } },
      docsQuality: { readmeLength: 0, readmeScore: 0, sectionCoverage: [], hasReadme: false, hasContributing: false, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 0, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'TypeScript', percentage: 60, bytes: 6000 }, { name: 'JavaScript', percentage: 40, bytes: 4000 }], frameworks: ['React'], databases: [], tools: ['npm'], infrastructure: [] },
      fileTree: [{ name: 'src', type: 'tree', path: 'src', children: [{ name: 'index.ts', type: 'blob', path: 'src/index.ts', size: 500 }] }, { name: '.github', type: 'tree', path: '.github', children: [{ name: 'workflows', type: 'tree', path: '.github/workflows', children: [{ name: 'ci.yml', type: 'blob', path: '.github/workflows/ci.yml', size: 100 }] }] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase2_readmeOnly(): SyntheticReport {
  return {
    file: 'EDGE-02-readme-only',
    issues: [],
    report: {
      id: 'edge/readme-only', repoUrl: 'https://github.com/edge/readme-only', repoName: 'readme-only', owner: 'edge',
      health: { stars: 100, forks: 10, contributorCount: 1, hasTests: false, hasCI: false, lastCommitDays: 30, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 1, totalLines: 5200, averageFileSize: 5200, deepestNesting: 0, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 5200, readmeScore: 85, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'API Documentation', present: true }, { section: 'Configuration', present: true }, { section: 'Contributing', present: true }, { section: 'License', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: true, hasLicense: true, hasChangelog: true, hasApiDocs: true, hasWiki: false, headingCount: 12, codeBlockCount: 8, imageCount: 3, badgeCount: 5, emojiCount: 2, tableCount: 1, checklistCount: 0, linkCount: 15, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'README.md', type: 'blob', path: 'README.md', size: 5200 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase3_abandoned(): SyntheticReport {
  return {
    file: 'EDGE-03-abandoned',
    issues: [],
    report: {
      id: 'edge/abandoned', repoUrl: 'https://github.com/edge/abandoned', repoName: 'abandoned', owner: 'edge',
      health: { stars: 15000, forks: 3000, contributorCount: 50, hasTests: true, hasCI: false, lastCommitDays: 1825, hasDockerfile: false, openIssues: 500 },
      complexity: { fileCount: 200, totalLines: 50000, averageFileSize: 250, deepestNesting: 6, languageBreakdown: [], dependencyFiles: { 'Cargo.toml': '[package]' } },
      docsQuality: { readmeLength: 2000, readmeScore: 70, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 6, codeBlockCount: 4, imageCount: 1, badgeCount: 3, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 8, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Rust', percentage: 100, bytes: 50000 }], frameworks: [], databases: [], tools: ['cargo'], infrastructure: [] },
      fileTree: [{ name: 'src', type: 'tree', path: 'src', children: [{ name: 'main.rs', type: 'blob', path: 'src/main.rs', size: 1000 }] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase4_fork(): SyntheticReport {
  return {
    file: 'EDGE-04-fork',
    issues: [],
    report: {
      id: 'edge/fork', repoUrl: 'https://github.com/edge/fork', repoName: 'fork', owner: 'edge',
      health: { stars: 8000, forks: 2, contributorCount: 1, hasTests: false, hasCI: false, lastCommitDays: 400, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 10, totalLines: 500, averageFileSize: 50, deepestNesting: 2, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 100, readmeScore: 20, sectionCoverage: [], hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 1, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 1, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Python', percentage: 100, bytes: 500 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'fork.py', type: 'blob', path: 'fork.py', size: 500 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase5_generatedCode(): SyntheticReport {
  return {
    file: 'EDGE-05-generated-code',
    issues: [],
    report: {
      id: 'edge/generated-code', repoUrl: 'https://github.com/edge/generated-code', repoName: 'generated-code', owner: 'edge',
      health: { stars: 10, forks: 0, contributorCount: 1, hasTests: false, hasCI: false, lastCommitDays: 5, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 60000, totalLines: 3000000, averageFileSize: 50, deepestNesting: 3, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 200, readmeScore: 30, sectionCoverage: [{ section: 'Description', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 2, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 5, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'JavaScript', percentage: 100, bytes: 3000000 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'dist', type: 'tree', path: 'dist', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase6_dsa(): SyntheticReport {
  return {
    file: 'EDGE-06-dsa',
    issues: [],
    report: {
      id: 'edge/dsa', repoUrl: 'https://github.com/edge/dsa', repoName: 'dsa', owner: 'edge',
      health: { stars: 50000, forks: 15000, contributorCount: 200, hasTests: false, hasCI: false, lastCommitDays: 60, hasDockerfile: false, openIssues: 100 },
      complexity: { fileCount: 2000, totalLines: 80000, averageFileSize: 40, deepestNesting: 5, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 3000, readmeScore: 75, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'Contributing', present: true }, { section: 'License', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 8, codeBlockCount: 2000, imageCount: 0, badgeCount: 2, emojiCount: 0, tableCount: 1, checklistCount: 0, linkCount: 5, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Python', percentage: 80, bytes: 64000 }, { name: 'C++', percentage: 20, bytes: 16000 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'algorithms', type: 'tree', path: 'algorithms', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase7_dataset(): SyntheticReport {
  return {
    file: 'EDGE-07-dataset',
    issues: [],
    report: {
      id: 'edge/dataset', repoUrl: 'https://github.com/edge/dataset', repoName: 'dataset', owner: 'edge',
      health: { stars: 2000, forks: 500, contributorCount: 10, hasTests: false, hasCI: false, lastCommitDays: 200, hasDockerfile: false, openIssues: 5 },
      complexity: { fileCount: 150, totalLines: 5000000, averageFileSize: 33333, deepestNesting: 1, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 1500, readmeScore: 60, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Usage', present: true }, { section: 'License', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 4, codeBlockCount: 1, imageCount: 0, badgeCount: 1, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 2, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'data.csv', type: 'blob', path: 'data.csv', size: 5000000 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase8_research(): SyntheticReport {
  return {
    file: 'EDGE-08-research',
    issues: [],
    report: {
      id: 'edge/research', repoUrl: 'https://github.com/edge/research', repoName: 'research', owner: 'edge',
      health: { stars: 3000, forks: 800, contributorCount: 15, hasTests: false, hasCI: false, lastCommitDays: 30, hasDockerfile: false, openIssues: 20 },
      complexity: { fileCount: 20, totalLines: 5000, averageFileSize: 250, deepestNesting: 2, languageBreakdown: [], dependencyFiles: { 'requirements.txt': 'torch\nnumpy' } },
      docsQuality: { readmeLength: 4000, readmeScore: 80, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'API Documentation', present: true }, { section: 'Contributing', present: true }, { section: 'License', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: true, hasWiki: false, headingCount: 10, codeBlockCount: 6, imageCount: 4, badgeCount: 2, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 10, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Python', percentage: 100, bytes: 5000 }], frameworks: ['PyTorch'], databases: [], tools: ['jupyter'], infrastructure: [] },
      fileTree: [{ name: 'paper.pdf', type: 'blob', path: 'paper.pdf', size: 200000 }, { name: 'notebooks', type: 'tree', path: 'notebooks', children: [{ name: 'experiment.ipynb', type: 'blob', path: 'notebooks/experiment.ipynb', size: 50000 }] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase9_monorepo(): SyntheticReport {
  return {
    file: 'EDGE-09-monorepo',
    issues: [],
    report: {
      id: 'edge/monorepo', repoUrl: 'https://github.com/edge/monorepo', repoName: 'monorepo', owner: 'edge',
      health: { stars: 8000, forks: 2000, contributorCount: 100, hasTests: true, hasCI: true, lastCommitDays: 1, hasDockerfile: true, openIssues: 200 },
      complexity: { fileCount: 5000, totalLines: 500000, averageFileSize: 100, deepestNesting: 8, languageBreakdown: [], dependencyFiles: { 'package.json': '{}', 'Cargo.toml': '[package]', 'Gemfile': 'source' } },
      docsQuality: { readmeLength: 5000, readmeScore: 85, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'API Documentation', present: true }, { section: 'Configuration', present: true }, { section: 'Contributing', present: true }, { section: 'License', present: true }, { section: 'Tests', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: true, hasLicense: true, hasChangelog: true, hasApiDocs: true, hasWiki: false, headingCount: 15, codeBlockCount: 10, imageCount: 2, badgeCount: 8, emojiCount: 1, tableCount: 2, checklistCount: 0, linkCount: 20, todoCount: 10, fixmeCount: 2, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'TypeScript', percentage: 40, bytes: 200000 }, { name: 'Rust', percentage: 30, bytes: 150000 }, { name: 'Python', percentage: 20, bytes: 100000 }, { name: 'Go', percentage: 10, bytes: 50000 }], frameworks: ['React', 'FastAPI'], databases: ['PostgreSQL'], tools: ['docker', 'npm'], infrastructure: ['Docker'] },
      fileTree: [{ name: 'packages', type: 'tree', path: 'packages', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase10_singleFile(): SyntheticReport {
  return {
    file: 'EDGE-10-single-file',
    issues: [],
    report: {
      id: 'edge/single-file', repoUrl: 'https://github.com/edge/single-file', repoName: 'single-file', owner: 'edge',
      health: { stars: 10000, forks: 2000, contributorCount: 30, hasTests: false, hasCI: false, lastCommitDays: 5, hasDockerfile: false, openIssues: 10 },
      complexity: { fileCount: 1, totalLines: 500, averageFileSize: 500, deepestNesting: 0, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 800, readmeScore: 60, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Usage', present: true }, { section: 'License', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 3, codeBlockCount: 2, imageCount: 0, badgeCount: 1, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 2, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Rust', percentage: 100, bytes: 500 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'main.rs', type: 'blob', path: 'main.rs', size: 500 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase11_configNightmare(): SyntheticReport {
  return {
    file: 'EDGE-11-config-nightmare',
    issues: [],
    report: {
      id: 'edge/config-nightmare', repoUrl: 'https://github.com/edge/config-nightmare', repoName: 'config-nightmare', owner: 'edge',
      health: { stars: 100, forks: 20, contributorCount: 3, hasTests: false, hasCI: false, lastCommitDays: 100, hasDockerfile: true, openIssues: 50 },
      complexity: { fileCount: 80, totalLines: 15000, averageFileSize: 187, deepestNesting: 4, languageBreakdown: [], dependencyFiles: { 'package.json': '{}', '.env.example': 'DATABASE_URL=\nAPI_KEY=\nSECRET=\n' } },
      docsQuality: { readmeLength: 3000, readmeScore: 65, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Configuration', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 5, codeBlockCount: 3, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 3, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'JavaScript', percentage: 100, bytes: 15000 }], frameworks: ['Express'], databases: ['MySQL', 'Redis', 'MongoDB'], tools: ['docker'], infrastructure: ['Docker'] },
      fileTree: [{ name: 'config', type: 'tree', path: 'config', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function edgeCase12_securityIssues(): SyntheticReport {
  return {
    file: 'EDGE-12-security-issues',
    issues: [],
    report: {
      id: 'edge/security-issues', repoUrl: 'https://github.com/edge/security-issues', repoName: 'security-issues', owner: 'edge',
      health: { stars: 50, forks: 5, contributorCount: 2, hasTests: false, hasCI: false, lastCommitDays: 200, hasDockerfile: false, openIssues: 5 },
      complexity: { fileCount: 20, totalLines: 4000, averageFileSize: 200, deepestNesting: 3, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 100, readmeScore: 20, sectionCoverage: [], hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 1, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 0, fixmeCount: 3, hackCount: 2, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Python', percentage: 100, bytes: 4000 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'app.py', type: 'blob', path: 'app.py', size: 2000 }, { name: '.env', type: 'blob', path: '.env', size: 100 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

// ---------------------------------------------------------------------------
// 10 Synthetic Test Repos
// ---------------------------------------------------------------------------

function synthetic_emptyRepo(): SyntheticReport {
  return {
    file: 'SYNTH-01-empty-repo',
    issues: [],
    report: {
      id: 'synth/empty-repo', repoUrl: 'https://github.com/synth/empty-repo', repoName: 'empty-repo', owner: 'synth',
      health: { stars: 0, forks: 0, contributorCount: 1, hasTests: false, hasCI: false, lastCommitDays: 0, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 0, totalLines: 0, averageFileSize: 0, deepestNesting: 0, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 0, readmeScore: 0, sectionCoverage: [], hasReadme: false, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 0, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [],
      analysisMethod: { cloneMethod: 'full', apiData: 'none', aiProvider: 'localai', confidence: 50 },
    },
  }
}

function synthetic_hugeReadmeSmallCode(): SyntheticReport {
  return {
    file: 'SYNTH-02-huge-readme-small-code',
    issues: [],
    report: {
      id: 'synth/huge-readme-small-code', repoUrl: 'https://github.com/synth/huge-readme-small-code', repoName: 'huge-readme-small-code', owner: 'synth',
      health: { stars: 500, forks: 100, contributorCount: 5, hasTests: false, hasCI: false, lastCommitDays: 30, hasDockerfile: false, openIssues: 2 },
      complexity: { fileCount: 10, totalLines: 300, averageFileSize: 30, deepestNesting: 1, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 10000, readmeScore: 90, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'API Documentation', present: true }, { section: 'Configuration', present: true }, { section: 'Contributing', present: true }, { section: 'License', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: true, hasLicense: true, hasChangelog: true, hasApiDocs: true, hasWiki: false, headingCount: 20, codeBlockCount: 15, imageCount: 5, badgeCount: 10, emojiCount: 3, tableCount: 2, checklistCount: 1, linkCount: 25, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Python', percentage: 100, bytes: 300 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'main.py', type: 'blob', path: 'main.py', size: 100 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function synthetic_greatCodeNoReadme(): SyntheticReport {
  return {
    file: 'SYNTH-03-great-code-no-readme',
    issues: [],
    report: {
      id: 'synth/great-code-no-readme', repoUrl: 'https://github.com/synth/great-code-no-readme', repoName: 'great-code-no-readme', owner: 'synth',
      health: { stars: 5000, forks: 1000, contributorCount: 20, hasTests: true, hasCI: true, lastCommitDays: 5, hasDockerfile: true, openIssues: 30 },
      complexity: { fileCount: 200, totalLines: 50000, averageFileSize: 250, deepestNesting: 5, languageBreakdown: [], dependencyFiles: { 'Cargo.toml': '[package]', 'package.json': '{}' } },
      docsQuality: { readmeLength: 0, readmeScore: 0, sectionCoverage: [], hasReadme: false, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 0, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Rust', percentage: 60, bytes: 30000 }, { name: 'TypeScript', percentage: 40, bytes: 20000 }], frameworks: [], databases: [], tools: ['cargo', 'npm'], infrastructure: [] },
      fileTree: [{ name: 'src', type: 'tree', path: 'src', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function synthetic_brokenLicense(): SyntheticReport {
  return {
    file: 'SYNTH-04-broken-license',
    issues: [],
    report: {
      id: 'synth/broken-license', repoUrl: 'https://github.com/synth/broken-license', repoName: 'broken-license', owner: 'synth',
      health: { stars: 100, forks: 20, contributorCount: 5, hasTests: true, hasCI: true, lastCommitDays: 10, hasDockerfile: false, openIssues: 5 },
      complexity: { fileCount: 30, totalLines: 6000, averageFileSize: 200, deepestNesting: 3, languageBreakdown: [], dependencyFiles: { 'package.json': '{}' } },
      docsQuality: { readmeLength: 500, readmeScore: 40, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Usage', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 2, codeBlockCount: 1, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 1, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'JavaScript', percentage: 100, bytes: 6000 }], frameworks: [], databases: [], tools: ['npm'], infrastructure: [] },
      fileTree: [{ name: 'src', type: 'tree', path: 'src', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function synthetic_testlessEnterprise(): SyntheticReport {
  return {
    file: 'SYNTH-05-testless-enterprise',
    issues: [],
    report: {
      id: 'synth/testless-enterprise', repoUrl: 'https://github.com/synth/testless-enterprise', repoName: 'testless-enterprise', owner: 'synth',
      health: { stars: 50, forks: 5, contributorCount: 10, hasTests: false, hasCI: true, lastCommitDays: 2, hasDockerfile: true, openIssues: 100 },
      complexity: { fileCount: 2000, totalLines: 200000, averageFileSize: 100, deepestNesting: 7, languageBreakdown: [], dependencyFiles: { 'pom.xml': '<project>', 'Dockerfile': 'FROM java' } },
      docsQuality: { readmeLength: 2000, readmeScore: 60, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'Configuration', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 5, codeBlockCount: 3, imageCount: 0, badgeCount: 2, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 5, todoCount: 15, fixmeCount: 5, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Java', percentage: 100, bytes: 200000 }], frameworks: ['Spring'], databases: ['Oracle'], tools: ['maven', 'docker'], infrastructure: ['Docker'] },
      fileTree: [{ name: 'src', type: 'tree', path: 'src', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function synthetic_fakeStartup(): SyntheticReport {
  return {
    file: 'SYNTH-06-fake-startup',
    issues: [],
    report: {
      id: 'synth/fake-startup', repoUrl: 'https://github.com/synth/fake-startup', repoName: 'fake-startup', owner: 'synth',
      health: { stars: 5, forks: 0, contributorCount: 1, hasTests: false, hasCI: false, lastCommitDays: 3, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 5, totalLines: 200, averageFileSize: 40, deepestNesting: 1, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 8000, readmeScore: 85, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }, { section: 'API Documentation', present: true }, { section: 'Configuration', present: true }, { section: 'Contributing', present: true }, { section: 'License', present: true }, { section: 'Changelog', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: true, hasCodeOfConduct: true, hasLicense: true, hasChangelog: true, hasApiDocs: true, hasWiki: false, headingCount: 18, codeBlockCount: 12, imageCount: 8, badgeCount: 15, emojiCount: 5, tableCount: 3, checklistCount: 2, linkCount: 30, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'JavaScript', percentage: 100, bytes: 200 }], frameworks: ['React'], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'index.js', type: 'blob', path: 'index.js', size: 100 }],
      analysisMethod: { cloneMethod: 'full', apiData: 'none', aiProvider: 'localai', confidence: 55 },
    },
  }
}

function synthetic_datasetOnly(): SyntheticReport {
  return {
    file: 'SYNTH-07-dataset-only',
    issues: [],
    report: {
      id: 'synth/dataset-only', repoUrl: 'https://github.com/synth/dataset-only', repoName: 'dataset-only', owner: 'synth',
      health: { stars: 100, forks: 30, contributorCount: 3, hasTests: false, hasCI: false, lastCommitDays: 365, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 50, totalLines: 1000000, averageFileSize: 20000, deepestNesting: 1, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 500, readmeScore: 30, sectionCoverage: [{ section: 'Description', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 2, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'data', type: 'tree', path: 'data', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function synthetic_archiveRepo(): SyntheticReport {
  return {
    file: 'SYNTH-08-archive-repo',
    issues: [],
    report: {
      id: 'synth/archive-repo', repoUrl: 'https://github.com/synth/archive-repo', repoName: 'archive-repo', owner: 'synth',
      health: { stars: 200, forks: 50, contributorCount: 5, hasTests: true, hasCI: false, lastCommitDays: 1500, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 100, totalLines: 20000, averageFileSize: 200, deepestNesting: 4, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 1000, readmeScore: 50, sectionCoverage: [{ section: 'Description', present: true }, { section: 'Installation', present: true }, { section: 'Usage', present: true }].map(s => ({ ...s, section: '' })), hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: true, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 3, codeBlockCount: 2, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 2, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0, suggestions: [] },
      techStack: { languages: [{ name: 'Python', percentage: 100, bytes: 20000 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'src', type: 'tree', path: 'src', children: [] }],
      analysisMethod: { cloneMethod: 'full', apiData: 'full', aiProvider: 'localai', confidence: 100 },
    },
  }
}

function synthetic_generatedCode(): SyntheticReport {
  return {
    file: 'SYNTH-09-generated-code-repo',
    issues: [],
    report: {
      id: 'synth/generated-code-repo', repoUrl: 'https://github.com/synth/generated-code-repo', repoName: 'generated-code-repo', owner: 'synth',
      health: { stars: 3, forks: 0, contributorCount: 1, hasTests: false, hasCI: false, lastCommitDays: 1, hasDockerfile: false, openIssues: 0 },
      complexity: { fileCount: 5000, totalLines: 500000, averageFileSize: 100, deepestNesting: 2, languageBreakdown: [], dependencyFiles: {} },
      docsQuality: { readmeLength: 100, readmeScore: 15, sectionCoverage: [], hasReadme: true, hasContributing: false, hasCodeOfConduct: false, hasLicense: false, hasChangelog: false, hasApiDocs: false, hasWiki: false, headingCount: 1, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 20, fixmeCount: 5, hackCount: 3, tempCount: 10, suggestions: [] },
      techStack: { languages: [{ name: 'JavaScript', percentage: 100, bytes: 500000 }], frameworks: [], databases: [], tools: [], infrastructure: [] },
      fileTree: [{ name: 'build', type: 'tree', path: 'build', children: [] }],
      analysisMethod: { cloneMethod: 'partial', apiData: 'none', aiProvider: 'localai', confidence: 40 },
    },
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const ALL_SYNTHETIC: (() => SyntheticReport)[] = [
  edgeCase1_noReadme, edgeCase2_readmeOnly, edgeCase3_abandoned,
  edgeCase4_fork, edgeCase5_generatedCode, edgeCase6_dsa,
  edgeCase7_dataset, edgeCase8_research, edgeCase9_monorepo,
  edgeCase10_singleFile, edgeCase11_configNightmare, edgeCase12_securityIssues,
  synthetic_emptyRepo, synthetic_hugeReadmeSmallCode,
  synthetic_greatCodeNoReadme, synthetic_brokenLicense,
  synthetic_testlessEnterprise, synthetic_fakeStartup,
  synthetic_datasetOnly, synthetic_archiveRepo, synthetic_generatedCode,
]

export interface EdgeCaseMeta {
  name: string
  file: string
  description: string
  expectedWeakness: string
  idealWeightAdjustment: { paramName: string; delta: number } | null
}

export const EDGE_CASE_METAS: EdgeCaseMeta[] = [
  { name: 'No README', file: 'EDGE-01-no-readme', description: 'Great code but no documentation', expectedWeakness: 'Model gives near-zero score for missing docs', idealWeightAdjustment: { paramName: 'docsWeight', delta: 0.1 } },
  { name: 'README Only', file: 'EDGE-02-readme-only', description: 'Documentation repository with no source code', expectedWeakness: 'Model thinks repo is software', idealWeightAdjustment: { paramName: 'docsWeight', delta: 0.1 } },
  { name: 'Abandoned', file: 'EDGE-03-abandoned', description: 'High stars but no commits in 5 years', expectedWeakness: 'Community score dominates despite abandonment', idealWeightAdjustment: { paramName: 'communityWeight', delta: -0.05 } },
  { name: 'Fork', file: 'EDGE-04-fork', description: 'Inherited stars with no original contribution', expectedWeakness: 'Analyzer assumes original popularity', idealWeightAdjustment: { paramName: 'communityWeight', delta: -0.05 } },
  { name: 'Generated Code', file: 'EDGE-05-generated-code', description: 'Thousands of autogenerated files', expectedWeakness: 'File count interpreted as quality', idealWeightAdjustment: { paramName: 'maintainabilityWeight', delta: -0.05 } },
  { name: 'DSA Repository', file: 'EDGE-06-dsa', description: '2000 algorithms with no CI/tests', expectedWeakness: 'Enterprise metrics destroy score', idealWeightAdjustment: { paramName: 'codeQualityWeight', delta: 0.05 } },
  { name: 'Dataset', file: 'EDGE-07-dataset', description: 'Mostly CSV/data files', expectedWeakness: 'Analyzer expects code', idealWeightAdjustment: null },
  { name: 'Research', file: 'EDGE-08-research', description: 'Paper + notebooks, no tests', expectedWeakness: 'Missing tests penalized heavily', idealWeightAdjustment: { paramName: 'docsWeight', delta: 0.1 } },
  { name: 'Monorepo', file: 'EDGE-09-monorepo', description: 'Frontend + Backend + Mobile', expectedWeakness: 'Wrong complexity calculation', idealWeightAdjustment: { paramName: 'maintainabilityWeight', delta: -0.05 } },
  { name: 'Single File', file: 'EDGE-10-single-file', description: 'Useful software in one file', expectedWeakness: 'Low file count = low score', idealWeightAdjustment: { paramName: 'maintainabilityWeight', delta: 0.1 } },
  { name: 'Config Nightmare', file: 'EDGE-11-config-nightmare', description: '50+ env variables, complex setup', expectedWeakness: 'No complexity penalty for config', idealWeightAdjustment: { paramName: 'securityWeight', delta: 0.05 } },
  { name: 'Security Issues', file: 'EDGE-12-security-issues', description: 'Hardcoded secrets and credentials', expectedWeakness: 'Security score remains high', idealWeightAdjustment: { paramName: 'securityWeight', delta: 0.05 } },
  { name: 'Empty Repo', file: 'SYNTH-01-empty-repo', description: 'No files at all', expectedWeakness: 'Zero-file edge case breaks scoring', idealWeightAdjustment: null },
  { name: 'Huge README Small Code', file: 'SYNTH-02-huge-readme-small-code', description: '5000-word README, 10 LOC', expectedWeakness: 'Overweighted docs', idealWeightAdjustment: { paramName: 'docsWeight', delta: -0.05 } },
  { name: 'Great Code No README', file: 'SYNTH-03-great-code-no-readme', description: '10k LOC well-structured, no documentation', expectedWeakness: 'Code ignored due to missing docs', idealWeightAdjustment: { paramName: 'codeQualityWeight', delta: 0.1 } },
  { name: 'Broken License', file: 'SYNTH-04-broken-license', description: 'No license file', expectedWeakness: 'Missing license severely penalized', idealWeightAdjustment: { paramName: 'communityWeight', delta: 0.05 } },
  { name: 'Testless Enterprise', file: 'SYNTH-05-testless-enterprise', description: 'Large project with CI but no tests', expectedWeakness: 'CI presence masks test absence', idealWeightAdjustment: { paramName: 'codeQualityWeight', delta: 0.05 } },
  { name: 'Fake Startup', file: 'SYNTH-06-fake-startup', description: 'Marketing README with almost no code', expectedWeakness: 'Docs score inflated, code ignored', idealWeightAdjustment: { paramName: 'docsWeight', delta: -0.1 } },
  { name: 'Dataset Only', file: 'SYNTH-07-dataset-only', description: 'CSV files only, no code', expectedWeakness: 'Analyzer expects programming languages', idealWeightAdjustment: null },
  { name: 'Archive Repo', file: 'SYNTH-08-archive-repo', description: 'No commits in years', expectedWeakness: 'Activity metric dominates', idealWeightAdjustment: { paramName: 'communityWeight', delta: -0.05 } },
  { name: 'Generated Code Repo', file: 'SYNTH-09-generated-code-repo', description: 'Autogenerated build files', expectedWeakness: 'File count interpreted as substance', idealWeightAdjustment: { paramName: 'maintainabilityWeight', delta: -0.05 } },
]

export function generateSyntheticReports(): SyntheticReport[] {
  return ALL_SYNTHETIC.map(fn => fn())
}

export function generateSyntheticExperiences(
  existingStateKeys: Set<string>
): { experiences: Experience[]; added: number; skipped: number } {
  const experiences: Experience[] = []
  const defaultParams = getDefaultParams()
  const paramNames = ['codeQualityWeight', 'docsWeight', 'maintainabilityWeight', 'communityWeight', 'securityWeight'] as const
  let added = 0
  let skipped = 0

  for (const { report } of generateSyntheticReports()) {
    const state = extractState(report)
    const stateKey = getStateKey(state)
    if (existingStateKeys.has(stateKey)) { skipped++; continue }
    existingStateKeys.add(stateKey)

    const baselineScore = computeQualityScore(report, defaultParams)

    for (const paramName of paramNames) {
      for (const delta of WEIGHT_DELTAS) {
        const trialParams: ScorerParams = { ...defaultParams }
        let newVal = (trialParams[paramName as keyof ScorerParams] as number) + delta
        newVal = Math.max(0, Math.min(1, newVal))
        ;(trialParams as any)[paramName] = newVal

        const trialScore = computeQualityScore(report, trialParams)
        const scoreDelta = trialScore - baselineScore
        if (Math.abs(scoreDelta) < 0.5) continue

        const reward = computeReward(trialScore, report, { paramName, delta })
        const nextState = { ...state as any }
        if (paramName === 'communityWeight') {
          nextState.repoStars = Math.max(0, state.repoStars + Math.round(delta * 1000))
          nextState.repoForks = Math.max(0, state.repoForks + Math.round(delta * 100))
        }

        const weight = 10.0
        experiences.push({
          state,
          action: { paramName, delta },
          reward: Math.round(reward * 1000) / 1000,
          nextState,
          timestamp: Date.now(),
          weight,
        })
        added++
      }
    }
  }

  return { experiences, added, skipped }
}
