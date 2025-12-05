#!/bin/bash

# Test A2A v0.2.6 Spec Compliance
# Tests that message/send works with standard MessageSendParams (no required skill parameter)

set -e

BASE_URL="${BASE_URL:-http://localhost:8080}"
ENDPOINT="$BASE_URL/a2a"

echo "Testing A2A v0.2.6 Spec Compliance"
echo "===================================="
echo ""

# Test 1: Auto-routing with URL parameter (no skillId)
echo "Test 1: Auto-routing with URL parameter (no skillId in metadata)"
echo "-----------------------------------------------------------------"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "data",
            "data": {
              "url": "https://google.com"
            }
          }
        ]
      }
    },
    "id": "test-1"
  }')

echo "$RESPONSE" | jq '.'
echo ""

# Check if response is successful (has result, not error)
if echo "$RESPONSE" | jq -e '.result' > /dev/null; then
  echo "✅ Test 1 PASSED: Auto-routing works without skillId"
else
  echo "❌ Test 1 FAILED: Expected result, got error"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi
echo ""

# Test 2: Explicit skillId in metadata
echo "Test 2: Explicit skillId in metadata"
echo "-------------------------------------"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "data",
            "data": {
              "domain": "google.com"
            }
          }
        ]
      },
      "metadata": {
        "skillId": "checkDomain"
      }
    },
    "id": "test-2"
  }')

echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.result' > /dev/null; then
  echo "✅ Test 2 PASSED: Explicit skillId works"
else
  echo "❌ Test 2 FAILED: Expected result, got error"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi
echo ""

# Test 3: Auto-routing with email parameter
echo "Test 3: Auto-routing with email parameter"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "data",
            "data": {
              "email": "test@example.com"
            }
          }
        ]
      }
    },
    "id": "test-3"
  }')

echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.result' > /dev/null; then
  echo "✅ Test 3 PASSED: Auto-routing with email works"
else
  echo "❌ Test 3 FAILED: Expected result, got error"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi
echo ""

# Test 4: Text-based routing with breach keyword
echo "Test 4: Text-based routing with breach keyword"
echo "-----------------------------------------------"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Check if this email has been in any breach"
          },
          {
            "kind": "data",
            "data": {
              "email": "test@example.com"
            }
          }
        ]
      }
    },
    "id": "test-4"
  }')

echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.result' > /dev/null; then
  echo "✅ Test 4 PASSED: Text-based routing works"
else
  echo "❌ Test 4 FAILED: Expected result, got error"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi
echo ""

# Test 5: Direct method call (backward compatibility)
echo "Test 5: Direct method call (backward compatibility)"
echo "----------------------------------------------------"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "scanUrl",
    "params": {
      "url": "https://google.com"
    },
    "id": "test-5"
  }')

echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.result' > /dev/null; then
  echo "✅ Test 5 PASSED: Direct method calls still work"
else
  echo "❌ Test 5 FAILED: Expected result, got error"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi
echo ""

echo "===================================="
echo "✅ All A2A spec compliance tests passed!"
echo ""
echo "Summary:"
echo "- Auto-routing without skillId: ✅"
echo "- Explicit skillId in metadata: ✅"
echo "- Parameter-based routing: ✅"
echo "- Text-based routing: ✅"
echo "- Backward compatibility: ✅"
