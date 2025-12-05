#!/bin/bash

# Test text-based parameter extraction

BASE_URL="${BASE_URL:-http://localhost:8080}"
ENDPOINT="$BASE_URL/a2a"

echo "Testing Text-Based Parameter Extraction"
echo "========================================"
echo ""

# Test 1: URL in text part
echo "Test 1: URL in text part"
echo "-------------------------"
curl -s -X POST "$ENDPOINT" \
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
            "text": "Please scan this URL: https://google.com"
          }
        ]
      }
    },
    "id": "test-1"
  }' | jq '.'
echo ""

# Test 2: Email in text part
echo "Test 2: Email in text part"
echo "---------------------------"
curl -s -X POST "$ENDPOINT" \
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
            "text": "Check if test@example.com has been in any breach"
          }
        ]
      }
    },
    "id": "test-2"
  }' | jq '.'
echo ""

# Test 3: Domain in text part
echo "Test 3: Domain in text part"
echo "----------------------------"
curl -s -X POST "$ENDPOINT" \
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
            "text": "What do you know about example.com?"
          }
        ]
      }
    },
    "id": "test-3"
  }' | jq '.'
echo ""

# Test 4: Just text with keyword
echo "Test 4: Just text with keyword"
echo "-------------------------------"
curl -s -X POST "$ENDPOINT" \
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
            "text": "I want to scan a URL"
          }
        ]
      }
    },
    "id": "test-4"
  }' | jq '.'
echo ""
