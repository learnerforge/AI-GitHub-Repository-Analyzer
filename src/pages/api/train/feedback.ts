import type { NextApiRequest, NextApiResponse } from 'next'
import { reinforcementLearner } from '@/models/reinforcement'
import { saveExperienceBuffer } from '@/models/persistence'

interface FeedbackBody {
  repoUrl: string
  rating: number
  category?: string
  comment?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { repoUrl, rating, category, comment } = req.body as FeedbackBody

    if (!repoUrl || typeof rating !== 'number') {
      return res.status(400).json({ error: 'repoUrl (string) and rating (number 1-5) are required' })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' })
    }

    const reward = (rating - 3) / 2

    const rl = reinforcementLearner

    const experience = {
      state: {
        repoStars: 0,
        repoForks: 0,
        fileCount: 0,
        languageCount: 0,
        readmeLength: 0,
        contributorCount: 0,
        hasTests: false,
        hasCI: false,
      },
      action: {
        paramName: 'codeQualityWeight' as const,
        delta: 0.05,
      },
      reward,
      nextState: {
        repoStars: 0,
        repoForks: 0,
        fileCount: 0,
        languageCount: 0,
        readmeLength: 0,
        contributorCount: 0,
        hasTests: false,
        hasCI: false,
      },
      timestamp: Date.now(),
      metadata: {
        repoUrl,
        category: category || 'general',
        comment: comment || '',
        rating,
      },
    }

    rl.storeExperience(
      experience.state as any,
      experience.action as any,
      experience.reward,
      experience.nextState as any
    )

    saveExperienceBuffer([experience])

    const result = rl.train()
    const stats = rl.getStats()

    return res.status(200).json({
      success: true,
      reward,
      trainingResult: result,
      stats,
      message: rating >= 4
        ? 'Thanks for the positive feedback! The model will learn from this.'
        : rating <= 2
        ? 'Thanks for the feedback. This helps the model improve.'
        : 'Feedback recorded.',
    })
  } catch (error: any) {
    console.error('[Feedback] Error:', error)
    return res.status(500).json({ error: error.message || 'Failed to process feedback' })
  }
}
