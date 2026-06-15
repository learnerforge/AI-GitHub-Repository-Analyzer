from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any
from ..services.github import fetch_repo_info
from ..services.analyzer import analyze_repository, load_report, list_reports, search_reports
from ..models.reinforcement import reinforcement_learner
from ..models.persistence import get_training_data_size, list_checkpoints, load_all_experiences

router = APIRouter()


class AnalyzeRequest(BaseModel):
    url: str


class FeedbackRequest(BaseModel):
    rating: int
    repoUrl: str = ''


class TrainRequest(BaseModel):
    epochs: int = 10
    batchSize: int = 64


@router.post('/analyze')
async def analyze(req: AnalyzeRequest):
    try:
        repo = await fetch_repo_info(req.url)
        report = await analyze_repository(repo)
        return {'report': report}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/report/{repo_id:path}')
async def get_report(repo_id: str):
    report = load_report(repo_id)
    if not report:
        raise HTTPException(status_code=404, detail='Report not found')
    return {'report': report}


@router.patch('/report/{repo_id:path}')
async def update_report(repo_id: str, body: dict[str, Any]):
    report = load_report(repo_id)
    if not report:
        raise HTTPException(status_code=404, detail='Report not found')
    allowed = ['summary', 'architecture', 'onboardingGuide', 'suggestions',
               'techStack', 'codeSmells', 'qualityScores', 'docsQuality']
    for field in allowed:
        if field in body:
            report[field] = body[field]
    from datetime import datetime, timezone
    report['generatedAt'] = datetime.now(timezone.utc).isoformat()
    from ..services.analyzer import _save_report
    _save_report(report)
    return {'report': report, 'message': 'Report updated successfully'}


@router.get('/reports')
async def list_all_reports(limit: int = Query(50, le=100), offset: int = Query(0, ge=0)):
    reports = list_reports(limit, offset)
    return {'reports': reports, 'total': len(reports)}


@router.get('/search')
async def search(q: str = Query('', min_length=1), limit: int = Query(20, le=50)):
    results = search_reports(q, limit)
    return {'results': results, 'total': len(results)}


@router.post('/compare')
async def compare_repos(body: dict[str, list[str]]):
    urls = body.get('urls', [])
    if len(urls) < 2:
        raise HTTPException(status_code=400, detail='At least 2 URLs required')
    if len(urls) > 5:
        raise HTTPException(status_code=400, detail='Maximum 5 URLs allowed')
    reports = []
    for url in urls:
        try:
            repo = await fetch_repo_info(url)
            report = await analyze_repository(repo)
            reports.append(report)
        except Exception as e:
            reports.append({'repoUrl': url, 'error': str(e)})
    return {'reports': reports, 'count': len(reports)}


@router.get('/stats')
async def get_stats():
    rl_stats = reinforcement_learner.get_stats()
    train_data = get_training_data_size()
    checkpoints = list_checkpoints()
    return {
        'reinforcementLearning': rl_stats,
        'trainingData': train_data,
        'checkpoints': checkpoints,
    }


@router.post('/train/trigger')
async def trigger_training(body: TrainRequest = TrainRequest()):
    from ..models.reinforcement import compute_readme_metrics
    from ..services.analyzer import list_reports
    all_exps = load_all_experiences()
    count = len(all_exps)
    if count == 0:
        reports = list_reports(200, 0)
        for r in reports:
            report = load_report(r['id'])
            if report:
                state = _report_to_state(report)
                if state:
                    action = reinforcement_learner.select_action(state, 0.5)
                    reward = reinforcement_learner.compute_reward(
                        report.get('qualityScores', {}).get('overall', 50), 0)
                    reinforcement_learner.store_experience(state, action, reward, state)
    result = reinforcement_learner.train_multiple(body.epochs, body.batchSize)
    reinforcement_learner.persist()
    stats = reinforcement_learner.get_stats()
    return {'training': result, 'stats': stats, 'experiences': len(reinforcement_learner.experience_buffer)}


@router.get('/train/stats')
async def train_stats():
    rl_stats = reinforcement_learner.get_stats()
    train_data = get_training_data_size()
    return {
        'states': rl_stats['states'],
        'totalQValues': rl_stats['totalQValues'],
        'avgQ': rl_stats['avgQ'],
        'experiences': rl_stats['experiences'] + train_data['experiences'],
        'trainingSteps': rl_stats['trainingSteps'],
        'savedFiles': train_data['files'],
    }


@router.post('/train/feedback')
async def train_feedback(body: FeedbackRequest):
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail='Rating must be 1-5')
    try:
        from ..services.github import fetch_repo_info
        repo = await fetch_repo_info(body.repoUrl)
        from ..services.analyzer import analyze_repository
        report = await analyze_repository(repo)
        from ..models.reinforcement import compute_readme_metrics, quantize_state
        readme = repo.get('readmeContent', '') or ''
        state = {
            'repoStars': repo.get('stars', 0) or 0,
            'repoForks': repo.get('forks', 0) or 0,
            'fileCount': len(repo.get('fileTree', []) or []),
            'languageCount': len(repo.get('languages', {})),
            'readmeLength': len(readme),
            'contributorCount': len(repo.get('contributors', []) or []),
            'hasTests': False, 'hasCI': False,
            'readmeScore': 50, 'docsSectionCount': 0,
            'hasApiDocs': 'api' in readme.lower(),
            'hasLicense': 'license' in readme.lower(),
            'lastCommitDays': 30, 'hasDockerfile': False, 'hasContributing': False,
            **compute_readme_metrics(readme),
        }
        action = reinforcement_learner.select_action(state, 0.3)
        reinforcement_learner.ingest_user_feedback(float(body.rating), state, action)
        reinforcement_learner.persist()
        return {'message': 'Feedback recorded', 'rating': body.rating}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _report_to_state(report: dict) -> dict | None:
    if not report:
        return None
    qs = report.get('qualityScores', {}) or {}
    health = report.get('health', {}) or {}
    complexity = report.get('complexity', {}) or {}
    from ..models.reinforcement import compute_readme_metrics
    readme = ''
    pr = report.get('processedReadme', {}) or {}
    if isinstance(pr, dict):
        readme = pr.get('cleanText', '') or ''
    rr = compute_readme_metrics(readme)
    return {
        'repoStars': health.get('stars', 0) or 0,
        'repoForks': health.get('forks', 0) or 0,
        'fileCount': complexity.get('fileCount', 0) or 0,
        'languageCount': complexity.get('fileCount', 0) or 0,
        'readmeLength': len(readme),
        'contributorCount': health.get('contributorCount', 0) or 0,
        'hasTests': health.get('hasTests', False),
        'hasCI': health.get('hasCI', False),
        'readmeScore': qs.get('documentation', 50) or 50,
        'docsSectionCount': 0,
        'hasApiDocs': 'api' in readme.lower(),
        'hasLicense': 'license' in readme.lower(),
        'lastCommitDays': health.get('lastCommitDays', 30) or 30,
        'hasDockerfile': False,
        'hasContributing': False,
        **rr,
    }
