import type { NextApiRequest, NextApiResponse } from 'next'
import { reinforcementLearner } from '@/models/reinforcement'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const stats = reinforcementLearner.getStats()
  return res.status(200).json({
    states: stats.states,
    totalQValues: stats.totalQValues,
    avgQ: stats.avgQ,
    minQ: stats.minQ,
    maxQ: stats.maxQ,
    experiences: stats.experiences,
    trainingSteps: stats.trainingSteps,
    currentParamsCount: Object.keys(reinforcementLearner.currentParams).length,
  })
}
