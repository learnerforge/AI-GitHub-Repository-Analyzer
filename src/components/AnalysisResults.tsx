import React, { useState } from 'react'
import { AnalysisReport } from '@/types'
import { ExternalLink, Calendar, Clock, CheckCircle2, Edit3, GitCompare, Save, X, ThumbsUp, ThumbsDown } from 'lucide-react'
import { formatDate } from '@/utils/helpers'
import ScoreCard from './ScoreCard'
import SummaryCard from './SummaryCard'
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
  onReportUpdate?: (updated: AnalysisReport) => void
}

function FeedbackButtons({ section }: { section: string }) {
  const [sent, setSent] = useState<'up' | 'down' | null>(null)

  const sendFeedback = async (rating: number) => {
    try {
      await fetch('/api/train/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: window.location.href, rating, category: section }),
      })
    } catch {}
    setSent(rating >= 4 ? 'up' : 'down')
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => sendFeedback(5)}
        className={`p-1 rounded transition-colors ${sent === 'up' ? 'text-green-500 bg-green-50' : 'text-gray-300 hover:text-gray-500'}`}
        title="Helpful"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => sendFeedback(1)}
        className={`p-1 rounded transition-colors ${sent === 'down' ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-gray-500'}`}
        title="Not helpful"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function AnalysisResults({ report, onReportUpdate }: AnalysisResultsProps) {
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ ...report })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/report/${encodeURIComponent(`${report.owner}:${report.repoName}`)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editData.summary,
          architecture: editData.architecture,
          onboardingGuide: editData.onboardingGuide,
          suggestions: editData.suggestions,
          techStack: editData.techStack,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditing(false)
      onReportUpdate?.(data.report)
    } catch (err: any) {
      alert('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData({ ...report })
    setEditing(false)
  }

  return (
    <div className="space-y-6">
      {editing && (
        <div className="card border-primary-300 bg-primary-50/50">
          <div className="card-body flex items-center justify-between">
            <span className="text-sm font-medium text-primary-700">Editing report. Changes are saved locally.</span>
            <div className="flex items-center gap-2">
              <button onClick={handleCancel} className="btn-secondary text-sm" disabled={saving}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary text-sm" disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="flex items-start gap-2">
              <a
                href={`/compare`}
                className="btn-secondary text-sm"
              >
                <GitCompare className="w-4 h-4 mr-1.5" />
                Compare
              </a>
              <button
                onClick={() => setEditing(!editing)}
                className={`btn-secondary text-sm ${editing ? 'bg-primary-50 border-primary-300' : ''}`}
              >
                <Edit3 className="w-4 h-4 mr-1.5" />
                {editing ? 'Cancel' : 'Edit'}
              </button>
              <ExportButton report={report} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {report.processedReadme ? (
        <SummaryCard
          processed={report.processedReadme}
          health={report.health}
          scores={report.qualityScores}
          repoName={report.repoName}
          owner={report.owner}
          topics={report.topics || []}
        />
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Summary</h3>
              {!editing && <FeedbackButtons section="summary" />}
            </div>
            {editing ? (
              <textarea
                value={editData.summary}
                onChange={e => setEditData({ ...editData, summary: e.target.value })}
                className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              />
            ) : (
              <p className="text-gray-700 leading-relaxed">{report.summary}</p>
            )}
          </div>
        </div>
      )}

      {/* Scores */}
      <ScoreCard scores={report.qualityScores} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Tech Stack</h3>
              {!editing && <FeedbackButtons section="techStack" />}
            </div>
            <TechStack techStack={editing ? editData.techStack : report.techStack} />
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Architecture</h3>
              {!editing && <FeedbackButtons section="architecture" />}
            </div>
            {editing ? (
              <textarea
                value={editData.architecture}
                onChange={e => setEditData({ ...editData, architecture: e.target.value })}
                className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              />
            ) : (
              <ArchitectureSummary architecture={report.architecture} />
            )}
          </div>
        </div>
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
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Suggestions</h3>
            {!editing && <FeedbackButtons section="suggestions" />}
          </div>
          {editing ? (
            <div className="space-y-2">
              {editData.suggestions.map((s, i) => (
                <input
                  key={i}
                  value={s}
                  onChange={e => {
                    const next = [...editData.suggestions]
                    next[i] = e.target.value
                    setEditData({ ...editData, suggestions: next })
                  }}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
              ))}
            </div>
          ) : (
            <ImprovementSuggestions suggestions={report.suggestions} />
          )}
        </div>
      </div>

      {/* Onboarding Guide */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Onboarding Guide</h3>
            {!editing && <FeedbackButtons section="onboardingGuide" />}
          </div>
          {editing ? (
            <textarea
              value={editData.onboardingGuide}
              onChange={e => setEditData({ ...editData, onboardingGuide: e.target.value })}
              className="w-full min-h-[200px] p-3 border border-gray-200 rounded-lg text-gray-700 text-sm font-mono focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          ) : (
            <OnboardingGuide guide={report.onboardingGuide} />
          )}
        </div>
      </div>
    </div>
  )
}
