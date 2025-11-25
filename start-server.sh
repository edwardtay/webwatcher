#!/bin/bash

# VeriSense Server Startup Script

echo "🔒 VeriSense Cybersecurity Agent Server"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "Please create .env file with required API keys."
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if AgentKit packages are installed
if ! npm list @coinbase/agentkit > /dev/null 2>&1; then
    echo "⚠️  Warning: @coinbase/agentkit not found!"
    echo "Installing AgentKit packages..."
    echo "Note: You may need to install from GitHub or npm registry"
    echo ""
fi

echo "🚀 Starting VeriSense Server..."
echo "📊 Web Interface: http://localhost:${PORT:-3000}"
echo "🔌 API Endpoints available at http://localhost:${PORT:-3000}/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

PORT=${PORT:-3000} npm run server

