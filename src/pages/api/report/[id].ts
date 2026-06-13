import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { AnalysisReport } from '@/types'

function findReportFile(id: string): string | null {
  const resultsDir = path.join(process.cwd(), 'analysis-results')
  if (!fs.existsSync(resultsDir)) return null

  const [owner, name] = id.split(':')
  if (!owner || !name) return null

  const prefix = `${owner}-${name}`.toLowerCase()
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
  const match = files.find(f => f.toLowerCase().startsWith(prefix))
  return match ? path.join(resultsDir, match) : null
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Report ID is required' })
  }

  if (req.method === 'PATCH') {
    try {
      const filePath = findReportFile(id)
      if (!filePath) {
        return res.status(404).json({ error: 'Report not found' })
      }

      const report: AnalysisReport = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const updates = req.body

      const allowedFields = [
        'summary', 'architecture', 'onboardingGuide', 'suggestions',
        'techStack', 'codeSmells', 'qualityScores', 'docsQuality',
      ]

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          ;(report as any)[field] = updates[field]
        }
      }

      report.generatedAt = new Date().toISOString()
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')

      return res.status(200).json({ report, message: 'Report updated successfully' })
    } catch (error: any) {
      console.error('Failed to update report:', error)
      return res.status(500).json({ error: error.message || 'Failed to update report' })
    }
  }

  if (req.method === 'GET') {
    try {
      const filePath = findReportFile(id)
      if (!filePath) {
        return res.status(404).json({ error: 'Report not found' })
      }

      const report: AnalysisReport = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      return res.status(200).json({ report })
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to load report' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
