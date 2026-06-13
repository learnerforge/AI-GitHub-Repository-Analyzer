import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, GitCompare, Check, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface CompareDiff {
  field: string
  values: (string | number | boolean | null)[]
  differs: boolean
}

interface CompareResult {
  reports: { id: string; repoName: string; owner: string }[]
  diffs: CompareDiff[]
}

function getTrendIcon(current: number, others: number[]) {
  const avg = others.reduce((a, b) => a + b, 0) / others.length
  if (current > avg * 1.1) return <TrendingUp className="w-4 h-4 text-green-500" />
  if (current < avg * 0.9) return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

export default function ComparePage() {
  const router = useRouter()
  const [availableRepos, setAvailableRepos] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/compare?repos=')
      .catch(() => {
        const names = new Set<string>()
        const prefix = ['ajeetdsouza-zoxide','BurntSushi-ripgrep','denoland-deno','django-django','expressjs-express','fastapi-fastapi','huggingface-transformers','kubernetes-kubernetes','langchain-ai-langchain','nodejs-node','pallets-flask','sveltejs-svelte','tensorflow-tensorflow','vuejs-vue','tiangolo-fastapi']
        prefix.forEach(n => names.add(n))
        setAvailableRepos(Array.from(names).sort())
      })
      .then(() => {
        const names = new Set<string>()
        const known = [
          'ajeetdsouza-zoxide','BurntSushi-ripgrep','denoland-deno','django-django','expressjs-express','fastapi-fastapi','huggingface-transformers','kubernetes-kubernetes','langchain-ai-langchain','nodejs-node','pallets-flask','sveltejs-svelte','tensorflow-tensorflow','vuejs-vue','tiangolo-fastapi',
          'antonmedv-fx','crewAIInc-crewAI','comfyanonymous-ComfyUI','flet-dev-flet','ggerganov-llama.cpp','gin-gonic-gin','httpie-cli','jesseduffield-lazygit','jina-ai-jina','junegunn-fzf','langflow-ai-langflow','laravel-laravel','mlflow-mlflow','muesli-duf','nestjs-nest','oobabooga-text-generation-webui','open-webui-open-webui','postgres-postgres','rails-rails','ray-project-ray','redis-redis','rs-curlie','scikit-learn-scikit-learn','sharkdp-bat','sharkdp-fd','simonw-llm','torvalds-linux','yt-dlp-yt-dlp',
          'apache-cassandra','duckdb-duckdb','mongodb-mongo','sqlite-sqlite',
        ]
        known.forEach(n => names.add(n))
        setAvailableRepos(Array.from(names).sort())
      })
  }, [])

  const toggleRepo = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    } else {
      if (next.size >= 5) return
      next.add(name)
    }
    setSelected(next)
  }

  const handleCompare = async () => {
    if (selected.size < 2) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const ids = Array.from(selected).map(s => {
        const parts = s.split('-')
        const owner = parts[0]
        const repo = parts.slice(1).join('-')
        return `${owner}/${repo}`
      })
      const res = await fetch(`/api/compare?repos=${encodeURIComponent(ids.join(','))}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => router.push('/')}
        className="btn-secondary text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Home
      </button>

      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Compare Repositories</h1>
              <p className="text-sm text-gray-500">Select up to 5 repositories to compare side by side</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4 max-h-64 overflow-y-auto p-1">
            {availableRepos.map(name => {
              const isSelected = selected.has(name)
              return (
                <button
                  key={name}
                  onClick={() => toggleRepo(name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                    isSelected
                      ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="truncate">{name.replace(/-/g, '/')}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {selected.size} selected {selected.size >= 2 ? '(ready)' : '(need at least 2)'}
            </span>
            <button
              onClick={handleCompare}
              disabled={selected.size < 2 || loading}
              className="btn-primary"
            >
              {loading ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 mb-6">
          <div className="card-body">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              <BarChart3 className="w-5 h-5 inline mr-2" />
              Comparison Results
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 w-48">Metric</th>
                    {result.reports.map((r, i) => (
                      <th key={i} className={`text-center py-3 px-4 font-medium ${i === 0 ? 'text-primary-700' : 'text-gray-700'}`}>
                        {r.owner}/{r.repoName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.diffs.map((diff, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${
                      diff.differs && result.reports.length >= 2 ? 'bg-amber-50/50' : ''
                    }`}>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        <div className="flex items-center gap-2">
                          {diff.field}
                          {diff.differs && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              differs
                            </span>
                          )}
                        </div>
                      </td>
                      {diff.values.map((v, j) => (
                        <td key={j} className={`py-3 px-4 text-center ${
                          j === 0 ? 'font-semibold text-gray-900' : 'text-gray-600'
                        }`}>
                          <div className="flex items-center justify-center gap-1.5">
                            {typeof v === 'number' && result.reports.length > 1 && getTrendIcon(v, diff.values.filter((_, idx) => idx !== j) as number[])}
                            <span>{v ?? 'N/A'}</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.diffs.filter(d => d.differs).length === 0 && (
              <p className="text-center text-gray-500 py-4">All selected repositories have very similar scores.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
