import { getTechKeywords } from './knowledge'

export interface KeywordScore {
  word: string
  score: number
}

export interface SentenceScore {
  sentence: string
  score: number
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
  'about', 'above', 'after', 'again', 'all', 'also', 'any', 'because',
  'before', 'between', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'own', 'same', 'into', 'over', 'under', 'up',
  'out', 'off', 'down', 'here', 'there', 'when', 'where', 'why', 'how',
  'which', 'who', 'whom', 'what', 'while', 'during', 'through', 'until',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

export function splitSentences(text: string): string[] {
  const sentences = text
    .replace(/\n\s*\n/g, '. ')
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1||')
    .split('||')
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500)

  return sentences.length > 0 ? sentences : text.split('\n').filter(s => s.trim().length > 10)
}

export function extractKeywords(text: string, topN: number = 20): KeywordScore[] {
  const words = tokenize(text)
  const totalWords = words.length
  if (totalWords === 0) return []

  const freq: Record<string, number> = {}
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1
  }

  return Object.entries(freq)
    .map(([word, count]) => ({ word, score: count / totalWords }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

export function computeTFIDF(
  documents: string[]
): Map<string, number[]> {
  const numDocs = documents.length
  const df: Record<string, number> = {}
  const tfs: Record<string, number[]> = {}

  for (const doc of documents) {
    const words = tokenize(doc)
    const unique = new Set(words)
    const docFreq: Record<string, number> = {}

    for (const w of words) {
      docFreq[w] = (docFreq[w] || 0) + 1
    }

    for (const w of unique) {
      df[w] = (df[w] || 0) + 1
    }

    for (const [w, count] of Object.entries(docFreq)) {
      if (!tfs[w]) tfs[w] = []
      tfs[w].push(count / words.length)
    }
  }

  const result = new Map<string, number[]>()
  for (const [word, tfValues] of Object.entries(tfs)) {
    const idf = Math.log((numDocs + 1) / (df[word] + 1)) + 1
    result.set(word, tfValues.map(tf => tf * idf))
  }

  return result
}

export function detectLanguage(text: string): string {
  const keywords = getTechKeywords()
  const lower = text.toLowerCase()
  const scores: Record<string, number> = {}

  for (const [lang, kws] of Object.entries(keywords)) {
    let score = 0
    for (const kw of kws) {
      if (lower.includes(kw)) {
        score += 1
      }
    }
    if (score > 0) {
      scores[lang] = score / kws.length
    }
  }

  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([lang]) => lang)
    .join(', ')
}

export function extractEntities(text: string, knownTerms: string[]): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []

  for (const term of knownTerms) {
    if (lower.includes(term.toLowerCase())) {
      found.push(term)
    }
  }

  return [...new Set(found)]
}

export function calculateReadability(text: string): number {
  if (text.length === 0) return 0

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const syllables = words.reduce((count, word) => {
    const syls = word.toLowerCase()
      .replace(/[^aeiouy]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(s => s.length > 0)
    return count + Math.max(1, syls.length)
  }, 0)

  if (sentences.length === 0 || words.length === 0) return 0

  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
  return Math.max(0, Math.min(100, Math.round(score * 1.5)))
}

export function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)

  const freqA: Record<string, number> = {}
  const freqB: Record<string, number> = {}

  for (const t of tokensA) freqA[t] = (freqA[t] || 0) + 1
  for (const t of tokensB) freqB[t] = (freqB[t] || 0) + 1

  const allWords = new Set([...Object.keys(freqA), ...Object.keys(freqB)])

  let dotProduct = 0
  let magA = 0
  let magB = 0

  for (const w of allWords) {
    const va = freqA[w] || 0
    const vb = freqB[w] || 0
    dotProduct += va * vb
    magA += va * va
    magB += vb * vb
  }

  if (magA === 0 || magB === 0) return 0
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB))
}
