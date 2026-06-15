import { splitSentences, extractKeywords } from './textAnalyzer'
import type { ProcessedReadme } from '@/types'

export function cleanReadme(raw: string): string {
  if (!raw) return ''

  let text = raw

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')

  // Remove images
  text = text.replace(/!\[.*?\]\(.*?\)/g, '')

  // Remove badge URLs (common patterns)
  text = text.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '')
  text = text.replace(/https?:\/\/img\.shields\.io\/[^\s)]+/g, '')
  text = text.replace(/https?:\/\/badge\.[^\s)]+/g, '')

  // Replace markdown links with just the text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Remove standalone URLs
  text = text.replace(/https?:\/\/[^\s)]+/g, '')

  // Remove code blocks (both ``` and ````)
  text = text.replace(/```[\s\S]*?```/g, '')
  text = text.replace(/````[\s\S]*?````/g, '')

  // Remove inline code
  text = text.replace(/`[^`]+`/g, '')

  // Remove table of contents sections
  text = text.replace(/- \[.*?\]\(#.*?\)/g, '')
  text = text.replace(/^\s*\[.*?\]:\s*.*$/gm, '')

  // Remove horizontal rules
  text = text.replace(/^---+$/gm, '')

  // Remove badges/tags like [:building_construction: ...]
  text = text.replace(/\[.*?\]\(.*?\)/g, '')

  // Remove emoji sequences at line starts
  text = text.replace(/^[\u{1F000}-\u{1FFFF}]+\s*/gmu, '')

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n')

  // Remove leading/trailing whitespace on each line
  text = text.split('\n').map(l => l.trim()).join('\n')

  return text.trim()
}

export function extractHeadings(text: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = []
  const regex = /^(#{1,6})\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    })
  }
  return headings
}

export function extractFeatures(readme: string): string[] {
  const features: string[] = []

  // Find bullet points under "Features" or "What" headings
  const sections = readme.split(/\n#{1,3}\s+/)
  for (const section of sections) {
    const header = section.split('\n')[0].toLowerCase()
    if (/features|what.*(does|can|this)|key.*(capabilit|feature|highlight)/i.test(header)) {
      const bullets = section.split('\n').filter(l => /^\s*[-*+]\s+/.test(l))
      for (const b of bullets) {
        const cleaned = b.replace(/^\s*[-*+]\s+/, '').trim()
        if (cleaned.length > 10 && cleaned.length < 150) {
          features.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1))
        }
      }
    }
  }

  // Also scan for feature badges/bold text
  if (features.length === 0) {
    const lines = readme.split('\n')
    for (const line of lines) {
      const trimmed = line.replace(/^\s*[-*+]\s+/, '').trim()
      if (
        trimmed.length > 15 &&
        trimmed.length < 120 &&
        !trimmed.startsWith('[') &&
        !trimmed.startsWith('http') &&
        !trimmed.startsWith('!') &&
        !trimmed.includes('```')
      ) {
        features.push(trimmed.charAt(0).toUpperCase() + trimmed.slice(1))
      }
    }
  }

  return [...new Set(features)].slice(0, 8)
}

export function detectReadmeDifficulty(readme: string): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (!readme) return 'Intermediate'

  const lower = readme.toLowerCase()
  let score = 0

  const advancedTerms = ['kubernetes', 'distributed', 'microservice', 'docker compose',
    'multi-thread', 'asynchronous', 'websocket', 'real-time', 'oauth', 'jwt',
    'authentication', 'authorization', 'middleware', 'dependency injection',
    'test coverage', 'ci/cd', 'continuous integration', 'deployment']
  for (const t of advancedTerms) {
    if (lower.includes(t)) score += 1
  }

  const beginnerTerms = ['getting started', 'quick start', 'beginner', 'simple',
    'easy', 'tutorial', 'hello world', 'starter', 'basic', 'minimal',
    'example', 'demo', 'guide']
  for (const t of beginnerTerms) {
    if (lower.includes(t)) score -= 1
  }

  if (score >= 4) return 'Advanced'
  if (score <= -1) return 'Beginner'
  return 'Intermediate'
}

export function extractOverview(readme: string, description: string | null): string {
  const clean = cleanReadme(readme)
  const sentences = splitSentences(clean)
  const keywords = extractKeywords(clean, 5)

  if (description && description.length > 20) {
    return description
  }

  // Try first paragraph after the main heading
  const lines = clean.split('\n').filter(l => l.trim().length > 0)
  let startIdx = 0
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (/^#\s/.test(lines[i])) {
      startIdx = i + 1
      break
    }
  }

  const para: string[] = []
  for (let i = startIdx; i < lines.length; i++) {
    if (/^#/.test(lines[i])) break
    const trimmed = lines[i].trim()
    if (trimmed.length > 0 && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      para.push(trimmed)
    }
    if (para.join(' ').length > 300) break
  }

  if (para.join(' ').length > 30) {
    return para.join(' ').slice(0, 500)
  }

  if (sentences.length > 0) {
    const summarySentences = sentences.slice(0, Math.min(3, sentences.length))
    return summarySentences.join(' ').slice(0, 500)
  }

  return clean.slice(0, 500)
}

export function extractTechKeywords(readme: string): string[] {
  const techTerms = [
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'node.js', 'deno',
    'typescript', 'javascript', 'python', 'rust', 'go', 'golang', 'java', 'kotlin',
    'swift', 'ruby', 'php', 'c++', 'c#', 'dart', 'flutter', 'tensorflow',
    'pytorch', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'firebase',
    'graphql', 'rest', 'api', 'grpc', 'websocket', 'redis', 'postgresql',
    'mongodb', 'mysql', 'sqlite', 'elasticsearch', 'kafka', 'rabbitmq',
    'tailwind', 'bootstrap', 'sass', 'less', 'webpack', 'vite', 'esbuild',
    'jest', 'mocha', 'cypress', 'playwright', 'pandas', 'numpy', 'scikit-learn',
    'opencv', 'llm', 'gpt', 'openai', 'langchain', 'hugging face', 'transformers',
  ]

  const lower = readme.toLowerCase()
  const found: string[] = []
  for (const term of techTerms) {
    if (lower.includes(term) && !found.includes(term)) {
      found.push(term)
    }
  }
  return found.slice(0, 8)
}

export function checkSection(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase()
  return patterns.some(p => lower.includes(p))
}

export function processReadme(readme: string, description: string | null): ProcessedReadme {
  const cleanText = cleanReadme(readme)
  const headings = extractHeadings(readme)
  const features = extractFeatures(readme)
  const overview = extractOverview(readme, description)
  const techKeywords = extractTechKeywords(readme)

  return {
    cleanText,
    overview,
    features,
    headings,
    hasInstallSection: checkSection(readme, ['install', 'setup', 'getting started']),
    hasUsageSection: checkSection(readme, ['usage', 'example', 'quick start']),
    hasApiSection: checkSection(readme, ['api', 'api reference', 'api documentation']),
    difficulty: detectReadmeDifficulty(readme),
    techKeywords,
  }
}

export function compileRepoSummary(
  readme: string,
  description: string | null,
  stars: number,
  forks: number,
  topics: string[],
  techStack: string[],
  docsScore: number,
  qualityScore: number,
): string {
  const processed = processReadme(readme, description)

  const lines: string[] = []

  if (processed.overview) {
    lines.push(processed.overview)
  }

  if (processed.features.length > 0) {
    lines.push('')
    lines.push('Key Features:')
    for (const f of processed.features.slice(0, 6)) {
      lines.push(`  • ${f}`)
    }
  }

  if (techStack.length > 0) {
    lines.push('')
    lines.push(`Tech Stack: ${techStack.join(', ')}`)
  }

  lines.push('')
  lines.push(`Difficulty: ${processed.difficulty}`)
  lines.push(`Documentation: ${docsScore}/100`)
  lines.push(`Quality Score: ${qualityScore}/100`)

  return lines.join('\n')
}
