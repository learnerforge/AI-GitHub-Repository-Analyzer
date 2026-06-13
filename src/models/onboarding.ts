import { RepoInfo, TechStack } from '@/types'
import { ArchitectureAnalysis } from './architecture'
import { getOnboardingTemplate } from './knowledge'
import { detectPackageManager, detectDevCommands } from './technologies'

export function generateOnboardingGuide(
  repo: RepoInfo,
  techStack: TechStack,
  architecture: ArchitectureAnalysis
): string {
  const template = getOnboardingTemplate('default')
  const commands = detectDevCommands(repo.dependencyFiles, repo.languages)
  const pm = detectPackageManager(repo.dependencyFiles)

  const langNames = techStack.languages.slice(0, 3).map(l => l.name).join(', ') || 'Your preferred language'
  const linter = techStack.tools.find(t => t.toLowerCase().includes('eslint') || t.toLowerCase().includes('prettier')) || 'the configured linter'
  const mainFrameworks = techStack.frameworks.slice(0, 2).join(', ') || 'your framework of choice'
  const archNotes = architecture.directoryHighlights.slice(0, 4).join('\n')

  const replacements: Record<string, string> = {
    '{{REPO_URL}}': repo.url,
    '{{REPO_NAME}}': repo.name,
    '{{LANGUAGES_DISPLAY}}': langNames,
    '{{INSTALL_COMMAND}}': commands.install,
    '{{DEV_COMMAND}}': commands.dev,
    '{{BUILD_COMMAND}}': commands.build,
    '{{TEST_COMMAND}}': commands.test,
    '{{ARCHITECTURE}}': architecture.primaryPattern,
    '{{STRUCTURE_HIGHLIGHTS}}': archNotes,
    '{{LINTER}}': linter,
  }

  const sections = template.sections.map(section => {
    let result = section
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
    }
    return result
  })

  const hasDocker = Object.keys(repo.dependencyFiles).some(f =>
    ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'].includes(f)
  )
  const hasDatabase = techStack.databases.length > 0

  if (hasDocker) {
    sections.push(
      '## Docker (Optional)\n\nIf you prefer using Docker:\n```bash\ndocker-compose up -d\n```'
    )
  }

  if (hasDatabase) {
    sections.push(
      `## Database Setup\n\nThis project uses ${techStack.databases.join(', ')}. Ensure it is running locally or configure the connection in your environment variables.`
    )
  }

  sections.push(
    '## Troubleshooting\n\nIf you encounter issues:\n1. Ensure all prerequisites are installed\n2. Clear your package manager cache and reinstall dependencies\n3. Check that environment variables are properly configured\n4. Look for existing GitHub Issues or open a new one'
  )

  return sections.join('\n\n')
}
