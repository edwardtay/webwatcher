# Simulating Vercel Build from /frontend

This guide shows how to simulate and test the Vercel build process for the frontend.

## Vercel Configuration

The frontend is configured to deploy from the `/frontend` directory with:
- **Root Directory**: `/frontend` (set in Vercel project settings)
- **Build Command**: `bash _vercel_build.sh` (or `npm run build`)
- **Output Directory**: `.` (current directory - serves index.html)
- **Framework Preset**: Other (static HTML)

## Local Build Simulation

### Step 1: Simulate Vercel Build

```bash
cd frontend

# Set API_URL environment variable (as Vercel would)
export API_URL="https://verisense-agentkit-414780218994.us-central1.run.app"

# Run the build script
bash _vercel_build.sh

# Or use npm
npm run build
```

### Step 2: Verify Build Output

```bash
# Check if API_URL was injected
grep "__API_URL__" index.html

# Should see something like:
# window.__API_URL__ = "https://verisense-agentkit-414780218994.us-central1.run.app";
```

### Step 3: Test Locally

```bash
# Serve the built frontend
cd frontend
python3 -m http.server 3001

# Or use any static server
npx serve .
```

## Vercel Project Settings

When setting up in Vercel Dashboard:

1. **Root Directory**: Set to `frontend`
2. **Framework Preset**: Other
3. **Build Command**: `bash _vercel_build.sh` or `npm run build`
4. **Output Directory**: `.` (or leave empty)
5. **Install Command**: (leave empty - no dependencies needed)

## Environment Variables in Vercel

Set in Vercel Dashboard → Settings → Environment Variables:

- `API_URL`: Your backend API URL (e.g., Cloud Run URL)
  - Example: `https://verisense-agentkit-414780218994.us-central1.run.app`

## Build Script Details

The `_vercel_build.sh` script:
1. Reads `API_URL` from environment
2. Injects it into `index.html` 
3. Replaces `window.__API_URL__` placeholder with actual URL
4. Outputs the modified `index.html` ready for deployment

## Testing the Build

```bash
# Full simulation
cd frontend
export API_URL="https://your-api-url.com"
bash _vercel_build.sh
grep "__API_URL__" index.html

# Test locally
python3 -m http.server 3001
# Open http://localhost:3001
```

## GitHub Integration

When you push to GitHub:

1. Vercel detects changes
2. Runs build command: `bash _vercel_build.sh`
3. Uses `API_URL` from Vercel environment variables
4. Deploys the built `index.html` to Vercel Edge Network

## Verification Checklist

- [ ] `frontend/vercel.json` exists and is configured
- [ ] `frontend/_vercel_build.sh` is executable
- [ ] `frontend/package.json` has build script
- [ ] `API_URL` environment variable is set in Vercel
- [ ] Build script successfully injects API_URL
- [ ] Frontend can connect to backend API

## Troubleshooting

### Build Fails
- Check `_vercel_build.sh` has execute permissions: `chmod +x _vercel_build.sh`
- Verify `API_URL` is set in Vercel environment variables
- Check Vercel build logs for errors

### API Not Connecting
- Verify `API_URL` was injected correctly: `grep "__API_URL__" index.html`
- Check CORS settings on backend API
- Verify backend API is accessible from Vercel deployment

