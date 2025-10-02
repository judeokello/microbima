#!/bin/bash

# Start only the Agent Registration app (port 3000)

echo "🌐 Starting Agent Registration app on port 3000..."

# Check if port is already in use
if lsof -i:3000 >/dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use!"
    echo "🔍 Checking what's using the port..."
    lsof -i:3000
    echo ""
    echo "🛑 Please stop the existing process or use 'pnpm stop' to stop all development processes"
    exit 1
fi

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Start Agent Registration app
cd "$PROJECT_ROOT/apps/agent-registration"
pnpm dev
