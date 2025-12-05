/**
 * Health and info routes
 */
import { Router } from 'express';
import path from 'path';
import { isLettaEnabled } from '../../utils/letta-client';
import { serverConfig } from '../../config/server.config';

const router = Router();

// Health check
router.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// Root page - API info
router.get('/', (_req, res) => {
  if (serverConfig.nodeEnv === 'development' || serverConfig.serveFrontend) {
    res.sendFile(path.join(process.cwd(), '..', 'frontend', 'index.html'));
  } else {
    res.status(200).json({
      service: 'WebWatcher API',
      status: 'running',
      agentId: 'webwatcher-phish-checker',
      protocols: ['A2A', 'MCP', 'HTTP'],
      endpoints: {
        agentCard: 'GET /.well-known/agent.json',
        chat: 'POST /api/chat',
        check: 'POST /check',
        health: 'GET /healthz',
        resolveEns: 'POST /api/resolve-ens',
        walletAnalyze: 'POST /api/wallet/analyze',
      },
      frontend: 'Deployed separately on Vercel',
      capabilities: {
        a2a: 'Agent-to-Agent coordination enabled',
        mcp: 'Model Context Protocol enabled',
        letta: isLettaEnabled() ? 'Autonomous learning enabled' : 'Not configured',
        autonomous: 'Automatic URL detection, risk escalation, multi-agent coordination',
        realTime: 'Exa MCP for latest threat intelligence, urlscan.io for live scans',
      },
    });
  }
});

// Capabilities endpoint
router.get('/capabilities', (_req, res) => {
  res.status(200).json({
    autonomy: {
      automaticUrlDetection: true,
      intentRecognition: true,
      riskBasedEscalation: true,
      autonomousLearning: isLettaEnabled(),
    },
    realTimeData: {
      exaMCP: true,
      urlscanIO: true,
      cveDatabase: true,
      threatIntelligence: true,
    },
    coordination: {
      a2aProtocol: true,
      multiAgentWorkflows: true,
      automaticDiscovery: true,
      contextAware: true,
    },
    learning: {
      lettaIntegration: isLettaEnabled(),
      patternRecognition: isLettaEnabled(),
      continuousImprovement: isLettaEnabled(),
      longTermMemory: isLettaEnabled(),
    },
    technical: {
      protocols: ['A2A', 'MCP', 'HTTP'],
      frameworks: ['AgentKit', 'LangChain', 'Letta'],
      deployment: 'Cloud Run + Vercel',
      scalability: 'Auto-scaling',
    },
  });
});

// Agent card for A2A discovery (A2A v0.2.6 compliant)
router.get('/.well-known/agent.json', (_req, res) => {
  const agentCard = {
    // Core A2A v0.2.6 required fields
    name: 'WebWatcher Cybersecurity Intelligence Platform',
    description: 'Advanced cybersecurity agent providing real-time threat analysis, breach detection, URL/domain scanning, email security analysis, and comprehensive security intelligence through AI-powered multi-agent coordination.',
    url: serverConfig.agentBaseUrl,
    
    // A2A v0.2.6 recommended fields
    version: '2.0.0',
    author: {
      name: 'Lever Labs',
      url: 'https://lever-labs.com',
      contact: 'support@lever-labs.com',
    },
    license: 'Apache-2.0',
    
    // Additional metadata
    id: 'webwatcher-cybersecurity-agent',
    repository: 'https://github.com/edwardtay/webwatcher',
    tags: ['cybersecurity', 'threat-intelligence', 'phishing-detection', 'breach-checking', 'url-scanning', 'domain-analysis', 'email-security', 'malware-detection', 'a2a', 'mcp'],
    // A2A v0.2.6 capabilities structure
    capabilities: {
      // Tools/functions the agent can perform
      tools: [
        {
          name: 'scanUrl',
          description: 'Comprehensive URL security scan including phishing detection, malware scanning, redirect chain analysis, TLS/SSL validation, and multi-source reputation checking.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to scan for security threats and phishing indicators.',
              },
            },
            required: ['url'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              riskScore: { type: 'number', minimum: 0, maximum: 100 },
              verdict: { type: 'string', enum: ['safe', 'suspicious', 'malicious'] },
              threats: { type: 'array', items: { type: 'string' } },
              details: { type: 'object' },
            },
          },
        },
        {
          name: 'checkDomain',
          description: 'Domain intelligence analysis including WHOIS data, domain age, registrar verification, IP risk profiling, hosting provider analysis, and suspicious TLD detection.',
          inputSchema: {
            type: 'object',
            properties: {
              domain: {
                type: 'string',
                description: 'Domain name to analyze (e.g., example.com).',
              },
            },
            required: ['domain'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              riskScore: { type: 'number' },
              ageInDays: { type: 'number' },
              registrar: { type: 'string' },
              flags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        {
          name: 'analyzeEmail',
          description: 'Email security analysis including phishing pattern detection, sender reputation analysis, URL extraction and scanning, and latest phishing campaign intelligence.',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email address or email content to analyze for phishing and security threats.',
              },
            },
            required: ['email'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              phishingScore: { type: 'number' },
              threats: { type: 'array' },
              extractedUrls: { type: 'array' },
            },
          },
        },
        {
          name: 'breachCheck',
          description: 'Data breach detection using HaveIBeenPwned API to check for credential leaks, breach history, risk scoring, and exposed data type identification.',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email address to check for data breaches and credential leaks.',
              },
            },
            required: ['email'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalBreaches: { type: 'number' },
              riskScore: { type: 'number' },
              breaches: { type: 'array' },
            },
          },
        },
      ],
      // A2A protocol specific capabilities
      protocols: {
        a2a: {
          version: '0.2.6',
          endpoint: '/api/a2a',
          supportedMessageTypes: ['request', 'response', 'error', 'notification'],
          authentication: {
            required: false,
            methods: ['bearer', 'api_key'],
          },
        },
        http: {
          version: '1.1',
          methods: ['GET', 'POST'],
        },
      },
      
      // Agent type and coordination
      agentType: 'security_analyst',
      coordinationTypes: [
        'vulnerability_scan',
        'incident_response',
        'compliance_check',
        'threat_analysis',
        'remediation',
        'url_analysis',
        'domain_intelligence',
        'email_security',
        'breach_detection',
        'malware_scanning',
      ],
      canCoordinateWith: ['scanner', 'triage', 'fix', 'governance', 'threat_intel', 'incident_response'],
      
      // Internal agent architecture
      internalAgents: [
        {
          name: 'UrlScanAgent',
          type: 'scanner',
          capabilities: ['url_scanning', 'redirect_analysis', 'tls_validation'],
          description: 'URL security scanning via URLScan.io API and redirect chain analysis',
        },
        {
          name: 'ThreatIntelAgent',
          type: 'intelligence',
          capabilities: ['reputation_lookup', 'threat_feeds', 'malware_detection'],
          description: 'Multi-source threat intelligence via Google Safe Browsing, VirusTotal, and Exa MCP',
        },
        {
          name: 'PhishingDetectorAgent',
          type: 'analyzer',
          capabilities: ['phishing_detection', 'pattern_matching', 'red_flag_analysis'],
          description: 'Phishing pattern detection and red flag analysis',
        },
        {
          name: 'HaveIBeenPwnedAgent',
          type: 'breach_checker',
          capabilities: ['breach_detection', 'credential_leak_checking'],
          description: 'Data breach detection and credential leak checking',
        },
        {
          name: 'DomainIntelAgent',
          type: 'intelligence',
          capabilities: ['whois_lookup', 'domain_age_verification', 'registrar_checks'],
          description: 'WHOIS analysis, domain age verification, and registrar checks',
        },
        {
          name: 'RiskAssessmentAgent',
          type: 'assessor',
          capabilities: ['risk_scoring', 'policy_compliance', 'incident_reporting'],
          description: 'Risk scoring, policy compliance, and incident report generation',
        },
      ],
      mcp: {
        version: '2024-11-05',
        protocol: 'Model Context Protocol',
        servers: [
          {
            name: 'exa-mcp',
            provider: 'Exa AI',
            purpose: 'Semantic web search for real-time threat intelligence',
            capabilities: ['threat_intelligence', 'phishing_campaigns', 'security_news'],
            transport: ['stdio', 'http'],
            tools: ['exa_search'],
          },
        ],
      },
      securityApis: {
        googleSafeBrowsing: {
          name: 'Google Safe Browsing',
          purpose: 'Malware and phishing detection',
        },
        virusTotal: {
          name: 'VirusTotal',
          purpose: 'Multi-engine malware scanning',
        },
        haveIBeenPwned: {
          name: 'HaveIBeenPwned',
          purpose: 'Breach detection database',
          coverage: '235+ breaches',
        },
        urlScanIO: {
          name: 'URLScan.io',
          purpose: 'URL scanning and screenshots',
        },
        abuseIPDB: {
          name: 'AbuseIPDB',
          purpose: 'IP abuse detection',
        },
        rdap: {
          name: 'RDAP',
          purpose: 'WHOIS data and domain intelligence',
        },
        dnsOverHttps: {
          name: 'DNS over HTTPS',
          purpose: 'DNS intelligence via Google DNS',
        },
      },
      riskScoring: {
        low: {
          range: '0-24',
          level: 'Green',
        },
        medium: {
          range: '25-49',
          level: 'Yellow',
        },
        high: {
          range: '50-74',
          level: 'Orange',
        },
        critical: {
          range: '75-100',
          level: 'Red',
        },
      },
    },
    endpoints: {
      chat: {
        method: 'POST',
        path: '/api/chat',
        description: 'Natural language security analysis with automatic intent detection',
      },
      comprehensiveScan: {
        method: 'POST',
        path: '/api/security/comprehensive-scan',
        description: 'Full security scan with all layers (URL, threat intel, policy, incident)',
      },
      urlScan: {
        method: 'POST',
        path: '/api/security/scan-page-content',
        description: 'URL and page content security analysis',
      },
      domainCheck: {
        method: 'POST',
        path: '/api/security/check-whois',
        description: 'Domain intelligence and WHOIS analysis',
      },
      breachCheck: {
        method: 'POST',
        path: '/api/security/breach-check',
        description: 'HaveIBeenPwned breach detection',
      },
      reputationLookup: {
        method: 'POST',
        path: '/api/security/lookup-reputation',
        description: 'Multi-source reputation checking',
      },
      riskScore: {
        method: 'POST',
        path: '/api/security/calculate-risk-score',
        description: 'Calculate comprehensive risk score',
      },
      incidentReport: {
        method: 'POST',
        path: '/api/security/generate-incident-report',
        description: 'Generate detailed incident report',
      },
      health: {
        method: 'GET',
        path: '/healthz',
        description: 'Health check endpoint',
      },
      agentCard: {
        method: 'GET',
        path: '/.well-known/agent.json',
        description: 'Agent discovery endpoint',
      },
    },
  };
  
  res.json(agentCard);
});

export default router;
