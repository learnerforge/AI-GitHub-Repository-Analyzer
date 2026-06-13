import type { NextApiRequest, NextApiResponse } from 'next'
import { analysisStats } from './analyze'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const latencies = analysisStats.latencyMs
  const sorted = [...latencies].sort((a, b) => a - b)
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0
  const p95 = sorted.length > 0
    ? sorted[Math.floor(sorted.length * 0.95)]
    : 0
  const p99 = sorted.length > 0
    ? sorted[Math.floor(sorted.length * 0.99)]
    : 0
  const totalNonCached = analysisStats.total - analysisStats.cached

  return res.status(200).json({
    total: analysisStats.total,
    success: analysisStats.success,
    failed: analysisStats.failed,
    cached: analysisStats.cached,
    cacheEfficiency: analysisStats.total > 0
      ? Math.round(analysisStats.cached / analysisStats.total * 10000) / 100
      : 0,
    successRate: totalNonCached > 0
      ? Math.round(analysisStats.success / totalNonCached * 10000) / 100
      : 0,
    errorRate: totalNonCached > 0
      ? Math.round(analysisStats.failed / totalNonCached * 10000) / 100
      : 0,
    latencyMs: { avg: avgLatency, p95, p99, samples: latencies.length },
    errors: analysisStats.errors,
    uptime: process.uptime(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  })
}
