# 4ang Development Setup Script (PowerShell)
# Run this once to set up the development environment

$ErrorActionPreference = "Stop"

Write-Host "=== 4ang Development Setup ===" -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Install Node.js >= 22.5.0" -ForegroundColor Red
    exit 1
}

$nodeVersion = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 22) {
    Write-Host "WARNING: Node.js version $nodeVersion detected. Recommended: >= 22.5.0" -ForegroundColor Yellow
}

# Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install

# Build client
Write-Host "Building client..." -ForegroundColor Cyan
Push-Location client
pnpm build
Pop-Location

# Verify server
Write-Host "Verifying server..." -ForegroundColor Cyan
Push-Location server
node --check src/index.js
Pop-Location

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Development commands:" -ForegroundColor Yellow
Write-Host "  pnpm dev          — Start both client and server"
Write-Host "  pnpm build        — Build client"
Write-Host "  pnpm test         — Run tests"
Write-Host "  pnpm lint         — Lint client"
