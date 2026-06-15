import React from 'react'
import ScoreRing from './ScoreRing'
import { QualityScores } from '@/types'

interface ScoreCardProps {
  scores: QualityScores
}

type ScoreKey = 'overall' | 'codeQuality' | 'documentation' | 'maintainability' | 'communityHealth' | 'security'

const metrics: { key: ScoreKey; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'codeQuality', label: 'Code Quality' },
  { key: 'documentation', label: 'Documentation' },
  { key: 'maintainability', label: 'Maintainability' },
  { key: 'communityHealth', label: 'Community' },
  { key: 'security', label: 'Security' },
]

export default function ScoreCard({ scores }: ScoreCardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Quality Scores</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-6 gap-x-4 justify-items-center">
          {metrics.map(({ key, label }) => (
            <ScoreRing
              key={key}
              score={scores[key]}
              size={key === 'overall' ? 140 : key === 'security' ? 100 : 100}
              strokeWidth={key === 'overall' ? 10 : 6}
              label={label}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
