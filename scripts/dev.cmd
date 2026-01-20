@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Starting DynamicFront Development
echo ============================================
echo.

REM Check if Docker is running
echo [1/5] Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running or accessible.
    echo Please start Docker Desktop manually and try again.
    exit /b 1
)
echo OK: Docker is running.
echo.

REM Check for .env files
if not exist "server\.env" (
    echo ERROR: Missing server/.env file. Please create it.
    exit /b 1
)

if not exist "client\.env" (
    echo WARNING: Missing client/.env file. Client might misbehave.
)

REM Start Database
echo [2/5] Starting Database container...
docker compose up -d
if errorlevel 1 (
    echo ERROR: Failed to start database container.
    exit /b 1
)
echo OK: Database container started.
echo.

REM Run Database Setup
echo [3/5] Running Database setup...
echo   - Generating Prisma Client...
call npm run generate
if errorlevel 1 (
    echo ERROR: Prisma Generate failed.
    exit /b 1
)

echo   - Running migrations...
call npm run migrate
if errorlevel 1 (
    echo ERROR: Prisma Migrate failed.
    exit /b 1
)

echo   - Seeding database...
call npm run db:seed
if errorlevel 1 (
    echo WARNING: Database seeding failed or nothing to seed.
)
echo OK: Database setup complete.
echo.

REM Start Application
echo [4/5] Starting Client and Server...
echo ============================================
npx concurrently "npm run api --workspace=server" "npm run dev --workspace=client" --names "SERVER,CLIENT" --prefix-colors "blue,magenta"
