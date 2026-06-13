import { TechStack, LanguageInfo, FileNode } from '@/types'
import { getTechDatabase } from './knowledge'

interface DetectionResult {
  name: string
  category: string
  confidence: number
  evidence: string[]
}

export function detectTechnologies(
  languages: Record<string, number>,
  fileTree: FileNode[],
  dependencyFiles: Record<string, string>,
  readmeContent: string,
  topics: string[]
): TechStack {
  const detections: DetectionResult[] = []
  const allFiles = collectFiles(fileTree)

  for (const tech of getTechDatabase()) {
    const evidence: string[] = []
    let confidence = 0

    for (const pattern of tech.patterns) {
      try {
        const regex = new RegExp(pattern, 'i')

        for (const file of allFiles) {
          if (regex.test(file)) {
            evidence.push(file)
            break
          }
        }

        for (const [filepath, content] of Object.entries(dependencyFiles)) {
          if (regex.test(filepath) || regex.test(content)) {
            evidence.push(filepath)
            break
          }
        }
      } catch {
      }
    }

    if (evidence.length > 0) {
      confidence = Math.min(tech.confidence, 50 + evidence.length * 15)
      detections.push({ name: tech.name, category: tech.category, confidence, evidence })
    }
  }

  if (readmeContent) {
    const readmeLower = readmeContent.toLowerCase()
    for (const tech of getTechDatabase()) {
      const existing = detections.find(d => d.name === tech.name)
      if (existing) {
        for (const pattern of tech.patterns) {
          try {
            const regex = new RegExp(pattern.replace(/\\/g, ''), 'i')
            if (regex.test(readmeLower)) {
              existing.confidence = Math.min(100, existing.confidence + 5)
            }
          } catch {
          }
        }
      } else {
        const hasMatch = tech.patterns.some(p => {
          try {
            const cleanPattern = p.replace(/\\\./g, '.').replace(/\\$/g, '')
            return readmeLower.includes(cleanPattern.toLowerCase())
          } catch {
            return false
          }
        })
        if (hasMatch) {
          detections.push({ name: tech.name, category: tech.category, confidence: 60, evidence: ['README mention'] })
        }
      }
    }
  }

  for (const topic of topics) {
    const matched = getTechDatabase().find(t =>
      t.name.toLowerCase() === topic.toLowerCase()
    )
    if (matched && !detections.find(d => d.name === matched.name)) {
      detections.push({ name: matched.name, category: matched.category, confidence: 70, evidence: ['GitHub topic'] })
    }
  }

  const languageEntries: LanguageInfo[] = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .map(([name, bytes]) => ({
      name,
      percentage: Math.round((bytes / Math.max(1, Object.values(languages).reduce((a, b) => a + b, 0))) * 1000) / 10,
      bytes,
    }))

  const techStack: TechStack = {
    languages: languageEntries,
    frameworks: [],
    databases: [],
    tools: [],
    infrastructure: [],
  }

  const grouped: Record<string, DetectionResult[]> = {}
  for (const d of detections) {
    if (!grouped[d.category]) grouped[d.category] = []
    grouped[d.category].push(d)
  }

  for (const [category, items] of Object.entries(grouped)) {
    const sorted = items.sort((a, b) => b.confidence - a.confidence).slice(0, 8)

    if (category === 'language') {
      for (const item of sorted) {
        if (!techStack.languages.find(l => l.name === item.name)) {
          techStack.languages.push({
            name: item.name,
            percentage: 0,
            bytes: 0,
          })
        }
      }
    } else if (category === 'framework') {
      techStack.frameworks.push(...sorted.map(s => `${s.name} (${s.confidence}%)`))
    } else if (category === 'database') {
      techStack.databases.push(...sorted.map(s => `${s.name} (${s.confidence}%)`))
    } else if (category === 'tool') {
      techStack.tools.push(...sorted.map(s => `${s.name} (${s.confidence}%)`))
    } else if (category === 'infrastructure') {
      techStack.infrastructure.push(...sorted.map(s => `${s.name} (${s.confidence}%)`))
    }
  }

  return techStack
}

function collectFiles(tree: FileNode[], path: string = ''): string[] {
  const files: string[] = []
  const MAX_FILES = 5000
  for (const node of tree) {
    if (files.length >= MAX_FILES) break
    const fullPath = path ? `${path}/${node.name}` : node.name
    if (node.type === 'blob') {
      files.push(fullPath)
    }
    if (node.children && files.length < MAX_FILES) {
      const childFiles = collectFiles(node.children, fullPath)
      for (const f of childFiles) {
        if (files.length >= MAX_FILES) break
        files.push(f)
      }
    }
  }
  return files
}

export function detectPackageManager(dependencyFiles: Record<string, string>): string {
  const files = Object.keys(dependencyFiles)
  if (files.some(f => f.includes('package-lock'))) return 'npm'
  if (files.some(f => f.includes('yarn.lock'))) return 'yarn'
  if (files.some(f => f.includes('pnpm-lock'))) return 'pnpm'
  if (files.some(f => f.includes('Cargo'))) return 'cargo'
  if (files.some(f => f.includes('Gemfile'))) return 'bundler'
  if (files.some(f => f.includes('requirements'))) return 'pip'
  if (files.some(f => f.includes('go.mod'))) return 'go mod'
  if (files.some(f => f.includes('pom.xml'))) return 'maven'
  if (files.some(f => f.includes('build.gradle'))) return 'gradle'
  return 'npm'
}

export function detectDevCommands(dependencyFiles: Record<string, string>, languages: Record<string, number>): {
  dev: string
  build: string
  test: string
  install: string
} {
  const hasNode = languages.hasOwnProperty('JavaScript') || languages.hasOwnProperty('TypeScript')
  const hasPython = languages.hasOwnProperty('Python')
  const hasGo = languages.hasOwnProperty('Go')
  const hasRust = languages.hasOwnProperty('Rust')
  const depFiles = Object.keys(dependencyFiles)

  if (depFiles.some(f => f.includes('package.json'))) {
    return { dev: 'npm run dev', build: 'npm run build', test: 'npm test', install: 'npm install' }
  }
  if (hasPython || depFiles.some(f => f.includes('requirements') || f.includes('Pipfile') || f.includes('pyproject'))) {
    return { dev: 'python main.py', build: 'python setup.py build', test: 'pytest', install: 'pip install -r requirements.txt' }
  }
  if (hasGo || depFiles.some(f => f.includes('go.mod'))) {
    return { dev: 'go run .', build: 'go build ./...', test: 'go test ./...', install: 'go mod download' }
  }
  if (hasRust || depFiles.some(f => f.includes('Cargo.toml'))) {
    return { dev: 'cargo run', build: 'cargo build --release', test: 'cargo test', install: 'cargo build' }
  }
  if (hasNode) {
    return { dev: 'npm run dev', build: 'npm run build', test: 'npm test', install: 'npm install' }
  }
  return { dev: 'npm run dev', build: 'npm run build', test: 'npm test', install: 'npm install' }
}
