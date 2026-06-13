import { CodeSmell, FileNode } from '@/types'

export interface SmellDetectionInput {
  fileTree: FileNode[]
  readmeContent: string
  languages: Record<string, number>
  dependencyFiles: Record<string, string>
  hasTests: boolean
  hasCI: boolean
  contributorCount: number
}

const SMELL_RULES: {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
  check: (input: SmellDetectionInput) => boolean
}[] = [
  {
    id: 'no-readme',
    severity: 'critical',
    category: 'Documentation',
    title: 'Missing README',
    description: 'The repository has no README file. A README is essential for explaining what the project does and how to use it.',
    check: (input) => !input.readmeContent || input.readmeContent.length < 20,
  },
  {
    id: 'short-readme',
    severity: 'warning',
    category: 'Documentation',
    title: 'Insufficient README Content',
    description: 'The README is too short to provide meaningful information about the project.',
    check: (input) => input.readmeContent.length > 0 && input.readmeContent.length < 200,
  },
  {
    id: 'no-tests',
    severity: 'warning',
    category: 'Testing',
    title: 'No Test Files Detected',
    description: 'No test files were found. Adding tests improves code reliability and makes contributions safer.',
    check: (input) => !input.hasTests,
  },
  {
    id: 'no-ci',
    severity: 'warning',
    category: 'DevOps',
    title: 'No CI/CD Pipeline',
    description: 'No continuous integration configuration detected. CI helps catch issues early.',
    check: (input) => !input.hasCI,
  },
  {
    id: 'single-contributor',
    severity: 'info',
    category: 'Community',
    title: 'Bus Factor of 1',
    description: 'Only one contributor has made changes. If they leave, the project could stall.',
    check: (input) => input.contributorCount <= 1,
  },
  {
    id: 'large-monolith',
    severity: 'warning',
    category: 'Architecture',
    title: 'Deeply Nested or Flat Structure',
    description: 'The project has issues with directory organization that may affect maintainability.',
    check: (input) => {
      const dirs = countDirectories(input.fileTree)
      return dirs > 20 || dirs < 2
    },
  },
  {
    id: 'no-license',
    severity: 'warning',
    category: 'Legal',
    title: 'Missing License',
    description: 'No license file found. This creates legal ambiguity for potential users and contributors.',
    check: (input) => !input.readmeContent.toLowerCase().includes('license') &&
      !Object.keys(input.dependencyFiles).some(f => f.toLowerCase().includes('license')),
  },
  {
    id: 'many-languages',
    severity: 'info',
    category: 'Complexity',
    title: 'Many Languages Used',
    description: 'The project uses many different programming languages, which may increase cognitive load.',
    check: (input) => Object.keys(input.languages).length > 5,
  },
  {
    id: 'no-contributing-guide',
    severity: 'info',
    category: 'Documentation',
    title: 'No Contributing Guidelines',
    description: 'Missing CONTRIBUTING.md. Guidelines help standardize the contribution process.',
    check: (input) => !input.readmeContent.toLowerCase().includes('contribut') &&
      !Object.keys(input.dependencyFiles).some(f => f.toLowerCase().includes('contribut')),
  },
  {
    id: 'stale-dependencies',
    severity: 'info',
    category: 'Dependencies',
    title: 'No Lock File',
    description: 'No package lock file found, which may lead to inconsistent dependency installations.',
    check: (input) => {
      const hasPackageManager = Object.keys(input.languages).some(l =>
        ['JavaScript', 'TypeScript', 'Python', 'Ruby', 'Rust', 'Go'].includes(l)
      )
      if (!hasPackageManager) return false
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock', 'Cargo.lock', 'go.sum']
      return !Object.keys(input.dependencyFiles).some(f => lockFiles.includes(f))
    },
  },
]

function countDirectories(tree: FileNode[]): number {
  let count = 0
  for (const node of tree) {
    if (node.type === 'tree') {
      count++
      if (node.children) {
        count += countDirectories(node.children)
      }
    }
  }
  return count
}

export function detectCodeSmells(input: SmellDetectionInput): CodeSmell[] {
  const smells: CodeSmell[] = []

  for (const rule of SMELL_RULES) {
    try {
      if (rule.check(input)) {
        smells.push({
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          description: rule.description,
        })
      }
    } catch {
    }
  }

  return smells
}
