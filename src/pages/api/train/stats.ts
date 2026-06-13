import type { NextApiRequest, NextApiResponse } from 'next'
import { reinforcementLearner } from '@/models/reinforcement'
import { listCheckpoints, getTrainingDataSize } from '@/models/persistence'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rl = reinforcementLearner
    const rlStats = rl.getStats()
    const qTable = rl.exportQTable()
    const checkpoints = listCheckpoints()
    const dataSize = getTrainingDataSize()
    const currentParams = rl.getCurrentParams()

    const stateKeys = Object.keys(qTable)
    let totalActionValues = 0
    let sumActionValues = 0

    for (const actions of Object.values(qTable)) {
      for (const value of Object.values(actions)) {
        totalActionValues++
        sumActionValues += value
      }
    }

    return res.status(200).json({
      reinforcementLearning: {
        trainingSteps: rlStats.trainingSteps,
        bufferSize: rlStats.bufferSize,
        stateCount: rlStats.stateCount,
        actionCount: Object.keys(qTable).length > 0
          ? Object.values(qTable)[0] ? Object.keys(Object.values(qTable)[0]).length : 0
          : 0,
        averageQValue: totalActionValues > 0
          ? Math.round((sumActionValues / totalActionValues) * 10000) / 10000
          : 0,
        qTableSize: new Blob([JSON.stringify(qTable)]).size,
      },
      trainingData: dataSize,
      checkpoints: {
        count: checkpoints.length,
        latest: checkpoints[0] || null,
        all: checkpoints.slice(0, 10),
      },
      currentScorerParams: currentParams,
    })
  } catch (error: any) {
    console.error('[Stats] Error:', error)
    return res.status(500).json({ error: error.message || 'Failed to get stats' })
  }
}
