# Vercel Deployment for Frontend

This frontend is configured to deploy from the `/frontend` directory on Vercel.

## Vercel Project Settings

When setting up your Vercel project:

1. **Root Directory**: Set to `frontend`
2. **Framework Preset**: Other (or Static HTML)
3. **Build Command**: `bash _vercel_build.sh` (or leave empty - vercel.json has it)
4. **Output Directory**: `.` (current directory)
5. **Install Command**: (leave empty - no dependencies)

## Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables:

- `API_URL`: Your backend API URL
  - Example: `https://verisense-agentkit-414780218994.us-central1.run.app`
  - This will be injected into `index.html` during build

## Build Process

1. Vercel runs `bash _vercel_build.sh`
2. Script injects `API_URL` into `index.html` as `window.__API_URL__`
3. Frontend uses this URL to connect to backend API
4. Static files are deployed to Vercel Edge Network

## Local Testing

Simulate Vercel build locally:

```bash
cd frontend
export API_URL="https://your-api-url.com"
bash _vercel_build.sh

# Verify injection
grep "__API_URL__" index.html

# Test locally
python3 -m http.server 3001
```

## Files Structure

```
frontend/
├── index.html          # Main HTML file (gets modified during build)
├── vercel.json         # Vercel configuration
├── _vercel_build.sh    # Build script (injects API_URL)
├── package.json        # NPM config (for build command)
└── .vercelignore       # Files to ignore
```

## GitHub Integration

When you push to GitHub:

1. Vercel detects changes in `/frontend` directory
2. Runs build command from `vercel.json`
3. Injects `API_URL` from environment variables
4. Deploys to Vercel Edge Network
5. Frontend is live and connects to your backend API

## Verification

After deployment, check:
- Frontend loads correctly
- API calls go to correct backend URL
- CORS headers are set properly
- Loading UI works correctly




