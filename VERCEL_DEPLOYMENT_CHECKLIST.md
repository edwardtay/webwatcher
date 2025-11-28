# Vercel Deployment Checklist

## ✅ Current Setup Status

### Frontend Configuration
- ✅ `frontend/vercel.json` - Configured with build command and output directory
- ✅ `frontend/_vercel_build.sh` - Build script to inject API_URL
- ✅ `frontend/index.html` - API URL detection logic:
  - **Localhost**: Uses `http://localhost:3000` automatically
  - **Vercel**: Uses `window.__API_URL__` injected by build script
  - **Fallback**: Cloud Run URL if neither applies

### How It Works

1. **Localhost (Development)**:
   ```javascript
   const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
   const API_BASE_URL = isLocalhost 
       ? 'http://localhost:3000'  // ← Uses local backend
       : window.__API_URL__ || 'https://verisense-agentkit-414780218994.us-central1.run.app';
   ```

2. **Vercel (Production)**:
   - Build script (`_vercel_build.sh`) injects `API_URL` environment variable
   - Sets `window.__API_URL__ = 'https://verisense-agentkit-414780218994.us-central1.run.app'`
   - Frontend detects it's not localhost, uses `window.__API_URL__`

## 📋 Pre-Deployment Checklist

### 1. Environment Variables in Vercel Dashboard
Set these in Vercel → Project Settings → Environment Variables:
- `API_URL` = `https://verisense-agentkit-414780218994.us-central1.run.app`
- `OPENAI_API_KEY` (if needed for frontend)
- Any other required env vars

### 2. Vercel Project Configuration
- **Root Directory**: `/frontend` (if deploying only frontend)
- **Build Command**: `bash _vercel_build.sh`
- **Output Directory**: `.`
- **Install Command**: (none needed for static HTML)

### 3. Backend (Cloud Run) Status
- ✅ Backend deployed and running on Cloud Run
- ✅ `/api/chat` endpoint working
- ✅ CORS configured to allow Vercel domain

## 🚀 Deployment Steps

1. **Commit and Push**:
   ```bash
   git add .
   git commit -m "Fix frontend API URL detection for localhost and Vercel"
   git push origin main
   ```

2. **Vercel Auto-Deploy**:
   - Vercel will automatically detect the push
   - Run the build script
   - Inject `API_URL` into `index.html`
   - Deploy the frontend

3. **Verify Deployment**:
   - Check Vercel build logs for: `✓ API_URL successfully injected`
   - Test the deployed frontend
   - Verify it connects to Cloud Run backend

## 🔍 Troubleshooting

### If Frontend Shows "Failed to fetch":
1. Check Vercel build logs - verify API_URL injection
2. Check browser console - verify `API_BASE_URL` value
3. Verify Cloud Run backend is accessible
4. Check CORS settings on backend

### If API_URL Not Injected:
1. Verify `API_URL` environment variable is set in Vercel
2. Check build script has execute permissions
3. Review Vercel build logs for errors

## ✅ Expected Behavior

- **Localhost**: Frontend → `http://localhost:3000/api/chat` ✅
- **Vercel**: Frontend → `https://verisense-agentkit-414780218994.us-central1.run.app/api/chat` ✅

Both should work identically!

