import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchRepoInfo } from '@/services/github'
import { analyzeRepository } from '@/services/analyzer'
import { AnalysisReport, AnalysisMethod } from '@/types'
import { createAIProvider } from '@/services/ai'

const analysisCache = new Map<string, AnalysisReport>()
let cachedAIProvider: string | null = null
function detectAIProvider(): string {
  if (cachedAIProvider) return cachedAIProvider
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && process.env.GEMINI_API_KEY.length > 10)
  const hasGroq = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here' && process.env.GROQ_API_KEY.length > 10)
  const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
  cachedAIProvider = hasGemini ? 'gemini' : hasGroq ? 'groq' : hasOpenAI ? 'openai' : 'localai'
  return cachedAIProvider
}

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
    report.analysisMethod = {
      cloneMethod: 'none',
      apiData: 'full',
      aiProvider: detectAIProvider() as AnalysisMethod['aiProvider'],
      confidence: detectAIProvider() === 'localai' ? 75 : 100,
    }
    analysisCache.set(cacheKey, report)

    analysisStats.success++
    analysisStats.latencyMs.push(Date.now() - startTime)
    if (analysisStats.latencyMs.length > 100) analysisStats.latencyMs = analysisStats.latencyMs.slice(-100)

    const useConfidenceAdjustment = req.query.confidence_adjusted === 'true'
    if (useConfidenceAdjustment && report.analysisMethod) {
      const confidence = report.analysisMethod.confidence
      const discount = confidence >= 90 ? 1.0 : confidence >= 70 ? 0.95 : confidence >= 50 ? 0.85 : 0.70
      return res.status(200).json({
        report,
        confidenceAdjusted: true,
        adjustedScores: {
          overall: Math.round(report.qualityScores.overall * discount),
          codeQuality: Math.round(report.qualityScores.codeQuality * discount),
          documentation: Math.round(report.qualityScores.documentation * discount),
          maintainability: Math.round(report.qualityScores.maintainability * discount),
          communityHealth: Math.round(report.qualityScores.communityHealth * discount),
          security: Math.round(report.qualityScores.security * discount),
        },
      })
    }

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
