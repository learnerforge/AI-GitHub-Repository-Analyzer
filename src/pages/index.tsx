import React, { useState } from 'react'
import RepoInput from '@/components/RepoInput'
import AnalysisResults from '@/components/AnalysisResults'
import LoadingState from '@/components/LoadingState'
import { AnalysisReport } from '@/types'
import { GitBranch, BarChart3, Shield, FileText, Zap, Github } from 'lucide-react'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async (url: string) => {
    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setReport(data.report)
    } catch (err: any) {
      setError(err.message || 'Failed to analyze repository')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <BarChart3 className="w-5 h-5" />, title: 'Quality Scores', description: 'Code quality, documentation, maintainability, security & community health' },
    { icon: <GitBranch className="w-5 h-5" />, title: 'Tech Stack Detection', description: 'Identify languages, frameworks, databases, and infrastructure tools' },
    { icon: <Shield className="w-5 h-5" />, title: 'Health Metrics', description: 'Stars, contributors, activity recency, CI/CD, test coverage & bus factor' },
    { icon: <FileText className="w-5 h-5" />, title: 'Documentation Analysis', description: 'README quality, section coverage, and doc improvement suggestions' },
    { icon: <Zap className="w-5 h-5" />, title: 'Actionable Insights', description: 'Code smells, anti-patterns, and prioritized improvement suggestions' },
    { icon: <Github className="w-5 h-5" />, title: 'Onboarding Guide', description: 'Auto-generated contributor guide to help new developers get started' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!report && !loading && (
        <>
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-medium mb-6 border border-primary-200">
              <Zap className="w-4 h-4" />
              AI-Powered Repository Analysis
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Understand Any GitHub Repository<br />in Seconds
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Analyze public GitHub repositories to uncover tech stack, architecture, code quality, 
              documentation health, and get AI-powered improvement suggestions.
            </p>
          </div>

          {/* Input */}
          <div className="max-w-3xl mx-auto mb-16">
            <RepoInput onAnalyze={handleAnalyze} loading={loading} />
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="card p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Loading */}
      {loading && (
        <div className="max-w-3xl mx-auto">
          <LoadingState />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="max-w-3xl mx-auto">
          <div className="card border-red-200 bg-red-50">
            <div className="card-body text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">!</span>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Analysis Failed</h3>
              <p className="text-red-600 mb-6">{error}</p>
              <button onClick={() => setError(null)} className="btn-secondary text-sm">
                Try Another Repository
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <AnalysisResults report={report} />
      )}
    </div>
  )
}
