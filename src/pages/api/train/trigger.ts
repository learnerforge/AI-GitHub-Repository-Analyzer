import type { NextApiRequest, NextApiResponse } from 'next'
import { reinforcementLearner } from '@/models/reinforcement'
import { saveQTable } from '@/models/persistence'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rl = reinforcementLearner
    const beforeStats = rl.getStats()

    const iterations = 5
    let totalLoss = 0
    let totalEpisodes = 0

    for (let i = 0; i < iterations; i++) {
      const result = rl.train(64)
      totalLoss += result.loss
      totalEpisodes += result.episodes
    }

    const afterStats = rl.getStats()

    const qTable = rl.exportQTable()
    const checkpointPath = saveQTable(
      qTable,
      afterStats.trainingSteps,
      'trained'
    )

    return res.status(200).json({
      success: true,
      trainingRun: {
        iterations,
        averageLoss: iterations > 0 ? Math.round((totalLoss / iterations) * 10000) / 10000 : 0,
        totalEpisodes,
      },
      before: beforeStats,
      after: afterStats,
      checkpointSaved: checkpointPath,
      improvement: {
        stateCountDiff: afterStats.stateCount - beforeStats.stateCount,
        stepsAdded: afterStats.trainingSteps - beforeStats.trainingSteps,
      },
    })
  } catch (error: any) {
    console.error('[Train Trigger] Error:', error)
    return res.status(500).json({ error: error.message || 'Training failed' })
  }
}
