# Cloud Run Backend Diagnosis

## Problem
Cloud Run backend is returning:
- `/healthz` → 404 (Not Found)
- `/api/chat` → HTML error page (not JSON)
- `/` → ✅ Works (returns API info JSON)

## Root Cause Analysis

### 1. Route Registration Order Issue
The routes are defined, but middleware order might be causing issues:
- Static file serving is added BEFORE CORS middleware
- This might interfere with route matching

### 2. Cloud Run Deployment Check
The Dockerfile uses:
```dockerfile
CMD ["npm", "run", "start:prod"]
```

Which runs:
```json
"start:prod": "NODE_OPTIONS='--no-warnings' node dist/server.js"
```

### 3. Server Export
The server exports `app` as default, which should work for Cloud Run.

## Immediate Fix Needed

1. **Check route registration order** - Ensure routes are registered before static middleware
2. **Verify build output** - Ensure `dist/server.js` has all routes
3. **Test locally with PORT=8080** - Simulate Cloud Run environment

## Quick Test Commands

```bash
# Build locally
npm run build

# Test with Cloud Run port
PORT=8080 node dist/server.js

# In another terminal
curl http://localhost:8080/healthz
curl -X POST http://localhost:8080/api/chat -H "Content-Type: application/json" -d '{"message":"test"}'
```

## Next Steps
1. Fix middleware order in server.ts
2. Rebuild and test locally
3. Redeploy to Cloud Run
4. Verify endpoints work



