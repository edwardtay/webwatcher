# MCP and A2A Verification Guide

## Current Status

Based on the codebase analysis:

### ✅ MCP (Model Context Protocol) - **CONFIGURED BUT NEEDS VERIFICATION**

**Configuration:**
- `EXA_API_KEY` is set in `.env` ✓
- `EXA_USE_MCP` is set in `.env` ✓
- MCP server files exist: `mcp/exa-mcp.ts` and `mcp/webwatcher-mcp.ts` ✓
- Required tools available: `tsx`, `npx` ✓

**How MCP Works Locally:**
1. When `EXA_USE_MCP=true`, the system tries to connect via stdio to local MCP server
2. It looks for `mcp/exa-mcp.ts` and runs it with `tsx`
3. Falls back to direct Exa API if MCP connection fails

**To Verify MCP is Working:**
```bash
# 1. Start the server
npm run server

# 2. Check logs for MCP connection messages:
# Should see: "✓ Connected to Exa MCP server via stdio"
# OR: "Using Exa API directly" (if MCP fails)

# 3. Test with a search query via API:
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "search for CVE-2024-1234"}'

# 4. Check logs - should see:
# "[MCP] Exa search via MCP returned X results" (if MCP working)
# OR "[API] Exa direct API returned X results" (if MCP not working)
```

### ✅ A2A (Agent-to-Agent) - **WORKING INTERNALLY**

**Current Implementation:**
- A2A coordination is built into `UnifiedActionProvider`
- `scan_website` action demonstrates A2A flow:
  - `UrlFeatureAgent` → extracts URL features
  - `UrlScanAgent` → calls urlscan.io API
  - `PhishingRedFlagAgent` → analyzes and flags phishing

**A2A Endpoints:**
- `POST /check` - A2A-style URL analysis (UrlFeatureAgent → PhishingRedFlagAgent)
- `GET /.well-known/agent.json` - AgentCard for A2A discovery

**To Verify A2A is Working:**
```bash
# 1. Test the /check endpoint (A2A-style):
curl -X POST http://localhost:8080/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Should return JSON with:
# - features (from UrlFeatureAgent)
# - verdict (from PhishingRedFlagAgent)
# - redFlags
# - explanation

# 2. Test via chat API (full A2A flow):
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "scan https://example.com"}'

# Should return response with A2A flow showing:
# - [User -> UrlFeatureAgent]
# - [UrlFeatureAgent -> UrlScanAgent]
# - [UrlScanAgent -> PhishingRedFlagAgent]
# - [PhishingRedFlagAgent -> User]
```

## Troubleshooting

### MCP Not Connecting

**Symptoms:**
- Logs show "Using Exa API directly" instead of "Connected to Exa MCP server"
- Search results marked as `source: "API"` instead of `source: "MCP"`

**Solutions:**
1. **Check EXA_API_KEY:**
   ```bash
   echo $EXA_API_KEY  # Should show your key
   ```

2. **Verify EXA_USE_MCP is set:**
   ```bash
   echo $EXA_USE_MCP  # Should be "true"
   ```

3. **Test MCP server directly:**
   ```bash
   cd mcp
   EXA_API_KEY=your_key npx tsx exa-mcp.ts
   # Should start MCP server (will wait for stdio input)
   ```

4. **Check for errors in server logs:**
   ```bash
   tail -f private/logs/server.log | grep -i mcp
   ```

### A2A Not Showing Flow

**Symptoms:**
- `/check` endpoint works but no A2A flow markers
- `scan_website` action doesn't show agent communication

**Solutions:**
1. **Verify URLSCAN_API_KEY (for UrlScanAgent):**
   ```bash
   echo $URLSCAN_API_KEY  # Optional but recommended
   ```

2. **Check server logs for A2A messages:**
   ```bash
   tail -f private/logs/server.log | grep -i "\[A2A\]"
   ```

3. **Test scan_website action directly:**
   ```bash
   curl -X POST http://localhost:8080/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "scan https://suspicious-site.com"}'
   ```

## Expected Behavior

### When MCP is Working:
- Logs show: `✓ Connected to Exa MCP server via stdio`
- Search results have `source: "MCP"`
- Faster responses (no API rate limits)

### When A2A is Working:
- `/check` endpoint returns structured A2A-style response
- `scan_website` action shows agent communication flow
- Logs show `[A2A]` prefixed messages

## Quick Test Commands

```bash
# 1. Start server
npm run server

# 2. In another terminal, test MCP:
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "search for latest security vulnerabilities"}'

# 3. Test A2A:
curl -X POST http://localhost:8080/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 4. Test full A2A flow:
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "scan https://test-site.com"}'
```

## Next Steps

1. **Start the server** and check logs for MCP/A2A status
2. **Run test commands** above to verify functionality
3. **Check logs** for any errors or warnings
4. **Update configuration** if needed based on test results

