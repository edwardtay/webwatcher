# Deployment Guide - A2A Protocol Updates

## Changes Made

The following files have been updated to implement A2A v0.2.6 protocol compliance:

### New Files
1. `apps/backend/src/api/routes/a2a.routes.ts` - A2A route handler
2. `apps/backend/src/api/controllers/a2a.controller.ts` - A2A protocol controller
3. `test-a2a.sh` - Testing script for A2A endpoints
4. `A2A_IMPLEMENTATION.md` - Implementation documentation

### Modified Files
1. `apps/backend/src/api/routes/index.ts` - Added A2A routes
2. `apps/backend/src/api/routes/health.routes.ts` - Updated agent card to A2A v0.2.6 spec
3. `agent-manifest.json` - Updated to reflect A2A v0.2.6 compliance

## Deployment Steps

### Option 1: Deploy to Cloud Run (Production)

```bash
# From the project root directory
./scripts/deploy-cloudrun.sh
```

This will:
- Build the Docker container
- Deploy to Google Cloud Run
- Update the service at: https://verisense-agentkit-414780218994.us-central1.run.app

### Option 2: Local Testing

```bash
# Navigate to backend directory
cd apps/backend

# Install dependencies (if not already done)
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

The server will be available at: http://localhost:8080

### Option 3: Development Mode

```bash
cd apps/backend
npm run dev:server
```

## Verification Steps

After deployment, verify the A2A implementation:

### 1. Check Agent Card
```bash
curl https://webwatcher.lever-labs.com/.well-known/agent.json | python3 -m json.tool
```

Expected: JSON response with A2A v0.2.6 compliant structure

### 2. Test A2A Endpoint
```bash
curl -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-001",
    "type": "request",
    "from": {"agentId": "test-agent"},
    "tool": "scanUrl",
    "parameters": {"url": "https://google.com"}
  }'
```

Expected: A2A response with scan results

### 3. Run Full Test Suite
```bash
./test-a2a.sh
```

This will test:
- Agent card discovery
- All 4 A2A tools (scanUrl, checkDomain, analyzeEmail, breachCheck)
- Error handling

## Key Changes Summary

### Agent Card (/.well-known/agent.json)
- ✅ Restructured to A2A v0.2.6 format
- ✅ Changed `functions` → `tools`
- ✅ Added `outputSchema` for all tools
- ✅ Added `protocols.a2a.version: "0.2.6"`
- ✅ Added `protocols.a2a.endpoint: "/api/a2a"`

### A2A Endpoint (/api/a2a)
- ✅ New POST endpoint for agent-to-agent communication
- ✅ Supports message types: request, response, error, notification
- ✅ Implements 4 tools: scanUrl, checkDomain, analyzeEmail, breachCheck
- ✅ Proper error handling with A2A error codes

### Agent Manifest
- ✅ Updated A2A version to "0.2.6"
- ✅ Updated tool names to camelCase
- ✅ Added outputSchema for all tools
- ✅ Added endpoint references

## Troubleshooting

### Issue: Agent card not updated after deployment
**Solution:** Clear CDN cache or wait for propagation (usually 1-2 minutes)

### Issue: A2A endpoint returns 404
**Solution:** Ensure routes are properly registered in `apps/backend/src/api/routes/index.ts`

### Issue: TypeScript compilation errors
**Solution:** Run `npm install` to ensure all dependencies are installed

### Issue: Tool execution fails
**Solution:** Check that all required environment variables are set (API keys for security services)

## Environment Variables Required

Ensure these are set in Cloud Run or your local `.env`:

```env
OPENAI_API_KEY=your_key
GOOGLE_SAFE_BROWSING_API_KEY=your_key
VIRUSTOTAL_API_KEY=your_key
HIBP_API_KEY=your_key
EXA_API_KEY=your_key
URLSCAN_API_KEY=your_key
AGENT_BASE_URL=https://webwatcher.lever-labs.com
```

## Next Steps

1. Deploy the changes using one of the deployment options above
2. Run the test script to verify functionality
3. Update any external systems that reference the old A2A format
4. Monitor logs for any issues

## Support

For issues or questions:
- Check logs: `gcloud run logs read verisense-agentkit --project webwatcher-479404`
- Review A2A specification: https://a2a-protocol.org/v0.2.6/specification/
- See implementation details: `A2A_IMPLEMENTATION.md`
