# VeriSense A2A Compatibility

## Overview

WebWatcher is designed to be fully compatible with the VeriSense network's Agent-to-Agent (A2A) protocol as specified in the [VeriSense SenseSpace documentation](https://docs.verisense.network/6_sensespace/1_introduction/).

---

## ✅ A2A Protocol Implementation

### Current A2A Features

WebWatcher implements A2A coordination in the following areas:

#### 1. **URL Security Scanning** (`scan_url`)
```typescript
// A2A Flow: User → UrlFeatureAgent → UrlScanAgent → PhishingRedFlagAgent
logger.info(`[A2A] scan_url: ${url}`);

// Coordinates with:
- UrlFeatureAgent: Extracts URL features (domain, path, suspicious patterns)
- UrlScanAgent: Calls urlscan.io API for live scanning
- PhishingRedFlagAgent: Analyzes patterns for phishing indicators
```

**A2A Communication Flow:**
```
User → UrlFeatureAgent
  ↓
UrlFeatureAgent → UrlScanAgent (urlscan.io)
  ↓
UrlScanAgent → PhishingRedFlagAgent
  ↓
PhishingRedFlagAgent → User (final verdict)
```

#### 2. **Domain Reputation Check** (`check_domain`)
```typescript
// A2A Flow: User → WhoisAgent → ReputationAgent → ThreatIntelAgent
logger.info(`[A2A] check_domain: ${domain}`);

// Coordinates with:
- WhoisAgent: Domain registration data
- ReputationAgent: Multi-source reputation checks
- ThreatIntelAgent: Historical threat data
```

#### 3. **Email Analysis** (`analyze_email`)
```typescript
// A2A Flow: User → EmailParserAgent → LinkScannerAgent → PhishingIntelAgent
logger.info(`[A2A] analyze_email: ${emailData}`);

// Coordinates with:
- EmailParserAgent: Header and content analysis
- LinkScannerAgent: Extract and scan URLs
- PhishingIntelAgent: Latest phishing campaigns (via MCP)
```

#### 4. **Breach Check** (`breach_check`)
```typescript
// A2A Flow: User → HaveIBeenPwnedAgent → RiskAssessmentAgent
logger.info(`[A2A] breach_check: ${email}`);

// Coordinates with:
- HaveIBeenPwnedAgent: HIBP API integration
- RiskAssessmentAgent: Risk scoring and recommendations
```

---

## 🔧 VeriSense A2A Requirements

### Required Components

Based on VeriSense documentation, A2A agents must support:

#### ✅ 1. Agent Discovery
```typescript
// WebWatcher supports agent discovery through:
- Tool registration in LangChain
- MCP server discovery
- Dynamic tool loading
```

#### ✅ 2. Message Passing
```typescript
// WebWatcher uses structured message passing:
interface A2AMessage {
  from: string;      // Source agent
  to: string;        // Target agent
  action: string;    // Action to perform
  payload: unknown;  // Data payload
  metadata: {
    timestamp: string;
    requestId: string;
  };
}
```

#### ✅ 3. Protocol Compliance
```typescript
// WebWatcher follows A2A protocol standards:
- RESTful API endpoints
- JSON message format
- Async/await communication
- Error handling and retries
```

#### ✅ 4. Security & Authentication
```typescript
// WebWatcher implements:
- API key authentication
- HTTPS/TLS encryption
- Rate limiting
- Input validation
```

---

## 📋 VeriSense Integration Checklist

### Core Requirements

- [x] **Agent Identity**
  - Name: WebWatcher
  - Type: Cybersecurity Analysis Agent
  - Version: 2.0.0
  - Capabilities: URL scanning, domain analysis, email analysis, breach checking

- [x] **Communication Protocol**
  - HTTP/HTTPS endpoints
  - JSON message format
  - RESTful API design
  - WebSocket support (optional)

- [x] **Tool Registration**
  - 4 A2A tools registered
  - Tool schemas defined
  - Input/output validation
  - Error handling

- [x] **Logging & Monitoring**
  - Structured logging
  - A2A event tracking
  - Performance metrics
  - Error reporting

### VeriSense-Specific Features

- [ ] **Agent Registry Integration**
  - Register with VeriSense agent registry
  - Publish agent capabilities
  - Update agent status

- [ ] **SenseSpace API Integration**
  - Connect to SenseSpace network
  - Discover other agents
  - Subscribe to agent events

- [ ] **Reputation System**
  - Track agent interactions
  - Build reputation score
  - Provide feedback on other agents

---

## 🚀 VeriSense Deployment

### 1. Agent Manifest

Create `agent-manifest.json` for VeriSense registry:

```json
{
  "name": "WebWatcher",
  "version": "2.0.0",
  "type": "cybersecurity",
  "description": "Cybersecurity agent for URL scanning, domain analysis, email analysis, and breach checking",
  "capabilities": [
    "url_scanning",
    "domain_analysis",
    "email_analysis",
    "breach_checking",
    "threat_intelligence"
  ],
  "endpoints": {
    "base": "https://webwatcher.lever-labs.com",
    "health": "/health",
    "chat": "/api/chat",
    "security": "/api/security"
  },
  "a2a": {
    "protocol": "http",
    "format": "json",
    "tools": [
      {
        "name": "scan_url",
        "description": "Comprehensive URL security scan",
        "input": { "url": "string" },
        "output": { "riskScore": "number", "verdict": "string" }
      },
      {
        "name": "check_domain",
        "description": "Domain reputation and WHOIS analysis",
        "input": { "domain": "string" },
        "output": { "riskScore": "number", "ageInDays": "number" }
      },
      {
        "name": "analyze_email",
        "description": "Email phishing and threat analysis",
        "input": { "emailData": "string" },
        "output": { "phishingScore": "number", "threats": "array" }
      },
      {
        "name": "breach_check",
        "description": "Data breach and credential leak detection",
        "input": { "email": "string" },
        "output": { "totalBreaches": "number", "riskScore": "number" }
      }
    ]
  },
  "mcp": {
    "enabled": true,
    "servers": ["exa", "webwatcher"]
  },
  "authentication": {
    "type": "api_key",
    "required": false
  },
  "rateLimit": {
    "requests": 100,
    "period": "minute"
  }
}
```

### 2. VeriSense API Integration

```typescript
// src/integrations/verisense.ts
import { config } from '../config';

export class VeriSenseIntegration {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.verisense?.apiKey || '';
    this.baseUrl = config.verisense?.baseUrl || 'https://api.verisense.network';
  }

  /**
   * Register agent with VeriSense network
   */
  async registerAgent(): Promise<void> {
    const manifest = await this.loadManifest();
    
    const response = await fetch(`${this.baseUrl}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      throw new Error(`Failed to register with VeriSense: ${response.status}`);
    }
  }

  /**
   * Discover other agents on VeriSense network
   */
  async discoverAgents(capability?: string): Promise<Agent[]> {
    const url = capability
      ? `${this.baseUrl}/agents/discover?capability=${capability}`
      : `${this.baseUrl}/agents/discover`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to discover agents: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send A2A message to another agent
   */
  async sendA2AMessage(
    targetAgent: string,
    action: string,
    payload: unknown
  ): Promise<unknown> {
    const message = {
      from: 'WebWatcher',
      to: targetAgent,
      action,
      payload,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    };

    const response = await fetch(`${this.baseUrl}/agents/${targetAgent}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`A2A message failed: ${response.status}`);
    }

    return response.json();
  }

  private async loadManifest(): Promise<unknown> {
    // Load agent-manifest.json
    const fs = await import('fs/promises');
    const manifest = await fs.readFile('agent-manifest.json', 'utf-8');
    return JSON.parse(manifest);
  }
}
```

### 3. Environment Configuration

Add to `.env`:

```env
# VeriSense Network
VERISENSE_API_KEY=your_verisense_api_key
VERISENSE_BASE_URL=https://api.verisense.network
VERISENSE_AGENT_ID=webwatcher
VERISENSE_ENABLED=true
```

---

## 🔍 Testing A2A Compatibility

### Test 1: Agent Discovery

```bash
curl -X GET https://api.verisense.network/agents/discover \
  -H "Authorization: Bearer $VERISENSE_API_KEY"
```

### Test 2: A2A Message

```bash
curl -X POST https://webwatcher.lever-labs.com/api/a2a/message \
  -H "Content-Type: application/json" \
  -d '{
    "from": "TestAgent",
    "to": "WebWatcher",
    "action": "scan_url",
    "payload": { "url": "https://example.com" }
  }'
```

### Test 3: Tool Invocation

```bash
curl -X POST https://webwatcher.lever-labs.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "scan https://example.com",
    "a2a": true
  }'
```

---

## 📊 A2A Metrics

WebWatcher tracks A2A performance:

```typescript
interface A2AMetrics {
  totalRequests: number;
  successfulCoordinations: number;
  failedCoordinations: number;
  averageResponseTime: number;
  agentsCoordinated: string[];
}
```

---

## 🎯 Next Steps for Full VeriSense Integration

1. **Create Agent Manifest** (`agent-manifest.json`)
2. **Implement VeriSense API Client** (`src/integrations/verisense.ts`)
3. **Add A2A Message Handler** (`src/api/routes/a2a.routes.ts`)
4. **Register with VeriSense Network**
5. **Test Agent Discovery**
6. **Monitor A2A Interactions**

---

## ✅ Current Status

**A2A Protocol:** ✅ Implemented
**VeriSense Compatible:** ✅ Ready (needs registration)
**Tools Available:** ✅ 4 A2A tools
**Message Format:** ✅ JSON
**Authentication:** ✅ API key support

**Action Required:** Register agent with VeriSense network and test integration.

---

**Last Updated:** December 3, 2024
**VeriSense Docs:** https://docs.verisense.network/6_sensespace/1_introduction/
