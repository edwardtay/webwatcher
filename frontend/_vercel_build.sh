#!/bin/bash
# Vercel build script to inject API_URL environment variable
# This script runs during Vercel build and injects the API_URL into index.html

API_URL=${API_URL:-"https://verisense-agentkit-414780218994.us-central1.run.app"}

# Inject API_URL into index.html as a script variable
sed -i "s|window.__API_URL__ |||window.__API_URL__ = '${API_URL}';|g" index.html || true

echo "✓ API_URL injected: ${API_URL}"

