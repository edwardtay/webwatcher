# Quick Start - WebWatcher A2A Agent

## Deploy

```bash
./scripts/deploy-cloudrun.sh
```

## Verify

```bash
./verify-agent.sh
```

## Test Manually

### 1. Check Agent Card
```bash
curl https://webwatcher.lever-labs.com/.well-known/agent.json | python3 -m json.tool
```

### 2. Test A2A Endpoint
```bash
curl -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "scanUrl",
    "parameters": {"url": "https://google.com"}
  }' | python3 -m json.tool
```

### 3. Run All Tests
```bash
./test-a2a.sh
```

## Expected Results After Deployment

✅ **Health Check**
```bash
curl https://webwatcher.lever-labs.com/healthz
# Returns: ok
```

✅ **Agent Card** (A2A v0.2.6 compliant)
- Available at `/.well-known/agent.json`
- Contains 4 tools with schemas
- A2A protocol version 0.2.6

✅ **A2A Endpoint**
- POST `/api/a2a`
- Handles: request, response, error, notification
- 4 tools: scanUrl, checkDomain, analyzeEmail, breachCheck

✅ **Security**
- SSRF prevention
- Protocol validation
- Input validation
- Rate limiting

## Tools Available

| Tool | Parameter | Example |
|------|-----------|---------|
| scanUrl | url | `{"url": "https://example.com"}` |
| checkDomain | domain | `{"domain": "example.com"}` |
| analyzeEmail | email | `{"email": "user@example.com"}` |
| breachCheck | email | `{"email": "user@example.com"}` |

## Documentation

- `VERIFICATION_GUIDE.md` - Complete verification guide
- `A2A_IMPLEMENTATION.md` - Implementation details
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `SECURITY_CHECKLIST.md` - Security review

## Troubleshooting

### Deployment fails
```bash
# Check Cloud Run logs
gcloud run logs read verisense-agentkit --project webwatcher-479404 --limit 50
```

### Tests fail
```bash
# Verify service is running
curl https://webwatcher.lever-labs.com/healthz

# Check specific endpoint
curl -I https://webwatcher.lever-labs.com/api/a2a
```

### Environment variables
```bash
# Set in Cloud Run console or via:
./scripts/set-cloudrun-env.sh
```

## Support

- GitHub: https://github.com/edwardtay/webwatcher
- A2A Spec: https://a2a-protocol.org/v0.2.6/specification/
