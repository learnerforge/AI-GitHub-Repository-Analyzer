import { getTechKeywords } from './knowledge'

interface KeywordScore {
  word: string
  score: number
}

interface SentenceScore {
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
