import React from 'react'
import { ArrowRight } from 'lucide-react'

interface ImprovementSuggestionsProps {
  suggestions: string[]
}

export default function ImprovementSuggestions({ suggestions }: ImprovementSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Improvement Suggestions</h3>
        </div>
        <div className="card-body text-gray-500 text-sm">No suggestions available</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Improvement Suggestions</h3>
        <p className="text-sm text-gray-500">{suggestions.length} actionable insights</p>
      </div>
      <div className="card-body space-y-3">
        {suggestions.map((suggestion, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-100"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{suggestion}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  )
}
