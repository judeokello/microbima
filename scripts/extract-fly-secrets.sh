#!/bin/bash

# Extract Fly.io Secrets Script
# This script extracts all secrets from Fly.io apps using printenv inside the container
# This ensures we get the literal values, not just the secret names

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to extract secrets from a Fly.io app
extract_secrets() {
    local APP_NAME=$1
    local OUTPUT_DIR=$2
    
    print_info "Extracting secrets from: $APP_NAME"
    
    # Create output directory if it doesn't exist
    mkdir -p "$OUTPUT_DIR"
    
    # Output file for this app
    local OUTPUT_FILE="$OUTPUT_DIR/${APP_NAME}-secrets.txt"
    
    # First, get list of secret names from flyctl
    print_info "Getting secret names from Fly.io..."
    local SECRET_NAMES=$(flyctl secrets list -a "$APP_NAME" 2>/dev/null | grep -v "NAME" | awk '{print $1}' | grep -v "^$" || true)
    
    if [ -z "$SECRET_NAMES" ]; then
        print_warning "No secrets found for $APP_NAME (or app doesn't exist)"
        echo "# No secrets found for $APP_NAME" > "$OUTPUT_FILE"
        return
    fi
    
    # Start output file with header
    {
        echo "# Secrets extracted from: $APP_NAME"
        echo "# Extracted on: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        echo "#"
        echo "# IMPORTANT: These are the actual secret values from the running container"
        echo "# Use these values when setting secrets on the new app"
        echo "#"
        echo ""
    } > "$OUTPUT_FILE"
    
    # Try to SSH into the container and get all environment variables
    print_info "Attempting to extract secrets from running container..."
    
    # Get all environment variables from the container
    local ENV_VARS=$(flyctl ssh console -a "$APP_NAME" -C "printenv" 2>/dev/null || echo "")
    
    if [ -z "$ENV_VARS" ]; then
        print_warning "Could not SSH into container. Trying alternative method..."
        
        # Alternative: Try to get secrets one by one using flyctl secrets show
        # Note: flyctl secrets show doesn't show values, so we'll document the names
        {
            echo "# WARNING: Could not extract actual values from container"
            echo "# Secret names found:"
            echo ""
            echo "$SECRET_NAMES" | while read -r secret_name; do
                echo "# $secret_name"
            done
            echo ""
            echo "# To get actual values, you'll need to:"
            echo "# 1. SSH into the container: flyctl ssh console -a $APP_NAME"
            echo "# 2. Run: printenv $secret_name"
        } >> "$OUTPUT_FILE"
        
        print_warning "Secret names saved to $OUTPUT_FILE (values need manual extraction)"
        return
    fi
    
    # Parse environment variables and extract secrets
    print_info "Parsing environment variables..."
    
    # Extract each secret value
    echo "$SECRET_NAMES" | while read -r secret_name; do
        if [ -z "$secret_name" ]; then
            continue
        fi
        
        print_info "Extracting: $secret_name"
        
        # Get the value from the environment variables
        local SECRET_VALUE=$(echo "$ENV_VARS" | grep "^${secret_name}=" | cut -d'=' -f2- | sed 's/^"//;s/"$//')
        
        if [ -z "$SECRET_VALUE" ]; then
            print_warning "Could not find value for $secret_name"
            {
                echo "# $secret_name"
                echo "# WARNING: Value not found in container environment"
                echo ""
            } >> "$OUTPUT_FILE"
        else
            # Save the secret (masked in output for security)
            local MASKED_VALUE=$(echo "$SECRET_VALUE" | sed 's/\(.\{10\}\).*/\1.../')
            print_success "Extracted $secret_name (value: ${MASKED_VALUE})"
            
            {
                echo "# $secret_name"
                echo "$secret_name=\"$SECRET_VALUE\""
                echo ""
            } >> "$OUTPUT_FILE"
        fi
    done
    
    # Also save a flyctl command format for easy copying
    {
        echo ""
        echo "# ========================================"
        echo "# Flyctl command format (for easy copy-paste)"
        echo "# ========================================"
        echo ""
        echo "flyctl secrets set \\"
    } >> "$OUTPUT_FILE"
    
    # Build the flyctl command
    local FIRST=true
    echo "$SECRET_NAMES" | while read -r secret_name; do
        if [ -z "$secret_name" ]; then
            continue
        fi
        
        local SECRET_VALUE=$(echo "$ENV_VARS" | grep "^${secret_name}=" | cut -d'=' -f2- | sed 's/^"//;s/"$//')
        
        if [ -n "$SECRET_VALUE" ]; then
            if [ "$FIRST" = true ]; then
                echo "  $secret_name=\"$SECRET_VALUE\" \\" >> "$OUTPUT_FILE"
                FIRST=false
            else
                echo "  $secret_name=\"$SECRET_VALUE\" \\" >> "$OUTPUT_FILE"
            fi
        fi
    done
    
    # Remove trailing backslash
    sed -i '$ s/ \\$//' "$OUTPUT_FILE"
    echo "  -a <NEW_APP_NAME>" >> "$OUTPUT_FILE"
    
    print_success "Secrets extracted to: $OUTPUT_FILE"
}

# Main execution
main() {
    print_info "Fly.io Secrets Extraction Script"
    print_info "================================="
    echo ""
    
    # Define staging apps
    STAGING_APPS=(
        "maishapoa-staging-internal-api"
        "maishapoa-staging-agent-registration"        
    )
    
    # Output directory
    OUTPUT_DIR="fly-secrets-backup/$(date +%Y%m%d-%H%M%S)"
    
    print_info "Output directory: $OUTPUT_DIR"
    echo ""
    
    # Extract secrets from each app
    for app in "${STAGING_APPS[@]}"; do
        extract_secrets "$app" "$OUTPUT_DIR"
        echo ""
    done
    
    print_success "All secrets extraction completed!"
    print_info "Review the files in: $OUTPUT_DIR"
    print_warning "Keep these files secure - they contain sensitive information!"
}

# Run main function
main "$@"

