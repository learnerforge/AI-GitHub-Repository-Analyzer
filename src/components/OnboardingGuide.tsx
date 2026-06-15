import React from 'react'
import { BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface OnboardingGuideProps {
  guide: string
}

export default function OnboardingGuide({ guide }: OnboardingGuideProps) {
  if (!guide) return null

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold">Onboarding Guide</h3>
        </div>
        <p className="text-sm text-gray-500">Quick start for new contributors</p>
      </div>
      <div className="card-body">
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
          <ReactMarkdown>{guide}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
