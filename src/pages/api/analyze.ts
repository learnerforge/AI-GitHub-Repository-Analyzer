import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchRepoInfo } from '@/services/github'
import { analyzeRepository } from '@/services/analyzer'
import { AnalysisReport } from '@/types'

const analysisCache = new Map<string, AnalysisReport>()

export const analysisStats = {
  total: 0,
  success: 0,
  failed: 0,
  cached: 0,
  errors: {} as Record<string, number>,
  latencyMs: [] as number[],
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'GitHub repository URL is required' })
  }

  const startTime = Date.now()
  analysisStats.total++

  try {
    const cacheKey = url.replace(/\.git$/, '').toLowerCase()

    if (analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey)!
      const age = Date.now() - new Date(cached.generatedAt).getTime()
      if (age < 3600000) {
        analysisStats.cached++
        analysisStats.latencyMs.push(Date.now() - startTime)
        if (analysisStats.latencyMs.length > 100) analysisStats.latencyMs = analysisStats.latencyMs.slice(-100)
        return res.status(200).json({ report: cached, cached: true })
      }
    }

    const repoInfo = await fetchRepoInfo(url)

    const report = await analyzeRepository(repoInfo)
    analysisCache.set(cacheKey, report)

    analysisStats.success++
    analysisStats.latencyMs.push(Date.now() - startTime)
    if (analysisStats.latencyMs.length > 100) analysisStats.latencyMs = analysisStats.latencyMs.slice(-100)

    return res.status(200).json({ report })
  } catch (error: any) {
    analysisStats.failed++
    const msg = error.response?.data?.message || error.message || 'Analysis failed'
    const key = msg.slice(0, 80)
    analysisStats.errors[key] = (analysisStats.errors[key] || 0) + 1
    console.error('Analysis failed:', error)
    return res.status(500).json({ error: msg })
  }
}
