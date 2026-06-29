from __future__ import annotations
from typing import Any
import re
import base64
from . import Engine, register

SECRET_PATTERNS: list[dict] = [
    {'name': 'AWS Access Key', 'pattern': r'AKIA[0-9A-Z]{16}', 'severity': 'critical'},
    {'name': 'AWS Secret Key', 'pattern': r'(?i)aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["\']?[A-Za-z0-9/+=]{40}["\']?', 'severity': 'critical'},
    {'name': 'GitHub Token', 'pattern': r'gh[pousr]_[A-Za-z0-9_]{36,}', 'severity': 'critical'},
    {'name': 'GitHub Fine-Grained Token', 'pattern': r'github_pat_[A-Za-z0-9_]{82,}', 'severity': 'critical'},
    {'name': 'JWT', 'pattern': r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'severity': 'high'},
    {'name': 'Slack Token', 'pattern': r'xox[baprs]-[A-Za-z0-9-]{10,}', 'severity': 'high'},
    {'name': 'Discord Token', 'pattern': r'[MN][A-Za-z\d]{23,25}\.[Xx][A-Za-z\d]{6}\.[A-Za-z\d]{27,}', 'severity': 'high'},
    {'name': 'Google API Key', 'pattern': r'AIza[0-9A-Za-z\-_]{35}', 'severity': 'high'},
    {'name': 'Firebase URL', 'pattern': r'[a-z0-9-]+\.firebaseio\.com', 'severity': 'medium'},
    {'name': 'Stripe Live Key', 'pattern': r'sk_live_[0-9a-zA-Z]{24,}', 'severity': 'critical'},
    {'name': 'Stripe Test Key', 'pattern': r'sk_test_[0-9a-zA-Z]{24,}', 'severity': 'medium'},
    {'name': 'Stripe Publishable Key', 'pattern': r'pk_(?:live|test)_[0-9a-zA-Z]{24,}', 'severity': 'low'},
    {'name': 'Private SSH Key', 'pattern': r'-----BEGIN\s*(?:RSA|DSA|EC|OPENSSH)\s*PRIVATE KEY-----', 'severity': 'critical'},
    {'name': 'Heroku API Key', 'pattern': r'[hH][eE][rR][oO][kK][uU]\s*[:=]\s*[A-Za-z0-9-]{20,}', 'severity': 'high'},
    {'name': 'Docker config', 'pattern': r'(?i)docker[_-]config[_-]auth\s*[:=]\s*["\']?[A-Za-z0-9+/=]{20,}["\']?', 'severity': 'high'},
    {'name': 'npm token', 'pattern': r'npm_[A-Za-z0-9]{36,}', 'severity': 'high'},
    {'name': 'Twitter API Key', 'pattern': r'(?i)twitter[_-]?(?:api|bearer|consumer)[_-]?(?:key|secret|token)\s*[:=]\s*["\']?[A-Za-z0-9-]{15,}', 'severity': 'medium'},
]

UNSAFE_PATTERNS: list[dict] = [
    {'name': 'eval()', 'pattern': r'\beval\s*\(', 'severity': 'high', 'message': 'Use of eval() can lead to code injection'},
    {'name': 'exec()', 'pattern': r'\bexec\s*\(', 'severity': 'high', 'message': 'Use of exec() can lead to code injection'},
    {'name': 'unsafe deserialization (pickle)', 'pattern': r'pickle\.loads?\s*\(', 'severity': 'high'},
    {'name': 'unsafe deserialization (yaml)', 'pattern': r'yaml\.load\s*\(', 'severity': 'medium'},
    {'name': 'SQL injection risk (raw query)', 'pattern': r'execute\(["\']\s*SELECT|INSERT|UPDATE|DELETE', 'severity': 'high'},
    {'name': 'innerHTML injection', 'pattern': r'\.innerHTML\s*=', 'severity': 'medium'},
    {'name': 'dangerouslySetInnerHTML', 'pattern': r'dangerouslySetInnerHTML', 'severity': 'medium'},
    {'name': 'Command injection', 'pattern': r'(?:os\.system|subprocess\.call|child_process\.exec)\s*\(', 'severity': 'high'},
    {'name': 'Insecure randomness', 'pattern': r'Math\.random\(\)', 'severity': 'low'},
    {'name': 'NoSQL injection', 'pattern': r'\$where\s*:', 'severity': 'high'},
    {'name': 'Hardcoded password', 'pattern': r'(?i)password\s*[:=]\s*["\'][^"\']+["\']', 'severity': 'high'},
]


def _flatten_tree(tree: dict, path: str = '') -> list[str]:
    paths = []
    for name, child in tree.items():
        full = f'{path}/{name}' if path else name
        if isinstance(child, dict):
            paths.append(full)
            paths.extend(_flatten_tree(child, full))
        else:
            paths.append(full)
    return paths


def _detect_secrets_in_text(text: str, filename: str) -> list[dict]:
    findings = []
    for rule in SECRET_PATTERNS:
        for m in re.finditer(rule['pattern'], text):
            start = max(0, m.start() - 30)
            end = min(len(text), m.end() + 30)
            context = text[start:end].replace('\n', ' ').strip()
            findings.append({
                'type': 'secret',
                'secret_type': rule['name'],
                'severity': rule['severity'],
                'file': filename,
                'match': m.group()[:20] + '...' if len(m.group()) > 20 else m.group(),
                'context': context,
                'line': text[:m.start()].count('\n') + 1,
            })
    return findings


def _detect_unsafe_patterns(text: str, filename: str) -> list[dict]:
    findings = []
    for rule in UNSAFE_PATTERNS:
        for m in re.finditer(rule['pattern'], text):
            findings.append({
                'type': 'unsafe_pattern',
                'pattern': rule['name'],
                'severity': rule['severity'],
                'file': filename,
                'message': rule.get('message', rule['name']),
                'line': text[:m.start()].count('\n') + 1,
            })
    return findings


def _cwe_for(severity: str) -> int:
    return {'critical': 10, 'high': 7, 'medium': 5, 'low': 2}.get(severity, 0)


def _detect_dep_vulns(dep_files: list[str]) -> list[dict]:
    findings = []
    for f in dep_files:
        low = f.lower()
        if 'package.json' in low:
            findings.append({
                'type': 'dependency_check',
                'message': 'package.json found — run npm audit for CVE scan',
                'severity': 'info',
            })
        if 'requirements.txt' in low or 'pyproject.toml' in low:
            findings.append({
                'type': 'dependency_check',
                'message': 'Python dependencies found — run safety/pip-audit for CVE scan',
                'severity': 'info',
            })
        if 'gemfile' in low or 'gemfile.lock' in low:
            findings.append({
                'type': 'dependency_check',
                'message': 'Ruby dependencies found — run bundle audit for CVE scan',
                'severity': 'info',
            })
        if 'cargo.toml' in low or 'cargo.lock' in low:
            findings.append({
                'type': 'dependency_check',
                'message': 'Rust dependencies found — run cargo audit for CVE scan',
                'severity': 'info',
            })
        if 'yarn.lock' in low or 'package-lock.json' in low:
            findings.append({
                'type': 'dependency_check',
                'message': f'Lockfile found ({f}) — enables reproducible builds',
                'severity': 'info',
            })
    return findings


SECURITY_CONFIG_FILES = [
    'security.md', 'security.txt', '.snyk',
    'codeql.yml', 'codeql-config.yml',
    'dependabot.yml', 'dependabot.yaml',
    '.gitleaks.toml', '.secretlintrc',
    '.trivyignore', '.trivy.yaml',
]


def _detect_security_infra(file_paths: list[str]) -> list[dict]:
    findings = []
    low_files = [f.lower() for f in file_paths]
    has_security_policy = any('security' in f for f in low_files)
    has_dependabot = any('dependabot' in f for f in low_files)
    has_codeql = any('codeql' in f for f in low_files)
    has_snyk = any('.snyk' in f for f in low_files)
    has_gitleaks = any('gitleaks' in f for f in low_files)

    if not has_security_policy:
        findings.append({
            'type': 'missing_security_policy',
            'message': 'No SECURITY.md or security policy found',
            'severity': 'medium',
        })
    if not has_dependabot:
        findings.append({
            'type': 'missing_dependabot',
            'message': 'No Dependabot configuration found',
            'severity': 'medium',
        })
    if has_codeql:
        findings.append({
            'type': 'codeql_enabled', 'message': 'CodeQL analysis configured',
            'severity': 'info', 'score': 10,
        })
    return findings


class SecurityEngine(Engine):
    name = 'security'
    description = 'Detects secrets, unsafe patterns, dependency vulnerabilities, and security infrastructure'
    version = '1.0.0'

    def analyze(self, repo: dict[str, Any]) -> dict[str, Any]:
        file_tree = repo.get('fileTree', {})
        dep_files = repo.get('dependencyFiles', [])
        file_contents = repo.get('fileContents', {})
        file_paths = _flatten_tree(file_tree)

        all_findings = []
        severity_weights = {'critical': 10, 'high': 7, 'medium': 4, 'low': 1}

        secret_count = 0
        unsafe_count = 0

        for filename, content in file_contents.items():
            if not isinstance(content, str):
                continue
            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
            if ext in ('png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'eot', 'ttf', 'otf'):
                continue
            if len(content) > 500000:
                continue

            sec = _detect_secrets_in_text(content, filename)
            unsafe = _detect_unsafe_patterns(content, filename)
            all_findings.extend(sec)
            all_findings.extend(unsafe)
            secret_count += len(sec)
            unsafe_count += len(unsafe)

        dep_findings = _detect_dep_vulns(dep_files)
        infra_findings = _detect_security_infra(file_paths)
        all_findings.extend(dep_findings)
        all_findings.extend(infra_findings)

        score = 100
        critical_deductions = 0
        if secret_count > 0:
            for f in all_findings:
                if f.get('type') == 'secret':
                    critical_deductions += severity_weights.get(f.get('severity', 'medium'), 4)
        score -= critical_deductions
        score -= unsafe_count * 3
        if not any(f.get('type') == 'codeql_enabled' for f in all_findings):
            score -= 5
        score = max(0, min(100, score))

        alert_count = sum(1 for f in all_findings if f.get('severity') in ('critical', 'high'))
        warn_count = sum(1 for f in all_findings if f.get('severity') == 'medium')
        info_count = sum(1 for f in all_findings if f.get('severity') == 'info')

        return {
            'score': score,
            'maxScore': 100,
            'findings': all_findings,
            'details': {
                'secretsFound': secret_count,
                'unsafePatternsFound': unsafe_count,
                'criticalCount': alert_count,
                'warningCount': warn_count,
                'infoCount': info_count,
                'severityBreakdown': {
                    'critical': sum(1 for f in all_findings if f.get('severity') == 'critical'),
                    'high': sum(1 for f in all_findings if f.get('severity') == 'high'),
                    'medium': sum(1 for f in all_findings if f.get('severity') == 'medium'),
                    'low': sum(1 for f in all_findings if f.get('severity') == 'low'),
                    'info': sum(1 for f in all_findings if f.get('severity') == 'info'),
                },
            },
        }


register(SecurityEngine())
