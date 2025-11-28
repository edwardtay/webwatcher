# Vercel Troubleshooting Guide

## "Failed to send message" Error

### Common Causes:

1. **API_URL not set in Vercel**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add `API_URL` with value: `https://verisense-agentkit-414780218994.us-central1.run.app`
   - Redeploy after adding

2. **Build script not running**
   - Check Vercel build logs
   - Look for "✓ API_URL injected" message
   - If missing, check that `_vercel_build.sh` is executable

3. **Wrong API URL**
   - Verify backend API is accessible: `curl https://verisense-agentkit-414780218994.us-central1.run.app/healthz`
   - Check CORS headers on backend

4. **CORS Issues**
   - Backend should have: `Access-Control-Allow-Origin: *`
   - Check browser console for CORS errors

### Debugging Steps:

1. **Check Browser Console**
   - Open DevTools → Console
   - Look for errors when sending message
   - Check what `API_BASE_URL` is set to

2. **Check Vercel Build Logs**
   - Go to Vercel Dashboard → Deployments → Latest
   - Check "Build Logs" tab
   - Look for build script output

3. **Verify API_URL Injection**
   - View page source (Ctrl+U)
   - Search for `window.__API_URL__`
   - Should see: `window.__API_URL__ = 'https://verisense-agentkit-414780218994.us-central1.run.app';`

4. **Test API Endpoint**
   ```bash
   curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"test","threadId":"test"}'
   ```

### Quick Fixes:

1. **Set API_URL in Vercel:**
   - Dashboard → Settings → Environment Variables
   - Add: `API_URL=https://verisense-agentkit-414780218994.us-central1.run.app`
   - Redeploy

2. **Check Build Script:**
   - Ensure `frontend/_vercel_build.sh` is executable
   - Should output: `✓ API_URL injected: ...`

3. **Verify Backend:**
   - Check backend is running: `curl https://verisense-agentkit-414780218994.us-central1.run.app/healthz`
   - Should return: `{"status":"ok"}`

### Expected Behavior:

- Build logs show: `✓ API_URL injected: https://...`
- Browser console shows: `API_BASE_URL: https://...`
- API calls succeed with 200 status
- Messages are sent and received


