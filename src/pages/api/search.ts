import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

interface SearchResult {
  id: string
  repoName: string
  owner: string
  repoUrl: string
  summary: string
  score: number
  matches: string[]
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-zA-Z0-9_#.]+/).filter(t => t.length > 2)
}

function computeTfIdf(docTokens: string[], queryTokens: string[], allDocs: string[][]): number {
  let score = 0
  const docFreq: Record<string, number> = {}
  for (const tokens of allDocs) {
    const seen = new Set(tokens)
    for (const t of seen) {
      docFreq[t] = (docFreq[t] || 0) + 1
    }
  }
  const totalDocs = allDocs.length
  for (const qt of queryTokens) {
    const tf = docTokens.filter(t => t === qt).length / docTokens.length
    const idf = Math.log(1 + totalDocs / (1 + (docFreq[qt] || 0)))
    score += tf * idf
  }
  return score
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q, limit } = req.query
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(200).json({ results: [], query: '' })
    }

    const resultsDir = path.join(process.cwd(), 'data', 'results')
    if (!fs.existsSync(resultsDir)) {
      return res.status(200).json({ results: [], query: q })
    }

    const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
    const topK = Math.min(50, parseInt(limit as string) || 20)
    const queryTokens = tokenize(q)

    interface ScoredDoc { report: any; score: number; docTokens: string[] }
    const scored: ScoredDoc[] = []

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(resultsDir, file), 'utf-8')
        const report = JSON.parse(raw)

        const searchText = [
          report.summary || '',
          report.architecture || '',
          report.repoName || '',
          report.owner || '',
          (report.techStack?.languages || []).map((l: any) => l.name).join(' '),
          ...(report.techStack?.frameworks || []),
          ...(report.techStack?.tools || []),
          ...(report.suggestions || []),
        ].join(' ')

        const docTokens = tokenize(searchText)
        const score = computeTfIdf(docTokens, queryTokens, [])
        if (score > 0) {
          scored.push({ report, score, docTokens })
        }
      } catch {}
    }

    const allDocTokens = scored.map(s => s.docTokens)
    for (const s of scored) {
      s.score = computeTfIdf(s.docTokens, queryTokens, allDocTokens)
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, topK)

    const results: SearchResult[] = top.map(s => {
      const matches: string[] = []
      for (const t of queryTokens) {
        if (s.docTokens.includes(t)) matches.push(t)
      }
      return {
        id: s.report.id || '',
        repoName: s.report.repoName || '',
        owner: s.report.owner || '',
        repoUrl: s.report.repoUrl || '',
        summary: (s.report.summary || '').slice(0, 300),
        score: Math.round(s.score * 1000) / 1000,
        matches,
      }
    })

    return res.status(200).json({ results, query: q, total: results.length })
  } catch (error: any) {
    console.error('Search failed:', error)
    return res.status(500).json({ error: error.message || 'Search failed' })
  }
}
