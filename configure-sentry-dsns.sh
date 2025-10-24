#!/bin/bash

# Sentry DSN Configuration Script
# This script sets the correct Sentry DSNs for each app

set -e

echo "🔧 Configuring Sentry DSNs for separate projects..."

# Agent Registration DSN (for agent-registration project)
AGENT_SENTRY_DSN="https://80f29418b76e462ce3af33b42e0e442b@o4509982735466496.ingest.de.sentry.io/4510119855194192"

# API DSN (for maisha-poa-core project) 
API_SENTRY_DSN="https://0279903c5b4ebb8df8c7d51cd92a1b91@o4509982735466496.ingest.de.sentry.io/4509982755455056"

echo "📱 Setting Agent Registration DSNs..."

# Production Agent Registration
echo "Setting secrets for maishapoa-production-agent-registration..."
fly secrets set \
  SENTRY_DSN="$AGENT_SENTRY_DSN" \
  NEXT_PUBLIC_SENTRY_DSN="$AGENT_SENTRY_DSN" \
  --app maishapoa-production-agent-registration

# Staging Agent Registration  
echo "Setting secrets for maishapoa-staging-agent-registration..."
fly secrets set \
  SENTRY_DSN="$AGENT_SENTRY_DSN" \
  NEXT_PUBLIC_SENTRY_DSN="$AGENT_SENTRY_DSN" \
  --app maishapoa-staging-agent-registration

echo "✅ Agent Registration DSNs configured!"
echo ""
echo "📊 API apps already have the correct DSN configured."
echo ""
echo "🎯 Project Configuration Summary:"
echo "   • Agent Registration → agent-registration project"
echo "   • API (Internal/Public) → maisha-poa-core project"
echo ""
echo "🚀 Next steps:"
echo "   1. Resolve Fly billing issue"
echo "   2. Run this script: ./configure-sentry-dsns.sh"
echo "   3. Deploy all apps to apply the new configuration"


