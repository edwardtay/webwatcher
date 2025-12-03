/**
 * Chat controller
 */
import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { validateInput } from '../../utils/input-validator';
import { exaSearch } from '../../utils/mcp-client';
import { learnFromInteraction, isLettaEnabled } from '../../utils/letta-client';
import { getAgent, getHumanMessage } from '../../services/agent.service';

export async function handleChat(req: Request, res: Response) {
  try {
    const { message, threadId } = req.body;

    // Input validation
    const inputValidation = validateInput(message);
    if (!inputValidation.valid) {
      return res.status(400).json({
        error: 'Invalid input',
        message: inputValidation.error,
      });
    }
    
    const sanitizedMessage = inputValidation.sanitized;

    // Enhanced URL detection
    const explicitScanPattern = /scan\s+(?:website|site|url|link)?\s+(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,})/i;
    const urlPattern = /(?:^|\s)(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)(?:\s|$)/i;
    
    let websiteToScan: string | null = null;
    
    // Email breach check detection
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const breachKeywords = ['breach', 'pwned', 'leaked', 'compromised', 'hacked', 'exposed'];
    const emailMatch = sanitizedMessage.match(emailPattern);
    const isBreachQuery = emailMatch && breachKeywords.some(keyword => 
      sanitizedMessage.toLowerCase().includes(keyword)
    );
    
    let emailToCheck: string | null = null;
    if (isBreachQuery && emailMatch) {
      emailToCheck = emailMatch[0];
      logger.info(`Detected breach check request for email: ${emailToCheck}`);
    }
    const explicitMatch = sanitizedMessage.match(explicitScanPattern);
    if (explicitMatch) {
      websiteToScan = explicitMatch[1];
      logger.info(`Detected explicit website scan request: ${websiteToScan}`);
    } else {
      const urlMatch = sanitizedMessage.match(urlPattern);
      if (urlMatch) {
        const potentialUrl = urlMatch[1].trim();
        const isLikelyUrl = /^https?:\/\//.test(potentialUrl) || 
                           /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(potentialUrl);
        const isShortMessage = sanitizedMessage.trim().split(/\s+/).length <= 3;
        
        if (isLikelyUrl && (isShortMessage || sanitizedMessage.toLowerCase().includes('check') || sanitizedMessage.toLowerCase().includes('scan'))) {
          websiteToScan = potentialUrl;
          logger.info(`Detected URL in message (auto-triggering scan): ${websiteToScan}`);
        }
      }
    }

    // Check if this is a search query
    const searchKeywords = [
      'search', 'find', 'look for', 'show me', 'what is', 'tell me about',
      'cve', 'vulnerability', 'exploit', 'threat', 'security', 'breach',
      'attack', 'malware', 'ransomware', 'phishing', 'zero-day',
      'patch', 'update', 'advisory', 'alert', 'incident',
    ];
    const isSearchQuery = !websiteToScan && sanitizedMessage.length > 3 && (
      searchKeywords.some(keyword => sanitizedMessage.toLowerCase().includes(keyword)) ||
      sanitizedMessage.match(/^\d{4}/) ||
      sanitizedMessage.match(/cve-\d{4}-\d+/i) ||
      sanitizedMessage.split(' ').length <= 5
    );
    
    // Parallelize Exa search and agent initialization
    let exaSearchResults: Array<{ title: string; url: string; text: string; snippet?: string; source?: string }> = [];
    const exaSearchPromise = isSearchQuery 
      ? (async () => {
          try {
            logger.info(`Detected search query, attempting Exa search: ${sanitizedMessage}`);
            const results = await exaSearch(sanitizedMessage, 5);
            logger.info(`Exa search returned ${results.length} results`);
            return results;
          } catch (error) {
            logger.warn('Exa search failed, continuing with agent response', error);
            return [];
          }
        })()
      : Promise.resolve([]);

    // Load agent in parallel
    const agentInitPromise = (async () => {
      const HumanMessage = getHumanMessage();
      if (!HumanMessage) {
        throw new Error('HumanMessage class not available');
      }
      return await getAgent();
    })();

    // Wait for both
    let agentData;
    try {
      const [exaResults, agentResult] = await Promise.all([exaSearchPromise, agentInitPromise]);
      exaSearchResults = exaResults;
      agentData = agentResult;
    } catch (error) {
      logger.error('Agent initialization error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('OPENAI_API_KEY') || errorMsg.includes('Required environment variables')) {
        return res.status(503).json({
          error: 'Agent not initialized',
          message: 'Missing required API keys in Cloud Run environment variables.',
          details: errorMsg,
        });
      }
      return res.status(503).json({
        error: 'Agent not initialized',
        message: 'Agent initialization failed.',
        details: errorMsg,
      });
    }
    
    const { agent, config } = agentData;
    const HumanMessage = getHumanMessage();
    
    // Enhance message for website scan or breach check
    let messageToSend = sanitizedMessage;
    if (websiteToScan) {
      messageToSend = `Use the scan_website action to scan ${websiteToScan} for phishing and security risks. This must use A2A coordination with UrlFeatureAgent, UrlScanAgent (urlscan.io API), and PhishingRedFlagAgent.`;
      logger.info(`Enhanced message for website scan: ${messageToSend}`);
    } else if (emailToCheck) {
      messageToSend = `Use the breach_check action to check if ${emailToCheck} has been involved in any data breaches. This must use A2A coordination with HaveIBeenPwnedAgent and RiskAssessmentAgent to provide comprehensive breach history.`;
      logger.info(`Enhanced message for breach check: ${messageToSend}`);
    }
    
    // Always use a fresh thread ID to avoid state corruption with tool calls
    const configWithThread = {
      ...config,
      configurable: {
        ...config.configurable,
        thread_id: `webwatcher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    };

    const stream = await agent.stream(
      { messages: [new HumanMessage(messageToSend)] },
      configWithThread,
    );

    let fullResponse = '';
    const chunks: string[] = [];
    let agentExaResults: Array<{ title: string; url: string; text: string; snippet?: string }> = [];
    let agentProvidedContext = false;

    for await (const chunk of stream) {
      if ('agent' in chunk) {
        const content = chunk.agent.messages[0].content;
        fullResponse += content;
        chunks.push(content);
        if (content.length > 50 && !content.toLowerCase().includes('let me search') && 
            !content.toLowerCase().includes('searching for')) {
          agentProvidedContext = true;
        }
      } else if ('tools' in chunk) {
        const toolContent = chunk.tools.messages[0].content;
        logger.debug('Tool execution:', toolContent);
        
        try {
          const jsonMatch = toolContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            if (parsed.results && Array.isArray(parsed.results) && parsed.query) {
              agentExaResults = parsed.results;
              logger.info(`Exa search executed: "${parsed.query}" returned ${parsed.results.length} results`);
            } else if (parsed.a2aFlow && parsed.website) {
              logger.info(`[A2A] Website scan completed for ${parsed.website}`);
              if (!fullResponse.includes('A2A Agent Coordination') && !fullResponse.includes('🤖 A2A')) {
                fullResponse = parsed.a2aFlow + '\n\n' + fullResponse;
              }
              if (parsed.urlscanData?.reportUrl) {
                fullResponse += `\n\n🔗 **Full Security Report:** ${parsed.urlscanData.reportUrl}`;
              }
            }
          }
        } catch (e) {
          if (toolContent.includes('A2A Agent Coordination') || toolContent.includes('🤖 A2A')) {
            logger.info('[A2A] A2A flow detected in tool content');
            if (!fullResponse.includes('A2A Agent Coordination') && !fullResponse.includes('🤖 A2A')) {
              fullResponse = toolContent + '\n\n' + fullResponse;
            }
          }
        }
      }
    }

    const finalExaResults = agentExaResults.length > 0 ? agentExaResults : exaSearchResults;
    
    // Build enhanced response with search results
    let enhancedResponse = fullResponse;
    if (finalExaResults.length > 0) {
      if (!fullResponse.toLowerCase().includes('found') && !fullResponse.toLowerCase().includes('result')) {
        enhancedResponse += `\n\nI found ${finalExaResults.length} relevant result${finalExaResults.length > 1 ? 's' : ''} for your query.`;
      }
      
      if (!fullResponse.includes('**Search Results:**') && !fullResponse.includes('**Results:**')) {
        enhancedResponse += '\n\n**📋 Search Results:**\n\n';
      }
      
      finalExaResults.slice(0, 8).forEach((result, idx) => {
        const title = result.title || result.url || `Result ${idx + 1}`;
        const url = result.url || '';
        const snippet = result.snippet || result.text || '';
        
        if (url) {
          enhancedResponse += `**${idx + 1}. [${title}](${url})**\n`;
        } else {
          enhancedResponse += `**${idx + 1}. ${title}**\n`;
        }
        if (snippet) {
          enhancedResponse += `\n${snippet.substring(0, 250)}...\n`;
        }
        enhancedResponse += '\n---\n\n';
      });
    }

    // Learn from interaction (Letta)
    const actionsTaken: string[] = [];
    if (agentExaResults.length > 0) actionsTaken.push('exa_search');
    if (websiteToScan) actionsTaken.push('scan_website');
    if (emailToCheck) actionsTaken.push('breach_check');
    if (fullResponse.includes('risk') || fullResponse.includes('threat')) {
      actionsTaken.push('threat_analysis');
    }

    const riskScoreMatch = enhancedResponse.match(/risk[_\s]?score[:\s]+(\d+)/i);
    const riskScore = riskScoreMatch ? parseInt(riskScoreMatch[1]) : undefined;
    const threatDetected = enhancedResponse.toLowerCase().includes('threat') || 
                          enhancedResponse.toLowerCase().includes('risk') ||
                          enhancedResponse.toLowerCase().includes('vulnerability');

    if (isLettaEnabled()) {
      logger.info('🤖 Letta: Learning from interaction');
      learnFromInteraction(sanitizedMessage, enhancedResponse, {
        actionsTaken,
        riskScore,
        threatDetected,
      }).catch(err => logger.warn('Letta learning failed:', err));
    }

    // Extract metadata
    const hasA2ACoordination = enhancedResponse.includes('A2A') || enhancedResponse.includes('Agent Coordination') || websiteToScan !== null || emailToCheck !== null;
    const hasRealTimeData = exaSearchResults.length > 0 || agentExaResults.length > 0;
    const hasAutonomousAction = websiteToScan !== null || emailToCheck !== null || (riskScore && riskScore > 50);
    
    res.json({
      response: enhancedResponse,
      chunks,
      threadId: configWithThread.configurable.thread_id,
      lettaEnabled: isLettaEnabled(),
      metadata: {
        a2aCoordinated: hasA2ACoordination,
        realTimeDataUsed: hasRealTimeData,
        autonomousAction: hasAutonomousAction,
        toolsUsed: actionsTaken,
        riskScore,
        threatDetected,
      },
    });
  } catch (error) {
    logger.error('Error in chat endpoint', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
