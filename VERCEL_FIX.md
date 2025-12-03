# Vercel Deployment Fix

## Issue
Vercel is serving an old version of the frontend with `window.location.origin` instead of the updated `https://webwatcher.lever-labs.com`.

## Root Cause
Vercel hasn't automatically deployed the latest changes from GitHub. This could be because:
1. Vercel project is not configured to auto-deploy from the monorepo
2. The build directory is not correctly set
3. Vercel needs manual trigger

## Current Status
- ✅ GitHub repo has correct code: `const API_BASE = 'https://webwatcher.lever-labs.com'`
- ❌ Vercel is serving old code: `const API_BASE = window.location.origin`
- ✅ Backend is working perfectly at https://webwatcher.lever-labs.com

## Solution

### Option 1: Trigger Manual Deployment (Quickest)
1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Find the `webwatcher-agent` project
3. Click "Deployments" tab
4. Click "Redeploy" on the latest deployment
5. Or click "Deploy" to trigger a new deployment from main branch

### Option 2: Fix Vercel Project Settings
1. Go to Vercel Dashboard → Project Settings
2. Under "Build & Development Settings":
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `bash _vercel_build.sh`
   - **Output Directory**: `dist`
3. Under "Git":
   - Ensure "Production Branch" is set to `main`
   - Enable "Automatically deploy all branches"
4. Save and redeploy

### Option 3: Use Vercel CLI
```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Deploy from frontend directory
cd apps/frontend
vercel --prod
```

## Verification
After deployment, verify the fix:

```bash
# Check if Vercel is serving the correct API URL
curl -s https://webwatcher-agent.vercel.app/ | grep "API_BASE"

# Should show:
# const API_BASE = 'https://webwatcher.lever-labs.com';
```

## Test the Frontend
1. Open https://webwatcher-agent.vercel.app/
2. Click any quick action button
3. Should connect to backend successfully (no HTTP 405 errors)

## Backend Status
✅ Backend is fully operational:
- URL: https://webwatcher.lever-labs.com
- All environment variables configured
- API responding correctly
- CORS enabled

The only issue is Vercel serving stale frontend code.
