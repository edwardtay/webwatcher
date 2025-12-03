# WebWatcher Architecture

## Monorepo Structure

WebWatcher is organized as a monorepo with clear separation of concerns:

### Apps
- **apps/backend** - Node.js/TypeScript API deployed to Google Cloud Run
- **apps/frontend** - Static web UI deployed to Vercel

### Packages
- **packages/mcp** - Model Context Protocol servers for threat intelligence

### Infrastructure
- **infra/cloudrun** - Cloud Run deployment configurations and Dockerfiles

### Scripts
- Deployment scripts
- Development utilities
- CI/CD helpers

## Backend Architecture

### Layered Security Analysis

**Layer A: URL & Page Analysis**
- Redirect chain analysis
- Page content scanning
- Form risk inspection
- TLS/SSL auditing

**Layer B: Threat Intelligence**
- Reputation lookup (Google Safe Browsing, VirusTotal)
- WHOIS and domain age checking
- IP risk profiling
- Breach detection (HaveIBeenPwned)

**Layer C: Policy & Context**
- Category classification
- Policy compliance
- Risk score calculation

**Layer D: Incident Management**
- Incident report generation
- User feedback collection
- Feedback analytics

## Deployment

### Backend (Cloud Run)
- Builds from `apps/backend` only
- Dockerfile-based deployment
- Auto-scaling with 2Gi memory, 2 CPU
- Deployed on every push to main

### Frontend (Vercel)
- Static HTML/JS deployment
- Serverless API functions via `apps/frontend/api`
- CDN distribution

## Technology Stack

- **Backend**: Node.js 22, TypeScript, Express
- **AI/ML**: LangChain, OpenAI GPT-4
- **Protocols**: MCP (Exa), A2A, Letta
- **Security APIs**: Google Safe Browsing, VirusTotal, HaveIBeenPwned, URLScan.io
- **Frontend**: Vanilla JS with Marked.js
