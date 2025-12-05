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
// Implements A2A v0.2.6 spec: accepts standard MessageSendParams
async function handleMessageSend(params: any): Promise<any> {
  const { message, metadata, configuration } = params;
  
  // Log incoming request for debugging
  logger.info('message/send params:', {
    hasMessage: !!message,
    hasMetadata: !!metadata,
    hasConfiguration: !!configuration,
    messageKeys: message ? Object.keys(message) : [],
    metadataKeys: metadata ? Object.keys(metadata) : [],
  });
  
  // Extract skill from metadata (optional, per A2A spec)
  let skill = metadata?.skillId || metadata?.skill;
  
  // Extract data from message parts
  let skillParams: any = {};
  if (message?.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.kind === 'data' && part.data) {
        skillParams = { ...skillParams, ...part.data };
      } else if (part.kind === 'text' && part.text) {
        // Store text content for auto-routing
        skillParams._textContent = part.text;
      }
    }
  }
  
  // Also check if message itself has content (some tools send it differently)
  if (message?.content) {
    if (typeof message.content === 'string') {
      skillParams._textContent = message.content;
    } else if (typeof message.content === 'object') {
      skillParams = { ...skillParams, ...message.content };
    }
  }

  // Extract parameters from text content if needed
  extractParametersFromText(skillParams);
  
  // Auto-route if no explicit skill provided
  if (!skill) {
    skill = autoRouteSkill(skillParams);
  }
  
  logger.info('Routing to skill:', { skill, extractedParams: Object.keys(skillParams) });

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

// Extract parameters from text content
function extractParametersFromText(params: any): void {
  if (!params._textContent) return;
  
  const text = params._textContent.trim();
  const textLower = text.toLowerCase();
  
  // Try to extract URL from text (with http/https)
  if (!params.url) {
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      params.url = urlMatch[0];
      logger.info('Extracted URL from text:', params.url);
      return; // Found URL, done
    }
  }
  
  // Try to extract email from text
  if (!params.email) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      params.email = emailMatch[0];
      logger.info('Extracted email from text:', params.email);
      return; // Found email, done
    }
  }
  
  // Fallback: If text looks like a URL/domain but didn't match patterns above
  // This handles cases like "example.com" without http:// or plain text URLs
  // Prefer treating as URL (for scanning) rather than domain (for WHOIS)
  if (!params.url && !params.email && !params.domain) {
    // Check if it's a simple domain-like string
    if (text.includes('.') && !text.includes(' ') && text.length < 200) {
      // Check if it looks like a domain
      const domainMatch = text.match(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i);
      if (domainMatch) {
        // Plain domain - treat as URL for scanning (more useful than WHOIS)
        params.url = 'https://' + text;
        logger.info('Fallback: treating plain domain as URL for scanning:', params.url);
      } else if (!text.startsWith('http://') && !text.startsWith('https://')) {
        params.url = 'https://' + text;
        logger.info('Fallback: treating text as URL with https://', params.url);
      } else {
        params.url = text;
        logger.info('Fallback: treating text as URL', params.url);
      }
    }
  }
}

// Auto-route to appropriate skill based on parameters
function autoRouteSkill(params: any): string {
  // Check for explicit parameters first
  if (params.url) return 'scanUrl';
  if (params.domain) return 'checkDomain';
  if (params.email) {
    // Distinguish between email analysis and breach check
    // If text mentions "breach" or "pwned", use breachCheck
    const textContent = params._textContent?.toLowerCase() || '';
    if (textContent.includes('breach') || textContent.includes('pwned') || textContent.includes('leak')) {
      return 'breachCheck';
    }
    return 'analyzeEmail';
  }
  
  // Keyword-based routing as fallback
  const textContent = params._textContent?.toLowerCase() || '';
  if (textContent.includes('url') || textContent.includes('http')) return 'scanUrl';
  if (textContent.includes('domain')) return 'checkDomain';
  if (textContent.includes('email')) return 'analyzeEmail';
  if (textContent.includes('breach')) return 'breachCheck';
  
  // Default to scanUrl as it's the most common use case
  return 'scanUrl';
}

// Tool handlers
async function handleScanUrl(parameters: any): Promise<any> {
  if (!parameters?.url) {
    logger.error('scanUrl missing url parameter:', { 
      receivedParams: parameters,
      paramKeys: Object.keys(parameters || {}),
    });
    throw new Error(`Missing required parameter: url. Received parameters: ${JSON.stringify(Object.keys(parameters || {}))}`);
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
