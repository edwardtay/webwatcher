# Set Environment Variables in Cloud Run

## Problem
You're getting "Agent not initialized" errors because Cloud Run doesn't have `OPENAI_API_KEY` set.

**Important:** Vercel is just the frontend. The backend API runs on Cloud Run and needs the environment variables there.

## Solution: Set OPENAI_API_KEY in Cloud Run

### Step 1: Get Your OpenAI API Key
- Go to https://platform.openai.com/api-keys
- Copy your API key (starts with `sk-`)

### Step 2: Set It in Cloud Run

Run this command (replace `your_actual_openai_key` with your real key):

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars 'OPENAI_API_KEY=sk-your-actual-key-here'
```

### Step 3: Verify It's Set

```bash
gcloud run services describe verisense-agentkit \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

You should see `OPENAI_API_KEY=sk-...` in the output.

### Step 4: Test the Backend

```bash
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://webwatcher-agent.vercel.app" \
  -d '{"message":"test","threadId":"test"}'
```

Should return a response instead of "Agent not initialized" error.

## Optional: Set Other Environment Variables

You can also set other optional variables:

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars 'OPENAI_API_KEY=sk-...,EXA_API_KEY=...,LETTA_API_KEY=...'
```

## Architecture Reminder

```
┌─────────────┐         HTTP          ┌──────────────┐
│   Vercel    │ ────────────────────> │  Cloud Run   │
│  (Frontend) │                        │  (Backend)   │
│             │                        │              │
│ - index.html│                        │ - Agent API  │
│ - No env    │                        │ - Needs keys │
└─────────────┘                        └──────────────┘
```

- **Vercel**: Frontend only, no environment variables needed for backend
- **Cloud Run**: Backend API, needs `OPENAI_API_KEY` and other keys

## After Setting Variables

1. Cloud Run will automatically restart (takes 1-2 minutes)
2. Check logs: `gcloud run services logs read verisense-agentkit --region us-central1 --limit 20`
3. Look for: "✓ Agent pre-initialized successfully" or "Agent initialized successfully"
4. Test Vercel frontend: https://webwatcher-agent.vercel.app

## Troubleshooting

**Still getting errors?**
- Wait 1-2 minutes for Cloud Run to restart
- Check logs for errors
- Verify key is correct (starts with `sk-`)
- Make sure you're updating the correct service: `verisense-agentkit` in `us-central1`

