# PowerShell script for starting DynamicFront Development Environment

# ========================================
# UTF-8 Configuration
# ========================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$env:LANG = "en_US.UTF-8"

Write-Host "✓ UTF-8 encoding configured" -ForegroundColor Green
Write-Host ""

# ========================================
# Colors for output
# ========================================
function Write-Color {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "🚀 Starting DynamicFront Development Environment..." "Blue"

# Check if Docker is running
Write-Color "🔍 Checking Docker status..." "Yellow"
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
} catch {
    Write-Color "❌ Docker is not running or accessible." "Red"
    Write-Color "🔄 Please start Docker Desktop manually and try again." "Yellow"
    exit 1
}
Write-Color "✅ Docker is running." "Green"

# Check for .env files
if (-not (Test-Path "server\.env")) {
    Write-Color "❌ Missing server/.env file. Please create it." "Red"
    exit 1
}

if (-not (Test-Path "client\.env")) {
    Write-Color "⚠️  Missing client/.env file. Proceeding, but client might misbehave." "Yellow"
}

# Start Database
Write-Color "🐘 Starting Database container..." "Yellow"
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Color "❌ Failed to start database container." "Red"
    exit 1
}
Write-Color "✅ Database container started." "Green"

# Run Database Setup
Write-Color "🔄 Running Database setup (Generate, Migrate, Seed)..." "Yellow"

Write-Color "  Running: npm run generate" "Blue"
npm run generate
if ($LASTEXITCODE -ne 0) {
    Write-Color "❌ Prisma Generate failed." "Red"
    exit 1
}

Write-Color "  Running: npm run migrate" "Blue"
npm run migrate
if ($LASTEXITCODE -ne 0) {
    Write-Color "❌ Prisma Migrate failed." "Red"
    exit 1
}

Write-Color "  Running: npm run db:seed" "Blue"
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Color "⚠️  Database seeding failed or nothing to seed. Continuing..." "Yellow"
    # Not fatal often
}
Write-Color "✅ Database setup complete." "Green"

# Start Application
Write-Color "🚀 Starting Client and Server..." "Blue"
npx concurrently '"npm run api --workspace=server"' '"npm run dev --workspace=client"' --names "SERVER,CLIENT" --prefix-colors "blue,magenta"
