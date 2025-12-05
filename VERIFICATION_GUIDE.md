# A2A Agent Verification Guide

Complete guide to verify your WebWatcher agent is working properly according to A2A v0.2.6 specification.

## Quick Verification

```bash
# 1. Check if agent is responding
curl https://webwatcher.lever-labs.com/healthz

# 2. Verify agent card exists
curl https://webwatcher.lever-labs.com/.well-known/agent.json

# 3. Test A2A endpoint
curl -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{"type":"request","tool":"scanUrl","parameters":{"url":"https://google.com"}}'
```

## A2A v0.2.6 Specification Compliance

### 1. Agent Card Discovery (Required)

**Specification:** Agent card MUST be available at `/.well-known/agent.json`

**Test:**
```bash
curl -s https://webwatcher.lever-labs.com/.well-known/agent.json | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)

# Check required fields per A2A v0.2.6 spec
required = ['name', 'description', 'url', 'capabilities']
missing = [f for f in required if f not in data]

if missing:
    print(f"❌ Missing required fields: {missing}")
    sys.exit(1)
else:
    print("✅ All required fields present")
    print(f"   Name: {data['name']}")
    print(f"   URL: {data['url']}")
    print(f"   Description: {data['description'][:60]}...")
    
# Check capabilities structure
if 'tools' in data.get('capabilities', {}):
    tools = data['capabilities']['tools']
    print(f"✅ Tools defined: {len(tools)}")
    for tool in tools:
        print(f"   - {tool['name']}")
else:
    print("❌ No tools defined in capabilities")

# Check A2A protocol info
protocols = data.get('capabilities', {}).get('protocols', {})
if 'a2a' in protocols:
    a2a = protocols['a2a']
    print(f"✅ A2A protocol version: {a2a.get('version', 'unknown')}")
    print(f"   Endpoint: {a2a.get('endpoint', 'unknown')}")
else:
    print("⚠️  A2A protocol info not found")
EOF
```

**Expected Output:**
```
✅ All required fields present
   Name: WebWatcher Cybersecurity Intelligence Platform
   URL: https://webwatcher.lever-labs.com
   Description: Advanced cybersecurity agent providing real-time threat...
✅ Tools defined: 4
   - scanUrl
   - checkDomain
   - analyzeEmail
   - breachCheck
✅ A2A protocol version: 0.2.6
   Endpoint: /api/a2a
```

### 2. Tool Schema Validation

**Specification:** Each tool MUST have `name`, `description`, `inputSchema`, and `outputSchema`

**Test:**
```bash
curl -s https://webwatcher.lever-labs.com/.well-known/agent.json | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)

tools = data.get('capabilities', {}).get('tools', [])
print(f"Validating {len(tools)} tools...\n")

for tool in tools:
    name = tool.get('name', 'unnamed')
    print(f"Tool: {name}")
    
    # Check required fields
    required = ['name', 'description', 'inputSchema', 'outputSchema']
    missing = [f for f in required if f not in tool]
    
    if missing:
        print(f"  ❌ Missing: {missing}")
    else:
        print(f"  ✅ All required fields present")
        
    # Validate schemas
    input_schema = tool.get('inputSchema', {})
    output_schema = tool.get('outputSchema', {})
    
    if input_schema.get('type') == 'object':
        props = input_schema.get('properties', {})
        required_params = input_schema.get('required', [])
        print(f"  ✅ Input: {len(props)} properties, {len(required_params)} required")
    else:
        print(f"  ❌ Invalid input schema")
        
    if output_schema.get('type') == 'object':
        props = output_schema.get('properties', {})
        print(f"  ✅ Output: {len(props)} properties defined")
    else:
        print(f"  ❌ Invalid output schema")
    
    print()
EOF
```

### 3. A2A Message Handling

**Specification:** Agent MUST handle message types: `request`, `response`, `error`, `notification`

#### Test 3.1: Request Message
```bash
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-001",
    "type": "request",
    "from": {
      "agentId": "test-agent",
      "url": "https://test.example.com"
    },
    "tool": "scanUrl",
    "parameters": {
      "url": "https://google.com"
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 << 'EOF'
import json, sys
try:
    data = json.load(sys.stdin)
    print("✅ Valid JSON response")
    print(f"   Type: {data.get('type')}")
    print(f"   ID: {data.get('id')}")
    
    if data.get('type') == 'response':
        print("✅ Correct response type")
        if 'result' in data:
            print("✅ Result field present")
            result = data['result']
            print(f"   Risk Score: {result.get('riskScore')}")
            print(f"   Verdict: {result.get('verdict')}")
        else:
            print("❌ No result field")
    elif data.get('type') == 'error':
        print(f"⚠️  Error response: {data.get('error', {}).get('message')}")
    else:
        print(f"❌ Unexpected type: {data.get('type')}")
        
    # Check from field
    if 'from' in data:
        print(f"✅ From field: {data['from'].get('agentId')}")
    else:
        print("❌ Missing 'from' field")
        
except json.JSONDecodeError as e:
    print(f"❌ Invalid JSON: {e}")
    sys.exit(1)
EOF
```

#### Test 3.2: Notification Message
```bash
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "id": "notif-001",
    "type": "notification",
    "from": {
      "agentId": "test-agent"
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 -c "import json,sys; d=json.load(sys.stdin); print('✅ Notification acknowledged' if d.get('status')=='acknowledged' else '❌ Not acknowledged')"
```

#### Test 3.3: Error Handling - Missing Tool
```bash
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "id": "error-001",
    "type": "request",
    "from": {"agentId": "test-agent"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error':
    error = data.get('error', {})
    print(f"✅ Error handling works")
    print(f"   Code: {error.get('code')}")
    print(f"   Message: {error.get('message')}")
else:
    print("❌ Should return error type")
EOF
```

#### Test 3.4: Error Handling - Unknown Tool
```bash
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "id": "error-002",
    "type": "request",
    "from": {"agentId": "test-agent"},
    "tool": "unknownTool",
    "parameters": {}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and data.get('error', {}).get('code') == 'TOOL_NOT_FOUND':
    print("✅ Unknown tool error handling works")
else:
    print("❌ Should return TOOL_NOT_FOUND error")
EOF
```

### 4. Tool Functionality Tests

#### Test 4.1: scanUrl Tool
```bash
echo "Testing scanUrl tool..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "scanUrl",
    "parameters": {"url": "https://google.com"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'response':
    result = data.get('result', {})
    required = ['riskScore', 'verdict', 'threats', 'details']
    missing = [f for f in required if f not in result]
    if missing:
        print(f"❌ Missing fields: {missing}")
    else:
        print("✅ scanUrl works correctly")
        print(f"   Risk Score: {result['riskScore']}")
        print(f"   Verdict: {result['verdict']}")
        print(f"   Threats: {len(result['threats'])}")
else:
    print(f"❌ Error: {data.get('error', {}).get('message')}")
EOF
```

#### Test 4.2: checkDomain Tool
```bash
echo "Testing checkDomain tool..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "checkDomain",
    "parameters": {"domain": "google.com"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'response':
    result = data.get('result', {})
    required = ['riskScore', 'ageInDays', 'registrar', 'flags']
    missing = [f for f in required if f not in result]
    if missing:
        print(f"❌ Missing fields: {missing}")
    else:
        print("✅ checkDomain works correctly")
        print(f"   Risk Score: {result['riskScore']}")
        print(f"   Age: {result['ageInDays']} days")
        print(f"   Registrar: {result['registrar']}")
else:
    print(f"❌ Error: {data.get('error', {}).get('message')}")
EOF
```

#### Test 4.3: analyzeEmail Tool
```bash
echo "Testing analyzeEmail tool..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "analyzeEmail",
    "parameters": {"email": "test@example.com"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'response':
    result = data.get('result', {})
    required = ['phishingScore', 'threats', 'extractedUrls']
    missing = [f for f in required if f not in result]
    if missing:
        print(f"❌ Missing fields: {missing}")
    else:
        print("✅ analyzeEmail works correctly")
        print(f"   Phishing Score: {result['phishingScore']}")
        print(f"   Threats: {len(result['threats'])}")
else:
    print(f"❌ Error: {data.get('error', {}).get('message')}")
EOF
```

#### Test 4.4: breachCheck Tool
```bash
echo "Testing breachCheck tool..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "breachCheck",
    "parameters": {"email": "test@example.com"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'response':
    result = data.get('result', {})
    required = ['totalBreaches', 'riskScore', 'breaches']
    missing = [f for f in required if f not in result]
    if missing:
        print(f"❌ Missing fields: {missing}")
    else:
        print("✅ breachCheck works correctly")
        print(f"   Total Breaches: {result['totalBreaches']}")
        print(f"   Risk Score: {result['riskScore']}")
else:
    print(f"❌ Error: {data.get('error', {}).get('message')}")
EOF
```

### 5. Input Validation Tests

#### Test 5.1: Invalid URL (SSRF Prevention)
```bash
echo "Testing SSRF prevention..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "scanUrl",
    "parameters": {"url": "http://localhost:8080"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'internal' in data.get('error', {}).get('message', '').lower():
    print("✅ SSRF prevention works")
else:
    print("❌ SSRF prevention failed")
EOF
```

#### Test 5.2: Invalid Protocol
```bash
echo "Testing protocol validation..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "scanUrl",
    "parameters": {"url": "ftp://example.com"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'protocol' in data.get('error', {}).get('message', '').lower():
    print("✅ Protocol validation works")
else:
    print("❌ Protocol validation failed")
EOF
```

#### Test 5.3: Invalid Email Format
```bash
echo "Testing email validation..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "analyzeEmail",
    "parameters": {"email": "not-an-email"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'email' in data.get('error', {}).get('message', '').lower():
    print("✅ Email validation works")
else:
    print("❌ Email validation failed")
EOF
```

#### Test 5.4: Invalid Domain Format
```bash
echo "Testing domain validation..."
curl -s -X POST https://webwatcher.lever-labs.com/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request",
    "tool": "checkDomain",
    "parameters": {"domain": "invalid..domain"}
  }' | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'domain' in data.get('error', {}).get('message', '').lower():
    print("✅ Domain validation works")
else:
    print("❌ Domain validation failed")
EOF
```

## Complete Verification Script

Run all tests at once:

```bash
./test-a2a.sh
```

Or create a comprehensive test:

```bash
chmod +x verify-agent.sh
./verify-agent.sh
```

## Expected Results Summary

✅ **Agent Card**
- Available at `/.well-known/agent.json`
- Contains required fields: name, description, url, capabilities
- Tools have inputSchema and outputSchema
- A2A protocol version 0.2.6

✅ **A2A Endpoint**
- Responds to POST `/api/a2a`
- Handles request, response, error, notification types
- Returns proper A2A response structure
- Includes from/to agent identification

✅ **Tools**
- scanUrl: Returns riskScore, verdict, threats, details
- checkDomain: Returns riskScore, ageInDays, registrar, flags
- analyzeEmail: Returns phishingScore, threats, extractedUrls
- breachCheck: Returns totalBreaches, riskScore, breaches

✅ **Security**
- SSRF prevention (blocks localhost, private IPs)
- Protocol validation (http/https only)
- Email format validation
- Domain format validation
- Proper error messages

## Troubleshooting

### Agent Card Not Found
```bash
# Check if service is running
curl https://webwatcher.lever-labs.com/healthz

# Check deployment
gcloud run services describe verisense-agentkit --region us-central1
```

### A2A Endpoint Returns 404
```bash
# Verify routes are deployed
curl -I https://webwatcher.lever-labs.com/api/a2a
```

### Tool Execution Fails
```bash
# Check logs
gcloud run logs read verisense-agentkit --project webwatcher-479404 --limit 50
```

## References

- [A2A v0.2.6 Specification](https://a2a-protocol.org/v0.2.6/specification/)
- [Agent Card Structure](https://a2a-protocol.org/v0.2.6/specification/#55-agentcard-object-structure)
- [Message Types](https://a2a-protocol.org/v0.2.6/specification/#message-types)
