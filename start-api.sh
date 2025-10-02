#!/bin/bash

# Start only the API server (port 3001)

echo "🔧 Starting API server on port 3001..."

# Check if port is already in use
if lsof -i:3001 >/dev/null 2>&1; then
    echo "⚠️  Port 3001 is already in use!"
    echo "🔍 Checking what's using the port..."
    lsof -i:3001
    echo ""
    echo "🛑 Please stop the existing process or use 'pnpm stop' to stop all development processes"
    exit 1
fi

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Start API server
cd "$PROJECT_ROOT/apps/api"
pnpm start:dev
