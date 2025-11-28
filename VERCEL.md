# Vercel Deployment Guide

This project is configured for deployment on Vercel as a serverless Express.js application.

## Configuration Files

### `vercel.json`
- **Build Command**: `npm run build`
- **Runtime**: Node.js 20.x
- **API Function**: `api/index.ts` (Vercel will compile this automatically)
- **Rewrites**: All routes (`/*`) are rewritten to `/api/index`

### `api/index.ts`
- Serverless function entry point
- Imports the compiled Express app from `dist/server.js`
- Exports the app as default export for Vercel

### `package.json`
- **Build Script**: `npm run build` (compiles TypeScript)
- **Vercel Build**: `vercel-build` script (alias for `npm run build`)

## Build Process

1. **TypeScript Compilation**: `npm run build` compiles `src/**/*.ts` → `dist/**/*.js`
2. **Vercel Compilation**: Vercel automatically compiles `api/index.ts` → serverless function
3. **Deployment**: All routes are handled by the Express app via `/api/index`

## Deployment Steps

### First Time Deployment
```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (will prompt for configuration)
vercel
```

### Production Deployment
```bash
vercel --prod
```

### Environment Variables
Set these in Vercel dashboard (Settings → Environment Variables):
- `OPENAI_API_KEY`
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`
- `NETWORK_ID` (optional, defaults to base-sepolia)
- `URLSCAN_API_KEY` (optional, for urlscan.io integration)
- `EXA_API_KEY` (for Exa MCP search)
- `MCP_EXA_SERVER_PATH` (optional)
- `MCP_WEBWATCHER_SERVER_PATH` (optional)

## Verification

### Local Build Test
```bash
# Build TypeScript
npm run build

# Verify exports
node -e "const app = require('./dist/server').default; console.log('Express app:', typeof app === 'function');"
```

### Vercel Build Simulation
```bash
# Test build command
npm run build

# Verify all files exist
test -f vercel.json && echo "✓ vercel.json"
test -f api/index.ts && echo "✓ api/index.ts"
test -f dist/server.js && echo "✓ dist/server.js"
```

## Architecture

```
┌─────────────────┐
│   Vercel Edge   │
│   (All Routes)  │
└────────┬────────┘
         │
         │ Rewrite: /* → /api/index
         │
┌────────▼────────┐
│  api/index.ts   │  ← Serverless Function
│  (TypeScript)   │
└────────┬────────┘
         │
         │ import app from '../dist/server'
         │
┌────────▼────────┐
│ dist/server.js  │  ← Compiled Express App
│  (JavaScript)   │
└─────────────────┘
```

## Routes

All routes are handled by the Express app:
- `GET /` - Root info page
- `GET /healthz` - Health check endpoint
- `POST /check` - URL phishing check endpoint
- `GET /.well-known/agent.json` - Agent discovery endpoint

## Notes

- The Express app only starts listening on a port when NOT in Vercel environment (`process.env.VERCEL !== "1"`)
- Vercel automatically handles serverless function execution
- TypeScript files in `api/` are compiled by Vercel automatically
- The `dist/` folder contains compiled JavaScript from `src/`




