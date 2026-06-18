from __future__ import annotations
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from typing import Any
from ..models.database import get_db
from ..models.auth import hash_password, verify_password, create_token, decode_token

router = APIRouter()


class RegisterBody(BaseModel):
    username: str
    email: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class RepoSaveBody(BaseModel):
    repoUrl: str
    repoName: str = ''
    notes: str = ''


class RepoUpdateBody(BaseModel):
    repoName: str = ''
    notes: str = ''


def _get_user_from_token(authorization: str = Header('')) -> dict[str, Any]:
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing or invalid token')
    token = authorization[7:]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    return payload


@router.post('/register')
async def register(body: RegisterBody):
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail='Password must be at least 4 characters')
    conn = get_db()
    try:
        cur = conn.execute('SELECT id FROM users WHERE username = ? OR email = ?',
                           (body.username, body.email))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail='Username or email already exists')
        hashed = hash_password(body.password)
        cur = conn.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                           (body.username, body.email, hashed))
        conn.commit()
        user_id = cur.lastrowid
        token = create_token(user_id, body.username)
        return {'token': token, 'user': {'id': user_id, 'username': body.username, 'email': body.email}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post('/login')
async def login(body: LoginBody):
    conn = get_db()
    try:
        cur = conn.execute('SELECT id, username, email, password FROM users WHERE username = ?',
                           (body.username,))
        row = cur.fetchone()
        if not row or not verify_password(body.password, row['password']):
            raise HTTPException(status_code=401, detail='Invalid username or password')
        token = create_token(row['id'], row['username'])
        return {'token': token, 'user': {'id': row['id'], 'username': row['username'], 'email': row['email']}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get('/me')
async def get_me(payload: dict = Depends(_get_user_from_token)):
    conn = get_db()
    try:
        cur = conn.execute('SELECT id, username, email, created_at FROM users WHERE id = ?',
                           (int(payload['sub']),))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='User not found')
        return {'user': dict(row)}
    finally:
        conn.close()


@router.get('/saved-repos')
async def list_saved_repos(payload: dict = Depends(_get_user_from_token)):
    conn = get_db()
    try:
        cur = conn.execute(
            'SELECT id, repo_url, repo_name, notes, created_at FROM saved_repos WHERE user_id = ? ORDER BY created_at DESC',
            (int(payload['sub']),))
        return {'repos': [dict(r) for r in cur.fetchall()]}
    finally:
        conn.close()


@router.post('/saved-repos')
async def save_repo(body: RepoSaveBody, payload: dict = Depends(_get_user_from_token)):
    conn = get_db()
    try:
        cur = conn.execute(
            'INSERT INTO saved_repos (user_id, repo_url, repo_name, notes) VALUES (?, ?, ?, ?)',
            (int(payload['sub']), body.repoUrl, body.repoName, body.notes))
        conn.commit()
        return {'id': cur.lastrowid, 'message': 'Repo saved'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete('/saved-repos/{repo_id}')
async def delete_saved_repo(repo_id: int, payload: dict = Depends(_get_user_from_token)):
    conn = get_db()
    try:
        cur = conn.execute(
            'DELETE FROM saved_repos WHERE id = ? AND user_id = ?',
            (repo_id, int(payload['sub'])))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail='Repo not found')
        return {'message': 'Repo removed'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.patch('/saved-repos/{repo_id}')
async def update_saved_repo(repo_id: int, body: RepoUpdateBody,
                            payload: dict = Depends(_get_user_from_token)):
    conn = get_db()
    try:
        cur = conn.execute(
            'UPDATE saved_repos SET repo_name = ?, notes = ? WHERE id = ? AND user_id = ?',
            (body.repoName, body.notes, repo_id, int(payload['sub'])))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail='Repo not found')
        return {'message': 'Repo updated'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
