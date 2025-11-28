# Exa MCP Server Setup Guide

This guide explains how to set up Exa MCP server for use with VeriSense AgentKit, including deployment to Google Cloud Run.

## Overview

Exa MCP (Model Context Protocol) provides AI-powered semantic web search. You can use it in two ways:

1. **HTTP-based MCP** (recommended for Cloud Run) - Connect to an MCP server via HTTP
2. **Stdio-based MCP** (local development) - Connect to a local MCP server process
3. **Direct API** (fallback) - Use Exa API directly without MCP

## Option 1: HTTP-based MCP Server (Cloud Run)

### Deploy Exa MCP Server to Cloud Run

1. **Create a simple Exa MCP HTTP server:**

Create `exa-mcp-server/Dockerfile`:
```dockerfile
FROM node:20-slim
WORKDIR /app
RUN npm install -g exa-mcp-server
EXPOSE 8080
CMD ["exa-mcp-server", "--port", "8080", "--host", "0.0.0.0"]
```

2. **Deploy to Cloud Run:**

```bash
# Build and deploy
gcloud run deploy exa-mcp-server \
  --source ./exa-mcp-server \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "EXA_API_KEY=your_exa_api_key"
```

3. **Get the service URL:**

```bash
EXA_MCP_URL=$(gcloud run services describe exa-mcp-server \
  --region us-central1 \
  --format 'value(status.url)')
echo "Exa MCP Server URL: $EXA_MCP_URL/mcp"
```

4. **Set in your main app:**

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "EXA_MCP_SERVER_URL=$EXA_MCP_URL/mcp,EXA_API_KEY=your_exa_api_key"
```

### Using Exa's Hosted MCP Server

If Exa provides a hosted MCP server, you can use it directly:

```bash
export EXA_MCP_SERVER_URL="https://mcp.exa.ai/mcp?exaApiKey=YOUR_API_KEY"
```

## Option 2: Stdio-based MCP (Local Development)

1. **Install Exa MCP server:**

```bash
npm install -g exa-mcp-server
# Or use npx
npx -y exa-mcp-server
```

2. **Set environment variables:**

```bash
export EXA_API_KEY="your_exa_api_key"
export EXA_USE_MCP="true"
```

3. **Run your app:**

```bash
npm run server
```

## Option 3: Direct API (No MCP)

If you don't want to use MCP, just set:

```bash
export EXA_API_KEY="your_exa_api_key"
```

The system will automatically use Exa's direct API.

## Configuration Priority

The system checks in this order:

1. **EXA_MCP_SERVER_URL** - Uses HTTP-based MCP (Cloud Run compatible)
2. **EXA_USE_MCP=true** - Uses stdio-based MCP (local only)
3. **Direct API** - Falls back to Exa API directly (requires EXA_API_KEY)

## Testing MCP Connection

Check logs to see which method is being used:

```bash
# Should see one of:
# "✓ Connected to Exa MCP server via HTTP"
# "✓ Connected to Exa MCP server via stdio"
# "Using Exa API directly"
```

## Troubleshooting

### MCP Server Not Connecting

1. **Check EXA_API_KEY is set:**
   ```bash
   echo $EXA_API_KEY
   ```

2. **For HTTP MCP, verify URL:**
   ```bash
   curl $EXA_MCP_SERVER_URL
   ```

3. **For stdio MCP, check command exists:**
   ```bash
   which exa-mcp-server
   # Or
   npx -y exa-mcp-server --help
   ```

### Cloud Run Deployment

- Ensure MCP server URL is accessible from Cloud Run
- Check CORS settings if needed
- Verify EXA_API_KEY is set in both services

## Example: Full Cloud Run Setup

```bash
# 1. Deploy Exa MCP server
gcloud run deploy exa-mcp-server \
  --source . \
  --region us-central1 \
  --set-env-vars "EXA_API_KEY=$EXA_API_KEY" \
  --allow-unauthenticated

# 2. Get MCP server URL
MCP_URL=$(gcloud run services describe exa-mcp-server \
  --region us-central1 \
  --format 'value(status.url)')

# 3. Deploy main app with MCP URL
gcloud run deploy verisense-agentkit \
  --source . \
  --region us-central1 \
  --set-env-vars "EXA_MCP_SERVER_URL=$MCP_URL/mcp,EXA_API_KEY=$EXA_API_KEY" \
  --allow-unauthenticated
```




