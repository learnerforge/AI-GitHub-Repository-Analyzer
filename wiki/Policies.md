# Policies

## Security Policy

### Reporting a Vulnerability

If you discover a security vulnerability in AI GitHub Repository Analyzer, please report it privately by emailing the maintainers or opening a GitHub Issue with the `security` label.

Do not disclose the vulnerability publicly until it has been addressed.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact

### Response timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 5 business days
- **Fix timeline**: communicated after assessment

### Scope

The following are in scope:
- The FastAPI application and its dependencies
- The analysis pipeline output (data leakage)
- Authentication and authorization (if applicable)

Out of scope:
- Third-party API rate limiting
- GitHub API limitations
- Operating system security

## Privacy Policy

### What data we collect

The analyzer fetches publicly available GitHub repository metadata:

- Repository name, owner, description, topics
- File tree structure (file names and paths only, not contents)
- Language breakdown
- README content (public)
- Contributor usernames and contribution counts
- Star, fork, and issue counts

### What data we store

Analysis reports are saved as JSON files in `data/results/`. These contain:

- The raw analysis results (scores, detected tech stack, code smells, etc.)
- A truncated copy of the README (first 20KB)
- Repository metadata (name, owner, URLs)

### What data we do NOT collect

- Personal information beyond public GitHub usernames
- Private repository data
- Source code contents (file bodies are never read)
- Credentials, tokens, or secrets
- IP addresses or browser fingerprints
- Analytics or tracking data

### Data retention

Analysis reports are stored indefinitely in `data/results/`. To delete a report, remove the corresponding JSON file from this directory.

### Third-party services

The analyzer communicates with:
- **GitHub API** — to fetch public repository data
- **Optional AI providers** (Gemini, Groq, OpenAI) — only if configured with an API key

No data is sent to any third party unless you explicitly configure an AI provider API key.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/learnerforge/AI-GitHub-Repository-Analyzer/blob/main/LICENSE) file for details.

## Acceptable Use

This tool is intended for:
- Evaluating open-source projects
- Improving documentation and code quality
- Learning about repository analysis techniques

This tool should NOT be used for:
- Mass scraping or harvesting GitHub data
- Competitive intelligence on private repositories
- Any purpose that violates GitHub's Terms of Service

## Support Policy

### Community support

- **GitHub Issues** — Bug reports and feature requests
- **Wiki** — Documentation and guides
- **README** — Quick start and configuration

### Maintenance

This project is maintained by volunteers. Response times vary. We aim to:

- Acknowledge issues within 3 business days
- Provide initial feedback within 5 business days
- Release patch fixes within 2 weeks for critical bugs

### Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **Major** — Breaking changes to the API or report schema
- **Minor** — New features, non-breaking additions
- **Patch** — Bug fixes and documentation updates

## Contribution Policy

By contributing to this project, you agree that:
1. Your contributions are licensed under the MIT License
2. You have the right to submit the contribution
3. Your contribution may be modified or removed by maintainers

See [Contributing](Contributing) for detailed guidelines.
