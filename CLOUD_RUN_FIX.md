# Cloud Run Backend Fix

## Issue
The `/api/chat` endpoint is returning "Cannot POST /api/chat" error on Cloud Run, even though the route exists in the code.

## Diagnosis
- `/check` endpoint works ✅
- `/api/chat` endpoint returns HTML error ❌
- This suggests the app might not be starting correctly or routes aren't registered

## Solution

### 1. Check Cloud Run Logs
```bash
gcloud run services logs read verisense-agentkit \
  --region us-central1 \
  --limit 50
```

Look for:
- App startup messages
- Route registration logs
- Any errors during initialization

### 2. Verify Environment Variables
```bash
gcloud run services describe verisense-agentkit \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Ensure:
- `PORT=8080` is set
- All required API keys are set
- `NODE_ENV` is set if needed

### 3. Redeploy Backend
```bash
# From project root
./deploy.sh

# Or manually
gcloud run deploy verisense-agentkit \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300
```

### 4. Test After Deployment
```bash
# Test health endpoint
curl https://verisense-agentkit-414780218994.us-central1.run.app/healthz

# Test chat endpoint
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","threadId":"test"}'
```

### 5. Common Issues

**Issue: App not starting**
- Check Dockerfile CMD/ENTRYPOINT
- Verify `npm start` or `node dist/server.js` works locally
- Check package.json scripts

**Issue: Routes not registered**
- Ensure Express app is exported correctly
- Check that all routes are registered before app.listen()
- Verify middleware order (CORS before routes)

**Issue: Port mismatch**
- Cloud Run expects PORT env var
- App should listen on `process.env.PORT || 8080`
- Check server.ts line 11

### 6. Quick Local Test
```bash
# Build locally
npm run build

# Test server starts
PORT=8080 node dist/server.js

# In another terminal, test
curl http://localhost:8080/healthz
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

## Expected Behavior
After fix:
- ✅ `GET /healthz` → `"ok"`
- ✅ `POST /api/chat` → JSON response with agent reply
- ✅ `POST /check` → JSON with phishing analysis
- ✅ CORS headers present on all responses

## Next Steps
1. Check Cloud Run logs
2. Redeploy if needed
3. Test endpoints
4. Update Vercel frontend API_URL if backend URL changes



