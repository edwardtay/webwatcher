# WebWatcher Monorepo Guide

## Structure

```
webwatcher/
├── apps/                     # Runnable applications
│   ├── backend/              # Node.js API → Cloud Run
│   └── frontend/             # Static web UI → Vercel
├── packages/                 # Shared code
│   └── mcp/                  # MCP servers
├── infra/                    # Infrastructure configs
│   └── cloudrun/             # Cloud Run deployment
├── scripts/                  # Utility scripts
├── docs/                     # Documentation
├── private/                  # Private files (gitignored)
└── data/                     # Data files (gitignored)
```

## Key Benefits

### For Cloud Run Deployment
- **Faster builds**: Only `apps/backend` is built, not the entire repo
- **Lower memory**: TypeScript compiles only backend code
- **No confusion**: Buildpacks see only backend package.json
- **Clean separation**: Frontend, docs, scripts excluded from build

### For Development
- **Clear boundaries**: Each app is self-contained
- **Shared code**: Packages can be used by multiple apps
- **Easy navigation**: Standard structure everyone understands
- **Scalable**: Easy to add new apps or packages

## Working with the Monorepo

### Backend Development
```bash
cd apps/backend
npm install
npm run dev:server
```

### Frontend Development
```bash
cd apps/frontend
# Open index.html in browser
```

### Adding Shared Code
Create a new package in `packages/`:
```bash
mkdir -p packages/my-package
cd packages/my-package
npm init -y
```

Then reference it from apps using workspace protocol or relative paths.

## Deployment

### Backend (Cloud Run)
- Triggered on push to main
- Builds from `apps/backend` only
- Uses `cloudbuild.yaml` at root
- Dockerfile at `apps/backend/Dockerfile`

### Frontend (Vercel)
- Deploys from `apps/frontend`
- Static files + serverless API functions
- Config at `apps/frontend/vercel.json`

## Configuration Files

### Root Level (Monorepo Meta)
- `package.json` - Workspace configuration
- `tsconfig.base.json` - Shared TypeScript config
- `.gitignore` - Ignore patterns for all apps
- `.eslintrc.json` - Shared linting rules
- `.prettierrc` - Shared formatting rules

### App Level (Backend)
- `apps/backend/package.json` - Backend dependencies
- `apps/backend/tsconfig.json` - Extends base config
- `apps/backend/Dockerfile` - Container image
- `apps/backend/.env.example` - Environment template

## Best Practices

1. **Keep root clean**: Only meta configs at root
2. **Self-contained apps**: Each app has its own package.json
3. **Shared configs**: Use base configs and extend them
4. **Clear boundaries**: Don't import across apps directly
5. **Use packages**: For code shared between apps

## Migration Notes

This structure was created to solve the Cloud Run OOM issue by:
1. Isolating backend code in `apps/backend`
2. Excluding frontend, docs, and scripts from build
3. Reducing TypeScript compilation scope
4. Following industry-standard monorepo patterns
