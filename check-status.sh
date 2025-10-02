#!/bin/bash

# MicroBima Development Status Check Script
# Shows the status of all development processes

echo "🔍 MicroBima Development Environment Status"
echo "=========================================="
echo ""

# Function to check if a port is in use and get process info
check_port_status() {
    local port=$1
    local service_name=$2
    
    if lsof -i:$port >/dev/null 2>&1; then
        echo "✅ $service_name (Port $port): RUNNING"
        echo "   Process: $(lsof -i:$port | tail -n +2 | awk '{print $1, $2}' | head -1)"
        echo "   URL: http://localhost:$port"
        
        # Test if the service is responding
        if [ "$service_name" = "API Server" ]; then
            if curl -s -f http://localhost:$port/api/health >/dev/null 2>&1; then
                echo "   Health: ✅ Healthy"
            else
                echo "   Health: ⚠️  Not responding to health checks"
            fi
        elif [ "$service_name" = "Agent Registration" ]; then
            if curl -s -f http://localhost:$port >/dev/null 2>&1; then
                echo "   Health: ✅ Responding"
            else
                echo "   Health: ⚠️  Not responding"
            fi
        fi
    else
        echo "❌ $service_name (Port $port): NOT RUNNING"
    fi
    echo ""
}

# Check API server status
check_port_status 3001 "API Server"

# Check Agent Registration status  
check_port_status 3000 "Agent Registration"

# Summary
echo "📊 Summary:"
API_RUNNING=$(lsof -i:3001 >/dev/null 2>&1 && echo "true" || echo "false")
AGENT_RUNNING=$(lsof -i:3000 >/dev/null 2>&1 && echo "true" || echo "false")

if [ "$API_RUNNING" = "true" ] && [ "$AGENT_RUNNING" = "true" ]; then
    echo "🎉 Both applications are running!"
    echo "🚀 Ready for development"
elif [ "$API_RUNNING" = "true" ] || [ "$AGENT_RUNNING" = "true" ]; then
    echo "⚠️  One application is running"
    echo "💡 Use 'pnpm dev:all' to start both applications"
else
    echo "🛑 No applications are running"
    echo "💡 Use 'pnpm dev:all' to start the development environment"
fi

echo ""
echo "📚 Available commands:"
echo "   pnpm dev:all    - Start both applications"
echo "   pnpm dev:api    - Start API only"
echo "   pnpm dev:agent  - Start Agent Registration only"
echo "   pnpm stop       - Stop all applications"
echo "   pnpm status     - Check status (this command)"
