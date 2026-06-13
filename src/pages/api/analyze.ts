import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchRepoInfo } from '@/services/github'
import { analyzeRepository } from '@/services/analyzer'
import { AnalysisReport } from '@/types'

const analysisCache = new Map<string, AnalysisReport>()

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

  try {
    const cacheKey = url.replace(/\.git$/, '').toLowerCase()

    if (analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey)!
      const age = Date.now() - new Date(cached.generatedAt).getTime()
      if (age < 3600000) {
        return res.status(200).json({ report: cached, cached: true })
      }
    }

    const repoInfo = await fetchRepoInfo(url)

    const report = await analyzeRepository(repoInfo)
    analysisCache.set(cacheKey, report)

    return res.status(200).json({ report })
  } catch (error: any) {
    console.error('Analysis failed:', error)
    const message = error.response?.data?.message || error.message || 'Analysis failed'
    return res.status(500).json({ error: message })
  }
}
