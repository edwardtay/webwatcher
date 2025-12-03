# WebWatcher Backend

This is the backend service for WebWatcher, deployed to Google Cloud Run.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Development
npm run dev:server

# Production build
npm run build
npm start
```

## Deployment

This backend is automatically deployed to Cloud Run when pushed to the main branch.

The Cloud Build configuration (`../../infra/cloudrun/cloudbuild.yaml`) builds from this subfolder only, ensuring:
- Faster builds
- Lower memory usage
- No frontend/docs/scripts included
- Clean service separation

## Structure

- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript (generated)
- `configs/` - Configuration files
- `tools/` - Utility scripts
- `tests/` - Test files
