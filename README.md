# �️ WbebWatcher - Cybersecurity Intelligence Platform

**WebWatcher** is an advanced cybersecurity agent that provides real-time threat analysis, breach detection, and comprehensive security scanning through AI-powered agents and multi-protocol integration.

## 🎯 What Makes WebWatcher Unique

### **Multi-Protocol Integration**
- **MCP (Model Context Protocol)** - Real-time threat intelligence via Exa search
- **A2A (Agent-to-Agent)** - Coordinated multi-agent security analysis
- **Multiple Security APIs** - Comprehensive threat detection and analysis

### 🤖 Intelligent Security Analysis
- **Autonomous Detection**: Automatically identifies URLs, emails, and domains in queries
- **Real-Time Intelligence**: Uses MCP for latest threat data and breach information
- **Multi-Agent Coordination**: Specialized agents work together via A2A protocol

### 🔍 Comprehensive Security Coverage
- **URL & Domain Analysis**: Phishing detection, malware scanning, reputation checks
- **Email Security**: Phishing detection, sender reputation, content analysis
- **Breach Detection**: HaveIBeenPwned integration for credential leak checking
- **Threat Intelligence**: Real-time feeds from multiple security sources

## 🚀 Features

### Core Capabilities

1. **URL Security Scanning**
   - Redirect chain analysis
   - Page content scanning for phishing indicators
   - Form risk inspection
   - TLS/SSL certificate validation
   - Multi-source reputation checking (Google Safe Browsing, VirusTotal)

2. **Domain Intelligence**
   - WHOIS data and domain age analysis
   - Registrar verification
   - IP risk profiling
   - Hosting provider analysis
   - Suspicious TLD detection

3. **Email Security**
   - Phishing pattern detection
   - Sender reputation analysis
   - URL extraction and scanning
   - Latest phishing campaign intelligence

4. **Breach Detection**
   - HaveIBeenPwned API integration
   - Comprehensive breach history
   - Risk scoring based on breach severity
   - Exposed data type identification

5. **Policy & Risk Management**
   - Category classification
   - Policy compliance checking
   - Risk score calculation
   - Incident report generation

## 🏗️ Architecture

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

### Technology Stack

- **Backend**: Node.js + TypeScript + Express
- **AI/ML**: LangChain + OpenAI GPT-4
- **Protocols**: MCP (Exa), A2A, Letta
- **Security APIs**: Google Safe Browsing, VirusTotal, HaveIBeenPwned, URLScan.io
- **Frontend**: Vanilla JS with Marked.js for markdown rendering

## 🚀 Getting Started

### Prerequisites

- Node.js v22+ ([Download](https://nodejs.org/en/download/))
- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Google Safe Browsing API Key](https://developers.google.com/safe-browsing/v4/get-started)
- [VirusTotal API Key](https://www.virustotal.com/gui/my-apikey)
- [HaveIBeenPwned API Key](https://haveibeenpwned.com/API/Key)
- [Exa API Key](https://exa.ai/) (for MCP)
- [URLScan.io API Key](https://urlscan.io/user/signup)
- [AbuseIPDB API Key](https://www.abuseipdb.com/) (optional - 1,000 free requests/day)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd webwatcher
```

2. Install backend dependencies:
```bash
cd apps/backend
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `apps/backend/.env` and add your API keys:
```env
OPENAI_API_KEY=your_openai_api_key
GOOGLE_SAFE_BROWSING_API_KEY=your_gsb_key
VIRUSTOTAL_API_KEY=your_vt_key
HIBP_API_KEY=your_hibp_key
EXA_API_KEY=your_exa_key
URLSCAN_API_KEY=your_urlscan_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
```

### Running the Application

#### Development Mode
```bash
cd apps/backend
npm run dev:server
```

#### Production Mode
```bash
cd apps/backend
npm run build
npm start
```

Then open your browser to: **http://localhost:8080**

## 📖 Usage

### Web Interface

The web interface provides four quick actions:

1. **Scan URL** - Comprehensive phishing and malware detection
2. **Check Domain** - Reputation and threat intelligence analysis
3. **Analyze Email** - Phishing detection and sender verification
4. **Breach Check** - Search data breach databases

Simply type your query in natural language:
- "Scan https://suspicious-site.com for threats"
- "Check domain reputation for example.com"
- "Analyze email from sender@suspicious-domain.com"
- "Check if user@example.com has been breached"

### API Endpoints

#### Security Analysis APIs

**Layer A: URL & Page Analysis**
```bash
POST /api/security/analyze-redirects
POST /api/security/scan-page-content
POST /api/security/inspect-forms
POST /api/security/audit-tls
```

**Layer B: Threat Intelligence**
```bash
POST /api/security/lookup-reputation
POST /api/security/check-whois
POST /api/security/ip-risk-profile
POST /api/security/breach-check
```

**Layer C: Policy & Context**
```bash
POST /api/security/classify-category
POST /api/security/check-policy
POST /api/security/calculate-risk-score
```

**Layer D: Incident Management**
```bash
POST /api/security/generate-incident-report
POST /api/security/submit-feedback
GET  /api/security/feedback-stats
GET  /api/security/recent-incidents
```

**Comprehensive Scan**
```bash
POST /api/security/comprehensive-scan
```

#### Chat API
```bash
POST /api/chat
Body: { "message": "your query here" }
```

## 🔒 Security Features

### Risk Scoring

- **0-24**: Low Risk (Green)
- **25-49**: Medium Risk (Yellow)
- **50-74**: High Risk (Orange)
- **75-100**: Critical Risk (Red)

### Threat Indicators

- Newly registered domains
- Suspicious TLDs
- Privacy-protected registrants
- Bulletproof hosting
- High-risk countries
- Recent data breaches
- Sensitive data exposure

### Multi-Source Verification

- **OpenPhish** - Free phishing URL database (no API key required)
- **Google Safe Browsing** - Malware and phishing detection
- **VirusTotal** - Multi-engine malware scanning
- **HaveIBeenPwned** - Breach detection database
- **URLScan.io** - URL scanning and screenshots
- **RDAP** - Free WHOIS data
- **crt.sh** - Certificate transparency logs (free, no API key)
- **DNS over HTTPS** - DNS intelligence via Google DNS (free)
- **IP Geolocation** - Geographic risk assessment
- **Exa Search (MCP)** - Real-time threat intelligence

## 📁 Project Structure

```
webwatcher/                      # Monorepo root
├── apps/                        # Runnable applications
│   ├── backend/                 # Backend service (Cloud Run)
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── controllers/ # Request handlers
│   │   │   │   ├── routes/      # API routes
│   │   │   │   └── middleware/  # CORS, validation, error handling
│   │   │   ├── services/        # Business logic
│   │   │   │   ├── agent.service.ts
│   │   │   │   ├── url-security.service.ts
│   │   │   │   ├── threat-intel.service.ts
│   │   │   │   ├── incident.service.ts
│   │   │   │   └── policy.service.ts
│   │   │   ├── utils/           # Utilities
│   │   │   │   ├── manual-tools.ts
│   │   │   │   ├── letta-client.ts
│   │   │   │   └── logger.ts
│   │   │   ├── config/          # Configuration
│   │   │   │   ├── server.config.ts
│   │   │   │   └── agent.config.ts
│   │   │   ├── types/           # TypeScript types
│   │   │   ├── integrations/    # External integrations
│   │   │   └── server.ts        # Main server entry
│   │   ├── configs/             # Config files
│   │   ├── data/                # Runtime data
│   │   ├── docs/                # Backend docs
│   │   ├── scripts/             # Backend scripts
│   │   ├── tests/               # Tests
│   │   ├── tools/               # Development tools
│   │   ├── Dockerfile           # Container config
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/                # Frontend (Vercel)
│       ├── api/                 # Vercel serverless functions
│       ├── js/                  # JavaScript files
│       ├── index.html           # Main web interface
│       ├── package.json
│       ├── vercel.json          # Vercel config
│       └── _vercel_build.sh     # Build script
├── packages/                    # Shared packages
│   └── mcp/                     # MCP server implementations
│       ├── exa-mcp.ts
│       └── webwatcher-mcp.ts
├── infra/                       # Infrastructure as code
│   └── cloudrun/
│       └── cloudbuild.yaml
├── scripts/                     # Deployment & utility scripts
│   ├── deploy-cloudrun.sh
│   ├── set-cloudrun-env.sh
│   ├── simulate-cloudrun-deploy.sh
│   └── start-server.sh
├── docs/                        # Documentation
│   ├── architecture.md
│   └── monorepo-guide.md
├── data/                        # Application data
│   └── incidents/               # Incident reports (JSON)
├── private/                     # Private files (gitignored)
│   ├── configs/                 # Private configs
│   ├── data/                    # Private data
│   ├── docs/                    # Internal docs
│   ├── keys/                    # API keys
│   └── logs/                    # Log files
├── cloudbuild.yaml              # Cloud Build config
├── package.json                 # Monorepo root config
├── tsconfig.base.json           # Shared TypeScript config
└── agent-manifest.json          # Agent metadata
```

## 🛠️ Development

### Adding New Security Checks

1. Create service in `src/services/`
2. Add controller in `src/api/controllers/`
3. Register route in `src/api/routes/`
4. Update manual tools if needed

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Google Safe Browsing | Yes |
| `VIRUSTOTAL_API_KEY` | VirusTotal API | Yes |
| `HIBP_API_KEY` | HaveIBeenPwned API | Yes |
| `EXA_API_KEY` | Exa search (MCP) | Yes |
| `URLSCAN_API_KEY` | URLScan.io API | Yes |
| `ABUSEIPDB_API_KEY` | AbuseIPDB (IP abuse detection) | No |

## 📊 Features in Detail

### HaveIBeenPwned Integration

- Real-time breach checking
- 235+ breach databases
- Detailed breach information
- Risk scoring based on:
  - Number of breaches
  - Recency of breaches
  - Sensitivity of exposed data

### MCP (Model Context Protocol)

- Real-time threat intelligence via Exa
- Latest phishing campaigns
- Security news and advisories
- Breach intelligence

### A2A (Agent-to-Agent) Protocol

- Coordinated multi-agent analysis
- Specialized agent roles:
  - UrlScanAgent
  - ThreatIntelAgent
  - PhishingDetectorAgent
  - HaveIBeenPwnedAgent
  - RiskAssessmentAgent

## 📄 License

Apache-2.0

## 🙏 Acknowledgments

- Built with LangChain and OpenAI
- Integrated with HaveIBeenPwned, VirusTotal, Google Safe Browsing
- MCP protocol via Exa

## 🔗 Resources

- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- [Google Safe Browsing](https://developers.google.com/safe-browsing)
- [VirusTotal API](https://developers.virustotal.com/)
- [Exa Search](https://exa.ai/)

---

**Pure Web2 Cybersecurity Agent for Everyone** 🛡️
