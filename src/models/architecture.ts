import { FileNode } from '@/types'
import { getArchitecturePatterns } from './knowledge'

export interface ArchitectureAnalysis {
  patterns: { name: string; confidence: number; description: string }[]
  primaryPattern: string
  description: string
  directoryHighlights: string[]
}

const DESIGN_PATTERNS: { name: string; indicators: string[]; description: string }[] = [
  { name: 'Component-Based', indicators: ['components/', 'Component', 'Props', 'useState'], description: 'UI built from reusable, composable components.' },
  { name: 'Repository Pattern', indicators: ['repositories/', 'Repository', 'repository/'], description: 'Data access abstracted through repository interfaces.' },
  { name: 'Service Layer', indicators: ['services/', 'Service', 'service/'], description: 'Business logic encapsulated in service classes.' },
  { name: 'Middleware Pipeline', indicators: ['middleware/', 'Middleware', 'middleware.ts'], description: 'Request processing through middleware chain.' },
  { name: 'Plugin Architecture', indicators: ['plugins/', 'Plugin', 'extensions/', 'addons/'], description: 'Extensible via plugins/addons.' },
  { name: 'Observer / Event', indicators: ['events/', 'Event', 'listeners/', 'handlers/'], description: 'Event-driven communication between components.' },
  { name: 'API-First', indicators: ['api/', 'graphql/', 'rest/', 'endpoints/'], description: 'API contracts defined first, consumed by clients.' },
  { name: 'Module Federation', indicators: ['remotes/', 'exposes/', 'ModuleFederation'], description: 'Micro-frontend architecture via module federation.' },
]

function collectTopDirectories(tree: FileNode[], depth: number = 0): string[] {
  const dirs: string[] = []

  for (const node of tree) {
    if (node.type === 'tree') {
      dirs.push(node.name)
      if (depth < 2 && node.children) {
        for (const child of node.children) {
          if (child.type === 'tree') {
            dirs.push(`${node.name}/${child.name}`)
          }
        }
      }
    }
  }

  return dirs
}

function detectMonorepoPatterns(tree: FileNode[]): boolean {
  const names = tree.map(n => n.name)
  return names.some(n => ['packages', 'apps', 'libs'].includes(n)) &&
    (names.includes('package.json') || names.includes('pnpm-workspace.yaml') || names.includes('lerna.json') || names.includes('nx.json') || names.includes('turborepo'))
}

function detectMonolithPatterns(tree: FileNode[]): boolean {
  const dirs = collectTopDirectories(tree)
  const keyDirs = ['src', 'app', 'lib', 'core', 'api', 'routes', 'controllers', 'models', 'views', 'public']
  const found = dirs.filter(d => keyDirs.includes(d)).length
  return found >= 3 && !detectMonorepoPatterns(tree)
}

export function analyzeArchitecture(
  fileTree: FileNode[],
  readmeContent: string,
  dependencyFiles: Record<string, string>
): ArchitectureAnalysis {
  const detected: { name: string; confidence: number; description: string }[] = []
  const allDirNames = collectTopDirectories(fileTree)
  const readmeLower = readmeContent.toLowerCase()
  const depFileNames = Object.values(dependencyFiles)

  for (const pattern of getArchitecturePatterns()) {
    let evidence = 0

    for (const indicator of pattern.indicators) {
      const indLower = indicator.toLowerCase()

      if (allDirNames.some(d => d.toLowerCase().includes(indLower))) {
        evidence++
      }

      if (readmeLower.includes(indLower)) {
        evidence++
      }

      if (depFileNames.some(f => f.toLowerCase().includes(indLower))) {
        evidence++
      }
    }

    if (evidence >= 2) {
      detected.push({
        name: pattern.name,
        confidence: Math.min(95, 30 + evidence * 15),
        description: pattern.description,
      })
    }
  }

  if (detectMonorepoPatterns(fileTree)) {
    const existing = detected.find(d => d.name === 'Monorepo')
    if (existing) {
      existing.confidence = Math.min(100, existing.confidence + 20)
    } else {
      detected.push({ name: 'Monorepo', confidence: 80, description: 'Multiple projects in a single repository with shared tooling.' })
    }
  }

  if (detectMonolithPatterns(fileTree)) {
    const existing = detected.find(d => d.name === 'Monolithic')
    if (existing) {
      existing.confidence = Math.min(100, existing.confidence + 15)
    }
  }

  for (const dp of DESIGN_PATTERNS) {
    let evidence = 0
    for (const ind of dp.indicators) {
      if (allDirNames.some(d => d.toLowerCase().includes(ind.toLowerCase()))) evidence++
      if (readmeLower.includes(ind.toLowerCase())) evidence++
    }
    if (evidence > 1) {
      detected.push({ name: dp.name, confidence: 40 + evidence * 15, description: dp.description })
    }
  }

  detected.sort((a, b) => b.confidence - a.confidence)

  const primaryPattern = detected.length > 0 ? detected[0].name : 'Standard / Custom'

  const structureLines: string[] = allDirNames.slice(0, 8).map(d => `- **${d}/**`)

  const description = detected.length > 0
    ? `This project follows a **${primaryPattern}** architecture pattern. ${
        detected.slice(0, 3).map(d => `${d.name}: ${d.description}`).join(' ')
      } The repository is organized into ${allDirNames.length > 0 ? allDirNames.slice(0, 5).join(', ') : 'a standard structure'} with a focus on ${detected[0]?.description || 'maintainable code organization'}.`
    : 'This project follows a standard project structure with conventional code organization patterns.'

  return {
    patterns: detected.slice(0, 5),
    primaryPattern,
    description,
    directoryHighlights: structureLines,
  }
}
