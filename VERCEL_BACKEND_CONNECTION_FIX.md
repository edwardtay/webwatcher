# Vercel Frontend → Cloud Run Backend Connection Fix

## Problem
Vercel frontend can't connect to Cloud Run backend:
- Error: "Failed to fetch (API: https://verisense-agentkit-414780218994.us-central1.run.app)"
- Backend returns 404 or "Service Unavailable"

## Root Causes

### 1. Cloud Run Deployment Status
The backend might still be deploying or failed to deploy:
- Check Cloud Build logs: https://console.cloud.google.com/cloud-build
- Check Cloud Run logs: https://console.cloud.google.com/run

### 2. CORS Configuration
CORS headers might not be sufficient for Vercel:
- Need to allow Vercel domain
- Need proper preflight handling

### 3. Route Registration
Routes might not be registered correctly:
- `/healthz` returns 404
- `/api/chat` returns Service Unavailable

## Solutions

### Fix 1: Enhanced CORS Headers
```typescript
// Already fixed in src/server.ts
res.header("Access-Control-Allow-Origin", "*");
res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
```

### Fix 2: Check Cloud Run Deployment
```bash
# Check deployment status
gcloud run services describe verisense-agentkit \
  --region us-central1 \
  --format 'value(status.conditions)'

# Check logs
gcloud run services logs read verisense-agentkit \
  --region us-central1 \
  --limit 50
```

### Fix 3: Verify Routes Are Working
```bash
# Test health endpoint
curl https://verisense-agentkit-414780218994.us-central1.run.app/healthz

# Test API endpoint
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Fix 4: Frontend API URL Configuration
Verify frontend is using correct API URL:
```javascript
// In frontend/index.html
const API_BASE_URL = 'https://verisense-agentkit-414780218994.us-central1.run.app';
```

## Testing Steps

1. **Wait for Cloud Run deployment** (2-5 minutes after push)
2. **Test backend directly:**
   ```bash
   curl https://verisense-agentkit-414780218994.us-central1.run.app/healthz
   ```
3. **Test from browser console:**
   ```javascript
   fetch('https://verisense-agentkit-414780218994.us-central1.run.app/api/chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ message: 'test' })
   }).then(r => r.json()).then(console.log)
   ```
4. **Check CORS preflight:**
   ```bash
   curl -X OPTIONS https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
     -H "Origin: https://webwatcher-agent.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```

## Expected Behavior After Fix

✅ Backend responds with 200 OK
✅ CORS headers present in response
✅ Frontend can make requests successfully
✅ No "Failed to fetch" errors

## Next Steps

1. Wait for Cloud Run deployment to complete
2. Test backend endpoints directly
3. Verify CORS headers in response
4. Test from Vercel frontend
5. Check browser console for detailed errors


