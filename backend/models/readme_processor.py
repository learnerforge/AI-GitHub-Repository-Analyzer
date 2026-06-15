from __future__ import annotations
import re
from .text_analyzer import split_sentences, extract_keywords


def clean_readme(raw: str) -> str:
    if not raw:
        return ''
    text = raw
    text = re.sub(r'<!--[\s\S]*?-->', '', text)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'\[!\[.*?\]\(.*?\)\]\(.*?\)', '', text)
    text = re.sub(r'https?://img\.shields\.io/[^\s)]+', '', text)
    text = re.sub(r'https?://badge\.[^\s)]+', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'https?://[^\s)]+', '', text)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'````[\s\S]*?````', '', text)
    text = re.sub(r'`[^`]+`', '', text)
    text = re.sub(r'- \[.*?\]\(#.*?\)', '', text)
    text = re.sub(r'^\s*\[.*?\]:\s*.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^---+$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'^[\U00010000-\U0010ffff]+\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = '\n'.join(l.strip() for l in text.split('\n'))
    return text.strip()


def extract_headings(text: str) -> list[dict]:
    headings: list[dict] = []
    for m in re.finditer(r'^(#{1,6})\s+(.+)$', text, re.MULTILINE):
        headings.append({'level': len(m.group(1)), 'text': m.group(2).strip()})
    return headings


def _strip_markdown(text: str) -> str:
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    return text.strip()


def extract_features(readme: str) -> list[str]:
    features: list[str] = []
    sections = re.split(r'\n#{1,3}\s+', readme)
    for section in sections:
        header = section.split('\n')[0].lower()
        if re.search(r'features|what.*(does|can|this)|key.*(capabilit|feature|highlight)', header):
            for line in section.split('\n'):
                if re.match(r'^\s*[-*+]\s+', line):
                    cleaned = _strip_markdown(re.sub(r'^\s*[-*+]\s+', '', line))
                    if 10 < len(cleaned) < 150:
                        features.append(cleaned[0].upper() + cleaned[1:])
    if not features:
        for line in readme.split('\n'):
            trimmed = re.sub(r'^\s*[-*+]\s+', '', line).strip()
            if (15 < len(trimmed) < 120 and not trimmed.startswith('[')
                    and not trimmed.startswith('http') and not trimmed.startswith('!')
                    and not trimmed.startswith('#') and not trimmed.startswith('|')
                    and not re.match(r'^[┌─┐└┘│├┤┬┴┼▀▄█▌▐]', trimmed)
                    and '```' not in trimmed and not re.match(r'^[─=]{3,}$', trimmed)
                    and '|' not in trimmed and '─' not in trimmed and '┌' not in trimmed):
                features.append(_strip_markdown(trimmed[0].upper() + trimmed[1:]))
    seen: list[str] = []
    for f in features:
        if f not in seen:
            seen.append(f)
    return seen[:6]


def detect_readme_difficulty(readme: str) -> str:
    if not readme:
        return 'Intermediate'
    lower = readme.lower()
    score = 0
    advanced = ['kubernetes', 'distributed', 'microservice', 'docker compose',
                'multi-thread', 'asynchronous', 'websocket', 'real-time', 'oauth', 'jwt',
                'authentication', 'authorization', 'middleware', 'dependency injection',
                'test coverage', 'ci/cd', 'continuous integration', 'deployment']
    for t in advanced:
        if t in lower:
            score += 1
    beginner = ['getting started', 'quick start', 'beginner', 'simple',
                'easy', 'tutorial', 'hello world', 'starter', 'basic', 'minimal',
                'example', 'demo', 'guide']
    for t in beginner:
        if t in lower:
            score -= 1
    if score >= 4:
        return 'Advanced'
    if score <= -1:
        return 'Beginner'
    return 'Intermediate'


def extract_overview(readme: str, description: str | None) -> str:
    clean = clean_readme(readme)
    sentences = split_sentences(clean)
    if description and len(description) > 20:
        return _strip_markdown(description)
    lines = [l for l in clean.split('\n') if l.strip()]
    start_idx = 0
    for i in range(min(len(lines), 5)):
        if re.match(r'^#\s', lines[i]):
            start_idx = i + 1
            break
    para: list[str] = []
    for i in range(start_idx, len(lines)):
        if re.match(r'^#', lines[i]):
            break
        trimmed = re.sub(r'^#{1,6}\s*', '', lines[i]).strip()
        if (trimmed and not trimmed.startswith('-') and not trimmed.startswith('*')
                and not trimmed.startswith('|') and not re.match(r'^[┌─┐└┘│]', trimmed)):
            para.append(trimmed)
        if len(' '.join(para)) > 300:
            break
    if len(' '.join(para)) > 30:
        return _strip_markdown(' '.join(para))[:500]
    if sentences:
        return _strip_markdown(' '.join(sentences[:3])).replace('#', '').strip()[:500]
    return clean[:500]


def extract_tech_keywords(readme: str) -> list[str]:
    tech_terms = [
        'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'node.js', 'deno',
        'typescript', 'javascript', 'python', 'rust', 'go', 'golang', 'java', 'kotlin',
        'swift', 'ruby', 'php', 'c++', 'c#', 'dart', 'flutter', 'tensorflow',
        'pytorch', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'firebase',
        'graphql', 'rest', 'api', 'grpc', 'websocket', 'redis', 'postgresql',
        'mongodb', 'mysql', 'sqlite', 'elasticsearch', 'kafka', 'rabbitmq',
        'tailwind', 'bootstrap', 'sass', 'less', 'webpack', 'vite', 'esbuild',
        'jest', 'mocha', 'cypress', 'playwright', 'pandas', 'numpy', 'scikit-learn',
        'opencv', 'llm', 'gpt', 'openai', 'langchain', 'hugging face', 'transformers',
    ]
    lower = readme.lower()
    found: list[str] = []
    for term in tech_terms:
        if term in lower and term not in found:
            found.append(term)
    return found[:8]


def check_section(text: str, patterns: list[str]) -> bool:
    lower = text.lower()
    return any(p in lower for p in patterns)


def process_readme(readme: str, description: str | None) -> dict:
    clean_text = clean_readme(readme)
    headings = extract_headings(readme)
    features = extract_features(readme)
    overview = extract_overview(readme, description)
    tech_keywords = extract_tech_keywords(readme)
    lower = readme.lower() if readme else ''
    return {
        'cleanText': clean_text,
        'overview': overview,
        'features': features,
        'headings': headings,
        'hasInstallSection': 'install' in lower or 'setup' in lower or 'getting started' in lower,
        'hasUsageSection': 'usage' in lower or 'example' in lower or 'quick start' in lower,
        'hasApiSection': 'api' in lower or 'api reference' in lower or 'api documentation' in lower,
        'difficulty': detect_readme_difficulty(readme),
        'techKeywords': tech_keywords,
    }


def compile_repo_summary(
    readme: str, description: str | None, stars: int, forks: int,
    topics: list[str], tech_stack: list[str], docs_score: float, quality_score: float,
) -> str:
    processed = process_readme(readme, description)
    lines: list[str] = []
    if processed['overview']:
        lines.append(processed['overview'])
    if processed['features']:
        lines.append('')
        lines.append('Key Features:')
        for f in processed['features'][:6]:
            lines.append(f'  \u2022 {f}')
    if tech_stack:
        lines.append('')
        lines.append(f'Tech Stack: {", ".join(tech_stack)}')
    lines.append('')
    lines.append(f'Difficulty: {processed["difficulty"]}')
    lines.append(f'Documentation: {docs_score}/100')
    lines.append(f'Quality Score: {quality_score}/100')
    return '\n'.join(lines)
