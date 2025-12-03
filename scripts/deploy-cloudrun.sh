#!/bin/bash

# Deploy WebWatcher to Cloud Run
# This script deploys from the root directory (where the code actually is)

echo "🚀 Deploying WebWatcher to Cloud Run..."
echo "📍 Service: verisense-agentkit"
echo "🌍 Region: us-central1"
echo "📦 Project: webwatcher-479404"
echo ""

# Deploy from current directory (root)
gcloud run deploy verisense-agentkit \
  --source . \
  --region us-central1 \
  --project webwatcher-479404 \
  --allow-unauthenticated \
  --platform managed \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0

echo ""
echo "✅ Deployment complete!"
echo "🔗 URL: https://verisense-agentkit-414780218994.us-central1.run.app"
