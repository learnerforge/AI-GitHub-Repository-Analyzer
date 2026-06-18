from __future__ import annotations
import time
from typing import Any
from datetime import datetime, timezone

MIN_CONFIDENCE_THRESHOLD = 30
RETRY_STRATEGIES = ['relaxed', 'aggressive', 'minimal']
CIRCUIT_RESET_MS = 300_000
CIRCUIT_FAILURE_THRESHOLD = 5
STALE_REPORT_DAYS = 7

DEFAULT_DOCS = {
    'readmeScore': 0, 'hasReadme': False, 'readmeLength': 0,
    'hasContributing': False, 'hasCodeOfConduct': False, 'hasLicense': False,
    'hasChangelog': False, 'hasApiDocs': False, 'hasWiki': False,
    'sectionCoverage': [], 'suggestions': [],
}

DEFAULT_QUALITY_SCORES = {
    'overall': 50, 'codeQuality': 50, 'documentation': 50,
    'maintainability': 50, 'communityHealth': 50, 'security': 50,
}

DEFAULT_RL_STATE = {
    'repoStars': 0, 'repoForks': 0, 'fileCount': 0, 'languageCount': 1,
    'readmeLength': 0, 'contributorCount': 0, 'hasTests': False, 'hasCI': False,
    'readmeScore': 0, 'docsSectionCount': 0, 'hasApiDocs': False, 'hasLicense': False,
}

DEFAULTS: dict[str, Any] = {
    'summary': 'Repository analysis summary could not be generated.',
    'techStack': {'languages': [], 'frameworks': [], 'databases': [], 'tools': [], 'infrastructure': []},
    'architecture': {'description': 'Standard project structure with conventional organization patterns.'},
    'codeSmells': [],
    'qualityScores': dict(DEFAULT_QUALITY_SCORES),
    'suggestions': [],
    'onboardingGuide': 'No onboarding guide could be generated automatically.',
    'docs': dict(DEFAULT_DOCS),
    'rlState': dict(DEFAULT_RL_STATE),
}


class SelfHealingLayer:
    def __init__(self) -> None:
        self.error_log: list[dict] = []
        self.retry_counts: dict[str, int] = {}
        self.strategy_index: dict[str, int] = {}
        self.adaptation_history: dict[str, list[dict]] = {}
        self.circuit_breaker: dict[str, dict] = {}

    def validate_component(self, component: str, data: Any, strategy: str | None = None) -> dict:
        issues: list[str] = []
        corrections: dict[str, Any] = {}
        is_relaxed = strategy == 'relaxed'
        is_minimal = strategy == 'minimal'

        if component == 'summary':
            if data is None or not isinstance(data, str):
                issues.append('Summary is missing or invalid type')
                corrections['summary'] = 'Repository analysis summary could not be generated.'
            elif len(data) < (5 if is_relaxed else 20):
                issues.append('Summary is too short')
                corrections['summary'] = data if len(data) > 0 else 'Repository analysis summary could not be generated.'

        elif component == 'techStack':
            if data is None or not isinstance(data, dict):
                issues.append('Tech stack data is missing')
                corrections['techStack'] = dict(DEFAULTS['techStack'])
            else:
                if not isinstance(data.get('languages'), list):
                    issues.append('Languages list is missing')
                    corrections['techStack.languages'] = []
                if not is_minimal and not isinstance(data.get('frameworks'), list):
                    issues.append('Frameworks list is missing')
                    corrections['techStack.frameworks'] = []

        elif component == 'architecture':
            if data is None or not isinstance(data.get('description'), str):
                issues.append('Architecture description is missing')
                corrections['architecture'] = 'Standard project structure with conventional organization patterns.'

        elif component == 'codeSmells':
            if not isinstance(data, list):
                issues.append('Code smells data is not an array')
                corrections['codeSmells'] = []

        elif component == 'qualityScores':
            if data is None or not isinstance(data.get('overall'), (int, float)):
                issues.append('Quality scores are missing or invalid')
                corrections['qualityScores'] = dict(DEFAULT_QUALITY_SCORES)
            elif not is_minimal:
                for key in ['overall', 'codeQuality', 'documentation', 'maintainability', 'communityHealth', 'security']:
                    val = data.get(key) if isinstance(data, dict) else None
                    max_val = 120 if is_relaxed else 100
                    if not isinstance(val, (int, float)) or val < 0 or val > max_val:
                        issues.append(f'Score "{key}" is out of range')
                        corrections[f'qualityScores.{key}'] = 50

        elif component == 'suggestions':
            if not isinstance(data, list):
                issues.append('Suggestions is not an array')
                corrections['suggestions'] = []

        elif component == 'onboardingGuide':
            if data is None or not isinstance(data, str):
                issues.append('Onboarding guide is missing')
                corrections['onboardingGuide'] = 'No onboarding guide could be generated automatically.'

        elif component == 'docs':
            if data is None or not isinstance(data, dict):
                issues.append('Docs data is missing')
                corrections['docs'] = dict(DEFAULT_DOCS)
            elif not is_minimal:
                max_score = 120 if is_relaxed else 100
                rscore = data.get('readmeScore', 0)
                if not isinstance(rscore, (int, float)) or rscore < 0 or rscore > max_score:
                    issues.append('readmeScore out of range')
                    corrections['docs.readmeScore'] = 0
                if not isinstance(data.get('sectionCoverage'), list):
                    issues.append('sectionCoverage missing')
                    corrections['docs.sectionCoverage'] = []
                if not isinstance(data.get('hasReadme'), bool):
                    issues.append('hasReadme missing')
                    corrections['docs.hasReadme'] = False

        elif component == 'rlState':
            if data is None or not isinstance(data, dict):
                issues.append('RL state is missing')
                corrections['rlState'] = dict(DEFAULT_RL_STATE)
            elif not is_minimal:
                numeric_fields = ['repoStars', 'repoForks', 'fileCount', 'languageCount',
                                  'readmeLength', 'contributorCount', 'readmeScore', 'docsSectionCount']
                for k in numeric_fields:
                    val = data.get(k)
                    if not isinstance(val, (int, float)) or val < 0:
                        issues.append(f'rlState.{k} invalid')
                bool_fields = ['hasTests', 'hasCI', 'hasApiDocs', 'hasLicense']
                for k in bool_fields:
                    if not isinstance(data.get(k), bool):
                        issues.append(f'rlState.{k} invalid')

        severity = 0 if not issues else (1 if len(issues) <= 1 else (2 if len(issues) <= 3 else 3))
        confidence = max(0, 100 - severity * 25)
        return {'valid': len(issues) == 0, 'issues': issues, 'corrections': corrections, 'confidence': confidence}

    def get_default_for(self, component: str) -> Any:
        return DEFAULTS.get(component, None)

    def is_circuit_tripped(self, component: str) -> bool:
        cb = self.circuit_breaker.get(component)
        if not cb:
            return False
        if cb['tripped_until'] > 0 and time.time() * 1000 > cb['tripped_until']:
            cb['failures'] = 0
            cb['tripped_until'] = 0
            return False
        return cb['tripped_until'] > 0

    def record_failure(self, component: str) -> None:
        if component not in self.circuit_breaker:
            self.circuit_breaker[component] = {'failures': 0, 'tripped_until': 0}
        cb = self.circuit_breaker[component]
        cb['failures'] += 1
        if cb['failures'] >= CIRCUIT_FAILURE_THRESHOLD:
            cb['tripped_until'] = (time.time() * 1000) + CIRCUIT_RESET_MS

    def reset_circuit(self, component: str) -> None:
        self.circuit_breaker.pop(component, None)

    def auto_tune_thresholds(self) -> dict:
        health = self.get_system_health()
        high_error = [c for c, h in health['components'].items() if h['errorRate'] > 0.3]
        if len(high_error) > 3 and health['overallHealth'] == 'unhealthy':
            return {'adjusted': True, 'reason': f'degraded components: {", ".join(high_error)}'}
        return {'adjusted': False, 'reason': 'within normal thresholds'}

    def heal_output(self, component: str, data: Any, validation: dict) -> Any:
        if validation['valid']:
            return data
        corrected = dict(data) if isinstance(data, dict) else data
        for key, value in validation['corrections'].items():
            parts = key.split('.')
            if len(parts) == 1:
                if isinstance(corrected, dict):
                    corrected[parts[0]] = value
            elif len(parts) == 2:
                if isinstance(corrected, dict):
                    if parts[0] not in corrected:
                        corrected[parts[0]] = {}
                    corrected[parts[0]][parts[1]] = value
        self.log_error(component, '; '.join(validation['issues']))
        return corrected

    def get_adapted_strategy(self, component: str) -> str:
        idx = self.strategy_index.get(component, 0)
        return RETRY_STRATEGIES[idx % len(RETRY_STRATEGIES)]

    def should_retry(self, component: str) -> bool:
        count = self.retry_counts.get(component, 0)
        return count < 3 and not self.is_circuit_tripped(component)

    def record_retry(self, component: str) -> None:
        self.retry_counts[component] = self.retry_counts.get(component, 0) + 1
        self.strategy_index[component] = self.strategy_index.get(component, 0) + 1

    def log_error(self, component: str, error: str) -> None:
        self.error_log.append({'component': component, 'error': error, 'timestamp': time.time() * 1000})
        if len(self.error_log) > 100:
            self.error_log.pop(0)

    def record_adaptation(self, component: str, params: Any, result: Any) -> None:
        if component not in self.adaptation_history:
            self.adaptation_history[component] = []
        self.adaptation_history[component].append({
            'params': params, 'result': result, 'timestamp': time.time() * 1000,
        })
        if len(self.adaptation_history[component]) > 50:
            self.adaptation_history[component].pop(0)

    def get_component_health(self, component: str) -> dict:
        now = time.time() * 1000
        recent = [e for e in self.error_log if e['component'] == component and now - e['timestamp'] < 3600000]
        total = (self.retry_counts.get(component, 0) or 0) + max(1, len(recent))
        return {
            'errorRate': len(recent) / total if total > 0 else 0,
            'avgConfidence': 100 - len(recent) * 20,
            'retries': self.retry_counts.get(component, 0) or 0,
        }

    def get_overall_confidence(self) -> float:
        components = ['summary', 'techStack', 'architecture', 'codeSmells', 'qualityScores', 'suggestions', 'onboardingGuide']
        total = 0.0
        count = 0
        for comp in components:
            health = self.get_component_health(comp)
            total += health['avgConfidence']
            count += 1
        return round(total / count) if count > 0 else 100.0

    def get_system_health(self) -> dict:
        components: dict[str, Any] = {}
        total_error = 0.0
        comp_count = 0
        for comp in ['summary', 'techStack', 'architecture', 'codeSmells', 'qualityScores', 'suggestions', 'onboardingGuide']:
            health = self.get_component_health(comp)
            components[comp] = health
            total_error += health['errorRate']
            comp_count += 1
        avg = total_error / comp_count if comp_count > 0 else 0
        overall = 'healthy' if avg == 0 else ('degraded' if avg < 0.2 else 'unhealthy')
        return {'components': components, 'overallHealth': overall}

    def validate_freshness(self, report: dict) -> dict:
        generated_at = report.get('generatedAt', '')
        if not generated_at:
            return {'stale': True, 'daysOld': 999, 'reason': 'No generation timestamp'}
        try:
            dt = datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
            days_old = (datetime.now(timezone.utc) - dt).days
        except Exception:
            return {'stale': True, 'daysOld': 999, 'reason': 'Invalid timestamp'}
        if days_old > STALE_REPORT_DAYS:
            return {'stale': True, 'daysOld': days_old, 'reason': f'Report is {days_old} days old (threshold: {STALE_REPORT_DAYS})'}
        return {'stale': False, 'daysOld': days_old, 'reason': 'Fresh'}

    def auto_refresh_decision(self, report: dict) -> dict:
        freshness = self.validate_freshness(report)
        if not freshness['stale']:
            return {'shouldRefresh': False, 'reason': 'Report is fresh'}
        health = self.get_component_health('report_freshness')
        if health['errorRate'] > 0.5:
            return {'shouldRefresh': False, 'reason': 'Circuit breaker tripped for freshness checks'}
        return {
            'shouldRefresh': True,
            'daysOld': freshness['daysOld'],
            'reason': f'Report is {freshness["daysOld"]} days old. Auto-refresh triggered.',
        }

    def reset_for_new_analysis(self) -> None:
        self.retry_counts = {}


self_healing_layer = SelfHealingLayer()
