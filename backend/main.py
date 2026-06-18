from __future__ import annotations
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api.routes import router
from .api.auth_routes import router as auth_router
from .models.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title='GitHub Repository Analyzer',
    version='2.0.0',
    description='AI-powered GitHub repository analysis backend',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(router, prefix='/api')
app.include_router(auth_router, prefix='/api/auth')

static_dir = Path(__file__).resolve().parent.parent / 'frontend'
static_dir.mkdir(exist_ok=True)


@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '2.0.0'}


@app.get('/favicon.ico')
async def favicon():
    return FileResponse(static_dir / 'favicon.ico') if (static_dir / 'favicon.ico').exists() else ''


@app.get('/')
async def root():
    return FileResponse(static_dir / 'index.html')


app.mount('/static', StaticFiles(directory=str(static_dir)), name='static')
