#!/bin/bash

# MicroBima File Watcher Limits Check Script
# Checks and reports file system watcher configuration for hot reload

echo "🔍 Checking File Watcher Configuration..."
echo "=========================================="
echo ""

# Check if running on Linux
if [ "$(uname)" != "Linux" ]; then
    echo "ℹ️  This script is designed for Linux systems"
    echo "   File watcher limits are typically handled automatically on macOS/Windows"
    exit 0
fi

# Check inotify max_user_watches
if [ -f /proc/sys/fs/inotify/max_user_watches ]; then
    CURRENT_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
    echo "📊 Current inotify max_user_watches: $CURRENT_LIMIT"
    
    # Recommended minimum for large projects
    RECOMMENDED_MIN=524288
    
    if [ "$CURRENT_LIMIT" -lt "$RECOMMENDED_MIN" ]; then
        echo "⚠️  Limit is below recommended minimum ($RECOMMENDED_MIN)"
        echo ""
        echo "💡 To increase the limit temporarily (until reboot):"
        echo "   sudo sysctl fs.inotify.max_user_watches=$RECOMMENDED_MIN"
        echo ""
        echo "💡 To make it permanent, add to /etc/sysctl.conf:"
        echo "   fs.inotify.max_user_watches=$RECOMMENDED_MIN"
        echo ""
        echo "   Then run: sudo sysctl -p"
    else
        echo "✅ Limit is sufficient for hot reload"
    fi
else
    echo "⚠️  Cannot read inotify limits (may not be Linux)"
fi

echo ""

# Check inotify max_user_instances
if [ -f /proc/sys/fs/inotify/max_user_instances ]; then
    CURRENT_INSTANCES=$(cat /proc/sys/fs/inotify/max_user_instances)
    echo "📊 Current inotify max_user_instances: $CURRENT_INSTANCES"
    
    if [ "$CURRENT_INSTANCES" -lt 512 ]; then
        echo "⚠️  Limit may be too low for multiple watch processes"
        echo "   Recommended: 512 or higher"
    else
        echo "✅ Instance limit is sufficient"
    fi
fi

echo ""
echo "📚 For more information, see:"
echo "   https://github.com/guard/listen/wiki/Increasing-the-amount-of-inotify-watchers"

