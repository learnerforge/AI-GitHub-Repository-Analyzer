from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router

app = FastAPI(
    title='GitHub Repository Analyzer API',
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


@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '2.0.0'}
