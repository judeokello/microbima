#!/bin/bash

# MicroBima Development Startup Script
# Starts both API (port 3001) and Agent Registration (port 3000) applications

set -e

echo "🚀 Starting MicroBima Development Environment..."
echo "📡 API will run on: http://localhost:3001"
echo "🌐 Agent Registration will run on: http://localhost:3000"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i:$port >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check if ports are already in use
API_RUNNING=false
AGENT_RUNNING=false

if check_port 3001; then
    echo "⚠️  Port 3001 is already in use (API might be running)"
    API_RUNNING=true
fi

if check_port 3000; then
    echo "⚠️  Port 3000 is already in use (Agent Registration might be running)"
    AGENT_RUNNING=true
fi

if [ "$API_RUNNING" = true ] && [ "$AGENT_RUNNING" = true ]; then
    echo "✅ Both applications appear to be already running!"
    echo "📡 API: http://localhost:3001"
    echo "🌐 Agent Registration: http://localhost:3000"
    echo "🛑 Use 'pnpm stop' to stop all applications first, or check what's using these ports"
    exit 0
fi

echo ""

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development environment..."
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Start API server if not already running
if [ "$API_RUNNING" = false ]; then
    echo "🔧 Starting API server (watch mode enabled)..."
    cd "$PROJECT_ROOT/apps/api"
    # Run in background but keep output visible for watch mode messages
    PORT=3001 pnpm start:dev > "$PROJECT_ROOT/.api.log" 2>&1 &
    API_PID=$!
    echo "   📋 API logs: tail -f $PROJECT_ROOT/.api.log"
    cd "$PROJECT_ROOT"
else
    echo "⏭️  Skipping API startup (already running)"
    API_PID=""
fi

# Wait a moment for API to start
sleep 5

# Start Agent Registration app if not already running
if [ "$AGENT_RUNNING" = false ]; then
    echo "🌐 Starting Agent Registration app (hot reload enabled)..."
    cd "$PROJECT_ROOT/apps/agent-registration"
    # Write watch mode indicator to log file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔥 WATCH MODE ENABLED - Hot reload active (next dev --turbopack)" > "$PROJECT_ROOT/.agent-registration.log"
    # Run in background but keep output visible for hot reload messages
    pnpm dev >> "$PROJECT_ROOT/.agent-registration.log" 2>&1 &
    AGENT_PID=$!
    echo "   📋 Agent logs: tail -f $PROJECT_ROOT/.agent-registration.log"
    cd "$PROJECT_ROOT"
else
    echo "⏭️  Skipping Agent Registration startup (already running)"
    AGENT_PID=""
fi

# Wait for both to start
echo "⏳ Waiting for applications to start..."
sleep 10

# Check if both are running
echo ""
echo "🔍 Checking application status..."

# Check API
if curl -s -f http://localhost:3001/api/health > /dev/null; then
    echo "✅ API server is running on port 3001"
else
    echo "❌ API server failed to start on port 3001"
fi

# Check Agent Registration - Ping to trigger Next.js compilation
echo "🔄 Triggering Next.js initial compilation..."
AGENT_READY=false
for i in {1..30}; do
    if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Agent Registration app is running on port 3000"
        AGENT_READY=true
        break
    fi
    sleep 1
done

if [ "$AGENT_READY" = false ]; then
    echo "⚠️  Agent Registration app started but not responding yet"
    echo "   It may still be compiling. Try accessing http://localhost:3000"
fi

echo ""
echo "🎉 Development environment is ready!"
echo "📡 API: http://localhost:3001"
echo "🌐 Agent Registration: http://localhost:3000"
echo ""
echo "💡 Hot reload is enabled - changes will automatically reload"
echo "📋 View logs:"
echo "   API: tail -f $PROJECT_ROOT/.api.log"
echo "   Agent: tail -f $PROJECT_ROOT/.agent-registration.log"
echo ""
echo "Press Ctrl+C to stop both applications"

# Keep script running and wait for background processes
# This ensures proper signal handling for watch mode
if [ -n "$API_PID" ] && [ -n "$AGENT_PID" ]; then
    wait $API_PID $AGENT_PID
elif [ -n "$API_PID" ]; then
    wait $API_PID
elif [ -n "$AGENT_PID" ]; then
    wait $AGENT_PID
fi
