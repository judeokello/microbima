#!/bin/bash

# MicroBima Hot Reload Diagnostic Script
# Verifies that hot reload/watch mode is properly configured and working

set -e

echo "🔍 Hot Reload Diagnostic Check"
echo "================================"
echo ""

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ERRORS=0
WARNINGS=0

# Function to check if a process is running
check_process() {
    local port=$1
    local name=$2
    
    if lsof -i:$port >/dev/null 2>&1; then
        echo "✅ $name is running on port $port"
        return 0
    else
        echo "❌ $name is NOT running on port $port"
        return 1
    fi
}

# Function to check if watch mode is active
check_watch_mode() {
    local port=$1
    local name=$2
    local log_file=$3
    
    if [ ! -f "$log_file" ]; then
        echo "⚠️  Log file not found: $log_file"
        return 1
    fi
    
    # Check for watch mode indicators in logs
    # For NestJS: look for "watch mode", "watching", "file change"
    # For Next.js: look for "next dev", "Turbopack", "Ready", or our custom watch mode message
    if [ "$name" = "API Server" ]; then
        if grep -qiE "watch mode|watching for file|file change" "$log_file" 2>/dev/null; then
            echo "✅ $name appears to be in watch mode"
            return 0
        else
            echo "⚠️  $name watch mode status unclear (check logs manually)"
            return 1
        fi
    elif [ "$name" = "Agent Registration" ]; then
        # Next.js watch mode indicators
        if grep -qiE "next dev|turbopack|ready in|watch mode enabled|hot reload enabled" "$log_file" 2>/dev/null; then
            echo "✅ $name appears to be in watch mode (hot reload enabled)"
            return 0
        else
            echo "⚠️  $name watch mode status unclear (check logs manually)"
            return 1
        fi
    else
        # Generic check
        if grep -qiE "watch|watching|file change|hot reload" "$log_file" 2>/dev/null; then
            echo "✅ $name appears to be in watch mode"
            return 0
        else
            echo "⚠️  $name watch mode status unclear (check logs manually)"
            return 1
        fi
    fi
}

# Check 1: File watcher limits
echo "1️⃣  Checking file watcher limits..."
if [ -f /proc/sys/fs/inotify/max_user_watches ]; then
    LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
    if [ "$LIMIT" -lt 524288 ]; then
        echo "⚠️  inotify limit is low: $LIMIT (recommended: 524288+)"
        echo "   Run: ./scripts/check-file-watcher-limits.sh for details"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "✅ File watcher limit is sufficient: $LIMIT"
    fi
else
    echo "ℹ️  Skipping file watcher check (not Linux or limits not accessible)"
fi
echo ""

# Check 2: Next.js configuration
echo "2️⃣  Checking Next.js configuration..."
NEXT_CONFIG="$PROJECT_ROOT/apps/agent-registration/next.config.mjs"
if [ -f "$NEXT_CONFIG" ]; then
    # Check if standalone is conditional
    if grep -q "NODE_ENV.*production.*standalone\|standalone.*NODE_ENV.*production" "$NEXT_CONFIG"; then
        echo "✅ Next.js standalone output is conditional (production only)"
    elif grep -q "output.*standalone" "$NEXT_CONFIG" && ! grep -q "process.env.NODE_ENV" "$NEXT_CONFIG"; then
        echo "❌ Next.js has standalone output enabled unconditionally"
        echo "   This will prevent hot reload in development!"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ Next.js configuration looks correct"
    fi
else
    echo "⚠️  Next.js config file not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 3: NestJS configuration
echo "3️⃣  Checking NestJS configuration..."
NEST_CONFIG="$PROJECT_ROOT/apps/api/nest-cli.json"
if [ -f "$NEST_CONFIG" ]; then
    if grep -q '"webpack":\s*false' "$NEST_CONFIG"; then
        echo "✅ NestJS is using TypeScript compiler (faster for watch mode)"
    else
        echo "⚠️  NestJS may be using webpack (slower for watch mode)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  NestJS config file not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 4: Running processes
echo "4️⃣  Checking running processes..."
API_RUNNING=false
AGENT_RUNNING=false

if check_process 3001 "API Server"; then
    API_RUNNING=true
else
    ERRORS=$((ERRORS + 1))
fi

if check_process 3000 "Agent Registration"; then
    AGENT_RUNNING=true
else
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 5: Watch mode indicators
echo "5️⃣  Checking watch mode indicators..."
if [ "$API_RUNNING" = true ]; then
    API_LOG="$PROJECT_ROOT/.api.log"
    if check_watch_mode 3001 "API Server" "$API_LOG"; then
        echo "   💡 Check logs: tail -f $API_LOG"
    else
        WARNINGS=$((WARNINGS + 1))
    fi
fi

if [ "$AGENT_RUNNING" = true ]; then
    AGENT_LOG="$PROJECT_ROOT/.agent-registration.log"
    if check_watch_mode 3000 "Agent Registration" "$AGENT_LOG"; then
        echo "   💡 Check logs: tail -f $AGENT_LOG"
    else
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# Check 6: Package.json scripts
echo "6️⃣  Checking package.json scripts..."
API_PKG="$PROJECT_ROOT/apps/api/package.json"
AGENT_PKG="$PROJECT_ROOT/apps/agent-registration/package.json"

if [ -f "$API_PKG" ]; then
    if grep -q '"start:dev".*--watch' "$API_PKG"; then
        echo "✅ API start:dev includes --watch flag"
    else
        echo "⚠️  API start:dev may not have --watch flag"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

if [ -f "$AGENT_PKG" ]; then
    if grep -q '"dev".*next dev' "$AGENT_PKG"; then
        echo "✅ Agent Registration uses 'next dev' (hot reload enabled)"
    else
        echo "⚠️  Agent Registration dev script may not use 'next dev'"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# Summary
echo "================================"
echo "📊 Summary"
echo "================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! Hot reload should be working."
    echo ""
    echo "💡 To test hot reload:"
    echo "   1. Make a small change to a file"
    echo "   2. Watch the logs for reload messages"
    echo "   3. Changes should appear within seconds"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Found $WARNINGS warning(s) - hot reload may work but check above"
    exit 0
else
    echo "❌ Found $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    echo "💡 Fix the errors above, then restart your development environment:"
    echo "   pnpm stop"
    echo "   pnpm dev:all"
    exit 1
fi

