# A2A Protocol Implementation for WebWatcher

## Overview
This document describes the A2A (Agent-to-Agent) v0.2.6 protocol implementation for the WebWatcher cybersecurity agent.

## What Was Fixed

### 1. Agent Card Compliance (/.well-known/agent.json)
**Location:** `apps/backend/src/api/routes/health.routes.ts`

Updated the agent card to comply with A2A v0.2.6 specification:
- Restructured to match required fields: `name`, `description`, `url`, `capabilities`
- Changed `functions` to `tools` with proper `inputSchema` and `outputSchema`
- Added `protocols` section with A2A v0.2.6 version and endpoint information
- Included proper `agentType`, `coordinationTypes`, and coordination capabilities

### 2. A2A Endpoint Implementation
**New Files Created:**
- `apps/backend/src/api/routes/a2a.routes.ts` - A2A route handler
- `apps/backend/src/api/controllers/a2a.controller.ts` - A2A protocol controller

**Features:**
- Handles A2A v0.2.6 message types: `request`, `response`, `error`, `notification`
- Implements tool routing for: `scanUrl`, `checkDomain`, `analyzeEmail`, `breachCheck`
- Proper error handling with A2A-compliant error responses
- Request/response structure following A2A specification

### 3. Agent Manifest Updates
**Location:** `agent-manifest.json`

Updated to reflect A2A v0.2.6 compliance:
- Changed A2A version from "1.0" to "0.2.6"
- Updated tool names to camelCase (scanUrl, checkDomain, etc.)
- Added `outputSchema` for all tools
- Added proper endpoint references
- Updated protocol versions

### 4. Route Integration
**Location:** `apps/backend/src/api/routes/index.ts`

Added A2A routes to the main router:
```typescript
import a2aRoutes from './a2a.routes';
router.use('/api', a2aRoutes);
```

## A2A Protocol Structure

### Request Format
```json
{
  "id": "unique-request-id",
  "type": "request",
  "from": {
    "agentId": "requesting-agent-id",
    "url": "https://requesting-agent.com"
  },
  "to": {
    "agentId": "webwatcher-cybersecurity-agent",
    "url": "https://webwatcher.lever-labs.com"
  },
  "tool": "scanUrl",
  "parameters": {
    "url": "https://example.com"
  },
  "timestamp": "2024-12-05T10:30:00Z"
}
```

### Response Format
```json
{
  "id": "unique-request-id",
  "type": "response",
  "from": {
    "agentId": "webwatcher-cybersecurity-agent",
    "url": "https://webwatcher.lever-labs.com"
  },
  "to": {
    "agentId": "requesting-agent-id",
    "url": "https://requesting-agent.com"
  },
  "result": {
    "riskScore": 15,
    "verdict": "safe",
    "threats": [],
    "details": {}
  },
  "timestamp": "2024-12-05T10:30:05Z"
}
```

### Error Format
```json
{
  "id": "unique-request-id",
  "type": "error",
  "from": {
    "agentId": "webwatcher-cybersecurity-agent",
    "url": "https://webwatcher.lever-labs.com"
  },
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'unknownTool' is not available",
    "details": {}
  },
  "timestamp": "2024-12-05T10:30:05Z"
}
```

## Available Tools

### 1. scanUrl
Comprehensive URL security scan including phishing detection, malware scanning, and threat intelligence.

**Input:**
```json
{
  "url": "https://example.com"
}
```

**Output:**
```json
{
  "riskScore": 0-100,
  "verdict": "safe" | "suspicious" | "malicious",
  "threats": ["threat1", "threat2"],
  "details": {}
}
```

### 2. checkDomain
Domain intelligence analysis including WHOIS data, domain age, and registrar verification.

**Input:**
```json
{
  "domain": "example.com"
}
```

**Output:**
```json
{
  "riskScore": 0-100,
  "ageInDays": 3650,
  "registrar": "Example Registrar",
  "flags": ["flag1", "flag2"]
}
```

### 3. analyzeEmail
Email security analysis including phishing pattern detection and sender reputation.

**Input:**
```json
{
  "email": "user@example.com"
}
```

**Output:**
```json
{
  "phishingScore": 0-100,
  "threats": ["threat1"],
  "extractedUrls": []
}
```

### 4. breachCheck
Data breach detection using HaveIBeenPwned API.

**Input:**
```json
{
  "email": "user@example.com"
}
```

**Output:**
```json
{
  "totalBreaches": 5,
  "riskScore": 0-100,
  "breaches": []
}
```

## Testing

### Using curl
```bash
# Test agent card discovery
curl https://webwatcher.lever-labs.com/.well-known/agent.json

# Test A2A scanUrl
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

### Using the test script
```bash
./test-a2a.sh
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent card discovery (A2A v0.2.6) |
| `/api/a2a` | POST | A2A protocol endpoint for tool execution |
| `/healthz` | GET | Health check |
| `/api/chat` | POST | Natural language chat interface |

## Compliance

This implementation follows the A2A v0.2.6 specification:
- ✅ Agent card at `/.well-known/agent.json`
- ✅ Required fields: name, description, url, capabilities
- ✅ Tools with inputSchema and outputSchema
- ✅ Protocol version and endpoint information
- ✅ Proper message types: request, response, error, notification
- ✅ Error handling with standard error codes
- ✅ Timestamp support
- ✅ Agent identification (from/to fields)

## References

- [A2A Protocol v0.2.6 Specification](https://a2a-protocol.org/v0.2.6/specification/)
- [Agent Card Object Structure](https://a2a-protocol.org/v0.2.6/specification/#55-agentcard-object-structure)
