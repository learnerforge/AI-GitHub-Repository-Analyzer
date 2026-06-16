from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api.routes import router

app = FastAPI(
    title='GitHub Repository Analyzer',
    version='2.0.0',
    description='AI-powered GitHub repository analysis backend',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(router, prefix='/api')

static_dir = Path(__file__).resolve().parent.parent / 'static'
static_dir.mkdir(exist_ok=True)


@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '2.0.0'}


@app.get('/')
async def root():
    return FileResponse(static_dir / 'index.html')


app.mount('/static', StaticFiles(directory=str(static_dir)), name='static')
