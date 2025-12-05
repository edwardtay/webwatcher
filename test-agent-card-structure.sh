#!/bin/bash

# Test Agent Card JSON Structure
# Verify no markdown formatting in JSON responses

BASE_URL="https://webwatcher.lever-labs.com"

echo "========================================="
echo "Testing Agent Card JSON Structure"
echo "========================================="
echo ""

echo "Fetching agent card..."
RESPONSE=$(curl -s "$BASE_URL/.well-known/agent.json")

echo ""
echo "1. Checking JSON validity..."
echo "$RESPONSE" | python3 -m json.tool > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Valid JSON"
else
    echo "✗ Invalid JSON"
    exit 1
fi

echo ""
echo "2. Checking for markdown syntax..."
MARKDOWN_COUNT=$(echo "$RESPONSE" | grep -E '\*\*|###|##|^\*|^\-' | wc -l)
if [ "$MARKDOWN_COUNT" -eq 0 ]; then
    echo "✓ No markdown syntax found"
else
    echo "⚠ Found $MARKDOWN_COUNT potential markdown patterns"
    echo "$RESPONSE" | grep -E '\*\*|###|##|^\*|^\-'
fi

echo ""
echo "3. Extracting key sections..."
echo "$RESPONSE" | python3 << 'PYTHON'
import json
import sys

data = json.load(sys.stdin)

print("\n--- Risk Scoring Structure ---")
risk_scoring = data.get('capabilities', {}).get('riskScoring', {})
print(json.dumps(risk_scoring, indent=2))

print("\n--- Security APIs Structure ---")
security_apis = data.get('capabilities', {}).get('securityApis', {})
for api_name, api_info in list(security_apis.items())[:2]:
    print(f"\n{api_name}:")
    print(json.dumps(api_info, indent=2))

print("\n--- Internal Agents Structure ---")
internal_agents = data.get('capabilities', {}).get('internalAgents', [])
if internal_agents:
    print(f"\nFirst agent:")
    print(json.dumps(internal_agents[0], indent=2))

print("\n--- MCP Structure ---")
mcp = data.get('capabilities', {}).get('mcp', {})
print(json.dumps(mcp, indent=2))

PYTHON

echo ""
echo "========================================="
echo "Structure Test Complete"
echo "========================================="
