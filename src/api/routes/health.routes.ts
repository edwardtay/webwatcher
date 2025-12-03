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
    res.sendFile(path.join(process.cwd(), 'frontend', 'index.html'));
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

// Agent card for A2A discovery
router.get('/.well-known/agent.json', (_req, res) => {
  const agentCard = {
    id: 'webwatcher-phish-checker',
    name: 'WebWatcher Phishing URL Checker',
    description: 'Cybersecurity agent that inspects a URL and reports phishing red flags using an internal A2A pipeline.',
    version: '1.0.0',
    author: {
      name: 'NetWatch Team',
      contact: 'https://github.com/edwardtay/webwatcher',
    },
    license: 'Apache-2.0',
    repository: 'https://github.com/edwardtay/webwatcher',
    tags: ['cybersecurity', 'phishing', 'url-analysis', 'security', 'a2a', 'mcp'],
    agentUrl: serverConfig.agentBaseUrl,
    baseUrl: serverConfig.agentBaseUrl,
    protocols: ['A2A', 'MCP', 'HTTP'],
    capabilities: {
      functions: [
        {
          name: 'checkUrl',
          description: 'Analyze a URL and return phishing red flags using A2A coordination.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to analyze for phishing indicators.',
              },
            },
            required: ['url'],
          },
        },
      ],
      a2a: {
        version: '1.0',
        agentType: 'security_analyst',
        discoveryEndpoint: '/.well-known/agent.json',
        messageTypes: ['discovery', 'task_request', 'task_response', 'status'],
        coordinationTypes: [
          'vulnerability_scan',
          'incident_response',
          'compliance_check',
          'threat_analysis',
          'remediation',
          'url_analysis',
        ],
        canCoordinateWith: ['scanner', 'triage', 'fix', 'governance'],
        internalAgents: [
          {
            name: 'UrlFeatureAgent',
            role: 'Extract URL features and structural analysis',
          },
          {
            name: 'UrlScanAgent',
            role: 'Call urlscan.io API for security scanning',
          },
          {
            name: 'PhishingRedFlagAgent',
            role: 'Analyze and flag phishing indicators',
          },
        ],
      },
      mcp: {
        version: '2024-11-05',
        servers: [
          {
            name: 'exa-mcp',
            description: 'Exa AI semantic web search via MCP',
            transport: ['stdio', 'http'],
            tools: ['exa_search'],
          },
        ],
      },
    },
    endpoints: {
      checkUrl: {
        method: 'POST',
        path: '/check',
        description: 'A2A endpoint for URL phishing analysis',
      },
      chat: {
        method: 'POST',
        path: '/api/chat',
        description: 'General chat endpoint with MCP and A2A support',
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
