from __future__ import annotations
import re
import math

STOP_WORDS: set[str] = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his',
    'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
    'about', 'above', 'after', 'again', 'all', 'also', 'any', 'because',
    'before', 'between', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'only', 'own', 'same', 'into', 'over', 'under', 'up',
    'out', 'off', 'down', 'here', 'there', 'when', 'where', 'why', 'how',
    'which', 'who', 'whom', 'what', 'while', 'during', 'through', 'until',
}


def tokenize(text: str) -> list[str]:
    cleaned = re.sub(r'[^a-z0-9\s-]', ' ', text.lower())
    return [w for w in cleaned.split() if len(w) > 2 and w not in STOP_WORDS]


def split_sentences(text: str) -> list[str]:
    text = re.sub(r'\n\s*\n', '. ', text)
    parts = re.split(r'([.!?])\s+(?=[A-Z])', text)
    sentences: list[str] = []
    i = 0
    while i < len(parts):
        if i + 1 < len(parts) and re.match(r'^[.!?]$', parts[i + 1]):
            sentences.append((parts[i] + parts[i + 1]).strip())
            i += 2
        else:
            sentences.append(parts[i].strip())
            i += 1
    sentences = [s for s in sentences if 20 < len(s) < 500]
    if not sentences:
        sentences = [s.strip() for s in text.split('\n') if len(s.strip()) > 10]
    return sentences


def extract_keywords(text: str, top_n: int = 20) -> list[dict]:
    words = tokenize(text)
    if not words:
        return []
    total = len(words)
    freq: dict[str, int] = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    sorted_words = sorted(freq.items(), key=lambda x: -x[1])
    return [{'word': w, 'score': c / total} for w, c in sorted_words[:top_n]]


def calculate_readability(text: str) -> float:
    if not text:
        return 0.0
    sentences = [s for s in re.split(r'[.!?]+', text) if s.strip()]
    words = [w for w in text.split() if w]
    if not sentences or not words:
        return 0.0
    syllable_count = 0
    for word in words:
        syls = re.sub(r'[^aeiouy]', ' ', word.lower()).strip().split()
        syllable_count += max(1, len(syls))
    score = 206.835 - 1.015 * (len(words) / len(sentences)) - 84.6 * (syllable_count / len(words))
    return max(0.0, min(100.0, round(score * 1.5)))


def cosine_similarity(a: str, b: str) -> float:
    tokens_a = tokenize(a)
    tokens_b = tokenize(b)
    freq_a: dict[str, int] = {}
    freq_b: dict[str, int] = {}
    for t in tokens_a:
        freq_a[t] = freq_a.get(t, 0) + 1
    for t in tokens_b:
        freq_b[t] = freq_b.get(t, 0) + 1
    all_words = set(freq_a.keys()) | set(freq_b.keys())
    dot = 0
    mag_a = 0
    mag_b = 0
    for w in all_words:
        va = freq_a.get(w, 0)
        vb = freq_b.get(w, 0)
        dot += va * vb
        mag_a += va * va
        mag_b += vb * vb
    mag_a = math.sqrt(mag_a)
    mag_b = math.sqrt(mag_b)
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)
