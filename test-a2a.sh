#!/bin/bash

# Test A2A Protocol Implementation
# Based on A2A v0.2.6 specification

BASE_URL="https://webwatcher.lever-labs.com"

echo "========================================="
echo "Testing WebWatcher A2A Implementation"
echo "========================================="
echo ""

# Test 1: Agent Card Discovery
echo "1. Testing Agent Card Discovery (/.well-known/agent.json)"
echo "---------------------------------------------------------"
curl -s "$BASE_URL/.well-known/agent.json" | python3 -m json.tool | head -30
echo ""
echo ""

# Test 2: A2A scanUrl tool
echo "2. Testing A2A scanUrl Tool"
echo "----------------------------"
curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-scan-001",
    "type": "request",
    "from": {
      "agentId": "test-agent",
      "url": "https://test-agent.example.com"
    },
    "tool": "scanUrl",
    "parameters": {
      "url": "https://google.com"
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 3: A2A checkDomain tool
echo "3. Testing A2A checkDomain Tool"
echo "--------------------------------"
curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-domain-001",
    "type": "request",
    "from": {
      "agentId": "test-agent",
      "url": "https://test-agent.example.com"
    },
    "tool": "checkDomain",
    "parameters": {
      "domain": "google.com"
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 4: A2A breachCheck tool
echo "4. Testing A2A breachCheck Tool"
echo "--------------------------------"
curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-breach-001",
    "type": "request",
    "from": {
      "agentId": "test-agent",
      "url": "https://test-agent.example.com"
    },
    "tool": "breachCheck",
    "parameters": {
      "email": "test@example.com"
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 5: Error handling - missing tool
echo "5. Testing Error Handling (Missing Tool)"
echo "-----------------------------------------"
curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-error-001",
    "type": "request",
    "from": {
      "agentId": "test-agent"
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 6: Error handling - unknown tool
echo "6. Testing Error Handling (Unknown Tool)"
echo "-----------------------------------------"
curl -s -X POST "$BASE_URL/api/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-error-002",
    "type": "request",
    "from": {
      "agentId": "test-agent"
    },
    "tool": "unknownTool",
    "parameters": {},
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | python3 -m json.tool
echo ""
echo ""

echo "========================================="
echo "A2A Testing Complete"
echo "========================================="
