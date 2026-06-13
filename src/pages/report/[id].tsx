import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AnalysisResults from '@/components/AnalysisResults'
import LoadingState from '@/components/LoadingState'
import { AnalysisReport } from '@/types'
import { ArrowLeft } from 'lucide-react'

export default function ReportPage() {
  const router = useRouter()
  const { id } = router.query
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || typeof id !== 'string') return

    const fetchReport = async () => {
      setLoading(true)
      setError(null)

      try {
        const [owner, name] = id.split(':')
        if (!owner || !name) {
          throw new Error('Invalid report ID')
        }

        const res = await fetch(`/api/repos/${encodeURIComponent(id)}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load report')
        }

        const analyzeRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: `https://github.com/${owner}/${name}` }),
        })

        const analyzeData = await analyzeRes.json()

        if (!analyzeRes.ok) {
          throw new Error(analyzeData.error || 'Analysis failed')
        }

        setReport(analyzeData.report)
      } catch (err: any) {
        setError(err.message || 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => router.push('/')}
        className="btn-secondary text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Home
      </button>

      {loading && <LoadingState message="Loading report..." />}

      {error && (
        <div className="card border-red-200 bg-red-50">
          <div className="card-body text-center">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {report && !loading && <AnalysisResults report={report} />}
    </div>
  )
}
