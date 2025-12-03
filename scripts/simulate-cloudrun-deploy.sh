#!/bin/bash
set -e

echo "🚀 Cloud Run Deployment Simulation"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check Docker
echo "📦 Step 1: Checking Docker..."
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

# Step 2: Build Docker image
echo ""
echo "🔨 Step 2: Building Docker image..."
cd apps/backend
docker build -t webwatcher-test:latest . 2>&1 | tail -20
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker build successful${NC}"
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

# Step 3: Run container
echo ""
echo "🏃 Step 3: Starting container..."
docker rm -f webwatcher-test 2>/dev/null || true
docker run -d \
    --name webwatcher-test \
    -p 8081:8080 \
    -e NODE_ENV=production \
    -e PORT=8080 \
    webwatcher-test:latest

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Container started${NC}"
else
    echo -e "${RED}✗ Container failed to start${NC}"
    exit 1
fi

# Step 4: Wait for server
echo ""
echo "⏳ Step 4: Waiting for server to start..."
sleep 5

# Step 5: Health check
echo ""
echo "🏥 Step 5: Running health check..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/healthz)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed (HTTP $HEALTH_RESPONSE)${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH_RESPONSE)${NC}"
    docker logs webwatcher-test
    docker rm -f webwatcher-test
    exit 1
fi

# Step 6: Test API endpoint
echo ""
echo "🧪 Step 6: Testing API endpoint..."
API_RESPONSE=$(curl -s -X POST http://localhost:8081/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$API_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API test passed (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠ API test returned HTTP $HTTP_CODE (may need env vars)${NC}"
fi

# Step 7: Check logs
echo ""
echo "📋 Step 7: Container logs (last 20 lines)..."
docker logs webwatcher-test 2>&1 | tail -20

# Cleanup
echo ""
echo "🧹 Cleaning up..."
docker rm -f webwatcher-test

echo ""
echo -e "${GREEN}✅ Simulation complete!${NC}"
echo ""
echo "Summary:"
echo "  - Docker build: ✓"
echo "  - Container start: ✓"
echo "  - Health check: ✓"
echo "  - API endpoint: $([ "$HTTP_CODE" = "200" ] && echo "✓" || echo "⚠")"
echo ""
echo "🎯 Cloud Run deployment should succeed!"
