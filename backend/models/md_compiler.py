from __future__ import annotations
import re
from html import escape


def compile_markdown(md: str) -> str:
    if not md:
        return ''
    text = _sanitize_html(md)
    code_blocks: list[str] = []

    def _save_code(m):
        lang = m.group(1).strip() or ''
        code = m.group(2)
        cls = f' class="language-{escape(lang)}"' if lang else ''
        html = f'<pre><code{cls}>{escape(code)}</code></pre>'
        code_blocks.append(html)
        return f'\x00CODE{len(code_blocks) - 1}\x00'
    text = re.sub(r'```(\w*)\n(.*?)```', _save_code, text, flags=re.DOTALL)

    tables: list[str] = []
    def _save_table(m):
        html = _compile_table(m.group(0))
        tables.append(html)
        return f'\x00TBL{len(tables) - 1}\x00'
    text = re.sub(r'\|[^\n]+\|(?:\n\|[^\n]+\|)*', _save_table, text)

    text = re.sub(r'^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$', lambda m: f'<h{len(m.group(1))}>{_inline(m.group(2).strip())}</h{len(m.group(1))}>', text, flags=re.MULTILINE)
    text = re.sub(r'^[-*_]{3,}\s*$', '<hr>', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = _compile_lists(text)
    text = _compile_blockquotes(text)
    text = _compile_paragraphs(text)

    for i, html in enumerate(code_blocks):
        text = text.replace(f'\x00CODE{i}\x00', html)
    for i, html in enumerate(tables):
        text = text.replace(f'\x00TBL{i}\x00', html)

    return text.strip()


def _sanitize_html(text: str) -> str:
    text = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<[^>]*>', '', text)
    return text


def _inline(text: str) -> str:
    text = escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', lambda m: f'<img src="{escape(m.group(2))}" alt="{escape(m.group(1))}">', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: f'<a href="{escape(m.group(2))}">{m.group(1)}</a>', text)
    return text


def _compile_table(block: str) -> str:
    rows = [r.strip() for r in block.strip().split('\n') if r.strip()]
    if len(rows) < 1:
        return block
    sep_idx = None
    for i, r in enumerate(rows):
        if re.match(r'^[\s\|:,-]+$', r):
            sep_idx = i
            break
    html = '<table>'
    if sep_idx is not None and sep_idx < len(rows):
        if sep_idx == 0 and len(rows) > 1:
            header_cells = _split_cells(rows[1])
            data_start = 2
        else:
            header_cells = _split_cells(rows[0])
            data_start = sep_idx + 1
        if header_cells and any(c.strip() for c in header_cells):
            html += '<thead><tr>'
            for c in header_cells:
                html += f'<th>{_inline(c.strip())}</th>'
            html += '</tr></thead>'
    else:
        header_cells = _split_cells(rows[0])
        data_start = 1
    if data_start < len(rows):
        html += '<tbody>'
        for r in rows[data_start:]:
            cells = _split_cells(r)
            if cells:
                html += '<tr>'
                for c in cells:
                    html += f'<td>{_inline(c.strip())}</td>'
                html += '</tr>'
        html += '</tbody>'
    html += '</table>'
    return html


def _split_cells(row: str) -> list[str]:
    cells: list[str] = []
    cur = ''
    in_code = False
    for ch in row:
        if ch == '`':
            in_code = not in_code
            cur += ch
        elif ch == '|' and not in_code:
            cells.append(cur)
            cur = ''
        else:
            cur += ch
    if cur:
        cells.append(cur)
    while cells and cells[0].strip() == '':
        cells = cells[1:]
    while cells and cells[-1].strip() == '':
        cells = cells[:-1]
    return cells


def _compile_lists(text: str) -> str:
    lines = text.split('\n')
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r'^\s*[-*+]\s+', line):
            result.append('<ul>')
            while i < len(lines) and re.match(r'^\s*[-*+]\s+', lines[i]):
                content = re.sub(r'^\s*[-*+]\s+', '', lines[i])
                result.append(f'<li>{_inline(content)}</li>')
                i += 1
            result.append('</ul>')
        elif re.match(r'^\s*\d+[.)]\s+', line):
            result.append('<ol>')
            while i < len(lines) and re.match(r'^\s*\d+[.)]\s+', lines[i]):
                content = re.sub(r'^\s*\d+[.)]\s+', '', lines[i])
                result.append(f'<li>{_inline(content)}</li>')
                i += 1
            result.append('</ol>')
        else:
            result.append(line)
            i += 1
    return '\n'.join(result)


def _compile_blockquotes(text: str) -> str:
    lines = text.split('\n')
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('> '):
            result.append('<blockquote>')
            while i < len(lines) and lines[i].startswith('> '):
                result.append(_inline(lines[i][2:]))
                i += 1
            result.append('</blockquote>')
        else:
            result.append(line)
            i += 1
    return '\n'.join(result)


def _compile_paragraphs(text: str) -> str:
    lines = text.split('\n')
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if (stripped
            and not stripped.startswith('<h')
            and not stripped.startswith('<pre')
            and not stripped.startswith('<ul')
            and not stripped.startswith('<ol')
            and not stripped.startswith('<li')
            and not stripped.startswith('<blockquote')
            and not stripped.startswith('<hr')
            and not stripped.startswith('</')
            and not stripped.startswith('\x00')):
            paras = [_inline(stripped)]
            i += 1
            while i < len(lines):
                next_s = lines[i].strip()
                if (next_s == ''
                    or next_s.startswith('<')
                    or next_s.startswith('\x00')):
                    break
                paras.append(_inline(next_s))
                i += 1
            result.append(f'<p>{" ".join(paras)}</p>')
        else:
            result.append(line)
            i += 1
    return '\n'.join(result)
