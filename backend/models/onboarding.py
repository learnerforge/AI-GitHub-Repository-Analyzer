from __future__ import annotations
from .knowledge import get_onboarding_template
from .technologies import detect_package_manager, detect_dev_commands


def generate_onboarding_guide(
    repo: dict, tech_stack: dict, architecture: dict,
) -> str:
    template = get_onboarding_template()
    commands = detect_dev_commands(repo.get('dependencyFiles', {}), repo.get('languages', {}))
    pm = detect_package_manager(repo.get('dependencyFiles', {}))

    langs = [l.get('name', '') for l in (tech_stack.get('languages', []) or [])[:3]]
    lang_names = ', '.join(langs) or 'Your preferred language'
    tools = tech_stack.get('tools', []) or []
    linter = next((t for t in tools if 'eslint' in t.lower() or 'prettier' in t.lower()), 'the configured linter')
    frameworks = (tech_stack.get('frameworks', []) or [])[:2]
    main_fw = ', '.join(frameworks) or 'your framework of choice'
    arch_notes = '\n'.join((architecture.get('directoryHighlights', []) or [])[:4])

    replacements = {
        '{{REPO_URL}}': repo.get('url', ''),
        '{{REPO_NAME}}': repo.get('name', ''),
        '{{LANGUAGES_DISPLAY}}': lang_names,
        '{{INSTALL_COMMAND}}': commands.get('install', ''),
        '{{DEV_COMMAND}}': commands.get('dev', ''),
        '{{BUILD_COMMAND}}': commands.get('build', ''),
        '{{TEST_COMMAND}}': commands.get('test', ''),
        '{{ARCHITECTURE}}': architecture.get('primaryPattern', architecture.get('primary', 'Standard')),
        '{{STRUCTURE_HIGHLIGHTS}}': arch_notes,
        '{{LINTER}}': linter,
    }

    sections = list(template[0].get('sections', [])) if template else []
    result_sections: list[str] = []
    for section in sections:
        if isinstance(section, str):
            result = section
            for key, value in replacements.items():
                result = result.replace(key, value)
            result_sections.append(result)

    dep_files = repo.get('dependencyFiles', {})
    has_docker = any(f in dep_files for f in ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'])
    has_database = len(tech_stack.get('databases', []) or []) > 0

    if has_docker:
        result_sections.append(
            '## Docker (Optional)\n\nIf you prefer using Docker:\n```bash\ndocker-compose up -d\n```'
        )
    if has_database:
        dbs = ', '.join(tech_stack.get('databases', []))
        result_sections.append(
            f'## Database Setup\n\nThis project uses {dbs}. Ensure it is running locally or configure the connection in your environment variables.'
        )
    result_sections.append(
        '## Troubleshooting\n\nIf you encounter issues:\n1. Ensure all prerequisites are installed\n2. Clear your package manager cache and reinstall dependencies\n3. Check that environment variables are properly configured\n4. Look for existing GitHub Issues or open a new one'
    )
    return '\n\n'.join(result_sections)
