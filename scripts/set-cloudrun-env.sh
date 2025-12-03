#!/bin/bash

# Set environment variables for Cloud Run
# Read from .env file and set them in Cloud Run

echo "🔧 Setting environment variables for Cloud Run..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with your API keys first."
    exit 1
fi

# Read environment variables from .env (excluding comments and empty lines)
ENV_VARS=$(grep -v '^#' .env | grep -v '^$' | tr '\n' ',' | sed 's/,$//')

if [ -z "$ENV_VARS" ]; then
    echo "❌ Error: No environment variables found in .env"
    exit 1
fi

echo "Setting environment variables..."
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --project webwatcher-479404 \
  --set-env-vars "$ENV_VARS"

echo ""
echo "✅ Environment variables updated!"
echo ""
echo "To verify, run:"
echo "gcloud run services describe verisense-agentkit --region us-central1 --project webwatcher-479404 --format='value(spec.template.spec.containers[0].env)'"
