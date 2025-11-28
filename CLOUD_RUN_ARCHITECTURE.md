# Cloud Run Architecture: API-Only vs Frontend

## Current Setup Analysis

### ✅ What Cloud Run Should Be: **API-Only (Agentic Endpoints)**

Cloud Run should serve **only agentic API endpoints** for A2A/MCP discovery and coordination:

**Required Endpoints:**
- `GET /.well-known/agent.json` - Agent card for A2A discovery ✅
- `POST /api/chat` - Chat endpoint ✅
- `POST /check` - A2A URL analysis ✅
- `GET /healthz` - Health check ✅

**Should NOT serve:**
- ❌ Frontend HTML (should be on Vercel)
- ❌ Static files (CSS, JS, images)

### Current Issue

Cloud Run is currently serving **both** frontend and API:
- ✅ API endpoints work (routes registered first)
- ⚠️ Frontend also served (static files after routes)
- ⚠️ This works but is not ideal architecture

## Recommended Architecture

### Option 1: API-Only Cloud Run (Recommended)

**Cloud Run (Backend):**
```
https://verisense-agentkit-414780218994.us-central1.run.app
├── GET  /.well-known/agent.json  → Agent card (A2A discovery)
├── POST /api/chat                → Chat endpoint
├── POST /check                   → A2A URL analysis
└── GET  /healthz                 → Health check
```

**Vercel (Frontend):**
```
https://your-frontend.vercel.app
└── Frontend HTML/CSS/JS
    └── Connects to Cloud Run API
```

### Option 2: Hybrid (Current - Works but not ideal)

**Cloud Run serves both:**
- API endpoints (for A2A/MCP)
- Frontend (for convenience)

**Pros:**
- Single deployment
- Works for both agentic and web access

**Cons:**
- Not standard architecture
- Frontend should be on CDN (Vercel)
- Mixes concerns

## Fix: Make Cloud Run API-Only

### Step 1: Remove Frontend Serving from Cloud Run

```typescript
// In src/server.ts, remove or conditionally serve frontend:

// Option A: Remove frontend serving completely
// Delete these lines:
app.use(express.static(path.join(process.cwd(), "frontend")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
});

// Option B: Only serve frontend in development
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(process.cwd(), "frontend")));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
  });
} else {
  // Production: API-only
  app.get("/", (_req, res) => {
    res.json({
      service: "WebWatcher API",
      status: "running",
      endpoints: {
        agentCard: "GET /.well-known/agent.json",
        chat: "POST /api/chat",
        check: "POST /check",
        health: "GET /healthz"
      },
      frontend: "Deployed separately on Vercel"
    });
  });
}
```

### Step 2: Ensure Frontend Points to Cloud Run

Frontend on Vercel should use Cloud Run URL:
```javascript
const API_BASE_URL = 'https://verisense-agentkit-414780218994.us-central1.run.app';
```

## Verification

### Test Agentic Endpoints (Should Work)

```bash
# Agent card (A2A discovery)
curl https://verisense-agentkit-414780218994.us-central1.run.app/.well-known/agent.json

# Should return JSON with:
# - id, name, description
# - protocols: ["A2A", "MCP", "HTTP"]
# - capabilities.a2a
# - capabilities.mcp

# A2A endpoint
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Chat endpoint
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### Test Frontend (Should be on Vercel)

```bash
# Frontend should be on Vercel, not Cloud Run
curl https://your-frontend.vercel.app
```

## Current Status

✅ **API Endpoints Work:**
- Routes are registered BEFORE static files
- API endpoints accessible
- Agent card accessible

⚠️ **Frontend Also Served:**
- Frontend HTML served at `/`
- Static files served
- Works but not ideal architecture

## Recommendation

**For Production:**
1. Make Cloud Run API-only (remove frontend serving)
2. Keep frontend on Vercel
3. Frontend connects to Cloud Run API

**For Development:**
- Can serve both locally for convenience
- Use `NODE_ENV=development` check

## A2A/MCP Compatibility

**Yes, it works!** Even with frontend serving:
- Routes registered first → API endpoints work
- Agent card accessible → A2A discovery works
- MCP tools accessible → MCP works
- Frontend is just additional static files

But **best practice** is to separate:
- Cloud Run = Agentic API only
- Vercel = Frontend UI only



