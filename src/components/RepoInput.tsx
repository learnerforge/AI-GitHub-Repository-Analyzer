import React, { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'

interface RepoInputProps {
  onAnalyze: (url: string) => void
  loading: boolean
}

export default function RepoInput({ onAnalyze, loading }: RepoInputProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onAnalyze(url.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter GitHub repository URL... e.g. https://github.com/facebook/react"
          className="input pl-12 pr-36 h-14 text-base"
          disabled={loading}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="btn-primary h-10 px-6 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze
                <Search className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
