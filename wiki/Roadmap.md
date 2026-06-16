# Roadmap

## Short-term (next 3 months)

### Language & Framework Expansion
- [x] Core tech detection with 147+ patterns
- [ ] Add 50+ more language and framework patterns
- [ ] Improve detection confidence with file content analysis (heuristic, not full parsing)
- [ ] Support for monorepo workspace detection (npm workspaces, Bazel, Nx)

### Analysis Quality
- [ ] Cross-reference detected tech with actual file usage for consistency scoring
- [ ] Add dependency freshness checks (compare against latest versions via registry APIs)
- [ ] Improve license detection with SPDX identifier matching
- [ ] Add security advisory scanning (check deps against known CVEs)

### User Experience
- [ ] Dashboard with historical trend charts
- [ ] Email reports for scheduled re-analyses
- [ ] Batch analysis with CSV/JSON input files
- [ ] Webhook support for CI/CD integration

### API & Integration
- [ ] OpenAPI/Swagger documentation page
- [ ] Rate limiting and API key management for multi-tenant usage
- [ ] GitHub App integration (auto-analyze on push/PR)

## Medium-term (3-6 months)

### Deep Analysis
- [ ] AST-level language detection without executing code
- [ ] API endpoint discovery from route definition files
- [ ] Database schema detection from ORM models and migration files
- [ ] Test quality estimation (naming conventions, coverage patterns)

### Machine Learning
- [ ] Replace heuristic scoring with a lightweight regression model
- [ ] Train on 10,000+ labeled repos for personality classification
- [ ] Semantic README section embedding for better feature extraction
- [ ] Anomaly detection for unusual repo characteristics

### Platform
- [ ] Multi-user support with saved preferences
- [ ] Organization-level dashboards
- [ ] Public API for third-party integrations
- [ ] Plugin system for custom detectors and scorers

## Long-term (6-12 months)

### Advanced Features
- [ ] Dependency graph visualization
- [ ] Contributor network analysis
- [ ] Code churn and velocity metrics
- [ ] Automated PR reviews based on analysis history
- [ ] Repository health alerts and monitoring

### Community
- [ ] Public instance at analyze.example.com
- [ ] Community-contributed detector plugins
- [ ] Integration marketplace (Slack, Discord, GitHub Actions)
- [ ] Localization support (i18n for reports)

## Ideas under consideration

- **README template generator** — Suggest README improvements based on detected gaps
- **Score comparison** — Benchmark a repo against similar projects
- **Migration guide generator** — When a dependency is outdated, suggest migration paths
- **License compatibility checker** — Flag incompatible dependency licenses
- **PDF report export** — Download analysis as formatted PDF
- **VSCode extension** — Analyze repos without leaving the editor

---

**Have a feature idea?** Open a [GitHub Issue](https://github.com/learnerforge/AI-GitHub-Repository-Analyzer/issues) with the `enhancement` tag.
