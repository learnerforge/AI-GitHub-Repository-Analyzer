@echo off
REM ===========================================================================
REM AI GitHub Repository Analyzer — Windows Setup Script
REM ===========================================================================

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  AI GitHub Repository Analyzer Setup              ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM 1. Check Node.js
echo [1/5] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   ✗ Node.js not found. Install from https://nodejs.org/ (v18+)
    exit /b 1
)
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set NODE_MAJOR=%%a
)
set NODE_MAJOR=%NODE_MAJOR:~1%
if %NODE_MAJOR% lss 18 (
    echo   ✗ Node.js v18+ required (found v%NODE_MAJOR%)
    exit /b 1
)
echo   ✓ Node.js v%NODE_MAJOR%+

REM 2. Install dependencies
echo [2/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo   ✗ npm install failed
    exit /b 1
)
echo   ✓ Dependencies installed

REM 3. Setup .env
echo [3/5] Setting up environment variables...
if not exist .env (
    copy .env.example .env >nul
    echo   ✓ Created .env from .env.example — please edit .env with your API keys
) else (
    echo   ✓ .env already exists
)

REM 4. Create required directories
echo [4/5] Creating required directories...
if not exist analysis-results mkdir analysis-results
if not exist training-data mkdir training-data
if not exist model-checkpoints mkdir model-checkpoints
if not exist training-logs mkdir training-logs
if not exist config mkdir config
echo   ✓ Directories ready

REM 5. Verify TypeScript
echo [5/5] Verifying TypeScript compilation...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo   ⚠ TypeScript errors found — review and fix before running
) else (
    echo   ✓ No TypeScript errors
)

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  Setup Complete                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo Commands:
echo   npm run dev            Start development server
echo   npm run build          Build for production
echo   npm run start          Start production server
echo   npm run analyze:local  Analyze repos locally (CLI)
echo   npm run train:compact  Train RL model
echo   npm run evaluate:edges Evaluate edge cases
echo.
echo Edit .env with your API keys before running.
echo.
