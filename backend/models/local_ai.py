from __future__ import annotations
import re
import time
from typing import Any
from .summarizer import generate_summary
from .technologies import detect_technologies
from .architecture import analyze_architecture
from .smell_detector import detect_code_smells
from .quality_scorer import compute_quality_scores, compute_reward
from .onboarding import generate_onboarding_guide
from .self_healing import SelfHealingLayer, self_healing_layer
from .reinforcement import (
    ReinforcementLearner, reinforcement_learner,
    compute_readme_metrics, quantize_state,
)
from .readme_processor import process_readme
from .text_analyzer import extract_keywords
from .deep_readme import analyze_readme_deep
from .md_compiler import compile_markdown


def _strip_markdown(text: str) -> str:
    if not text:
        return ''
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'``([^`]+)``', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'<https?://[^>]+>', '', text)
    text = re.sub(r'https?://[^\s)]+', '', text)
    text = re.sub(r'(?<!\w)#{1,6}\s+', '', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'~~(.+?)~~', r'\1', text)
    text = re.sub(r'(?<!\w)[-*_]{3,}(?!\w)', '', text)
    text = re.sub(r'\|[^\n]*\|[\s]*', '', text)
    text = re.sub(r'(?<!\w)[-*+]\s+(?![\s])', '', text)
    text = re.sub(r'(?<!\d)\d+[.)]\s+', '', text)
    text = re.sub(r'>\s+', '', text)
    text = re.sub(r'`[^`]+`', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\s+\.', '.', text)
    text = re.sub(r'\.\s+\.', '.', text)
    text = re.sub(r'\.{2,}', '.', text)
    return text.strip()


class LocalAIProvider:
    def __init__(
        self,
        use_rl: bool = True,
        use_healing: bool = True,
        verbosity: str = 'normal',
    ) -> None:
        self.self_healing: SelfHealingLayer = self_healing_layer
        self.rl: ReinforcementLearner = reinforcement_learner
        self.options = {
            'useReinforcementLearning': use_rl,
            'useSelfHealing': use_healing,
            'verbosity': verbosity,
        }

    def analyze(self, input_data: dict) -> dict:
        if not input_data:
            raise ValueError('Analysis input is required')
        readme = input_data.get('readme', '') or ''
        if len(readme) > 100000:
            readme = readme[:100000] + '\n\n<!-- TRUNCATED at 100KB -->'
            input_data['readme'] = readme

        self.self_healing.reset_for_new_analysis()
        start_time = time.time()

        has_tests = self._detect_has_tests(input_data.get('fileTree', []))
        has_ci = self._detect_has_ci(input_data.get('fileTree', []))
        lang_count = len(input_data.get('languages', {}))
        total_bytes = sum(input_data.get('languages', {}).values())

        summary = self._run_with_healing('summary', lambda: self._generate_summary(input_data))
        tech_stack = self._run_with_healing('techStack', lambda: self._detect_tech_stack(input_data, total_bytes))
        arch_result = self._run_with_healing('architecture', lambda: self._analyze_architecture(input_data))

        smell_input = {
            'fileTree': input_data.get('fileTree', []),
            'readmeContent': readme,
            'languages': input_data.get('languages', {}),
            'dependencyFiles': input_data.get('dependencyFiles', {}),
            'hasTests': has_tests,
            'hasCI': has_ci,
            'contributorCount': input_data.get('contributorCount', 0),
        }
        code_smells = self._run_with_healing('codeSmells', lambda: detect_code_smells(smell_input))
        suggestions = self._run_with_healing('suggestions', lambda: self._generate_suggestions(code_smells, tech_stack, input_data.get('fileTree', [])))
        onboarding_guide = self._run_with_healing('onboardingGuide', lambda: self._generate_onboarding(input_data, tech_stack, arch_result))
        quality_scores = self._run_with_healing('qualityScores', lambda: self._score_quality(input_data, tech_stack, code_smells, has_tests, has_ci, lang_count, total_bytes))

        deep_readme = self._run_with_healing('deepReadme', lambda: analyze_readme_deep(readme))
        compiled_readme = self._run_with_healing('compiledReadme', lambda: compile_markdown(readme))

        if self.options['useReinforcementLearning']:
            self._run_reinforcement_learning(input_data, quality_scores)

        execution_time = (time.time() - start_time) * 1000
        self.self_healing.record_adaptation('full_analysis', {'executionTime': execution_time}, {})

        return {
            'summary': summary,
            'techStack': tech_stack,
            'architecture': arch_result.get('description', arch_result.get('architecture', '')),
            'codeSmells': code_smells,
            'suggestions': suggestions,
            'onboardingGuide': onboarding_guide,
            'qualityScores': quality_scores,
            'deepReadme': deep_readme,
            'compiledReadme': compiled_readme,
        }

    def _run_with_healing(self, component: str, fn: callable) -> Any:
        if self.options['useSelfHealing'] and self.self_healing.is_circuit_tripped(component):
            return self.self_healing.get_default_for(component)
        result = fn()
        if self.options['useSelfHealing']:
            strategy = self.self_healing.get_adapted_strategy(component)
            validation = self.self_healing.validate_component(component, result, strategy)
            if not validation['valid']:
                self.self_healing.record_failure(component)
                healed = self.self_healing.heal_output(component, result, validation)
                result = healed
                if self.self_healing.should_retry(component):
                    self.self_healing.record_retry(component)
                    retry_result = fn()
                    retry_strategy = self.self_healing.get_adapted_strategy(component)
                    retry_val = self.self_healing.validate_component(component, retry_result, retry_strategy)
                    if retry_val['valid'] or retry_val['confidence'] > validation['confidence']:
                        result = retry_result
                        self.self_healing.reset_circuit(component)
        return result

    def _generate_summary(self, input_data: dict) -> str:
        languages = input_data.get('languages', {})
        topics = input_data.get('topics', []) or []
        description = input_data.get('description', '')
        stars = input_data.get('stars', 0) or 0
        forks = input_data.get('forks', 0) or 0
        readme = input_data.get('readme', '') or ''
        file_tree = input_data.get('fileTree', [])
        dep_files = input_data.get('dependencyFiles', {})

        parts: list[str] = []
        lang_names = list(languages.keys())
        total_bytes = sum(languages.values())

        if description:
            parts.append(str(description))
        if lang_names and total_bytes > 0:
            sorted_langs = sorted(lang_names, key=lambda l: languages[l], reverse=True)[:4]
            top = [f'{l} ({round(languages[l] / total_bytes * 100)}%)' for l in sorted_langs]
            topic_str = f' — topics: {", ".join(topics[:5])}' if topics else ''
            parts.append(f'Tech stack: {", ".join(top)}{topic_str}.')
        elif topics:
            parts.append(f'Topics: {", ".join(topics[:5])}.')
        if readme:
            headings = len(re.findall(r'^## ', readme, re.MULTILINE))
            parts.append(f'Documentation: {headings} sections across {len(readme):,} characters.')
        else:
            parts.append('Documentation: no README found.')
        if stars > 0 or forks > 0:
            parts.append(f'Community: {stars:,} stars, {forks:,} forks.')
        file_count = self._count_files(file_tree)
        if file_count > 0:
            parts.append(f'Repository spans {file_count} files{ f" across {len(dep_files)} dependency manifests" if dep_files else "" }.')

        readme_insights = ''
        if readme and len(readme) > 100:
            clean_for_summary = re.sub(r'```[\s\S]*?```', '', readme)
            clean_for_summary = re.sub(r'```[\s\S]*?```', '', clean_for_summary)
            clean_for_summary = re.sub(r'^[|\\/].*$', '', clean_for_summary, flags=re.MULTILINE)
            clean_for_summary = re.sub(r'^\s*[\-]{2,}.*$', '', clean_for_summary, flags=re.MULTILINE)
            clean_for_summary = re.sub(r'\n{3,}', '\n\n', clean_for_summary)
            extracted = generate_summary(clean_for_summary)
            if extracted.get('summary') and len(extracted['summary']) > 60:
                cleaned = _strip_markdown(extracted['summary'])
                cleaned = re.sub(r'(?<!\w)[-]{2,}(?!\w)', '', cleaned)
                cleaned = re.sub(r'\b(?:actor|participant|sequenceDiagram|end|activate|deactivate|Note\s+over|loop|alt|opt|rect|par)\b[\s\S]*?(?=\n|$)', '', cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r'\s*->>?\s*', ' ', cleaned)
                cleaned = re.sub(r'\s+', ' ', cleaned)
                cleaned = re.sub(r'\.{2,}', '.', cleaned)
                cleaned = cleaned.strip()
                if len(cleaned) > 60:
                    readme_insights = cleaned
                if len(cleaned) > 60:
                    readme_insights = cleaned

        structured = ' '.join(parts)
        return f'{structured}\n\n{readme_insights}' if readme_insights else (structured or 'A code repository with multiple file types and organized project structure.')

    def _detect_tech_stack(self, input_data: dict, total_bytes: int | None = None) -> dict:
        tech_stack = detect_technologies(
            input_data.get('languages', {}),
            input_data.get('fileTree', []),
            input_data.get('dependencyFiles', {}),
            input_data.get('readme', '') or '',
            input_data.get('topics', []) or [],
        )
        lang_names = list(input_data.get('languages', {}).keys())
        bytes_total = total_bytes or sum(input_data.get('languages', {}).values())
        existing_names = {l['name'] for l in (tech_stack.get('languages') or [])}
        for lang in lang_names:
            if lang not in existing_names:
                b = input_data['languages'][lang]
                pct = round((b / bytes_total) * 1000) / 10 if bytes_total > 0 else 0
                tech_stack['languages'].append({'name': lang, 'percentage': pct, 'bytes': b})
        tech_stack['languages'].sort(key=lambda x: -x['percentage'])
        return tech_stack

    def _analyze_architecture(self, input_data: dict) -> dict:
        ft = input_data.get('fileTree', [])
        return analyze_architecture(ft)

    def _detect_has_tests(self, file_tree: list) -> bool:
        names = ['tests', '__tests__', 'test']
        for f in file_tree:
            if f.get('name') in names or '.test.' in f.get('name', '') or '.spec.' in f.get('name', ''):
                return True
            if f.get('children') and self._detect_has_tests(f['children']):
                return True
        return False

    def _detect_has_ci(self, file_tree: list) -> bool:
        for f in file_tree:
            if '.github/workflows' in f.get('path', ''):
                return True
            if f.get('children') and self._detect_has_ci(f['children']):
                return True
        return False

    def _generate_suggestions(self, code_smells: list, tech_stack: dict, file_tree: list) -> list[str]:
        suggestions: list[str] = []
        critical = [s for s in code_smells if s.get('severity') == 'critical']
        warnings = [s for s in code_smells if s.get('severity') == 'warning']
        if critical:
            suggestions.append('Address critical issues first: ' +
                               ', '.join(s['title'] for s in critical) +
                               '. These have the highest impact on project quality.')
        if warnings:
            suggestions.append('Review warning-level issues: ' +
                               ', '.join(s['title'] for s in warnings) +
                               '. Addressing these will improve maintainability.')
        if not self._detect_has_tests(file_tree):
            suggestions.append('Add automated tests to improve code reliability and make contributions safer.')
        lang_names = [l.get('name', '') for l in (tech_stack.get('languages') or [])]
        keywords = extract_keywords(' '.join(lang_names), 5)
        if keywords:
            suggestions.append(f'Consider adding more {", ".join(k["word"] for k in keywords[:3])} examples and use cases in the documentation.')
        dbs = tech_stack.get('databases') or []
        if dbs:
            suggestions.append(f'Document database setup instructions for {", ".join(dbs)} to help new contributors get started faster.')
        fws = tech_stack.get('frameworks') or []
        if fws:
            suggestions.append(f'Include framework-specific best practices for {" and ".join(fws[:2])} to ensure consistent code quality.')
        tools = tech_stack.get('tools') or []
        if tools:
            suggestions.append(f'Add configuration examples for {", ".join(tools[:3])} to standardize the development environment.')
        suggestions.append('Create or update CONTRIBUTING.md with clear guidelines for submitting issues, PRs, and code review processes.')
        return suggestions[:8]

    def _generate_onboarding(self, input_data: dict, tech_stack: dict, arch_result: dict) -> str:
        repo = {
            'url': f'https://github.com/{input_data.get("id", "unknown/repository")}',
            'name': input_data.get('id', 'repository').split('/')[-1] if '/' in input_data.get('id', '') else 'repository',
            'description': input_data.get('description', ''),
            'languages': input_data.get('languages', {}),
            'fileTree': input_data.get('fileTree', []),
            'dependencyFiles': input_data.get('dependencyFiles', {}),
        }
        arch_for_guide = {
            'primaryPattern': arch_result.get('primary', 'Standard'),
            'directoryHighlights': [f'- {d}' for d in self._get_top_dirs(input_data.get('fileTree', []))[:10]],
        }
        return generate_onboarding_guide(repo, tech_stack, arch_for_guide)

    def _get_top_dirs(self, tree: list[dict], depth: int = 0) -> list[str]:
        dirs: list[str] = []
        for node in tree:
            if node.get('type') == 'tree':
                dirs.append(node['name'])
                if depth < 2 and node.get('children'):
                    for child in node['children']:
                        if child.get('type') == 'tree':
                            dirs.append(f"{node['name']}/{child['name']}")
        return dirs[:200]

    def _score_quality(
        self, input_data: dict, tech_stack: dict,
        code_smells: list, has_tests: bool, has_ci: bool,
        lang_count: int, total_bytes: int,
    ) -> dict:
        file_tree = input_data.get('fileTree', [])
        file_count = self._count_files(file_tree)
        avg_file_size = round((total_bytes / 50) / file_count) if file_count > 0 else 0

        readme = input_data.get('readme', '') or ''
        lower = readme.lower()
        heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))
        has_heading = heading_count >= 1
        sections = [
            {'section': 'Description', 'present': len(readme) > 50},
            {'section': 'Installation', 'present': 'install' in lower or (has_heading and heading_count >= 2)},
            {'section': 'Usage', 'present': 'usage' in lower or 'example' in lower or (has_heading and heading_count >= 3)},
            {'section': 'API Documentation', 'present': 'api' in lower or (has_heading and heading_count >= 4)},
            {'section': 'Configuration', 'present': 'config' in lower or (has_heading and heading_count >= 5)},
            {'section': 'Contributing', 'present': 'contributing' in lower},
            {'section': 'License', 'present': 'license' in lower},
            {'section': 'Code of Conduct', 'present': 'code of conduct' in lower},
            {'section': 'Changelog', 'present': 'changelog' in lower},
            {'section': 'Tests', 'present': 'test' in lower},
        ]
        docs = {
            'readmeScore': self._compute_readme_score(readme),
            'hasReadme': bool(readme),
            'readmeLength': len(readme),
            'hasContributing': 'contributing' in lower,
            'hasCodeOfConduct': 'code of conduct' in lower,
            'hasLicense': 'license' in lower,
            'hasChangelog': 'changelog' in lower,
            'hasApiDocs': 'api' in lower,
            'hasWiki': False,
            'sectionCoverage': sections,
            'suggestions': [],
        }
        last_commit_days = self._compute_last_commit_days(input_data.get('pushedAt', ''))
        health = {
            'overall': 50, 'stars': input_data.get('stars', 0) or 0,
            'forks': input_data.get('forks', 0) or 0, 'openIssues': 0,
            'issuesPerStar': 0, 'lastCommitDays': last_commit_days,
            'hasRecentActivity': last_commit_days < 90,
            'contributorCount': input_data.get('contributorCount', 0) or 0,
            'busFactor': 1, 'releaseCount': 0, 'hasCI': has_ci, 'hasTests': has_tests,
        }

        weight_params = dict(self.rl.get_current_params())
        if self.options['useReinforcementLearning']:
            metrics = compute_readme_metrics(readme)
            state = {
                'repoStars': health['stars'], 'repoForks': health['forks'],
                'fileCount': file_count, 'languageCount': lang_count,
                'readmeLength': len(readme), 'contributorCount': health['contributorCount'],
                'hasTests': health['hasTests'], 'hasCI': health['hasCI'],
                'readmeScore': docs['readmeScore'],
                'docsSectionCount': self._compute_docs_section_count(readme),
                'hasApiDocs': docs['hasApiDocs'], 'hasLicense': docs['hasLicense'],
                'lastCommitDays': last_commit_days,
                'hasDockerfile': self._check_has_dockerfile(file_tree),
                'hasContributing': docs['hasContributing'],
                **metrics,
            }
            s_val = self.self_healing.validate_component('rlState', state)
            if not s_val['valid']:
                healed = self.self_healing.heal_output('rlState', state, s_val)
                state.update(healed)
            weight_params = self.rl.get_optimal_params(state)

        merged = self.rl.merge_with_defaults(weight_params, {
            'repoStars': health['stars'], 'repoForks': health['forks'],
            'fileCount': file_count, 'languageCount': lang_count,
            'readmeLength': len(readme), 'contributorCount': health['contributorCount'],
            'hasTests': health['hasTests'], 'hasCI': health['hasCI'],
            'readmeScore': docs['readmeScore'],
            'docsSectionCount': self._compute_docs_section_count(readme),
            'hasApiDocs': docs['hasApiDocs'], 'hasLicense': docs['hasLicense'],
            'lastCommitDays': last_commit_days,
            'hasDockerfile': self._check_has_dockerfile(file_tree),
            'hasContributing': docs['hasContributing'],
            **compute_readme_metrics(readme),
        })

        if self.options['useSelfHealing']:
            dv = self.self_healing.validate_component('docs', docs)
            if not dv['valid']:
                docs.update(self.self_healing.heal_output('docs', docs, dv))

        scores = compute_quality_scores(
            input_data.get('languages', {}), file_tree, readme,
            input_data.get('dependencyFiles', {}), input_data.get('topics', []) or [],
            input_data.get('stars', 0) or 0, input_data.get('forks', 0) or 0,
            input_data.get('contributorCount', 0) or 0, has_tests, has_ci,
            input_data.get('pushedAt', ''),
            merged,
            {'fileCount': file_count, 'averageFileSize': avg_file_size, 'totalLines': total_bytes // 50},
            docs, health,
        )
        num_critical = sum(1 for s in code_smells if s.get('severity') == 'critical')
        if num_critical > 0:
            scores['codeQuality'] = max(10, scores['codeQuality'] - num_critical * 10)
            scores['security'] = max(10, scores['security'] - num_critical * 5)
        return scores

    def _compute_readme_score(self, readme: str) -> float:
        if not readme:
            return 0
        lower = readme.lower()
        heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))
        has_good = heading_count >= 3
        score = 0
        if len(readme) > 500: score += 30
        elif len(readme) > 100: score += 15
        else: score += 5
        if '## ' in readme: score += 20
        if 'install' in lower: score += 15
        if 'usage' in lower or 'example' in lower: score += 15
        if 'api' in lower or 'config' in lower: score += 10
        if 'license' in lower: score += 10
        if has_good and 'install' not in lower: score += 10
        return min(100, score)

    def _compute_docs_section_count(self, readme: str) -> int:
        if not readme:
            return 0
        lower = readme.lower()
        heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))
        has_heading = heading_count >= 1
        count = 0
        if len(readme) > 50: count += 1
        if 'install' in lower or (has_heading and heading_count >= 2): count += 1
        if 'usage' in lower or 'example' in lower or (has_heading and heading_count >= 3): count += 1
        if 'api' in lower or (has_heading and heading_count >= 4): count += 1
        if 'config' in lower or (has_heading and heading_count >= 5): count += 1
        if 'contributing' in lower: count += 1
        if 'license' in lower: count += 1
        if 'code of conduct' in lower: count += 1
        if 'changelog' in lower: count += 1
        if 'test' in lower: count += 1
        return min(10, count)

    def _compute_last_commit_days(self, pushed_at: str) -> int:
        if not pushed_at:
            return 30
        try:
            from datetime import datetime, timezone
            pushed = datetime.fromisoformat(pushed_at.replace('Z', '+00:00'))
            return max(0, (datetime.now(timezone.utc) - pushed).days)
        except Exception:
            return 30

    def _run_reinforcement_learning(self, input_data: dict, scores: dict) -> None:
        if not self.options['useReinforcementLearning']:
            return
        readme = input_data.get('readme', '') or ''
        lower = readme.lower()
        heading_count = len(re.findall(r'^## ', readme, re.MULTILINE))
        file_count = self._count_files(input_data.get('fileTree', []))
        readme_score = self._compute_readme_score(readme)
        docs_section_count = self._compute_docs_section_count(readme)
        has_api = 'api' in lower
        has_license = 'license' in lower
        has_contributing = 'contributing' in lower
        last_commit_days = self._compute_last_commit_days(input_data.get('pushedAt', ''))
        metrics = compute_readme_metrics(readme)
        has_docker = self._check_has_dockerfile(input_data.get('fileTree', []))

        state = {
            'repoStars': input_data.get('stars', 0) or 0,
            'repoForks': input_data.get('forks', 0) or 0,
            'fileCount': file_count,
            'languageCount': len(input_data.get('languages', {})),
            'readmeLength': len(readme),
            'contributorCount': input_data.get('contributorCount', 0) or 0,
            'hasTests': self._detect_has_tests(input_data.get('fileTree', [])),
            'hasCI': self._detect_has_ci(input_data.get('fileTree', [])),
            'readmeScore': readme_score,
            'docsSectionCount': docs_section_count,
            'hasApiDocs': has_api,
            'hasLicense': has_license,
            'lastCommitDays': last_commit_days,
            'hasDockerfile': has_docker,
            'hasContributing': has_contributing,
            **metrics,
        }

        baseline = dict(self.rl.get_current_params())
        for _ in range(3):
            action = self.rl.select_action(state, 0.4)
            trial_params = self.rl.apply_action(baseline, action)
            merged = self.rl.merge_with_defaults(trial_params, state)
            total_bytes = sum(input_data.get('languages', {}).values())
            total_lines = max(1, total_bytes // 50)
            avg_file_size = round(total_lines / max(1, file_count))
            trial = compute_quality_scores(
                input_data.get('languages', {}),
                input_data.get('fileTree', []),
                readme, input_data.get('dependencyFiles', {}),
                input_data.get('topics', []) or [],
                state['repoStars'], state['repoForks'], state['contributorCount'],
                state['hasTests'], state['hasCI'], input_data.get('pushedAt', ''),
                merged,
                {'fileCount': file_count, 'averageFileSize': avg_file_size, 'totalLines': total_lines},
                {'readmeScore': readme_score, 'hasReadme': len(readme) > 0, 'readmeLength': len(readme),
                 'hasContributing': has_contributing, 'hasCodeOfConduct': False, 'hasLicense': has_license,
                 'hasChangelog': False, 'hasApiDocs': has_api, 'hasWiki': False,
                 'sectionCoverage': [], 'suggestions': []},
                {'overall': 0, 'stars': state['repoStars'], 'forks': state['repoForks'],
                 'openIssues': 0, 'issuesPerStar': 0, 'lastCommitDays': last_commit_days,
                 'hasRecentActivity': last_commit_days < 90, 'contributorCount': state['contributorCount'],
                 'busFactor': 1, 'releaseCount': 0, 'hasCI': state['hasCI'], 'hasTests': state['hasTests']},
            )
            health = self.self_healing.get_component_health('qualityScores')
            reward = self.rl.compute_reward(trial.get('overall', 50), health['errorRate'])
            next_state = dict(state)
            self.rl.store_experience(state, action, reward, next_state)
        self.rl.train_multiple(3, 16)
        self.rl.persist()

    def _count_files(self, tree: list) -> int:
        count = 0
        for node in tree:
            if node.get('type') == 'blob':
                count += 1
            if node.get('children'):
                count += self._count_files(node['children'])
        return count

    def _check_has_dockerfile(self, tree: list) -> bool:
        docker = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']
        for node in tree:
            if node.get('type') == 'blob' and node.get('name') in docker:
                return True
            if node.get('children') and self._check_has_dockerfile(node.get('children', [])):
                return True
        return False

    def get_self_healing_layer(self) -> SelfHealingLayer:
        return self.self_healing

    def get_reinforcement_learner(self) -> ReinforcementLearner:
        return self.rl
