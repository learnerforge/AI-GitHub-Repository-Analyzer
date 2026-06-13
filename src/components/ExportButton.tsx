import React from 'react'
import { Download, FileDown } from 'lucide-react'
import { AnalysisReport } from '@/types'

interface ExportButtonProps {
  report: AnalysisReport
}

export default function ExportButton({ report }: ExportButtonProps) {
  const exportMarkdown = () => {
    const content = `# Analysis Report: ${report.owner}/${report.repoName}

**Generated:** ${new Date(report.generatedAt).toLocaleString()}
**Repository:** ${report.repoUrl}

## Summary
${report.summary}

## Quality Scores
| Category | Score |
|----------|-------|
| Overall | ${report.qualityScores.overall}/100 |
| Code Quality | ${report.qualityScores.codeQuality}/100 |
| Documentation | ${report.qualityScores.documentation}/100 |
| Maintainability | ${report.qualityScores.maintainability}/100 |
| Community Health | ${report.qualityScores.communityHealth}/100 |
| Security | ${report.qualityScores.security}/100 |

## Technology Stack
- **Languages:** ${report.techStack.languages.map(l => `${l.name} (${l.percentage}%)`).join(', ')}
- **Frameworks:** ${report.techStack.frameworks.join(', ') || 'N/A'}
- **Databases:** ${report.techStack.databases.join(', ') || 'N/A'}
- **Tools:** ${report.techStack.tools.join(', ') || 'N/A'}

## Architecture
${report.architecture}

## Code Complexity
- Total Files: ${report.complexity.fileCount}
- Total Lines: ${report.complexity.totalLines}
- Average File Size: ${report.complexity.averageFileSize} lines

## Repository Health
- Stars: ${report.health.stars}
- Forks: ${report.health.forks}
- Open Issues: ${report.health.openIssues}
- Contributors: ${report.health.contributorCount}

## Improvement Suggestions
${report.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Onboarding Guide
${report.onboardingGuide}
`

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.owner}-${report.repoName}-analysis.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={exportMarkdown} className="btn-secondary text-sm">
      <FileDown className="w-4 h-4 mr-1.5" />
      Export Markdown
    </button>
  )
}
