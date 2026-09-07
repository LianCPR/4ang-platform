#!/bin/bash
# 4ang Development Setup Script
# Run this once to set up the development environment

set -e

echo "=== 4ang Development Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Install Node.js >= 22.5.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "WARNING: Node.js version $NODE_VERSION detected. Recommended: >= 22.5.0"
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build client
echo "Building client..."
cd client && pnpm build && cd ..

# Verify server
echo "Verifying server..."
cd server && node --check src/index.js && cd ..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Development commands:"
echo "  pnpm dev          — Start both client and server"
echo "  pnpm build        — Build client"
echo "  pnpm test         — Run tests"
echo "  pnpm lint         — Lint client"
echo ""
echo "Server only:"
echo "  cd server && pnpm dev"
echo ""
echo "Client only:"
echo "  cd client && pnpm dev"
