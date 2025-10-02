#!/bin/bash

# MicroBima Development Stop Script
# Stops all running development processes

echo "🛑 Stopping MicroBima Development Environment..."

# Kill all processes on ports 3000 and 3001
echo "🔧 Stopping API server (port 3001)..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No process found on port 3001"

echo "🌐 Stopping Agent Registration app (port 3000)..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process found on port 3000"

# Kill any remaining pnpm/nest/node processes
echo "🧹 Cleaning up remaining processes..."
pkill -f "nest start" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "pnpm.*dev" 2>/dev/null || true

echo "✅ Development environment stopped!"
