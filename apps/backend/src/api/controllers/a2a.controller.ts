/**
 * A2A (Agent-to-Agent) Protocol Controller
 * Implements A2A v0.2.6 specification
 */
import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import * as urlSecurityService from '../../services/url-security.service';
import * as threatIntelService from '../../services/threat-intel.service';

// JSON-RPC 2.0 request format (A2A v0.2.6 requirement)
interface A2ARequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
  id?: string | number;
}

// JSON-RPC 2.0 response format
interface A2AResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export async function handleA2ARequest(req: Request, res: Response): Promise<void> {
  try {
    const a2aRequest: A2ARequest = req.body;
    
    logger.info('A2A JSON-RPC request received:', {
      jsonrpc: a2aRequest.jsonrpc,
      method: a2aRequest.method,
      id: a2aRequest.id,
    });

    // Validate JSON-RPC 2.0 format
    if (a2aRequest.jsonrpc !== '2.0') {
      res.status(400).json(createErrorResponse(
        a2aRequest.id,
        -32600,
        'Invalid Request: jsonrpc must be "2.0"'
      ));
      return;
    }

    if (!a2aRequest.method) {
      res.status(400).json(createErrorResponse(
        a2aRequest.id,
        -32600,
        'Invalid Request: method is required'
      ));
      return;
    }

    // Handle method call
    await handleMethodCall(a2aRequest, res);
    
  } catch (error: any) {
    logger.error('A2A request error:', error);
    res.status(500).json(createErrorResponse(
      req.body.id,
      -32603,
      'Internal error',
      error.message
    ));
  }
}

async function handleMethodCall(a2aRequest: A2ARequest, res: Response): Promise<void> {
  const { method, params } = a2aRequest;

  try {
    let result: any;

    // A2A protocol uses message/send as the wrapper method
    if (method === 'message/send') {
      result = await handleMessageSend(params);
    } else {
      // Direct skill calls (for backward compatibility)
      switch (method) {
        case 'scanUrl':
          result = await handleScanUrl(params);
          break;
        
        case 'checkDomain':
          result = await handleCheckDomain(params);
          break;
        
        case 'analyzeEmail':
          result = await handleAnalyzeEmail(params);
          break;
        
        case 'breachCheck':
          result = await handleBreachCheck(params);
          break;
        
        default:
          res.status(200).json(createErrorResponse(
            a2aRequest.id,
            -32601,
            `Method not found: '${method}'`
          ));
          return;
      }
    }

    // Send success response
    res.status(200).json(createSuccessResponse(a2aRequest.id, result));
  } catch (error: any) {
    logger.error(`Method execution error (${method}):`, error);
    res.status(200).json(createErrorResponse(
      a2aRequest.id,
      -32603,
      error.message || 'Internal error',
      { method, error: error.toString() }
    ));
  }
}

// A2A message/send handler - wraps skill execution
async function handleMessageSend(params: any): Promise<any> {
  if (!params?.skill) {
    throw new Error('Missing required parameter: skill');
  }

  const { skill, message } = params;
  
  // Extract data from message parts
  let skillParams: any = {};
  if (message?.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.kind === 'data' && part.data) {
        skillParams = { ...skillParams, ...part.data };
      }
    }
  }

  // Execute the skill
  let skillResult: any;
  switch (skill) {
    case 'scanUrl':
      skillResult = await handleScanUrl(skillParams);
      break;
    
    case 'checkDomain':
      skillResult = await handleCheckDomain(skillParams);
      break;
    
    case 'analyzeEmail':
      skillResult = await handleAnalyzeEmail(skillParams);
      break;
    
    case 'breachCheck':
      skillResult = await handleBreachCheck(skillParams);
      break;
    
    default:
      throw new Error(`Unknown skill: ${skill}`);
  }

  // Return as a task object (A2A format)
  return {
    task: {
      id: `task-${Date.now()}`,
      status: 'completed',
      result: skillResult,
    },
  };
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
  
  // Clean response - exclude large HTML content
  return {
    riskScore,
    verdict,
    threats,
    details: {
      pageAnalysis: {
        forms: scanResult.dom.forms,
        scripts: scanResult.dom.scripts,
        iframes: scanResult.dom.iframes,
        externalLinks: scanResult.dom.externalLinks,
        flags: scanResult.flags,
      },
      reputation: {
        domain: reputationResult.domain,
        ip: reputationResult.ip,
        sources: reputationResult.sources,
        flags: reputationResult.flags,
      },
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

// Helper functions for JSON-RPC 2.0 responses
function createSuccessResponse(id: string | number | null | undefined, result: any): A2AResponse {
  return {
    jsonrpc: '2.0',
    result,
    id: id ?? null,
  };
}

function createErrorResponse(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: any
): A2AResponse {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data,
    },
    id: id ?? null,
  };
}
