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

    // A2A protocol methods
    if (method === 'message/send') {
      result = await handleMessageSend(params);
    } else if (method === 'message/stream') {
      // Handle streaming separately - it uses SSE
      await handleMessageStream(a2aRequest, res);
      return; // Don't send JSON response for streaming
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

  // Execute the skill with error handling
  let skillResult: any;
  let taskStatus = 'completed';
  
  try {
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
  } catch (error: any) {
    // Handle errors gracefully - return a helpful response instead of throwing
    logger.error('Skill execution error:', { skill, error: error.message });
    
    taskStatus = 'failed';
    skillResult = {
      error: true,
      message: getHelpfulErrorMessage(error, skill, skillParams),
      suggestion: getSuggestionForInput(skillParams._textContent),
      acceptedInputs: getAcceptedInputsForSkill(skill),
    };
  }

  // Return in A2A v0.2.6 format - Direct message response
  // This is the simplest format: just return a Message object
  return {
    messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contextId: message?.messageId || `ctx-${Date.now()}`,
    kind: 'message',
    role: 'agent',  // Must be 'agent' not 'assistant' per A2A spec
    parts: [
      {
        kind: 'text',
        text: JSON.stringify({
          status: taskStatus,
          result: skillResult,
        }, null, 2),
      },
    ],
    metadata: {},
  };
}

// A2A message/stream handler - Server-Sent Events streaming
async function handleMessageStream(a2aRequest: A2ARequest, res: Response): Promise<void> {
  const { params, id } = a2aRequest;
  const { message, metadata } = params || {};
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const contextId = message?.messageId || `ctx-${Date.now()}`;
  
  // Helper to send SSE data
  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    // 1. Send task submitted event
    sendEvent({
      id,
      jsonrpc: '2.0',
      result: {
        contextId,
        history: [message],
        id: taskId,
        kind: 'task',
        status: { state: 'submitted' },
      },
    });
    
    // 2. Send working status
    sendEvent({
      id,
      jsonrpc: '2.0',
      result: {
        contextId,
        final: false,
        kind: 'status-update',
        status: {
          message: {
            contextId,
            kind: 'message',
            messageId: `msg-${Date.now()}-working`,
            parts: [{ kind: 'text', text: 'Processing security scan...' }],
            role: 'agent',
            taskId,
          },
          state: 'working',
          timestamp: new Date().toISOString(),
        },
        taskId,
      },
    });
    
    // 3. Execute the actual skill (same as message/send)
    let skill = metadata?.skillId || metadata?.skill;
    let skillParams: any = {};
    
    if (message?.parts && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (part.kind === 'data' && part.data) {
          skillParams = { ...skillParams, ...part.data };
        } else if (part.kind === 'text' && part.text) {
          skillParams._textContent = part.text;
        }
      }
    }
    
    extractParametersFromText(skillParams);
    
    if (!skill) {
      skill = autoRouteSkill(skillParams);
    }
    
    let skillResult: any;
    let taskStatus = 'completed';
    
    try {
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
    } catch (error: any) {
      taskStatus = 'failed';
      skillResult = {
        error: true,
        message: getHelpfulErrorMessage(error, skill, skillParams),
        suggestion: getSuggestionForInput(skillParams._textContent),
        acceptedInputs: getAcceptedInputsForSkill(skill),
      };
    }
    
    // 4. Send result message
    const resultText = JSON.stringify({ status: taskStatus, result: skillResult }, null, 2);
    sendEvent({
      id,
      jsonrpc: '2.0',
      result: {
        contextId,
        final: false,
        kind: 'status-update',
        status: {
          message: {
            contextId,
            kind: 'message',
            messageId: `msg-${Date.now()}-result`,
            parts: [{ kind: 'text', text: resultText }],
            role: 'agent',
            taskId,
          },
          state: 'working',
          timestamp: new Date().toISOString(),
        },
        taskId,
      },
    });
    
    // 5. Send completion event
    sendEvent({
      id,
      jsonrpc: '2.0',
      result: {
        contextId,
        final: true,
        kind: 'status-update',
        status: {
          state: taskStatus === 'completed' ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
        },
        taskId,
      },
    });
    
  } catch (error: any) {
    logger.error('Stream error:', error);
    sendEvent({
      id,
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
    });
  } finally {
    res.end();
  }
}

// Extract parameters from text content
function extractParametersFromText(params: any): void {
  if (!params._textContent) {
    logger.warn('No _textContent to extract from');
    return;
  }
  
  const text = params._textContent.trim();
  logger.info('Extracting parameters from text:', { text, length: text.length });
  
  // Already have explicit parameters, skip extraction
  if (params.url || params.email || params.domain) {
    logger.info('Already have explicit parameters, skipping extraction');
    return;
  }
  
  // Try to extract URL from text (with http/https)
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    params.url = urlMatch[0];
    logger.info('Extracted URL with protocol:', params.url);
    return;
  }
  
  // Try to extract email from text
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    params.email = emailMatch[0];
    logger.info('Extracted email:', params.email);
    return;
  }
  
  // Fallback: treat text as URL if it looks domain-like
  // This is the most common case for the inspector
  if (text.includes('.') && text.length < 200) {
    // Add https:// if not present
    params.url = text.startsWith('http://') || text.startsWith('https://') 
      ? text 
      : 'https://' + text;
    logger.info('Fallback: treating text as URL:', params.url);
    return;
  }
  
  // Final fallback: if text doesn't look like anything specific,
  // try to use it as a URL anyway (will fail gracefully if invalid)
  if (text.length > 0 && text.length < 200) {
    // Check if it might be a domain without TLD (like "localhost" or "google")
    // or just random text - try adding .com and https://
    if (!text.includes(' ') && !text.includes('@')) {
      params.url = text.startsWith('http://') || text.startsWith('https://') 
        ? text 
        : 'https://' + text + '.com';
      logger.info('Final fallback: treating text as potential domain:', params.url);
      return;
    }
  }
  
  logger.warn('Could not extract any parameters from text:', text);
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

// Helper function to provide user-friendly error messages
function getHelpfulErrorMessage(error: any, skill: string, params: any): string {
  const errorMsg = error.message || error.toString();
  
  // DNS/Network errors
  if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
    const url = params.url || 'unknown';
    return `The domain "${url}" could not be found. Please check if it's a valid domain or URL.`;
  }
  
  // Connection errors
  if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ECONNRESET')) {
    return `Could not connect to the specified URL. The server may be down or unreachable.`;
  }
  
  // Timeout errors
  if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
    return `The request timed out. The server took too long to respond.`;
  }
  
  // Invalid URL errors
  if (errorMsg.includes('Invalid URL')) {
    return `The provided input is not a valid URL format.`;
  }
  
  // Missing parameter errors
  if (errorMsg.includes('Missing required parameter')) {
    return errorMsg;
  }
  
  // Generic error
  return `An error occurred while processing your request: ${errorMsg}`;
}

// Helper function to suggest correct input format
function getSuggestionForInput(text: string): string {
  if (!text) {
    return 'Please provide a URL (e.g., google.com, https://example.com), email address, or domain name.';
  }
  
  // If text doesn't look like a URL/email/domain
  if (!text.includes('.') && !text.includes('@') && !text.startsWith('http')) {
    return 'Your input doesn\'t appear to be a URL, email, or domain. Try: "google.com", "test@example.com", or "https://example.com"';
  }
  
  return 'Try providing a complete URL with protocol (e.g., https://example.com) or a valid domain name.';
}

// Helper function to list accepted inputs for each skill
function getAcceptedInputsForSkill(skill: string): any {
  const inputs: Record<string, any> = {
    scanUrl: {
      description: 'URL Security Scan',
      examples: ['https://google.com', 'example.com', 'http://test.com'],
      format: 'A valid URL or domain name',
    },
    checkDomain: {
      description: 'Domain Intelligence',
      examples: ['google.com', 'example.org', 'test.io'],
      format: 'A domain name without protocol',
    },
    analyzeEmail: {
      description: 'Email Security Analysis',
      examples: ['user@example.com', 'test@gmail.com'],
      format: 'A valid email address',
    },
    breachCheck: {
      description: 'Data Breach Check',
      examples: ['user@example.com', 'test@gmail.com'],
      format: 'A valid email address',
    },
  };
  
  return inputs[skill] || {
    description: 'Unknown skill',
    examples: [],
    format: 'Please check the skill documentation',
  };
}
