import { splitSentences, cosineSimilarity, extractKeywords, calculateReadability } from './textAnalyzer'

const PAGE_RANK_DAMPING = 0.85
const PAGE_RANK_ITERATIONS = 30
const SUMMARY_RATIO = 0.3

function textRank(sentences: string[]): number[] {
  const n = sentences.length
  if (n === 0) return []
  if (n === 1) return [1]

  const similarity: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(sentences[i], sentences[j])
      similarity[i][j] = sim
      similarity[j][i] = sim
    }
  }

  let scores = new Array(n).fill(1 / n)

  for (let iter = 0; iter < PAGE_RANK_ITERATIONS; iter++) {
    const newScores = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const rowSum = similarity[j].reduce((a, b) => a + b, 0)
          if (rowSum > 0) {
            sum += similarity[j][i] * scores[j] / rowSum
          }
        }
      }
      newScores[i] = (1 - PAGE_RANK_DAMPING) / n + PAGE_RANK_DAMPING * sum
    }
    scores = newScores
  }

  return scores
}

interface SummarizationResult {
  summary: string
  keyPoints: string[]
  confidence: number
}

export function generateSummary(text: string): SummarizationResult {
  if (!text || text.length < 50) {
    return {
      summary: text || 'No content available for summarization.',
      keyPoints: [],
      confidence: 0,
    }
  }

  const sentences = splitSentences(text)

  if (sentences.length === 0) {
    return {
      summary: text.slice(0, 500),
      keyPoints: [],
      confidence: 10,
    }
  }

  const scores = textRank(sentences)
  const keywords = extractKeywords(text, 10)

  const scoredSentences = sentences.map((sentence, i) => ({
    sentence,
    score: scores[i],
    index: i,
  }))

  scoredSentences.sort((a, b) => b.score - a.score)

  const numSentences = Math.max(1, Math.ceil(sentences.length * SUMMARY_RATIO))
  const topSentences = scoredSentences.slice(0, numSentences)
  topSentences.sort((a, b) => a.index - b.index)

  const summary = topSentences.map(s => s.sentence).join(' ')

  const keyPoints = keywords.slice(0, 5).map(k => k.word)

  const readability = calculateReadability(text)
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const confidence = Math.min(100, Math.round(
    (sentences.length > 3 ? 30 : 10) +
    (readability > 30 ? 20 : 5) +
    (summary.length > 100 ? 25 : 10) +
    (keywords.length > 5 ? 25 : 10)
  ))

  return { summary, keyPoints, confidence }
}
