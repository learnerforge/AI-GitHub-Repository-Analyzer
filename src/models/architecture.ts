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
  { name: 'Plugin Architecture', indicators: ['plugins/', 'Plugin', 'extensions/', 'addons/', 'custom_nodes/'], description: 'Extensible via plugins/addons.' },
  { name: 'Observer / Event', indicators: ['events/', 'Event', 'listeners/', 'handlers/'], description: 'Event-driven communication between components.' },
  { name: 'API-First', indicators: ['api/', 'graphql/', 'rest/', 'endpoints/', 'openapi'], description: 'API contracts defined first, consumed by clients.' },
  { name: 'Module Federation', indicators: ['remotes/', 'exposes/', 'ModuleFederation'], description: 'Micro-frontend architecture via module federation.' },
  { name: 'Client-Server', indicators: ['client/', 'server/', 'backend/', 'frontend/'], description: 'Separate client and server codebases.' },
  { name: 'Microservices', indicators: ['services/', 'service/', 'gateway/', 'discovery/'], description: 'Distributed services communicating over network.' },
  { name: 'Layered Architecture', indicators: ['controllers/', 'models/', 'views/', 'services/', 'repositories/'], description: 'Separation of concerns into distinct layers.' },
  { name: 'Event-Driven', indicators: ['events/', 'event', 'message/', 'queue/', 'kafka', 'rabbitmq'], description: 'Components communicate via events and messages.' },
]

function collectTopDirectories(tree: FileNode[], depth: number = 0): string[] {
  const dirs: string[] = []
  const MAX_DIRS = 200

  for (const node of tree) {
    if (dirs.length >= MAX_DIRS) break
    if (node.type === 'tree') {
      dirs.push(node.name)
      if (depth < 2 && node.children) {
        for (const child of node.children) {
          if (dirs.length >= MAX_DIRS) break
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
  const topDirs = tree.filter(n => n.type === 'tree').map(n => n.name)

  const pkgDirs = topDirs.filter(d => ['packages', 'apps', 'libs', 'modules', 'services', 'components'].includes(d))

  const workspaceConfigs = ['package.json', 'pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turborepo', 'rush.json', 'bazel']
  const hasWorkspaceConfig = names.some(n => workspaceConfigs.includes(n))

  if (hasWorkspaceConfig && pkgDirs.length >= 1) return true

  if (names.includes('package.json')) {
    const pkgDirDepth = (d: string) => {
      let count = 0
      const walk = (nodes: FileNode[]): void => {
        for (const n of nodes) {
          if (n.type === 'tree' && n.name === d && n.children) {
            const childDirs = n.children.filter(c => c.type === 'tree')
            if (childDirs.length >= 2) count = childDirs.length
          }
          if (n.children) walk(n.children)
        }
      }
      walk(tree)
      return count
    }
    for (const dir of pkgDirs) {
      if (pkgDirDepth(dir) >= 2) return true
    }
  }

  return false
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
  const depFilePaths = Object.keys(dependencyFiles)

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

      if (depFilePaths.some(f => f.toLowerCase().includes(indLower))) {
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

  const structureLines: string[] = allDirNames.slice(0, 10).map(d => `- **${d}/**`)

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
