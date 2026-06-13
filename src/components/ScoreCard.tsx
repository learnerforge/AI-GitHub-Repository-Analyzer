import React from 'react'
import ScoreRing from './ScoreRing'
import { QualityScores } from '@/types'

interface ScoreCardProps {
  scores: QualityScores
}

const metrics: { key: keyof QualityScores; label: string }[] = [
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
        <div className="flex flex-wrap gap-8 justify-center">
          {metrics.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center">
              <ScoreRing
                score={scores[key]}
                size={key === 'overall' ? 140 : 100}
                strokeWidth={key === 'overall' ? 10 : 6}
                label={label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
