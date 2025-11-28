# Cloud Run Environment Variables Setup

## Problem
Vercel frontend shows "Failed to send message" because Cloud Run backend returns 503 errors. This happens when required environment variables are not set in Cloud Run.

## Root Cause
- **Localhost works**: Uses local backend with `.env` file containing real API keys ✅
- **Vercel fails**: Uses Cloud Run backend which doesn't have environment variables set ❌
- When `OPENAI_API_KEY` is missing, the agent can't initialize, causing 503 errors

## Solution: Set Environment Variables in Cloud Run

### Step 1: Get Your API Keys
Make sure you have:
- `OPENAI_API_KEY` - Required for agent to work
- `EXA_API_KEY` - Optional, for search functionality
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` - Optional, for blockchain features

### Step 2: Set Environment Variables in Cloud Run

**Option A: Using gcloud CLI (Recommended)**

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "OPENAI_API_KEY=your_actual_openai_key,EXA_API_KEY=your_actual_exa_key"
```

**Option B: Set Multiple Variables**

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "OPENAI_API_KEY=sk-...,EXA_API_KEY=...,CDP_API_KEY_ID=...,CDP_API_KEY_SECRET=...,CDP_WALLET_SECRET=..."
```

**Option C: Using Cloud Console**

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on `verisense-agentkit` service
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Click "Add Variable"
6. Add each environment variable:
   - Name: `OPENAI_API_KEY`, Value: `your_key`
   - Name: `EXA_API_KEY`, Value: `your_key`
   - (Add others as needed)
7. Click "Deploy"

### Step 3: Verify Environment Variables

```bash
# Check current env vars
gcloud run services describe verisense-agentkit \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### Step 4: Test the Backend

```bash
# Test health endpoint
curl https://verisense-agentkit-414780218994.us-central1.run.app/healthz

# Test chat endpoint (should work now)
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://webwatcher-agent.vercel.app" \
  -d '{"message":"test","threadId":"test"}'
```

### Step 5: Check Logs

```bash
gcloud run services logs read verisense-agentkit \
  --region us-central1 \
  --limit 20
```

Look for:
- ✅ "Agent initialized successfully" - Good!
- ❌ "Required environment variables are not set" - Still missing keys

## Required vs Optional Variables

### Required
- `OPENAI_API_KEY` - **Must be set** for agent to work

### Optional (but recommended)
- `EXA_API_KEY` - For Exa search functionality
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` - For blockchain features
- `URLSCAN_API_KEY` - For URL scanning

## After Setting Variables

1. Cloud Run will automatically restart with new environment variables
2. Wait 1-2 minutes for the new revision to deploy
3. Test the Vercel frontend: https://webwatcher-agent.vercel.app
4. It should now connect successfully to Cloud Run backend

## Troubleshooting

**Still getting 503 errors?**
- Check logs: `gcloud run services logs read verisense-agentkit --region us-central1 --limit 50`
- Verify env vars are set: `gcloud run services describe verisense-agentkit --region us-central1 --format="value(spec.template.spec.containers[0].env)"`
- Make sure API keys are real values, not placeholders like `your_openai_api_key_here`

**Frontend still can't connect?**
- Check CORS: Backend should allow `https://webwatcher-agent.vercel.app`
- Check Cloud Run URL: Should be `https://verisense-agentkit-414780218994.us-central1.run.app`
- Check Vercel build: Make sure `API_URL` is injected correctly

## Security Note

⚠️ **Never commit API keys to git!** Always set them via Cloud Run environment variables or secrets.

For sensitive keys, use Cloud Run Secrets:
```bash
# Create secret
echo -n "your-api-key" | gcloud secrets create openai-api-key --data-file=-

# Use secret in Cloud Run
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-secrets "OPENAI_API_KEY=openai-api-key:latest"
```

