import React from 'react'
import { ComplexityMetrics } from '@/types'
import { BarChart3, Files, Type, Ruler } from 'lucide-react'

interface ComplexityMeterProps {
  complexity: ComplexityMetrics
}

export default function ComplexityMeter({ complexity }: ComplexityMeterProps) {
  const stats = [
    { icon: <Files className="w-4 h-4" />, label: 'Total Files', value: complexity.fileCount.toLocaleString() },
    { icon: <Type className="w-4 h-4" />, label: 'Total Lines', value: complexity.totalLines.toLocaleString() },
    { icon: <Ruler className="w-4 h-4" />, label: 'Avg File Size', value: `${complexity.averageFileSize} lines` },
    { icon: <BarChart3 className="w-4 h-4" />, label: 'Languages', value: complexity.languageBreakdown.length.toString() },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Code Complexity</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-primary-600">{stat.icon}</span>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-sm font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-sm font-semibold text-gray-700 mb-3">Breakdown by Language</h4>
        <div className="space-y-2">
          {complexity.languageBreakdown.slice(0, 8).map((lang) => {
            const percentage = complexity.totalLines > 0
              ? (lang.lines / complexity.totalLines) * 100
              : 0
            return (
              <div key={lang.language}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{lang.language}</span>
                  <span className="text-gray-500">{lang.files} files &middot; {lang.lines.toLocaleString()} lines</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
