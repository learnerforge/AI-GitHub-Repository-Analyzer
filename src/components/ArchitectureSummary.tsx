import React from 'react'
import { Building2, FileText } from 'lucide-react'

interface ArchitectureSummaryProps {
  architecture: string
}

export default function ArchitectureSummary({ architecture }: ArchitectureSummaryProps) {
  if (!architecture) return null

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold">Architecture Overview</h3>
        </div>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{architecture}</p>
      </div>
    </div>
  )
}
