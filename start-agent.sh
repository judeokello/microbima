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

# Start Agent Registration app in background with hot reload
cd "$PROJECT_ROOT/apps/agent-registration"
echo "💡 Hot reload enabled - file changes will trigger automatic refresh"
# Write watch mode indicator to log file
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔥 WATCH MODE ENABLED - Hot reload active (next dev --turbopack)" > "$PROJECT_ROOT/.agent-registration.log"
pnpm dev >> "$PROJECT_ROOT/.agent-registration.log" 2>&1 &
AGENT_PID=$!

echo "⏳ Waiting for Next.js to start (hot reload active)..."
sleep 5

# Ping the app to trigger initial compilation (this makes Next.js bind to the port)
echo "🔄 Triggering initial page compilation..."
for i in {1..30}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ Agent Registration app is running on port 3000"
        echo "🎉 Ready at http://localhost:3000"
        echo ""
        echo "📋 View logs: tail -f $PROJECT_ROOT/.agent-registration.log"
        echo "🛑 Stop: pnpm stop or Ctrl+C"
        echo ""
        echo "Press Ctrl+C to stop the application"
        
        # Keep the script running and wait for the background process
        wait $AGENT_PID
        exit 0
    fi
    sleep 1
done

echo "⚠️  Agent Registration app started but not responding yet"
echo "📋 Check logs: tail -f $PROJECT_ROOT/.agent-registration.log"
echo "🛑 Stop: pnpm stop or Ctrl+C"
echo ""
echo "Press Ctrl+C to stop the application"

# Keep the script running
wait $AGENT_PID
