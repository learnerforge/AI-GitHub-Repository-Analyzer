from __future__ import annotations
from .text_analyzer import split_sentences, cosine_similarity, extract_keywords, calculate_readability

PAGE_RANK_DAMPING = 0.85
PAGE_RANK_ITERATIONS = 30
SUMMARY_RATIO = 0.3


def text_rank(sentences: list[str]) -> list[float]:
    n = len(sentences)
    if n == 0:
        return []
    if n == 1:
        return [1.0]
    similarity = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(sentences[i], sentences[j])
            similarity[i][j] = sim
            similarity[j][i] = sim
    scores = [1.0 / n] * n
    for _ in range(PAGE_RANK_ITERATIONS):
        new_scores = [0.0] * n
        for i in range(n):
            total = 0.0
            for j in range(n):
                if i != j:
                    row_sum = sum(similarity[j])
                    if row_sum > 0:
                        total += similarity[j][i] * scores[j] / row_sum
            new_scores[i] = (1 - PAGE_RANK_DAMPING) / n + PAGE_RANK_DAMPING * total
        scores = new_scores
    return scores


def generate_summary(text: str) -> dict:
    if not text or len(text) < 50:
        return {'summary': text or 'No content available for summarization.',
                'keyPoints': [], 'confidence': 0.0}
    sentences = split_sentences(text)
    if not sentences:
        return {'summary': text[:500], 'keyPoints': [], 'confidence': 10.0}
    scores = text_rank(sentences)
    keywords = extract_keywords(text, 10)
    scored = [{'sentence': s, 'score': scores[i], 'index': i} for i, s in enumerate(sentences)]
    scored.sort(key=lambda x: -x['score'])
    num_sentences = max(1, int(len(sentences) * SUMMARY_RATIO))
    top = scored[:num_sentences]
    top.sort(key=lambda x: x['index'])
    summary = ' '.join(t['sentence'] for t in top)
    key_points = [k['word'] for k in keywords[:5]]
    readability = calculate_readability(text)
    avg_score = sum(scores) / len(scores) if scores else 0
    confidence = min(100, round(
        (30 if len(sentences) > 3 else 10) +
        (20 if readability > 30 else 5) +
        (25 if len(summary) > 100 else 10) +
        (25 if len(keywords) > 5 else 10)
    ))
    return {'summary': summary, 'keyPoints': key_points, 'confidence': confidence}
