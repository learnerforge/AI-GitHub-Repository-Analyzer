import React from 'react'
import { HealthMetrics as HealthMetricsType } from '@/types'
import { formatNumber, timeAgo } from '@/utils/helpers'
import {
  Star, GitFork, AlertCircle, Users,
  GitCommitHorizontal, Activity, Shield,
} from 'lucide-react'

interface HealthMetricsProps {
  health: HealthMetricsType
}

export default function HealthMetrics({ health }: HealthMetricsProps) {
  const isLocalOnly = health.stars === 0 && health.forks === 0

  const stats = [
    {
      icon: <Star className="w-4 h-4" />,
      label: 'Stars',
      value: isLocalOnly ? 'N/A (local)' : formatNumber(health.stars),
      color: 'text-amber-500',
    },
    {
      icon: <GitFork className="w-4 h-4" />,
      label: 'Forks',
      value: isLocalOnly ? 'N/A (local)' : formatNumber(health.forks),
      color: 'text-blue-500',
    },
    {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Open Issues',
      value: formatNumber(health.openIssues),
      color: 'text-red-500',
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: 'Contributors',
      value: health.contributorCount.toString(),
      color: 'text-green-500',
    },
    {
      icon: <GitCommitHorizontal className="w-4 h-4" />,
      label: 'Last Commit',
      value: health.lastCommitDays === 999 ? 'N/A' : timeAgo(new Date(Date.now() - health.lastCommitDays * 86400000).toISOString()),
      color: 'text-purple-500',
    },
    {
      icon: <Shield className="w-4 h-4" />,
      label: 'Bus Factor',
      value: health.busFactor.toString(),
      color: 'text-cyan-500',
    },
  ]

  const checks = [
    { label: 'Recent Activity', pass: health.hasRecentActivity },
    { label: 'CI/CD Pipeline', pass: health.hasCI },
    { label: 'Tests', pass: health.hasTests },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Repository Health</h3>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                health.overall >= 70 ? 'bg-green-500' :
                health.overall >= 40 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${health.overall}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700">{health.overall}/100</span>
          {isLocalOnly && (
            <p className="text-xs text-gray-400 mt-1">Community data unavailable (local clone analysis)</p>
          )}
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className={stat.color}>{stat.icon}</span>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-sm font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-sm font-semibold text-gray-700 mb-3">Health Checks</h4>
        <div className="flex flex-wrap gap-3">
          {checks.map((check) => (
            <div
              key={check.label}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                check.pass
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200'
              }`}
            >
              <Activity className={`w-4 h-4 ${check.pass ? 'text-green-500' : 'text-gray-400'}`} />
              {check.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
