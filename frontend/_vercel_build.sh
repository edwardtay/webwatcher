#!/bin/bash
# Vercel build script to inject API_URL environment variable
# This script runs during Vercel build and injects the API_URL into index.html

API_URL=${API_URL:-"https://webwatcher.lever-labs.com"}

# Debug output
echo "Building frontend..."
echo "API_URL=${API_URL}"

# Inject API_URL into index.html
if [ -n "$API_URL" ]; then
    # Create a temporary file
    TEMP_FILE=$(mktemp)
    
    # Remove any existing window.__API_URL__ assignments first
    # Then inject new one before "const API_BASE_URL"
    awk -v api_url="$API_URL" '
        /window\.__API_URL__ = / { next }  # Skip existing assignments
        /const API_BASE_URL/ && !injected {
            print "        window.__API_URL__ = '\''" api_url "'\'';"
            injected = 1
        }
        { print }
    ' index.html > "$TEMP_FILE" && mv "$TEMP_FILE" index.html
    
    # Verify injection
    if grep -q "window.__API_URL__ = '${API_URL}'" index.html; then
        echo "✓ API_URL successfully injected: ${API_URL}"
    else
        echo "⚠ Warning: API_URL injection may have failed"
        echo "Checking index.html..."
        grep -A2 "API_BASE_URL" index.html | head -5
    fi
    
    # Cleanup
    rm -f "$TEMP_FILE" 2>/dev/null || true
else
    echo "⚠ Warning: API_URL is empty, using default"
fi

echo "Build complete"
