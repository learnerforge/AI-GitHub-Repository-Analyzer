import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
RESULTS_DIR = DATA_DIR / 'results'
CHECKPOINT_DIR = DATA_DIR / 'checkpoints'
TRAINING_DIR = DATA_DIR / 'training'
LOGS_DIR = DATA_DIR / 'logs'

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')

AI_PROVIDER = os.environ.get('AI_PROVIDER', 'localai')

for d in [RESULTS_DIR, CHECKPOINT_DIR, TRAINING_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)
