from __future__ import annotations
import json
import os
import time
from pathlib import Path
from ..config import CHECKPOINT_DIR, TRAINING_DIR


def _ensure_dir(d: Path) -> None:
    d.mkdir(parents=True, exist_ok=True)


def save_q_table(
    q_table: dict[str, dict[str, float]],
    training_steps: int,
    label: str = 'latest',
) -> str:
    _ensure_dir(CHECKPOINT_DIR)
    data = {
        'qTable': q_table,
        'experienceBuffer': [],
        'trainingSteps': training_steps,
        'version': 1,
        'exportedAt': _now_iso(),
    }
    filepath = CHECKPOINT_DIR / f'qtable-{label}.json'
    filepath.write_text(json.dumps(data, indent=2), encoding='utf-8')
    dated = CHECKPOINT_DIR / f'qtable-{label}-{int(time.time() * 1000)}.json'
    dated.write_text(json.dumps(data, indent=2), encoding='utf-8')
    return str(filepath)


def load_latest_q_table() -> dict | None:
    _ensure_dir(CHECKPOINT_DIR)
    files = sorted(
        [f for f in CHECKPOINT_DIR.iterdir() if f.name.startswith('qtable-') and f.suffix == '.json'],
        key=lambda f: f.stat().st_mtime, reverse=True,
    )
    if not files:
        return None
    try:
        raw = files[0].read_text(encoding='utf-8')
        parsed = json.loads(raw)
        if 'qTable' in parsed:
            return parsed
        return {'qTable': parsed, 'experienceBuffer': [], 'trainingSteps': 0, 'version': 1, 'exportedAt': ''}
    except (json.JSONDecodeError, OSError):
        return None


def list_checkpoints() -> list[dict]:
    _ensure_dir(CHECKPOINT_DIR)
    entries: list[dict] = []
    for f in CHECKPOINT_DIR.iterdir():
        if f.name.startswith('qtable-') and f.suffix == '.json':
            stat = f.stat()
            entries.append({
                'label': f.name.replace('qtable-', '').replace('.json', ''),
                'timestamp': _iso_from_ts(stat.st_mtime),
                'size': stat.st_size,
            })
    entries.sort(key=lambda x: x['timestamp'], reverse=True)
    return entries


def save_experience_buffer(experiences: list[dict], append: bool = True) -> str:
    _ensure_dir(TRAINING_DIR)
    filename = f'experiences-{int(time.time() * 1000)}.json'
    filepath = TRAINING_DIR / filename
    data = [
        {
            'state': {k: exp['state'][k] for k in ('repoStars', 'repoForks', 'fileCount', 'languageCount',
                       'readmeLength', 'contributorCount', 'hasTests', 'hasCI')},
            'action': exp['action'],
            'reward': exp['reward'],
            'nextState': {k: exp['nextState'][k] for k in ('repoStars', 'repoForks', 'fileCount', 'languageCount',
                           'readmeLength', 'contributorCount', 'hasTests', 'hasCI')},
            'timestamp': exp.get('timestamp', time.time() * 1000),
        }
        for exp in experiences
    ]
    if append and filepath.exists():
        existing = json.loads(filepath.read_text(encoding='utf-8'))
        data.extend(existing)
    filepath.write_text(json.dumps(data, indent=2), encoding='utf-8')
    return str(filepath)


def load_all_experiences() -> list[dict]:
    _ensure_dir(TRAINING_DIR)
    all_data: list[dict] = []
    for f in TRAINING_DIR.iterdir():
        if f.name.startswith('experiences-') and f.suffix == '.json':
            try:
                data = json.loads(f.read_text(encoding='utf-8'))
                if isinstance(data, list):
                    all_data.extend(data)
            except (json.JSONDecodeError, OSError):
                pass
    return all_data


def get_training_data_size() -> dict:
    _ensure_dir(TRAINING_DIR)
    files = [f for f in TRAINING_DIR.iterdir() if f.name.startswith('experiences-') and f.suffix == '.json']
    total = 0
    for f in files:
        try:
            data = json.loads(f.read_text(encoding='utf-8'))
            if isinstance(data, list):
                total += len(data)
        except (json.JSONDecodeError, OSError):
            pass
    return {'files': len(files), 'experiences': total}


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _iso_from_ts(ts: float) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
