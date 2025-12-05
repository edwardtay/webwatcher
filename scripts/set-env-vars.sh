#!/bin/bash

# Script to set environment variables for Google Cloud Run service
# Usage: ./set-env-vars.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
SERVICE_NAME=${SERVICE_NAME:-webwatcher}
REGION=${REGION:-us-central1}

echo -e "${GREEN}🔧 Setting environment variables for ${SERVICE_NAME}${NC}\n"

# Update Cloud Run service with all integration API keys
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --update-env-vars \
    "MORALIS_API_KEY=${MORALIS_API_KEY:-your_moralis_key},"\
    "BLOCKSCOUT_API_KEY=${BLOCKSCOUT_API_KEY:-your_blockscout_key},"\
    "ALCHEMY_API_KEY=${ALCHEMY_API_KEY:-your_alchemy_key},"\
    "THIRDWEB_SECRET_KEY=${THIRDWEB_SECRET_KEY:-your_thirdweb_key},"\
    "NANSEN_API_KEY=${NANSEN_API_KEY:-your_nansen_key},"\
    "METASLEUTH_LABEL_API_KEY=${METASLEUTH_LABEL_API_KEY:-your_metasleuth_label_key},"\
    "METASLEUTH_RISK_API_KEY=${METASLEUTH_RISK_API_KEY:-your_metasleuth_risk_key},"\
    "PASSPORT_API_KEY=${PASSPORT_API_KEY:-your_passport_key},"\
    "OPENAI_API_KEY=${OPENAI_API_KEY:-your_openai_key},"\
    "CDP_API_KEY_ID=${CDP_API_KEY_ID:-your_cdp_key_id},"\
    "CDP_API_KEY_SECRET=${CDP_API_KEY_SECRET:-your_cdp_secret},"\
    "CDP_WALLET_SECRET=${CDP_WALLET_SECRET:-your_wallet_secret},"\
    "EXA_API_KEY=${EXA_API_KEY:-your_exa_key},"\
    "URLSCAN_API_KEY=${URLSCAN_API_KEY:-your_urlscan_key},"\
    "LETTA_API_KEY=${LETTA_API_KEY:-your_letta_key},"\
    "PORT=8080,"\
    "NODE_ENV=production"

echo -e "\n${GREEN}✅ Environment variables updated!${NC}\n"

echo -e "${YELLOW}💡 To set variables individually, use:${NC}"
echo "   gcloud run services update ${SERVICE_NAME} \\"
echo "     --region ${REGION} \\"
echo "     --update-env-vars 'MORALIS_API_KEY=your_key'"

echo -e "\n${YELLOW}💡 Or set them from your shell environment:${NC}"
echo "   export MORALIS_API_KEY=your_key"
echo "   export BLOCKSCOUT_API_KEY=your_key"
echo "   # ... then run this script"

