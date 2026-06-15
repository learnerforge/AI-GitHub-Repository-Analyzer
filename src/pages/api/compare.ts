import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { AnalysisReport } from '@/types'

interface CompareDiff {
  field: string
  values: (string | number | boolean | null)[]
  differs: boolean
}

interface CompareResult {
  reports: AnalysisReport[]
  diffs: CompareDiff[]
}

const COMPARABLE_FIELDS = [
  { key: 'qualityScores.overall', label: 'Overall Score', type: 'number' },
  { key: 'qualityScores.codeQuality', label: 'Code Quality', type: 'number' },
  { key: 'qualityScores.documentation', label: 'Documentation', type: 'number' },
  { key: 'qualityScores.maintainability', label: 'Maintainability', type: 'number' },
  { key: 'qualityScores.communityHealth', label: 'Community Health', type: 'number' },
  { key: 'qualityScores.security', label: 'Security', type: 'number' },
  { key: 'complexity.overall', label: 'Complexity', type: 'number' },
  { key: 'complexity.fileCount', label: 'File Count', type: 'number' },
  { key: 'complexity.totalLines', label: 'Total Lines', type: 'number' },
  { key: 'docsQuality.readmeScore', label: 'README Score', type: 'number' },
  { key: 'health.stars', label: 'Stars', type: 'number' },
  { key: 'health.forks', label: 'Forks', type: 'number' },
  { key: 'health.contributorCount', label: 'Contributors', type: 'number' },
  { key: 'health.overall', label: 'Health', type: 'number' },
  { key: 'codeSmells.length', label: 'Code Smells', type: 'number' },
]

function getNested(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => {
    if (part === 'length' && Array.isArray(acc)) return acc.length
    return acc?.[part]
  }, obj)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { repos } = req.query
    if (!repos || typeof repos !== 'string') {
      return res.status(400).json({ error: 'Query parameter "repos" is required' })
    }

    const repoIds = repos.split(',').map(r => r.trim()).filter(Boolean)
    if (repoIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 repo IDs required for comparison' })
    }

    const resultsDir = path.join(process.cwd(), 'data', 'results')
    if (!fs.existsSync(resultsDir)) {
      return res.status(404).json({ error: 'No analysis results found' })
    }

    const reports: AnalysisReport[] = []
    const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))

    for (const repoId of repoIds) {
      const safeId = repoId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
      const match = files.find(f => {
        const name = f.replace(/\.json$/, '').toLowerCase()
        return name.startsWith(safeId) || name.includes(safeId)
      })

      if (match) {
        const content = fs.readFileSync(path.join(resultsDir, match), 'utf-8')
        reports.push(JSON.parse(content))
      }
    }

    if (reports.length < 2) {
      return res.status(404).json({ error: `Could only find ${reports.length} matching reports. Need at least 2.` })
    }

    const diffs: CompareDiff[] = COMPARABLE_FIELDS.map(field => {
      const values = reports.map(r => getNested(r, field.key))
      const uniqueValues = new Set(values.filter(v => v !== undefined && v !== null))
      return {
        field: field.label,
        values,
        differs: uniqueValues.size > 1,
      }
    })

    const result: CompareResult = { reports, diffs }
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Comparison failed:', error)
    return res.status(500).json({ error: error.message || 'Comparison failed' })
  }
}
