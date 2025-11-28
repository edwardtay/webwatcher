# Google Cloud Run Deployment Guide

This guide will help you deploy VeriSense AgentKit to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** installed (for local testing)

## Setup Steps

### 1. Install gcloud CLI (if not already installed)

```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download from https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate and Set Project

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Set Environment Variables

You'll need to set environment variables in Cloud Run. You can do this via:

**Option A: Using gcloud CLI (recommended for first deployment)**

```bash
gcloud run deploy verisense-agentkit \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=your_key_here,CDP_API_KEY_ID=your_key,CDP_API_KEY_SECRET=your_secret,CDP_WALLET_SECRET=your_secret" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

**Option B: Using Cloud Console**

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click "Create Service"
3. Fill in service details
4. Go to "Variables & Secrets" tab
5. Add your environment variables

### 4. Deploy to Cloud Run

**Quick Deploy (from source):**

```bash
# Deploy directly from source (Cloud Build will build for you)
gcloud run deploy verisense-agentkit \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

**Deploy using Dockerfile:**

```bash
# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/verisense-agentkit

# Deploy to Cloud Run
gcloud run deploy verisense-agentkit \
  --image gcr.io/YOUR_PROJECT_ID/verisense-agentkit \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

**Deploy using Cloud Build (automated):**

```bash
# Submit build using cloudbuild.yaml
gcloud builds submit --config cloudbuild.yaml
```

### 5. Set Environment Variables After Deployment

If you need to update environment variables:

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "OPENAI_API_KEY=your_key,CDP_API_KEY_ID=your_key"
```

### 6. Get Your Service URL

After deployment, get your service URL:

```bash
gcloud run services describe verisense-agentkit \
  --region us-central1 \
  --format 'value(status.url)'
```

Your app will be available at: `https://verisense-agentkit-XXXXX-uc.a.run.app`

## Environment Variables

Required environment variables:

- `OPENAI_API_KEY` - OpenAI API key (required)
- `CDP_API_KEY_ID` - Coinbase Developer Platform API key ID (for Level 2+)
- `CDP_API_KEY_SECRET` - Coinbase Developer Platform API key secret (for Level 2+)
- `CDP_WALLET_SECRET` - Coinbase Developer Platform wallet secret (for Level 2+)
- `PORT` - Port number (automatically set by Cloud Run, default: 8080)

Optional environment variables:

- `EXA_API_KEY` - Exa AI API key for semantic web search (required for Exa search)
- `EXA_MCP_SERVER_URL` - HTTP URL to Exa MCP server (for Cloud Run, e.g., `https://exa-mcp-server-xxx.run.app/mcp`)
- `EXA_USE_MCP` - Set to "true" to use Exa MCP server via stdio (local development only)
- `SERP_API_KEY` - SerpAPI key for better search results
- `SEARCH_API_KEY` - Brave Search API key
- `NETWORK_ID` - Blockchain network ID (default: base-sepolia)
- `ANALYST_LEVEL` - Analyst level (default: level_1_local)

**Exa MCP Configuration:**
- **For Cloud Run**: Set `EXA_MCP_SERVER_URL` to your Exa MCP server HTTP endpoint
- **For Local**: Set `EXA_USE_MCP=true` and ensure `exa-mcp` is installed
- **Fallback**: If neither is set, uses Exa direct API (requires `EXA_API_KEY`)

## Updating the Deployment

To update your deployment:

```bash
# Re-deploy from source
gcloud run deploy verisense-agentkit \
  --source . \
  --region us-central1
```

## Monitoring

View logs:

```bash
gcloud run services logs read verisense-agentkit \
  --region us-central1 \
  --limit 50
```

## Troubleshooting

1. **Build fails**: Check that all dependencies are in `package.json`
2. **Service won't start**: Check logs for errors
3. **Port issues**: Ensure server listens on `0.0.0.0` and uses `PORT` env var
4. **Memory issues**: Increase memory allocation with `--memory 4Gi`

## Cost Optimization

- Use `--min-instances 0` to scale to zero when not in use
- Set `--max-instances` based on expected traffic
- Use `--cpu 1` for lower costs if performance allows
- Consider using Cloud Run Jobs for batch processing


