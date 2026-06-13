import React from 'react'
import { DocsQuality as DocsQualityType } from '@/types'
import { CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react'

interface DocsQualityProps {
  docs: DocsQualityType
}

export default function DocsQuality({ docs }: DocsQualityProps) {
  const sections = [
    { label: 'README', present: docs.hasReadme },
    { label: 'Contributing Guide', present: docs.hasContributing },
    { label: 'Code of Conduct', present: docs.hasCodeOfConduct },
    { label: 'License', present: docs.hasLicense },
    { label: 'Changelog', present: docs.hasChangelog },
    { label: 'API Documentation', present: docs.hasApiDocs },
    { label: 'Wiki', present: docs.hasWiki },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Documentation Quality</h3>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                docs.readmeScore >= 70 ? 'bg-green-500' :
                docs.readmeScore >= 40 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${docs.readmeScore}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700">{docs.readmeScore}/100</span>
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {sections.map((s) => (
            <div
              key={s.label}
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                s.present
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {s.present ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${s.present ? 'text-green-800' : 'text-gray-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {docs.suggestions.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Suggestions</h4>
            <div className="space-y-2">
              {docs.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {docs.sectionCoverage.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-gray-700 mt-6 mb-3">Section Coverage</h4>
            <div className="space-y-2">
              {docs.sectionCoverage.map((s) => (
                <div key={s.section} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${s.present ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={s.present ? 'text-gray-700' : 'text-gray-400'}>{s.section}</span>
                  {s.present && <FileText className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
