#!/bin/bash

# Deploy WebWatcher to Cloud Run using Docker
# This script builds the Docker image and deploys it

set -e

PROJECT_ID="webwatcher-479404"
SERVICE_NAME="webwatcher"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "🚀 Deploying WebWatcher to Cloud Run..."
echo "📍 Service: $SERVICE_NAME"
echo "🌍 Region: $REGION"
echo "📦 Project: $PROJECT_ID"
echo "🐳 Image: $IMAGE_NAME"
echo ""

# Navigate to backend directory
cd apps/backend

echo "🔨 Building Docker image..."
docker build -t $IMAGE_NAME .

echo ""
echo "📤 Pushing image to Google Container Registry..."
docker push $IMAGE_NAME

echo ""
echo "🚀 Deploying to Cloud Run..."

# Check if .env file exists
if [ -f apps/backend/.env ]; then
  echo "📝 Loading environment variables from apps/backend/.env..."
  # Read .env and convert to comma-separated format
  ENV_VARS=$(grep -v '^#' apps/backend/.env | grep -v '^$' | tr '\n' ',' | sed 's/,$//')
  
  gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --region $REGION \
    --project $PROJECT_ID \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars "NODE_ENV=production,$ENV_VARS"
else
  echo "⚠️  No .env file found, deploying without API keys..."
  gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --region $REGION \
    --project $PROJECT_ID \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars NODE_ENV=production
fi

echo ""
echo "✅ Deployment complete!"
echo "🔗 Service URL: https://$SERVICE_NAME-$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(status.url)' | cut -d'/' -f3)"
