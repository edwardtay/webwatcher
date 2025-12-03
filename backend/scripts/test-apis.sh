#!/bin/bash

# Internal script to test all security APIs
# This file is not committed to GitHub

echo "🔍 Testing WebWatcher Security APIs (Internal)"
echo "=============================================="
echo ""

BASE_URL="http://localhost:8080/api"

# Test 1: Category Classification
echo "1️⃣ Category Classification..."
curl -s -X POST $BASE_URL/security/classify-category \
  -H "Content-Type: application/json" \
  -d '{"url": "https://binance.com"}' | jq '.'

# Test 2: Policy Check
echo ""
echo "2️⃣ Policy Check..."
curl -s -X POST $BASE_URL/security/check-policy \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/login", "policyProfileId": "enterprise"}' | jq '.'

# Test 3: Comprehensive Scan
echo ""
echo "3️⃣ Comprehensive Scan..."
curl -s -X POST $BASE_URL/security/comprehensive-scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq '.data.riskScore'

echo ""
echo "✅ All tests completed!"
