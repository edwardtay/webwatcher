#!/bin/bash

# Google Cloud Run Deployment Script
# This script deploys VeriSense AgentKit to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying VeriSense AgentKit to Google Cloud Run${NC}\n"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  No project ID set. Please set it with:${NC}"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✓ Project ID: ${PROJECT_ID}${NC}"

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  Not authenticated. Running gcloud auth login...${NC}"
    gcloud auth login
fi

# Enable required APIs
echo -e "\n${GREEN}📦 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com --quiet || true
gcloud services enable run.googleapis.com --quiet || true
gcloud services enable containerregistry.googleapis.com --quiet || true

# Get region (default to us-central1)
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-verisense-agentkit}

echo -e "\n${GREEN}🏗️  Building and deploying to Cloud Run...${NC}"
echo -e "${YELLOW}Service: ${SERVICE_NAME}${NC}"
echo -e "${YELLOW}Region: ${REGION}${NC}\n"

# Deploy to Cloud Run
gcloud run deploy ${SERVICE_NAME} \
  --source . \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "PORT=8080" \
  || {
    echo -e "\n${RED}❌ Deployment failed!${NC}"
    echo -e "${YELLOW}💡 Make sure you have:${NC}"
    echo "   1. Set your project: gcloud config set project YOUR_PROJECT_ID"
    echo "   2. Enabled billing for your project"
    echo "   3. Set environment variables (see DEPLOY.md)"
    exit 1
  }

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format 'value(status.url)')

echo -e "\n${GREEN}✅ Deployment successful!${NC}\n"
echo -e "${GREEN}🌐 Your app is available at:${NC}"
echo -e "${GREEN}   ${SERVICE_URL}${NC}\n"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Set environment variables:"
echo "      gcloud run services update ${SERVICE_NAME} \\"
echo "        --region ${REGION} \\"
echo "        --update-env-vars 'OPENAI_API_KEY=your_key,CDP_API_KEY_ID=your_key'"
echo ""
echo "   2. View logs:"
echo "      gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo ""
echo "   3. See DEPLOY.md for more details"






