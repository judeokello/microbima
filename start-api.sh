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

# Start API server in background with watch mode
cd "$PROJECT_ROOT/apps/api"
echo "💡 Watch mode enabled - file changes will trigger automatic reload"
PORT=3001 pnpm start:dev > "$PROJECT_ROOT/.api.log" 2>&1 &
API_PID=$!

echo "⏳ Waiting for API to start (watch mode active)..."
sleep 8

# Check if API is ready
echo "🔄 Checking API health..."
for i in {1..20}; do
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        echo "✅ API server is running on port 3001"
        echo "🎉 Ready at http://localhost:3001"
        echo ""
        echo "📚 Internal API docs: http://localhost:3001/api/internal/docs"
        echo "📚 Public API docs: http://localhost:3001/api/v1/docs"
        echo "📋 View logs: tail -f $PROJECT_ROOT/.api.log"
        echo "🛑 Stop: pnpm stop or Ctrl+C"
        echo ""
        echo "Press Ctrl+C to stop the application"
        
        # Keep the script running and wait for the background process
        wait $API_PID
        exit 0
    fi
    sleep 1
done

echo "⚠️  API server started but not responding to health checks"
echo "📋 Check logs: tail -f $PROJECT_ROOT/.api.log"
echo "🛑 Stop: pnpm stop or Ctrl+C"
echo ""
echo "Press Ctrl+C to stop the application"

# Keep the script running
wait $API_PID
