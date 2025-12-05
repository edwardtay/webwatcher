#!/bin/bash

# Comprehensive A2A Agent Verification Script
# Based on A2A v0.2.6 Specification

BASE_URL="${1:-https://webwatcher.lever-labs.com}"
PASSED=0
FAILED=0

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          A2A v0.2.6 Agent Verification                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Testing: $BASE_URL"
echo ""

# Helper functions
pass() {
    echo "✅ $1"
    ((PASSED++))
}

fail() {
    echo "❌ $1"
    ((FAILED++))
}

warn() {
    echo "⚠️  $1"
}

# Test 1: Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/healthz")
if [ "$HEALTH" = "200" ]; then
    pass "Service is healthy (HTTP $HEALTH)"
else
    fail "Service health check failed (HTTP $HEALTH)"
fi
echo ""

# Test 2: Agent Card Discovery
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Agent Card Discovery (A2A v0.2.6 Required)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
AGENT_CARD=$(curl -s "$BASE_URL/.well-known/agent.json")
if echo "$AGENT_CARD" | python3 -m json.tool > /dev/null 2>&1; then
    pass "Agent card is valid JSON"
    
    # Check required fields
    echo "$AGENT_CARD" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
required = ['name', 'description', 'url', 'capabilities']
for field in required:
    if field in data:
        print(f"  ✓ {field}: {str(data[field])[:50]}...")
    else:
        print(f"  ✗ Missing required field: {field}")
        sys.exit(1)
EOF
    if [ $? -eq 0 ]; then
        pass "All required fields present"
    else
        fail "Missing required fields"
    fi
else
    fail "Agent card is not valid JSON or not found"
fi
echo ""

# Test 3: Tools Definition
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Tools Definition (A2A v0.2.6 Required)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$AGENT_CARD" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
tools = data.get('capabilities', {}).get('tools', [])
if not tools:
    print("  ✗ No tools defined")
    sys.exit(1)
print(f"  ✓ Found {len(tools)} tools")
for tool in tools:
    name = tool.get('name', 'unnamed')
    required = ['name', 'description', 'inputSchema', 'outputSchema']
    missing = [f for f in required if f not in tool]
    if missing:
        print(f"  ✗ {name}: Missing {missing}")
        sys.exit(1)
    else:
        print(f"  ✓ {name}: Complete schema")
EOF
if [ $? -eq 0 ]; then
    pass "All tools have required schemas"
else
    fail "Tools missing required schemas"
fi
echo ""

# Test 4: A2A Protocol Info
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. A2A Protocol Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$AGENT_CARD" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
protocols = data.get('capabilities', {}).get('protocols', {})
if 'a2a' in protocols:
    a2a = protocols['a2a']
    print(f"  ✓ A2A Version: {a2a.get('version', 'unknown')}")
    print(f"  ✓ Endpoint: {a2a.get('endpoint', 'unknown')}")
    print(f"  ✓ Message Types: {', '.join(a2a.get('supportedMessageTypes', []))}")
else:
    print("  ✗ A2A protocol info not found")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "A2A protocol info present"
else
    fail "A2A protocol info missing"
fi
echo ""

# Test 5: A2A Endpoint - Request Message
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. A2A Endpoint - Request Message"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "verify-001",
    "type": "request",
    "from": {"agentId": "verification-agent"},
    "tool": "scanUrl",
    "parameters": {"url": "https://google.com"}
  }')

echo "$RESPONSE" | python3 << 'EOF'
import json, sys
try:
    data = json.load(sys.stdin)
    if data.get('type') == 'response':
        print("  ✓ Response type correct")
        if 'result' in data:
            print("  ✓ Result field present")
            result = data['result']
            if 'riskScore' in result and 'verdict' in result:
                print(f"  ✓ Risk Score: {result['riskScore']}")
                print(f"  ✓ Verdict: {result['verdict']}")
            else:
                print("  ✗ Missing riskScore or verdict")
                sys.exit(1)
        else:
            print("  ✗ No result field")
            sys.exit(1)
        if 'from' in data:
            print(f"  ✓ From: {data['from'].get('agentId')}")
        else:
            print("  ✗ Missing from field")
            sys.exit(1)
    elif data.get('type') == 'error':
        print(f"  ✗ Error: {data.get('error', {}).get('message')}")
        sys.exit(1)
    else:
        print(f"  ✗ Unexpected type: {data.get('type')}")
        sys.exit(1)
except json.JSONDecodeError:
    print("  ✗ Invalid JSON response")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "Request message handling works"
else
    fail "Request message handling failed"
fi
echo ""

# Test 6: A2A Endpoint - Notification Message
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. A2A Endpoint - Notification Message"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
NOTIF_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "verify-notif-001",
    "type": "notification",
    "from": {"agentId": "verification-agent"}
  }')

echo "$NOTIF_RESPONSE" | python3 << 'EOF'
import json, sys
try:
    data = json.load(sys.stdin)
    if data.get('status') == 'acknowledged':
        print("  ✓ Notification acknowledged")
    else:
        print("  ✗ Notification not acknowledged")
        sys.exit(1)
except:
    print("  ✗ Invalid response")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "Notification handling works"
else
    fail "Notification handling failed"
fi
echo ""

# Test 7: Error Handling
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. Error Handling"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 7.1: Missing tool
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{"type": "request", "from": {"agentId": "test"}}')

echo "$ERROR_RESPONSE" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error':
    print(f"  ✓ Missing tool error: {data.get('error', {}).get('code')}")
else:
    print("  ✗ Should return error for missing tool")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "Missing tool error handling works"
else
    fail "Missing tool error handling failed"
fi

# Test 7.2: Unknown tool
UNKNOWN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{"type": "request", "from": {"agentId": "test"}, "tool": "unknownTool"}')

echo "$UNKNOWN_RESPONSE" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and data.get('error', {}).get('code') == 'TOOL_NOT_FOUND':
    print(f"  ✓ Unknown tool error: TOOL_NOT_FOUND")
else:
    print("  ✗ Should return TOOL_NOT_FOUND error")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "Unknown tool error handling works"
else
    fail "Unknown tool error handling failed"
fi
echo ""

# Test 8: Input Validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. Input Validation & Security"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 8.1: SSRF Prevention
SSRF_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{"type": "request", "tool": "scanUrl", "parameters": {"url": "http://localhost:8080"}}')

echo "$SSRF_RESPONSE" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'internal' in data.get('error', {}).get('message', '').lower():
    print("  ✓ SSRF prevention: Blocks localhost")
else:
    print("  ✗ SSRF prevention failed")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "SSRF prevention works"
else
    fail "SSRF prevention failed"
fi

# Test 8.2: Protocol Validation
PROTO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{"type": "request", "tool": "scanUrl", "parameters": {"url": "ftp://example.com"}}')

echo "$PROTO_RESPONSE" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'protocol' in data.get('error', {}).get('message', '').lower():
    print("  ✓ Protocol validation: Blocks non-http(s)")
else:
    print("  ✗ Protocol validation failed")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "Protocol validation works"
else
    fail "Protocol validation failed"
fi

# Test 8.3: Email Validation
EMAIL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{"type": "request", "tool": "analyzeEmail", "parameters": {"email": "not-an-email"}}')

echo "$EMAIL_RESPONSE" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'error' and 'email' in data.get('error', {}).get('message', '').lower():
    print("  ✓ Email validation: Rejects invalid format")
else:
    print("  ✗ Email validation failed")
    sys.exit(1)
EOF
if [ $? -eq 0 ]; then
    pass "Email validation works"
else
    fail "Email validation failed"
fi
echo ""

# Test 9: All Tools
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9. Tool Functionality"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test each tool
for tool in "scanUrl:url:https://google.com" "checkDomain:domain:google.com" "analyzeEmail:email:test@example.com" "breachCheck:email:test@example.com"; do
    IFS=':' read -r tool_name param_name param_value <<< "$tool"
    
    TOOL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/a2a" \
      -H "Content-Type: application/json" \
      -d "{\"type\": \"request\", \"tool\": \"$tool_name\", \"parameters\": {\"$param_name\": \"$param_value\"}}")
    
    echo "$TOOL_RESPONSE" | python3 << EOF
import json, sys
data = json.load(sys.stdin)
if data.get('type') == 'response' and 'result' in data:
    print(f"  ✓ $tool_name works")
elif data.get('type') == 'error':
    print(f"  ✗ $tool_name error: {data.get('error', {}).get('message')}")
    sys.exit(1)
else:
    print(f"  ✗ $tool_name unexpected response")
    sys.exit(1)
EOF
    if [ $? -eq 0 ]; then
        pass "$tool_name functional"
    else
        fail "$tool_name not functional"
    fi
done
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Verification Summary                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed! Agent is A2A v0.2.6 compliant."
    exit 0
else
    echo "⚠️  Some tests failed. Please review the output above."
    exit 1
fi
