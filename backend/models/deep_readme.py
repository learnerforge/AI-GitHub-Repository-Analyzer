from __future__ import annotations
import re
import math
from .text_analyzer import calculate_readability, extract_keywords


# ---------------------------------------------------------------------------
# Section detection & content extraction
# ---------------------------------------------------------------------------

def extract_sections(md: str) -> list[dict]:
    if not md:
        return []
    md = re.sub(r'```[\s\S]*?```', '', md)
    sections: list[dict] = []
    lines = md.split('\n')
    current: dict | None = None
    for line in lines:
        m = re.match(r'^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$', line)
        if m:
            if current:
                sections.append(current)
            level = len(m.group(1))
            title = m.group(2).strip()
            current = {'level': level, 'title': title, 'body': ''}
        else:
            if current:
                current['body'] += line + '\n'
    if current:
        sections.append(current)
    return sections


def get_section_by_title(sections: list[dict], keywords: list[str]) -> str:
    for s in sections:
        lower = s['title'].lower()
        for kw in keywords:
            if kw in lower:
                return s['body'].strip()
    return ''


def count_sentences(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r'[.!?]+', text)) or 1


def count_code_blocks(md: str) -> list[dict]:
    if not md:
        return []
    blocks: list[dict] = []
    for m in re.finditer(r'```(\w*)\n(.*?)```', md, re.DOTALL):
        lang = m.group(1).strip() or 'unknown'
        code = m.group(2).strip()
        blocks.append({'language': lang, 'lines': code.count('\n') + 1, 'length': len(code)})
    return blocks


def count_inline_code(md: str) -> int:
    if not md:
        return 0
    return len(re.findall(r'`[^`\n]+`', md))


def count_tables(md: str) -> list[dict]:
    if not md:
        return []
    tables: list[dict] = []
    lines = md.split('\n')
    i = 0
    while i < len(lines):
        if '|' in lines[i] and lines[i].strip().startswith('|'):
            rows = []
            while i < len(lines) and '|' in lines[i]:
                rows.append(lines[i].strip())
                i += 1
            if len(rows) >= 2:
                header = [c.strip() for c in rows[0].split('|')[1:-1]]
                separator = rows[1]
                data_rows = rows[2:] if len(rows) > 2 else []
                has_alignment = bool(re.search(r'[-]+', separator))
                tables.append({
                    'columns': len(header), 'headers': header,
                    'dataRows': len(data_rows), 'hasAlignmentRow': has_alignment,
                })
        else:
            i += 1
    return tables


def count_images(md: str) -> list[dict]:
    if not md:
        return []
    images: list[dict] = []
    for m in re.finditer(r'!\[([^\]]*)\]\(([^)]+)\)', md):
        images.append({'alt': m.group(1), 'url': m.group(2)})
    for m in re.finditer(r'<img\s+[^>]*src=["\']([^"\']+)["\']', md, re.IGNORECASE):
        images.append({'alt': 'embedded', 'url': m.group(1)})
    return images


def count_badges(md: str) -> list[dict]:
    if not md:
        return []
    badges: list[dict] = []
    known_services = {
        'img.shields.io': 'shields',
        'badge.fury.io': 'fury',
        'travis-ci.org': 'travis',
        'github.com/': 'github',
        'codecov.io': 'codecov',
        'coveralls.io': 'coveralls',
        'gitter.im': 'gitter',
        'discord.gg': 'discord',
        'discordapp.com': 'discord',
        'circleci.com': 'circleci',
        'appveyor.com': 'appveyor',
        'scrutinizer-ci.com': 'scrutinizer',
    }
    for m in re.finditer(r'\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)', md):
        url = m.group(2).lower()
        service = 'other'
        for domain, svc in known_services.items():
            if domain in url:
                service = svc
                break
        badges.append({'alt': m.group(1), 'service': service, 'url': m.group(2)})
    return badges


def find_links(md: str) -> list[dict]:
    if not md:
        return []
    links: list[dict] = []
    for m in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', md):
        text = m.group(1)
        url = m.group(2)
        is_placeholder = url.startswith('#') or 'TODO' in url.upper() or url == '' or '{' in url
        links.append({'text': text, 'url': url, 'placeholder': is_placeholder})
    return links


def _check_placeholder(text: str) -> bool:
    placeholders = ['todo', 'fixme', 'coming soon', 'tbd', 'to be done', 'placeholder']
    lower = text.lower()
    return any(p in lower for p in placeholders)


def score_installation_quality(body: str) -> dict:
    if not body:
        return {'score': 0, 'hasPrerequisites': False, 'hasCommands': False, 'hasVerificationStep': False, 'stepCount': 0}
    lower = body.lower()
    has_prereq = bool(re.search(r'(require|prerequisite|dependency|need|install|node|python|java|ruby)', lower))
    has_commands = bool(re.search(r'(npm install|pip install|apt-get|brew install|yarn add|cargo install|go get|gem install|bundle install)', lower))
    has_verify = bool(re.search(r'(verify|check|test|confirm|validate|run|start|serve)', lower))
    steps = len(re.findall(r'^\d+[.)]\s', body, re.MULTILINE)) or len(re.findall(r'^- ', body, re.MULTILINE)) // 2
    score = 0
    if body.count('\n') > 3: score += 15
    if has_prereq: score += 20
    if has_commands: score += 30
    if has_verify: score += 15
    score += min(20, steps * 5)
    return {'score': min(100, score), 'hasPrerequisites': has_prereq, 'hasCommands': has_commands, 'hasVerificationStep': has_verify, 'stepCount': steps}


def score_usage_quality(body: str) -> dict:
    if not body:
        return {'score': 0, 'hasCodeExample': False, 'hasOutputExample': False, 'hasOptions': False}
    lower = body.lower()
    has_code = '```' in body
    has_output = bool(re.search(r'(output|result|returns|prints|=>|\$)', lower))
    has_options = bool(re.search(r'(option|flag|argument|param|config|setting)', lower))
    code_blocks = count_code_blocks(body)
    score = 0
    if len(body) > 50: score += 10
    if has_code: score += 25
    if code_blocks:
        tagged = sum(1 for b in code_blocks if b['language'] != 'unknown')
        score += min(15, tagged * 5)
    if has_output: score += 15
    if has_options: score += 15
    if len(body) > 200: score += 10
    examples = len(re.findall(r'```', body)) // 2
    score += min(10, examples * 5)
    return {'score': min(100, score), 'hasCodeExample': has_code, 'hasOutputExample': has_output, 'hasOptions': has_options, 'exampleCount': len(code_blocks), 'taggedExampleCount': sum(1 for b in code_blocks if b['language'] != 'unknown')}


def score_api_docs_quality(body: str) -> dict:
    if not body:
        return {'score': 0, 'hasEndpoints': False, 'hasParams': False, 'hasReturnValues': False, 'hasExamples': False}
    lower = body.lower()
    has_endpoints = bool(re.search(r'(endpoint|route|api|/api/|/v\d+/|method|get|post|put|delete)', lower))
    has_params = bool(re.search(r'(param|argument|parameter|query|header|body)', lower))
    has_returns = bool(re.search(r'(return|response|output|result|status code)', lower))
    has_examples = '```' in body
    has_tables = '|' in body
    score = 0
    if has_endpoints: score += 25
    if has_params: score += 20
    if has_returns: score += 20
    if has_examples: score += 20
    if has_tables: score += 15
    return {'score': min(100, score), 'hasEndpoints': has_endpoints, 'hasParams': has_params, 'hasReturnValues': has_returns, 'hasExamples': has_examples}


def score_contributing_quality(body: str) -> dict:
    if not body:
        return {'score': 0, 'hasPRProcess': False, 'hasCodingStandards': False, 'hasSetupInstructions': False}
    lower = body.lower()
    has_pr = bool(re.search(r'(pull request|pr|submit|branch|fork)', lower))
    has_standards = bool(re.search(r'(standard|style|format|lint|convention|guide)', lower))
    has_setup = bool(re.search(r'(setup|set up|install|clone|run)', lower))
    has_review = bool(re.search(r'(review|approve|maintainer)', lower))
    has_issues = bool(re.search(r'(issue|bug|feature request|improvement)', lower))
    score = 0
    if has_pr: score += 20
    if has_standards: score += 20
    if has_setup: score += 20
    if has_review: score += 15
    if has_issues: score += 15
    if len(body) > 200: score += 10
    return {'score': min(100, score), 'hasPRProcess': has_pr, 'hasCodingStandards': has_standards, 'hasSetupInstructions': has_setup}


def identify_license(md: str) -> dict:
    if not md:
        return {'identified': False, 'license': None, 'confidence': 0}
    md = re.sub(r'```[\s\S]*?```', '', md)
    lower = md.lower()
    patterns = {
        'MIT': [r'MIT License', r'Permission is hereby granted', r'THE SOFTWARE IS PROVIDED "AS IS"'],
        'Apache 2.0': [r'Apache License.*2\.0', r'Licensed under the Apache License'],
        'GPL 3.0': [r'GNU GENERAL PUBLIC LICENSE', r'GPL.*3\.0', r'GNU General Public License'],
        'GPL 2.0': [r'GNU General Public License.*2', r'GPL.*2\.0'],
        'BSD 3-Clause': [r'BSD 3-Clause', r'Redistribution and use in source and binary'],
        'BSD 2-Clause': [r'BSD 2-Clause', r'Redistributions of source code must retain'],
        'MPL 2.0': [r'Mozilla Public License', r'MPL.*2\.0'],
        'LGPL': [r'LGPL', r'GNU Lesser General Public License'],
        'Unlicense': [r'Unlicense', r'public domain'],
        'CC0': [r'CC0', r'Creative Commons Zero'],
        'CC BY 4.0': [r'Creative Commons Attribution'],
        'AGPL': [r'AGPL', r'GNU Affero General Public License'],
    }
    best = {'license': None, 'score': 0}
    for name, pats in patterns.items():
        score = 0
        for p in pats:
            if re.search(p, md, re.IGNORECASE):
                score += 1
        if score > best['score']:
            best = {'license': name, 'score': score}
    identified = best['score'] > 0
    confidence = min(100, best['score'] * 35) if identified else 0
    return {'identified': identified, 'license': best['license'], 'confidence': confidence}


def classify_tone(text: str) -> str:
    if not text or len(text) < 20:
        return 'neutral'
    lower = re.sub(r'```[\s\S]*?```', '', text.lower())
    formal = len(re.findall(r'\b(therefore|furthermore|consequently|implement|utilize|demonstrate|facilitate|hence|thus|whereas)\b', lower))
    casual = len(re.findall(r'\b(just|easy|simple|awesome|great|nice|fun|check it out|basically|actually|pretty)\b', lower))
    academic = len(re.findall(r'\b(lemma|theorem|proof|algorithm|function|define|proposition|corollary|hypothesis)\b', lower))
    if academic > formal and academic > casual:
        return 'academic'
    if formal > casual:
        return 'formal'
    if casual > formal:
        return 'casual'
    return 'neutral'


# ---------------------------------------------------------------------------
# Main analysis function
# ---------------------------------------------------------------------------

def analyze_readme_deep(md: str) -> dict:
    if not md:
        return {
            'sections': [], 'sectionCount': 0, 'headingCount': 0,
            'codeBlocks': [], 'codeBlockCount': 0, 'taggedCodeBlockCount': 0,
            'inlineCodeCount': 0, 'tables': [], 'tableCount': 0,
            'images': [], 'imageCount': 0, 'badges': [], 'badgeCount': 0,
            'links': [], 'linkCount': 0, 'placeholderLinkCount': 0,
            'readability': 0, 'tone': 'neutral', 'sentences': 0,
            'totalWords': 0, 'totalChars': len(md or ''),
            'installation': {'score': 0}, 'usage': {'score': 0},
            'apiDocs': {'score': 0}, 'contributing': {'score': 0},
            'license': {'identified': False}, 'structureScore': 0,
        }

    sections = extract_sections(md)
    heading_count = len(re.findall(r'^#{1,6}\s+', md, re.MULTILINE))
    code_blocks = count_code_blocks(md)
    inline_code = count_inline_code(md)
    tables = count_tables(md)
    images = count_images(md)
    badges = count_badges(md)
    links = find_links(md)
    sentences = count_sentences(md)
    words = len(re.findall(r'\b\w+\b', md))
    readability = calculate_readability(md)
    tone = classify_tone(md)
    placeholder_links = sum(1 for l in links if l['placeholder'])
    structure_score = _compute_structure_score(sections)

    # Per-section analysis
    installation_body = get_section_by_title(sections, ['install', 'setup', 'getting started', 'quickstart', 'prerequisites'])
    usage_body = get_section_by_title(sections, ['usage', 'example', 'quick start', 'how to use', 'running', 'getting started'])
    api_body = get_section_by_title(sections, ['api', 'api reference', 'api documentation', 'endpoints', 'reference'])
    contributing_body = get_section_by_title(sections, ['contributing', 'contribute', 'development', 'how to contribute'])

    installation = score_installation_quality(installation_body)
    usage = score_usage_quality(usage_body)
    api_docs = score_api_docs_quality(api_body)
    contributing = score_contributing_quality(contributing_body)
    license_info = identify_license(md)

    plain = re.sub(r'```[\s\S]*?```', '', md)

    # Detect FIXME/TODO/HACK/TEMP mentions in the README itself
    fixme_count = len(re.findall(r'\bFIXME\b', plain))
    todo_count = len(re.findall(r'\bTODO\b', plain))
    hack_count = len(re.findall(r'\bHACK\b', plain))
    temp_count = len(re.findall(r'\bTEMP\b', plain))

    # Security mentions
    has_security_policy = bool(re.search(r'security|vulnerability|responsible disclosure', plain, re.IGNORECASE))

    # Community signals
    plain_lower = plain.lower()
    has_discord = 'discord' in plain_lower
    has_twitter = bool(re.search(r'twitter|@\w+', plain))
    has_sponsor = bool(re.search(r'sponsor|donate|patreon|open collective|github sponsor', plain, re.IGNORECASE))
    has_roadmap = bool(re.search(r'roadmap|planned|upcoming|future', plain, re.IGNORECASE))

    tagged = sum(1 for b in code_blocks if b['language'] != 'unknown')

    return {
        'sections': [{'title': s['title'], 'level': s['level'], 'bodyLength': len(s['body'])} for s in sections],
        'sectionCount': len(sections),
        'headingCount': heading_count,
        'codeBlocks': code_blocks,
        'codeBlockCount': len(code_blocks),
        'taggedCodeBlockCount': tagged,
        'inlineCodeCount': inline_code,
        'tables': tables,
        'tableCount': len(tables),
        'images': images,
        'imageCount': len(images),
        'badges': badges,
        'badgeCount': len(badges),
        'uniqueBadgeServices': len({b['service'] for b in badges}),
        'links': links,
        'linkCount': len(links),
        'placeholderLinkCount': placeholder_links,
        'readability': round(readability, 1),
        'tone': tone,
        'sentences': sentences,
        'totalWords': words,
        'totalChars': len(md),
        'installation': installation,
        'usage': usage,
        'apiDocs': api_docs,
        'contributing': contributing,
        'license': license_info,
        'structureScore': structure_score,
        'fixmeCount': fixme_count,
        'todoCount': todo_count,
        'hackCount': hack_count,
        'tempCount': temp_count,
        'hasSecurityPolicy': has_security_policy,
        'hasDiscord': has_discord,
        'hasTwitter': has_twitter,
        'hasSponsorSection': has_sponsor,
        'hasRoadmap': has_roadmap,
    }


def _compute_structure_score(sections: list[dict]) -> float:
    if not sections:
        return 0
    score = 0
    titles_lower = [s['title'].lower() for s in sections]

    expected = ['description', 'install', 'usage', 'api', 'config', 'contributing', 'license', 'test']
    for exp in expected:
        if any(exp in t for t in titles_lower):
            score += 12.5

    has_h1 = any(s['level'] == 1 for s in sections)
    h2_count = sum(1 for s in sections if s['level'] == 2)
    if has_h1: score += 5
    if 3 <= h2_count <= 10: score += 5
    elif h2_count > 10: score -= 5

    return min(100, score)
