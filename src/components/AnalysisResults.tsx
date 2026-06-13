import React from 'react'
import { AnalysisReport } from '@/types'
import { ExternalLink, Calendar, Clock, CheckCircle2 } from 'lucide-react'
import { formatNumber, formatDate } from '@/utils/helpers'
import ScoreCard from './ScoreCard'
import TechStack from './TechStack'
import ArchitectureSummary from './ArchitectureSummary'
import ComplexityMeter from './ComplexityMeter'
import DocsQuality from './DocsQuality'
import HealthMetrics from './HealthMetrics'
import CodeSmells from './CodeSmells'
import ImprovementSuggestions from './ImprovementSuggestions'
import OnboardingGuide from './OnboardingGuide'
import FileTreeView from './FileTree'
import ExportButton from './ExportButton'

interface AnalysisResultsProps {
  report: AnalysisReport
}

export default function AnalysisResults({ report }: AnalysisResultsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {report.owner}/{report.repoName}
                </h2>
                <span className="badge-green">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Analyzed
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <a
                  href={report.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on GitHub
                </a>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(report.generatedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(report.generatedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <ExportButton report={report} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="card">
        <div className="card-body">
          <p className="text-gray-700 leading-relaxed">{report.summary}</p>
        </div>
      </div>

      {/* Scores */}
      <ScoreCard scores={report.qualityScores} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TechStack techStack={report.techStack} />
        <ArchitectureSummary architecture={report.architecture} />
      </div>

      {/* Complexity + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComplexityMeter complexity={report.complexity} />
        <HealthMetrics health={report.health} />
      </div>

      {/* Documentation + File Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DocsQuality docs={report.docsQuality} />
        <FileTreeView tree={report.fileTree} />
      </div>

      {/* Code Smells */}
      <CodeSmells codeSmells={report.codeSmells} />

      {/* Suggestions */}
      <ImprovementSuggestions suggestions={report.suggestions} />

      {/* Onboarding Guide */}
      <OnboardingGuide guide={report.onboardingGuide} />
    </div>
  )
}
