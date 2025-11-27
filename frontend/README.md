# WebWatcher Frontend

Frontend chat UI for WebWatcher cybersecurity agent.

## Deployment

This frontend is deployed separately on Vercel, while the API runs on Google Cloud Run.

### Setup

1. **Deploy to Vercel:**
   ```bash
   cd frontend
   vercel
   vercel --prod
   ```

2. **Set Environment Variable in Vercel:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add `API_URL` with your Google Cloud Run API URL:
     ```
     API_URL=https://verisense-agentkit-414780218994.us-central1.run.app
     ```

### Configuration

- **API URL**: Set via `API_URL` environment variable in Vercel
- **Default**: Falls back to Google Cloud Run URL if not set

### Features

- Chat interface with WebWatcher agent
- MCP command quick actions
- Info modal with app details
- Markdown rendering for agent responses
- A2A flow visualization

