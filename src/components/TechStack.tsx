import React from 'react'
import { TechStack as TechStackType } from '@/types'
import { Code2, Database, Wrench, Cloud, Puzzle } from 'lucide-react'

interface TechStackProps {
  techStack: TechStackType
}

const sectionIcon: Record<string, React.ReactNode> = {
  languages: <Code2 className="w-4 h-4" />,
  frameworks: <Puzzle className="w-4 h-4" />,
  databases: <Database className="w-4 h-4" />,
  tools: <Wrench className="w-4 h-4" />,
  infrastructure: <Cloud className="w-4 h-4" />,
}

export default function TechStack({ techStack }: TechStackProps) {
  const sections: { key: keyof TechStackType; label: string }[] = [
    { key: 'languages', label: 'Languages' },
    { key: 'frameworks', label: 'Frameworks' },
    { key: 'databases', label: 'Databases' },
    { key: 'tools', label: 'Tools' },
    { key: 'infrastructure', label: 'Infrastructure' },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Technology Stack</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map(({ key, label }) => {
            const items = techStack[key]
            if (!items || (Array.isArray(items) && items.length === 0)) return null

            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-primary-600">{sectionIcon[key] || <Code2 className="w-4 h-4" />}</span>
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{label}</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(items) && items.map((item: any, i: number) => (
                    <span key={i} className="badge-blue">
                      {typeof item === 'string' ? item : item.name}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
