import React from 'react'
import { ProcessedReadme, HealthMetrics, QualityScores, TechStack } from '@/types'
import { Star, GitFork, BookOpen, Wrench, BarChart3, Layers, Lightbulb, AlertTriangle, Shield, Code } from 'lucide-react'

interface SummaryCardProps {
  processed: ProcessedReadme
  health: HealthMetrics
  scores: QualityScores
  techStack: TechStack
  repoName: string
  owner: string
  topics: string[]
}

export default function SummaryCard({ processed, health, scores, techStack, repoName, owner, topics }: SummaryCardProps) {
  const difficultyColors: Record<string, string> = {
    Beginner: 'bg-green-100 text-green-700 border-green-200',
    Intermediate: 'bg-blue-100 text-blue-700 border-blue-200',
    Advanced: 'bg-purple-100 text-purple-700 border-purple-200',
  }

  const formatCount = (n: number): string => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  return (
    <div className="card">
      <div className="card-body space-y-5">
        {/* Repo header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{owner}/{repoName}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${difficultyColors[processed.difficulty] || 'bg-gray-100 text-gray-700'}`}>
                {processed.difficulty}
              </span>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {topics.slice(0, 6).map(t => (
                  <span key={t} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full border border-primary-200">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 shrink-0">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              {formatCount(health.stars)}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-4 h-4 text-blue-500" />
              {formatCount(health.forks)}
            </span>
          </div>
        </div>

        {/* Overview */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overview</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{processed.overview}</p>
        </div>

        {/* Features */}
        {processed.features.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Key Features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {processed.features.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tech Stack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tech Stack</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {techStack.languages.slice(0, 5).map(l => (
                <span key={l.name} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md">
                  {l.name} {l.percentage > 0 && `${l.percentage}%`}
                </span>
              ))}
              {processed.techKeywords.filter(k => !techStack.languages.some(l => l.name.toLowerCase() === k)).slice(0, 3).map(k => (
                <span key={k} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-md border border-gray-200">
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frameworks &amp; Tools</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...techStack.frameworks, ...techStack.databases, ...techStack.tools].slice(0, 6).map(t => (
                <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md">
                  {t}
                </span>
              ))}
              {techStack.frameworks.length + techStack.databases.length + techStack.tools.length === 0 && (
                <span className="text-xs text-gray-400">Detected from README &amp; dependencies</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-900">
              <BarChart3 className="w-3.5 h-3.5 text-primary-500" />
              {scores.overall}/100
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Quality</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-900">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              {scores.documentation}/100
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Docs</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-900">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              {health.hasCI ? 'Yes' : 'No'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">CI/CD</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-900">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {processed.hasInstallSection ? 'Install' : 'Docs'} / {processed.hasUsageSection ? 'Usage' : 'Guide'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Sections</div>
          </div>
        </div>

        {/* README sections indicator */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {processed.headings.length > 0 && (
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              {processed.headings.length} sections
            </span>
          )}
          {processed.hasInstallSection && (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">Install ✓</span>
          )}
          {processed.hasUsageSection && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">Usage ✓</span>
          )}
          {processed.hasApiSection && (
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200">API Docs ✓</span>
          )}
        </div>
      </div>
    </div>
  )
}
