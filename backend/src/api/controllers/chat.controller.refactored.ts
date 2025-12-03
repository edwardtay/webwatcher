/**
 * Refactored Chat Controller
 * Improved structure with separation of concerns
 * 
 * NOTE: This is the refactored version. To use it:
 * 1. Test thoroughly
 * 2. Rename chat.controller.ts to chat.controller.old.ts
 * 3. Rename this file to chat.controller.ts
 */

import { Request, Response } from 'express';
import { structuredLogger } from '../../utils/logger-improved';
import { ChatRequest, ChatResponse } from '../../types/api.types';
import { validate, chatRequestSchema } from '../../utils/validation';
import { ValidationError } from '../../utils/errors';
import { getAgent, getHumanMessage } from '../../services/agent.service';
import { exaSearch } from '../../utils/mcp-client';
import { learnFromInteraction, isLettaEnabled } from '../../utils/letta-client';

/**
 * Handle chat request
 */
export async function handleChat(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const input = validateChatInput(req.body);
    
    // Detect special queries (URL scan, breach check, etc.)
    const queryType = detectQueryType(input.message);
    
    // Enhance message based on query type
    const enhancedMessage = enhanceMessage(input.message, queryType);
    
    // Get agent and process message
    const { agent, config } = await getAgent();
    const HumanMessage = getHumanMessage();
    
    // Invoke agent
    const result = await agent.invoke(
      { messages: [new HumanMessage(enhancedMessage)] },
      config
    );
    
    // Extract response
    const agentResponse = extractAgentResponse(result);
    
    // Format response
    const response = formatChatResponse(
      agentResponse,
      input.message,
      config.configurable.thread_id
    );
    
    // Learn from interaction (async, don't wait)
    learnFromInteractionAsync(input.message, agentResponse);
    
    // Log performance
    const duration = Date.now() - startTime;
    structuredLogger.performance('chat.request', duration, {
      queryType,
      responseLength: agentResponse.length,
    });
    
    res.json(response);
  } catch (error) {
    structuredLogger.error('Chat request failed', error, {
      path: req.path,
      method: req.method,
    });
    throw error;
  }
}

/**
 * Validate chat input
 */
function validateChatInput(body: unknown): ChatRequest {
  try {
    return validate(chatRequestSchema, body);
  } catch (error) {
    throw new ValidationError('Invalid chat request', undefined, error);
  }
}

/**
 * Detect query type from message
 */
function detectQueryType(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // URL/Website scan
  if (/scan|check|analyze/.test(lowerMessage) && /https?:\/\/|\.com|\.org|\.net/.test(message)) {
    return 'url_scan';
  }
  
  // Breach check
  if (/breach|pwned|leaked|compromised/.test(lowerMessage) && /@/.test(message)) {
    return 'breach_check';
  }
  
  // Domain check
  if (/domain|whois|reputation/.test(lowerMessage)) {
    return 'domain_check';
  }
  
  // Email analysis
  if (/email|phishing|spam/.test(lowerMessage)) {
    return 'email_analysis';
  }
  
  // CVE search
  if (/cve|vulnerability|exploit/.test(lowerMessage)) {
    return 'cve_search';
  }
  
  return 'general';
}

/**
 * Enhance message based on query type
 */
function enhanceMessage(message: string, queryType: string): string {
  switch (queryType) {
    case 'url_scan':
      return `Use the scan_website action to analyze this URL for security threats: ${message}`;
    
    case 'breach_check':
      const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      if (emailMatch) {
        return `Use the breach_check action to check if ${emailMatch[0]} has been involved in any data breaches.`;
      }
      return message;
    
    case 'domain_check':
      return `Use the check_domain action to analyze this domain: ${message}`;
    
    default:
      return message;
  }
}

/**
 * Extract agent response from result
 */
function extractAgentResponse(result: any): string {
  const messages = result.messages || [];
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.content || 'No response generated';
}

/**
 * Format chat response
 */
function formatChatResponse(
  agentResponse: string,
  originalMessage: string,
  threadId: string
): ChatResponse {
  return {
    response: agentResponse,
    chunks: [agentResponse],
    threadId,
    lettaEnabled: isLettaEnabled(),
    metadata: {
      a2aCoordinated: agentResponse.includes('A2A'),
      realTimeDataUsed: agentResponse.includes('Exa') || agentResponse.includes('MCP'),
      autonomousAction: true,
      toolsUsed: extractToolsUsed(agentResponse),
    },
  };
}

/**
 * Extract tools used from response
 */
function extractToolsUsed(response: string): string[] {
  const tools: string[] = [];
  
  if (response.includes('scan_website') || response.includes('scan_url')) {
    tools.push('scan_url');
  }
  if (response.includes('check_domain')) {
    tools.push('check_domain');
  }
  if (response.includes('breach_check')) {
    tools.push('breach_check');
  }
  if (response.includes('analyze_email')) {
    tools.push('analyze_email');
  }
  
  return tools;
}

/**
 * Learn from interaction asynchronously
 */
async function learnFromInteractionAsync(
  userMessage: string,
  agentResponse: string
): Promise<void> {
  if (!isLettaEnabled()) {
    return;
  }
  
  try {
    const riskScore = extractRiskScore(agentResponse);
    const threatDetected = agentResponse.toLowerCase().includes('threat') ||
                          agentResponse.toLowerCase().includes('malicious');
    
    await learnFromInteraction(userMessage, agentResponse, {
      actionsTaken: extractToolsUsed(agentResponse),
      riskScore,
      threatDetected,
    });
    
    structuredLogger.info('Letta learning completed', {
      riskScore,
      threatDetected,
    });
  } catch (error) {
    structuredLogger.warn('Letta learning failed', { error });
  }
}

/**
 * Extract risk score from response
 */
function extractRiskScore(response: string): number | undefined {
  const match = response.match(/risk\s*score[:\s]+(\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}
