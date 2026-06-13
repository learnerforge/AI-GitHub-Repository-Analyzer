import React from 'react'
import { CodeSmell } from '@/types'
import { AlertTriangle, AlertOctagon, Info, Bug } from 'lucide-react'
import { SEVERITY_COLORS } from '@/utils/constants'

interface CodeSmellsProps {
  codeSmells: CodeSmell[]
}

const severityIcons: Record<string, React.ReactNode> = {
  critical: <AlertOctagon className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
}

export default function CodeSmells({ codeSmells }: CodeSmellsProps) {
  if (!codeSmells || codeSmells.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Code Smells & Issues</h3>
        </div>
        <div className="card-body text-gray-500 text-sm">No code smells detected</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Code Smells & Issues</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
              {codeSmells.filter(s => s.severity === 'critical').length}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {codeSmells.filter(s => s.severity === 'warning').length}
            </span>
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              {codeSmells.filter(s => s.severity === 'info').length}
            </span>
          </div>
        </div>
      </div>
      <div className="card-body space-y-3">
        {codeSmells.map((smell, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-4 rounded-lg border ${SEVERITY_COLORS[smell.severity]}`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {severityIcons[smell.severity] || <Bug className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  {smell.severity}
                </span>
                {smell.category && (
                  <span className="badge opacity-70 text-xs">{smell.category}</span>
                )}
              </div>
              <p className="text-sm font-medium">{smell.title}</p>
              <p className="text-sm opacity-80 mt-0.5">{smell.description}</p>
              {smell.location && (
                <p className="text-xs font-mono mt-1 opacity-60">{smell.location}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
