/**
 * A2A (Agent-to-Agent) Protocol Controller
 * Implements A2A v0.2.6 specification
 */
import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import * as urlSecurityService from '../../services/url-security.service';
import * as threatIntelService from '../../services/threat-intel.service';

interface A2ARequest {
  id?: string;
  type: 'request' | 'response' | 'error' | 'notification';
  from?: {
    agentId: string;
    url?: string;
  };
  to?: {
    agentId: string;
    url?: string;
  };
  tool?: string;
  parameters?: Record<string, any>;
  timestamp?: string;
}

interface A2AResponse {
  id?: string;
  type: 'response' | 'error';
  from: {
    agentId: string;
    url: string;
  };
  to?: {
    agentId: string;
    url?: string;
  };
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export async function handleA2ARequest(req: Request, res: Response): Promise<void> {
  try {
    const a2aRequest: A2ARequest = req.body;
    
    logger.info('A2A request received:', {
      id: a2aRequest.id,
      type: a2aRequest.type,
      tool: a2aRequest.tool,
      from: a2aRequest.from?.agentId,
    });

    // Validate request
    if (!a2aRequest.type) {
      res.status(400).json(createErrorResponse(
        a2aRequest,
        'INVALID_REQUEST',
        'Missing required field: type'
      ));
      return;
    }

    // Handle different message types
    switch (a2aRequest.type) {
      case 'request':
        await handleToolRequest(a2aRequest, res);
        break;
      
      case 'notification':
        // Acknowledge notification
        res.status(200).json({
          type: 'response',
          id: a2aRequest.id,
          status: 'acknowledged',
          timestamp: new Date().toISOString(),
        });
        break;
      
      default:
        res.status(400).json(createErrorResponse(
          a2aRequest,
          'UNSUPPORTED_TYPE',
          `Message type '${a2aRequest.type}' is not supported`
        ));
    }
  } catch (error: any) {
    logger.error('A2A request error:', error);
    res.status(500).json(createErrorResponse(
      req.body,
      'INTERNAL_ERROR',
      error.message || 'Internal server error'
    ));
  }
}

async function handleToolRequest(a2aRequest: A2ARequest, res: Response): Promise<void> {
  const { tool, parameters } = a2aRequest;

  if (!tool) {
    res.status(400).json(createErrorResponse(
      a2aRequest,
      'MISSING_TOOL',
      'Tool name is required for request type'
    ));
    return;
  }

  try {
    let result: any;

    // Route to appropriate tool handler
    switch (tool) {
      case 'scanUrl':
        result = await handleScanUrl(parameters);
        break;
      
      case 'checkDomain':
        result = await handleCheckDomain(parameters);
        break;
      
      case 'analyzeEmail':
        result = await handleAnalyzeEmail(parameters);
        break;
      
      case 'breachCheck':
        result = await handleBreachCheck(parameters);
        break;
      
      default:
        res.status(404).json(createErrorResponse(
          a2aRequest,
          'TOOL_NOT_FOUND',
          `Tool '${tool}' is not available`
        ));
        return;
    }

    // Send success response
    res.status(200).json(createSuccessResponse(a2aRequest, result));
  } catch (error: any) {
    logger.error(`Tool execution error (${tool}):`, error);
    res.status(500).json(createErrorResponse(
      a2aRequest,
      'TOOL_EXECUTION_ERROR',
      error.message || 'Tool execution failed',
      { tool, error: error.toString() }
    ));
  }
}

// Tool handlers
async function handleScanUrl(parameters: any): Promise<any> {
  if (!parameters?.url) {
    throw new Error('Missing required parameter: url');
  }

  // Validate URL format and prevent SSRF
  try {
    const urlObj = new URL(parameters.url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol. Only http and https are allowed');
    }
    // Prevent localhost/internal network access
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.16.')) {
      throw new Error('Access to internal networks is not allowed');
    }
  } catch (error: any) {
    throw new Error(`Invalid URL: ${error.message}`);
  }

  const scanResult = await urlSecurityService.scanPageContent(parameters.url);
  const reputationResult = await threatIntelService.lookupReputation(parameters.url);
  
  // Calculate risk score from both sources
  let riskScore = Math.max(scanResult.riskScore, reputationResult.riskScore);
  const threats: string[] = [...scanResult.flags, ...reputationResult.flags];
  
  // Add source-specific threats
  reputationResult.sources.forEach(source => {
    if (source.status === 'malicious') {
      threats.push(`${source.name}: Malicious detected`);
    } else if (source.status === 'suspicious') {
      threats.push(`${source.name}: Suspicious activity`);
    }
  });
  
  const verdict = riskScore >= 50 ? 'malicious' : riskScore >= 25 ? 'suspicious' : 'safe';
  
  return {
    riskScore,
    verdict,
    threats,
    details: {
      scan: scanResult,
      reputation: reputationResult,
    },
  };
}

async function handleCheckDomain(parameters: any): Promise<any> {
  if (!parameters?.domain) {
    throw new Error('Missing required parameter: domain');
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(parameters.domain)) {
    throw new Error('Invalid domain format');
  }

  const whoisResult = await threatIntelService.checkWhoisAndAge(parameters.domain);
  
  return {
    riskScore: whoisResult.riskScore,
    ageInDays: whoisResult.ageInDays,
    registrar: whoisResult.registrar,
    flags: whoisResult.flags,
    details: whoisResult,
  };
}

async function handleAnalyzeEmail(parameters: any): Promise<any> {
  if (!parameters?.email) {
    throw new Error('Missing required parameter: email');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(parameters.email)) {
    throw new Error('Invalid email format');
  }

  // Extract domain from email
  const domain = parameters.email.split('@')[1];
  const threats: string[] = [];
  let phishingScore = 0;
  
  if (domain) {
    const whoisResult = await threatIntelService.checkWhoisAndAge(domain);
    if (whoisResult.ageInDays < 30) {
      threats.push('Domain is newly registered');
      phishingScore += 30;
    }
  }
  
  // Check for common phishing patterns
  const suspiciousPatterns = [
    'verify', 'urgent', 'suspended', 'confirm', 'update',
    'secure', 'account', 'click here', 'act now'
  ];
  
  const emailLower = parameters.email.toLowerCase();
  suspiciousPatterns.forEach(pattern => {
    if (emailLower.includes(pattern)) {
      phishingScore += 5;
    }
  });
  
  return {
    phishingScore: Math.min(phishingScore, 100),
    threats,
    extractedUrls: [],
    details: {
      domain,
      analysis: 'Email security analysis completed',
    },
  };
}

async function handleBreachCheck(parameters: any): Promise<any> {
  if (!parameters?.email) {
    throw new Error('Missing required parameter: email');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(parameters.email)) {
    throw new Error('Invalid email format');
  }

  const breachResult = await threatIntelService.checkHaveIBeenPwned(parameters.email);
  
  return {
    totalBreaches: breachResult.breaches?.length || 0,
    riskScore: breachResult.riskScore || 0,
    breaches: breachResult.breaches || [],
    details: breachResult,
  };
}

// Helper functions
function createSuccessResponse(request: A2ARequest, result: any): A2AResponse {
  return {
    id: request.id,
    type: 'response',
    from: {
      agentId: 'webwatcher-cybersecurity-agent',
      url: process.env.AGENT_BASE_URL || 'https://webwatcher.lever-labs.com',
    },
    to: request.from,
    result,
    timestamp: new Date().toISOString(),
  };
}

function createErrorResponse(
  request: A2ARequest,
  code: string,
  message: string,
  details?: any
): A2AResponse {
  return {
    id: request.id,
    type: 'error',
    from: {
      agentId: 'webwatcher-cybersecurity-agent',
      url: process.env.AGENT_BASE_URL || 'https://webwatcher.lever-labs.com',
    },
    to: request.from,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}
