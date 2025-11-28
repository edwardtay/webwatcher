# Agent Schema Compliance Check

## Current Agent Card Schema

```json
{
  "id": "webwatcher-phish-checker",
  "name": "WebWatcher Phishing URL Checker",
  "description": "Cybersecurity agent that inspects a URL and reports phishing red flags using an internal A2A pipeline.",
  "version": "1.0.0",
  "author": {
    "name": "NetWatch Team"
  },
  "agentUrl": "https://verisense-agentkit-414780218994.us-central1.run.app",
  "baseUrl": "https://verisense-agentkit-414780218994.us-central1.run.app",
  "capabilities": {
    "functions": [
      {
        "name": "checkUrl",
        "description": "Analyze a URL and return phishing red flags.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {
              "type": "string",
              "description": "URL to analyze for phishing indicators."
            }
          },
          "required": ["url"]
        },
        "outputSchema": {
          "type": "object",
          "properties": {
            "url": { "type": "string" },
            "verdict": { "type": "string" },
            "redFlags": { "type": "array", "items": { "type": "string" } },
            "explanation": { "type": "string" }
          }
        }
      }
    ]
  },
  "endpoints": {
    "checkUrl": {
      "method": "POST",
      "path": "/check"
    }
  }
}
```

## Schema Compliance Analysis

### ✅ Required Fields (Present)
- ✅ `id` - Unique agent identifier
- ✅ `name` - Human-readable name
- ✅ `description` - Agent description
- ✅ `version` - Version string
- ✅ `capabilities.functions` - Available functions
- ✅ `endpoints` - API endpoints

### ⚠️ Recommended Fields (Missing)
- ⚠️ `protocols` - Should list supported protocols (A2A, MCP, HTTP)
- ⚠️ `mcp` - MCP server information
- ⚠️ `tags` - Categorization tags
- ⚠️ `contact` - Contact information
- ⚠️ `license` - License information
- ⚠️ `repository` - Source code repository
- ⚠️ `capabilities.mcp` - MCP tools available
- ⚠️ `capabilities.a2a` - A2A coordination capabilities

### 🔍 A2A Capabilities Check

**Current Implementation:**
- ✅ Internal A2A coordination (UrlFeatureAgent → UrlScanAgent → PhishingRedFlagAgent)
- ✅ A2A discovery endpoint (`a2a_discover_agents`)
- ✅ Agent registry system
- ✅ Message queue for A2A communication
- ✅ Auto-coordination triggers

**Missing from Agent Card:**
- ❌ A2A protocol version
- ❌ A2A discovery endpoint
- ❌ A2A message types supported
- ❌ Agent types this agent can coordinate with

### 🔍 MCP Capabilities Check

**Current Implementation:**
- ✅ Exa MCP client (`src/utils/mcp-client.ts`)
- ✅ MCP server files (`mcp/exa-mcp.ts`, `mcp/webwatcher-mcp.ts`)
- ✅ HTTP and stdio transport support
- ✅ Fallback to direct API

**Missing from Agent Card:**
- ❌ MCP server URL/endpoint
- ❌ MCP tools available
- ❌ MCP protocol version
- ❌ MCP transport types (HTTP, stdio)

## Recommended Enhanced Agent Card

```json
{
  "id": "webwatcher-phish-checker",
  "name": "WebWatcher Phishing URL Checker",
  "description": "Cybersecurity agent that inspects a URL and reports phishing red flags using an internal A2A pipeline.",
  "version": "1.0.0",
  "author": {
    "name": "NetWatch Team",
    "contact": "https://github.com/edwardtay/webwatcher"
  },
  "license": "Apache-2.0",
  "repository": "https://github.com/edwardtay/webwatcher",
  "tags": ["cybersecurity", "phishing", "url-analysis", "security"],
  "agentUrl": "https://verisense-agentkit-414780218994.us-central1.run.app",
  "baseUrl": "https://verisense-agentkit-414780218994.us-central1.run.app",
  "protocols": ["A2A", "MCP", "HTTP"],
  "capabilities": {
    "functions": [
      {
        "name": "checkUrl",
        "description": "Analyze a URL and return phishing red flags.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {
              "type": "string",
              "description": "URL to analyze for phishing indicators."
            }
          },
          "required": ["url"]
        },
        "outputSchema": {
          "type": "object",
          "properties": {
            "url": { "type": "string" },
            "verdict": { "type": "string" },
            "redFlags": { "type": "array", "items": { "type": "string" } },
            "explanation": { "type": "string" },
            "a2aFlow": { "type": "string", "description": "A2A coordination flow" }
          }
        }
      }
    ],
    "a2a": {
      "version": "1.0",
      "agentType": "security_analyst",
      "discoveryEndpoint": "/.well-known/agent.json",
      "messageTypes": ["discovery", "task_request", "task_response", "status"],
      "coordinationTypes": [
        "vulnerability_scan",
        "incident_response",
        "compliance_check",
        "threat_analysis",
        "remediation"
      ],
      "canCoordinateWith": ["scanner", "triage", "fix", "governance"]
    },
    "mcp": {
      "version": "2024-11-05",
      "servers": [
        {
          "name": "exa-mcp",
          "description": "Exa AI semantic web search",
          "transport": ["stdio", "http"],
          "tools": ["exa_search"]
        }
      ],
      "tools": [
        {
          "name": "exa_search",
          "description": "Search the web using Exa AI semantic search",
          "inputSchema": {
            "type": "object",
            "properties": {
              "query": { "type": "string" },
              "numResults": { "type": "number", "default": 20 }
            },
            "required": ["query"]
          }
        }
      ]
    }
  },
  "endpoints": {
    "checkUrl": {
      "method": "POST",
      "path": "/check",
      "description": "A2A endpoint for URL phishing analysis"
    },
    "chat": {
      "method": "POST",
      "path": "/api/chat",
      "description": "General chat endpoint"
    },
    "health": {
      "method": "GET",
      "path": "/healthz",
      "description": "Health check endpoint"
    },
    "agentCard": {
      "method": "GET",
      "path": "/.well-known/agent.json",
      "description": "Agent discovery endpoint"
    }
  }
}
```

## Action Items

1. **Enhance Agent Card** - Add missing recommended fields
2. **Document A2A Protocol** - Add A2A capabilities to agent card
3. **Document MCP** - Add MCP server and tools information
4. **Add Tags** - Categorize agent for discovery
5. **Add Contact Info** - Repository and contact details

## Verification Commands

```bash
# Test agent card endpoint
curl https://verisense-agentkit-414780218994.us-central1.run.app/.well-known/agent.json | jq .

# Test A2A endpoint
curl -X POST https://verisense-agentkit-414780218994.us-central1.run.app/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq .

# Test MCP (if MCP server is deployed)
curl https://exa-mcp-server-xxx.run.app/mcp | jq .
```



