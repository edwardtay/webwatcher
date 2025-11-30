import express from "express";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import { validateInput } from "./utils/input-validator";
import { exaSearch } from "./utils/mcp-client";
import { learnFromInteraction, isLettaEnabled, queryLettaAgent, autonomousAction } from "./utils/letta-client";
import { resolveENS, isValidENS } from "./utils/ens-resolver";
import * as dotenv from "dotenv";
import path from "path";
import { dirname } from "path";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

// CORS middleware (must be before routes)
app.use((req, res, next) => {
  // Allow all origins (including Vercel)
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Helper function to extract title from URL
function extractTitleFromUrl(url: string): string {
  if (!url) return "";
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      return decodeURIComponent(lastPart)
        .replace(/[-_]/g, ' ')
        .replace(/\.[^.]*$/, '')
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return url.substring(0, 50);
  }
}

// Lazy import to avoid decorator metadata issues during module load
let initializeAgent: any;
let HumanMessage: any;

async function loadAgentModules() {
  if (!initializeAgent) {
    try {
      logger.info("Attempting to load agent modules with dynamic import...");
      let indexModule;
      try {
        indexModule = await import("./index.js");
      } catch (e) {
        try {
          indexModule = await import("./index");
        } catch (e2) {
          throw new Error(`Failed to import index module: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      initializeAgent = indexModule.initializeAgent;
      if (!initializeAgent) {
        throw new Error("initializeAgent not found in index module");
      }
      logger.info("✓ index module loaded");
      
      const langchainModule = await import("@langchain/core/messages");
      HumanMessage = langchainModule.HumanMessage;
      if (!HumanMessage) {
        throw new Error("HumanMessage not found in langchain module");
      }
      logger.info("✓ langchain module loaded");
      
      logger.info("✓ All agent modules loaded successfully");
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("Failed to load agent modules:", errorMsg);
      return false;
    }
  }
  return true;
}

// Initialize agent (singleton)
let agentInstance: any = null;
let agentInitialized = false;
let agentInitPromise: Promise<any> | null = null;

// OPTIMIZATION: Pre-initialize agent on server startup (non-blocking)
async function preInitializeAgent() {
  if (!agentInitPromise && !agentInitialized) {
    agentInitPromise = (async () => {
      try {
        logger.info("Pre-initializing agent in background...");
        await loadAgentModules();
        if (initializeAgent) {
          agentInstance = await initializeAgent();
          agentInitialized = true;
          logger.info("✓ Agent pre-initialized successfully");
        }
      } catch (error) {
        logger.warn("Agent pre-initialization failed (will initialize on first request):", error);
        agentInitPromise = null; // Allow retry on first request
      }
    })();
  }
  return agentInitPromise;
}

async function getAgent() {
  if (!initializeAgent) {
    const loaded = await loadAgentModules();
    if (!loaded) {
      throw new Error("Agent initialization module not available");
    }
  }
  
  if (!initializeAgent) {
    throw new Error("Agent initialization module not available");
  }
  
  if (!agentInstance) {
    try {
      logger.info("Initializing agent...");
      agentInstance = await initializeAgent();
      agentInitialized = true;
      logger.info("Agent initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize agent", error);
      agentInitialized = false;
      throw error;
    }
  }
  return agentInstance;
}

// Simple health endpoint
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// Root page - API info (frontend served separately on Vercel)
app.get("/", (_req, res) => {
  // In development, serve frontend; in production, return API info
  if (process.env.NODE_ENV === 'development' || process.env.SERVE_FRONTEND === 'true') {
    res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
  } else {
    // Production: API-only endpoint
    res.status(200).json({
      service: "WebWatcher API",
      status: "running",
      agentId: "webwatcher-phish-checker",
      protocols: ["A2A", "MCP", "HTTP"],
      endpoints: {
        agentCard: "GET /.well-known/agent.json",
        chat: "POST /api/chat",
        check: "POST /check",
        health: "GET /healthz",
        resolveEns: "POST /api/resolve-ens",
        walletAnalyze: "POST /api/wallet/analyze"
      },
      frontend: "Deployed separately on Vercel",
      capabilities: {
        a2a: "Agent-to-Agent coordination enabled",
        mcp: "Model Context Protocol enabled",
        letta: isLettaEnabled() ? "Autonomous learning enabled" : "Not configured",
        autonomous: "Automatic URL detection, risk escalation, multi-agent coordination",
        realTime: "Exa MCP for latest threat intelligence, urlscan.io for live scans"
      },
      demo: {
        autonomousDetection: "Type any URL - agent automatically scans",
        realTimeData: "CVE searches use latest data via Exa MCP",
        a2aCoordination: "Multi-agent workflows activated automatically",
        learning: isLettaEnabled() ? "Every interaction learned for improvement" : "Enable Letta for learning"
      }
    });
  }
});

// Capabilities endpoint for demo showcase
app.get("/capabilities", (_req, res) => {
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
      protocols: ["A2A", "MCP", "HTTP"],
      frameworks: ["AgentKit", "LangChain", "Letta"],
      deployment: "Cloud Run + Vercel",
      scalability: "Auto-scaling",
    }
  });
});

/**
 * Chat endpoint - Send a message to the agent
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, threadId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }

    // Input validation and sanitization
    const inputValidation = validateInput(message);
    if (!inputValidation.valid) {
      return res.status(400).json({
        error: "Invalid input",
        message: inputValidation.error,
      });
    }
    
    const sanitizedMessage = inputValidation.sanitized;

    // Enhanced URL detection - detect URLs even without "scan" keyword
    // Pattern 1: Explicit scan command
    const explicitScanPattern = /scan\s+(?:website|site|url|link)?\s+(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,})/i;
    // Pattern 2: Just a URL (with or without protocol)
    const urlPattern = /(?:^|\s)(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)(?:\s|$)/i;
    
    let websiteToScan: string | null = null;
    const explicitMatch = sanitizedMessage.match(explicitScanPattern);
    if (explicitMatch) {
      websiteToScan = explicitMatch[1];
      logger.info(`Detected explicit website scan request: ${websiteToScan}`);
    } else {
      // Check if message is just a URL or contains a URL
      const urlMatch = sanitizedMessage.match(urlPattern);
      if (urlMatch) {
        const potentialUrl = urlMatch[1].trim();
        // Only treat as URL if it looks like a domain/URL and message is short (likely just a URL)
        const isLikelyUrl = /^https?:\/\//.test(potentialUrl) || 
                           /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(potentialUrl);
        const isShortMessage = sanitizedMessage.trim().split(/\s+/).length <= 3;
        
        if (isLikelyUrl && (isShortMessage || sanitizedMessage.toLowerCase().includes('check') || sanitizedMessage.toLowerCase().includes('scan'))) {
          websiteToScan = potentialUrl;
          logger.info(`Detected URL in message (auto-triggering scan): ${websiteToScan}`);
        }
      }
    }

    // Check if this is a search query and try Exa search directly
    const searchKeywords = [
      "search", "find", "look for", "show me", "what is", "tell me about",
      "cve", "vulnerability", "exploit", "threat", "security", "breach",
      "attack", "malware", "ransomware", "phishing", "zero-day",
      "patch", "update", "advisory", "alert", "incident"
    ];
    const isSearchQuery = !websiteToScan && sanitizedMessage.length > 3 && (
      searchKeywords.some(keyword => sanitizedMessage.toLowerCase().includes(keyword)) ||
      sanitizedMessage.match(/^\d{4}/) ||
      sanitizedMessage.match(/cve-\d{4}-\d+/i) ||
      sanitizedMessage.split(' ').length <= 5
    );
    
    // OPTIMIZATION: Parallelize Exa search and agent initialization
    let exaSearchResults: Array<{ title: string; url: string; text: string; snippet?: string; source?: string }> = [];
    const exaSearchPromise = isSearchQuery 
      ? (async () => {
          try {
            logger.info(`Detected search query, attempting Exa search: ${sanitizedMessage}`);
            const results = await exaSearch(sanitizedMessage, 5);
            const mcpCount = results.filter((r: any) => r.source === "MCP").length;
            const apiCount = results.filter((r: any) => r.source === "API").length;
            logger.info(`Exa search returned ${results.length} results (${mcpCount} from MCP, ${apiCount} from API)`);
            return results;
          } catch (error) {
            logger.warn("Exa search failed, continuing with agent response", error);
            return [];
          }
        })()
      : Promise.resolve([]);

    // OPTIMIZATION: Load modules and initialize agent in parallel with Exa search
    const agentInitPromise = (async () => {
      // Ensure modules are loaded
      if (!HumanMessage || !initializeAgent) {
        await loadAgentModules();
      }
      
      if (!agentInitialized) {
        try {
          await getAgent();
        } catch (error) {
        logger.error("Agent initialization error in chat endpoint:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("OPENAI_API_KEY") || errorMsg.includes("Required environment variables")) {
          return res.status(503).json({
            error: "Agent not initialized",
            message: "Missing required API keys in Cloud Run environment variables.",
            details: errorMsg,
            fix: "Set OPENAI_API_KEY in Cloud Run: gcloud run services update verisense-agentkit --region us-central1 --update-env-vars 'OPENAI_API_KEY=your_key'",
          });
        }
        if (errorMsg.includes("CDP_API_KEY")) {
          return res.status(503).json({
            error: "Agent not initialized",
            message: "Missing CDP API keys (optional for basic functionality).",
            details: errorMsg,
          });
        }
          return res.status(503).json({
            error: "Agent not initialized",
            message: "Agent initialization failed. Please check server logs for details.",
            details: errorMsg,
          });
        }
      }
      return await getAgent();
    })();

    // OPTIMIZATION: Wait for both Exa search and agent initialization in parallel
    let agentData;
    try {
      const [exaResults, agentResult] = await Promise.all([exaSearchPromise, agentInitPromise]);
      exaSearchResults = exaResults;
      agentData = agentResult;
    } catch (error) {
      // Handle agent initialization errors
      logger.error("Agent initialization error in chat endpoint:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("OPENAI_API_KEY") || errorMsg.includes("Required environment variables")) {
        return res.status(503).json({
          error: "Agent not initialized",
          message: "Missing required API keys in Cloud Run environment variables.",
          details: errorMsg,
          fix: "Set OPENAI_API_KEY in Cloud Run: gcloud run services update verisense-agentkit --region us-central1 --update-env-vars 'OPENAI_API_KEY=your_key'",
        });
      }
      if (errorMsg.includes("CDP_API_KEY")) {
        return res.status(503).json({
          error: "Agent not initialized",
          message: "Missing CDP API keys (optional for basic functionality).",
          details: errorMsg,
        });
      }
      return res.status(503).json({
        error: "Agent not initialized",
        message: "Agent initialization failed. Please check server logs for details.",
        details: errorMsg,
      });
    }
    
    const { agent, config } = agentData;
    
    if (!HumanMessage) {
      await loadAgentModules();
      if (!HumanMessage) {
        return res.status(503).json({
          error: "Missing dependencies",
          message: "HumanMessage class not available. Please check server logs.",
        });
      }
    }
    
    // If website scan detected, enhance the message to trigger scan_website action
    let messageToSend = sanitizedMessage;
    if (websiteToScan) {
      // Force the agent to use scan_website action explicitly
      messageToSend = `Use the scan_website action to scan ${websiteToScan} for phishing and security risks. This must use A2A coordination with UrlFeatureAgent, UrlScanAgent (urlscan.io API), and PhishingRedFlagAgent.`;
      logger.info(`Enhanced message for website scan: ${messageToSend}`);
    }
    
    const configWithThread = {
      ...config,
      configurable: {
        ...config.configurable,
        thread_id: threadId || config.configurable.thread_id,
      },
    };

    const stream = await agent.stream(
      { messages: [new HumanMessage(messageToSend)] },
      configWithThread,
    );

    let fullResponse = "";
    const chunks: string[] = [];
    let agentExaResults: Array<{ title: string; url: string; text: string; snippet?: string }> = [];
    let agentProvidedContext = false;

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        const content = chunk.agent.messages[0].content;
        fullResponse += content;
        chunks.push(content);
        if (content.length > 50 && !content.toLowerCase().includes("let me search") && 
            !content.toLowerCase().includes("searching for")) {
          agentProvidedContext = true;
        }
      } else if ("tools" in chunk) {
        const toolContent = chunk.tools.messages[0].content;
        logger.debug("Tool execution:", toolContent);
        
        try {
          // Try to parse JSON from tool response
          const jsonMatch = toolContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Check for Exa search results
            if (parsed.results && Array.isArray(parsed.results) && parsed.query) {
              agentExaResults = parsed.results;
              logger.info(`Exa search executed: "${parsed.query}" returned ${parsed.results.length} results`);
            } 
            // Check for website scan results with A2A flow
            else if (parsed.a2aFlow && parsed.website) {
              logger.info(`[A2A] Website scan completed for ${parsed.website}`);
              // Prepend A2A flow to response if not already included
              if (!fullResponse.includes("A2A Agent Coordination") && !fullResponse.includes("🤖 A2A")) {
                fullResponse = parsed.a2aFlow + "\n\n" + fullResponse;
              }
              // Also add urlscan.io results if available
              if (parsed.urlscanData && parsed.urlscanData.reportUrl) {
                fullResponse += `\n\n🔗 **Full Security Report:** ${parsed.urlscanData.reportUrl}`;
              }
            }
            // Check if this is a scan_website action result (might be nested)
            else if (parsed.website || parsed.domain) {
              logger.info(`[A2A] Website scan result detected`);
              // Try to extract A2A flow from nested structure
              if (parsed.a2aFlow) {
                if (!fullResponse.includes("A2A Agent Coordination") && !fullResponse.includes("🤖 A2A")) {
                  fullResponse = parsed.a2aFlow + "\n\n" + fullResponse;
                }
              }
            }
          }
        } catch (e) {
          // If JSON parsing fails, check if toolContent contains A2A flow markers
          if (toolContent.includes("A2A Agent Coordination") || toolContent.includes("🤖 A2A")) {
            logger.info("[A2A] A2A flow detected in tool content");
            if (!fullResponse.includes("A2A Agent Coordination") && !fullResponse.includes("🤖 A2A")) {
              fullResponse = toolContent + "\n\n" + fullResponse;
            }
          }
        }
      }
    }

    const finalExaResults = agentExaResults.length > 0 ? agentExaResults : exaSearchResults;
    
    if (!agentProvidedContext && exaSearchResults.length > 0 && fullResponse.length < 100) {
      const queryContext = sanitizedMessage.toLowerCase();
      let intro = "";
      
      if (queryContext.includes("cve")) {
        intro = `I found several CVE entries related to your query. Here are the most relevant results:\n\n`;
      } else if (queryContext.includes("vulnerability") || queryContext.includes("exploit")) {
        intro = `Here are the latest security vulnerabilities and exploits I found:\n\n`;
      } else if (queryContext.match(/^\d{4}/)) {
        intro = `I found security-related information for ${sanitizedMessage}. Here are the results:\n\n`;
      } else {
        intro = `Based on your query, here are the most relevant results I found:\n\n`;
      }
      
      fullResponse = intro + fullResponse;
    }
    
    let enhancedResponse = fullResponse;
    if (finalExaResults.length > 0) {
      if (!fullResponse.toLowerCase().includes("found") && !fullResponse.toLowerCase().includes("result")) {
        enhancedResponse += `\n\nI found ${finalExaResults.length} relevant result${finalExaResults.length > 1 ? 's' : ''} for your query.`;
      }
      
      if (!fullResponse.includes("**Search Results:**") && !fullResponse.includes("**Results:**")) {
        enhancedResponse += "\n\n**📋 Search Results:**\n\n";
      }
      
      finalExaResults.slice(0, 8).forEach((result, idx) => {
        const title = result.title && result.title !== "Untitled" && result.title !== "Search Result" 
          ? result.title 
          : result.url 
            ? extractTitleFromUrl(result.url) 
            : `Result ${idx + 1}`;
        const url = result.url || "";
        
        let domain = "";
        try {
          if (url) {
            const urlObj = new URL(url);
            domain = urlObj.hostname.replace(/^www\./, '');
          }
        } catch (e) {
        }
        
        let snippet = "";
        if (result.snippet && result.snippet.trim()) {
          snippet = result.snippet.trim();
        } else if (result.text && result.text.trim()) {
          snippet = result.text.trim();
        }
        
        if (snippet) {
          snippet = snippet.replace(/\s+/g, ' ').trim();
          if (snippet.length > 250) {
            const lastSpace = snippet.substring(0, 250).lastIndexOf(' ');
            snippet = snippet.substring(0, lastSpace > 0 ? lastSpace : 250) + '...';
          }
        }
        
        if (url) {
          enhancedResponse += `**${idx + 1}. [${title}](${url})**\n`;
        } else {
          enhancedResponse += `**${idx + 1}. ${title}**\n`;
        }
        if (domain) {
          enhancedResponse += `📍 Source: ${domain}\n`;
        }
        if (snippet) {
          enhancedResponse += `\n${snippet}\n`;
        }
        enhancedResponse += "\n---\n\n";
      });
      
    }

    // Learn from this interaction (Letta integration for self-improvement)
    // Extract context for learning: actions taken, risk scores, threat detection
    const actionsTaken: string[] = [];
    if (agentExaResults.length > 0) actionsTaken.push('exa_search');
    if (websiteToScan) actionsTaken.push('scan_website');
    if (fullResponse.includes('risk') || fullResponse.includes('threat')) {
      actionsTaken.push('threat_analysis');
    }

    // Extract risk score from response if present
    const riskScoreMatch = enhancedResponse.match(/risk[_\s]?score[:\s]+(\d+)/i);
    const riskScore = riskScoreMatch ? parseInt(riskScoreMatch[1]) : undefined;
    const threatDetected = enhancedResponse.toLowerCase().includes('threat') || 
                          enhancedResponse.toLowerCase().includes('risk') ||
                          enhancedResponse.toLowerCase().includes('vulnerability');

    // Store interaction in Letta for learning (non-blocking)
    // Log when Letta learning is actually happening
    if (isLettaEnabled()) {
      logger.info('🤖 Letta: Learning from interaction - storing in memory');
      learnFromInteraction(sanitizedMessage, enhancedResponse, {
        actionsTaken,
        riskScore,
        threatDetected,
      }).then(() => {
        logger.info('✓ Letta: Interaction stored successfully');
      }).catch(err => {
        // Don't fail the request if learning fails
        logger.warn('Letta learning failed (non-critical):', err);
      });
    } else {
      logger.debug('Letta not enabled - skipping learning');
    }

    // Extract metadata for demo showcase
    const hasA2ACoordination = enhancedResponse.includes('A2A') || enhancedResponse.includes('Agent Coordination') || websiteToScan !== null;
    const hasRealTimeData = exaSearchResults.length > 0 || agentExaResults.length > 0;
    const hasAutonomousAction = websiteToScan !== null || (riskScore && riskScore > 50);
    
    res.json({
      response: enhancedResponse,
      chunks,
      threadId: configWithThread.configurable.thread_id,
      lettaEnabled: isLettaEnabled(), // Indicate if Letta is active
      // Demo showcase metadata
      metadata: {
        a2aCoordinated: hasA2ACoordination,
        realTimeDataUsed: hasRealTimeData,
        autonomousAction: hasAutonomousAction,
        toolsUsed: actionsTaken,
        riskScore: riskScore,
        threatDetected: threatDetected,
      },
    });
  } catch (error) {
    logger.error("Error in chat endpoint", error);
    res.status(500).json({
      error: "Failed to process chat message",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * ENS Resolution endpoint
 */
app.post("/api/resolve-ens", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "ENS name is required" });
    }

    const resolvedAddress = await resolveENS(name);

    if (resolvedAddress) {
      res.status(200).json({
        success: true,
        name,
        address: resolvedAddress
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Could not resolve ENS name"
      });
    }
  } catch (error: any) {
    logger.error('ENS resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve ENS name',
      message: error.message
    });
  }
});

/**
 * Wallet Analysis endpoint - Analyze wallet using Moralis, Blockscout, Alchemy, Thirdweb, Revoke.cash, Nansen, MetaSleuth, and Passport
 */
app.post("/api/wallet/analyze", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    // Fetch data from Moralis, Blockscout, Alchemy, Thirdweb, Revoke.cash, Nansen, MetaSleuth, and Passport
    const [moralisData, blockscoutData, alchemyData, thirdwebData, revokeData, nansenData, metasleuthData, passportData] = await Promise.allSettled([
      (async () => {
        try {
          const { analyzeWalletSecurity, getWalletTransactions } = await import('./integrations/moralis');
          const [analysis, transactions] = await Promise.all([
            analyzeWalletSecurity(address),
            getWalletTransactions(address, '0x1', 10),
          ]);
          return { analysis, transactions };
        } catch (e) {
          logger.warn('Moralis integration failed:', e);
          return { error: 'Moralis integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getComprehensiveWalletData } = await import('./integrations/blockscout');
          return await getComprehensiveWalletData(address);
        } catch (e) {
          logger.warn('Blockscout integration failed:', e);
          return { error: 'Blockscout integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getComprehensiveWalletMetrics } = await import('./integrations/alchemy');
          return await getComprehensiveWalletMetrics(address);
        } catch (e) {
          logger.warn('Alchemy integration failed:', e);
          return { error: 'Alchemy integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getWalletPortfolio } = await import('./integrations/thirdweb');
          return await getWalletPortfolio(address);
        } catch (e) {
          logger.warn('Thirdweb integration failed:', e);
          return { error: 'Thirdweb integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getSecurityRecommendations, getApprovalSummary } = await import('./integrations/revoke');
          const [recommendations, summary] = await Promise.all([
            getSecurityRecommendations(address, 1),
            getApprovalSummary(address, 1),
          ]);
          return { recommendations, summary };
        } catch (e) {
          logger.warn('Revoke.cash integration failed:', e);
          return { error: 'Revoke.cash integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getWalletIntelligence } = await import('./integrations/nansen');
          return await getWalletIntelligence(address);
        } catch (e) {
          logger.warn('Nansen integration failed:', e);
          return { error: 'Nansen integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getComprehensiveAnalysis } = await import('./integrations/metasleuth');
          return await getComprehensiveAnalysis(address, 'ethereum');
        } catch (e) {
          logger.warn('MetaSleuth integration failed:', e);
          return { error: 'MetaSleuth integration not available' };
        }
      })(),
      (async () => {
        try {
          const { getPassportAnalysis } = await import('./integrations/passport');
          return await getPassportAnalysis(address);
        } catch (e) {
          logger.warn('Passport integration failed:', e);
          return { error: 'Passport integration not available' };
        }
      })(),
    ]);

    const result: any = {
      success: true,
      address,
      timestamp: new Date().toISOString(),
    };

    // Merge Moralis data
    if (moralisData.status === 'fulfilled') {
      result.moralis = moralisData.value;
      
      // Learn patterns from transactions
      if (moralisData.value.transactions && moralisData.value.transactions.length > 0) {
        try {
          const { learnFromTransactions, getPatternSummary } = await import('./utils/pattern-learner');
          learnFromTransactions(address, moralisData.value.transactions);
          result.patternSummary = getPatternSummary(address);
        } catch (error) {
          logger.warn('Pattern learning failed:', error);
        }
      }
    } else {
      logger.warn('Moralis data fetch failed:', moralisData.reason);
      result.moralis = { error: 'Failed to fetch Moralis data' };
    }

    // Merge Blockscout data
    if (blockscoutData.status === 'fulfilled') {
      result.blockscout = blockscoutData.value;
    } else {
      logger.warn('Blockscout data fetch failed:', blockscoutData.reason);
      result.blockscout = { error: 'Failed to fetch Blockscout data' };
    }

    // Merge Alchemy data
    if (alchemyData.status === 'fulfilled') {
      result.alchemy = alchemyData.value;
    } else {
      logger.warn('Alchemy data fetch failed:', alchemyData.reason);
      result.alchemy = { error: 'Failed to fetch Alchemy data' };
    }

    // Merge Thirdweb data
    if (thirdwebData.status === 'fulfilled') {
      result.thirdweb = thirdwebData.value;
    } else {
      logger.warn('Thirdweb data fetch failed:', thirdwebData.reason);
      result.thirdweb = { error: 'Failed to fetch Thirdweb data' };
    }

    // Merge Revoke.cash data
    if (revokeData.status === 'fulfilled') {
      result.revoke = revokeData.value;
    } else {
      logger.warn('Revoke.cash data fetch failed:', revokeData.reason);
      result.revoke = { error: 'Failed to fetch Revoke.cash data' };
    }

    // Merge Nansen data
    if (nansenData.status === 'fulfilled') {
      result.nansen = nansenData.value;
    } else {
      logger.warn('Nansen data fetch failed:', nansenData.reason);
      result.nansen = { error: 'Failed to fetch Nansen data' };
    }

    // Merge MetaSleuth data
    if (metasleuthData.status === 'fulfilled') {
      result.metasleuth = metasleuthData.value;
    } else {
      logger.warn('MetaSleuth data fetch failed:', metasleuthData.reason);
      result.metasleuth = { error: 'Failed to fetch MetaSleuth data' };
    }

    // Merge Passport data
    if (passportData.status === 'fulfilled') {
      result.passport = passportData.value;
    } else {
      logger.warn('Passport data fetch failed:', passportData.reason);
      result.passport = { error: 'Failed to fetch Passport data' };
    }

    // Check for threat intelligence
    try {
      const { checkWalletThreats, getThreatSummary } = await import('./utils/threat-intelligence');
      const transactions = result.moralis?.transactions || result.blockscout?.transactions || [];
      const approvals = result.revoke?.summary?.totalApprovals || 0;
      
      const threats = await checkWalletThreats(address, transactions, approvals > 0 ? [{}] : []);
      result.threats = {
        active: threats,
        summary: getThreatSummary()
      };
    } catch (error) {
      logger.warn('Threat intelligence check failed:', error);
    }

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Wallet analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze wallet',
      message: error.message 
    });
  }
});

type UrlFeatures = {
  fullUrl: string;
  domain: string;
  path: string;
  isIp: boolean;
  hasAt: boolean;
  numDots: number;
  urlLength: number;
  keywordHits: string[];
  tld: string;
  tldSuspicious: boolean;
  brandImpersonation: string | null;
};

function urlFeatureAgent(rawUrl: string): UrlFeatures {
  let input = rawUrl.trim();
  if (!input.startsWith("http://") && !input.startsWith("https://")) {
    input = "https://" + input;
  }

  const parsed = new URL(input);
  const fullUrl = parsed.href;
  const domain = parsed.hostname;
  const path = parsed.pathname + parsed.search;

  const urlLower = fullUrl.toLowerCase();
  const domainLower = domain.toLowerCase();
  const pathLower = path.toLowerCase();

  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
  const hasAt = fullUrl.includes("@");
  const numDots = (domain.match(/\./g) || []).length;
  const urlLength = fullUrl.length;

  const suspiciousKeywords = [
    "login",
    "signin",
    "verify",
    "update",
    "secure",
    "account",
    "wallet",
    "password",
    "support"
  ];

  const keywordHits = suspiciousKeywords.filter(
    k => pathLower.includes(k) || domainLower.includes(k)
  );

  const weirdTlds = [".cn", ".ru", ".tk", ".ml", ".ga", ".gq", ".cf"];
  const tld = domainLower.slice(domainLower.lastIndexOf("."));
  const tldSuspicious = weirdTlds.includes(tld);

  const bigBrands = [
    "apple",
    "paypal",
    "google",
    "microsoft",
    "facebook",
    "binance"
  ];
  let brandImpersonation: string | null = null;
  for (const b of bigBrands) {
    if (domainLower.includes(b) && !domainLower.endsWith(`${b}.com`)) {
      brandImpersonation = b;
      break;
    }
  }

  return {
    fullUrl,
    domain,
    path,
    isIp,
    hasAt,
    numDots,
    urlLength,
    keywordHits,
    tld,
    tldSuspicious,
    brandImpersonation
  };
}

function phishingRedFlagAgent(features: UrlFeatures) {
  const {
    fullUrl,
    domain,
    isIp,
    hasAt,
    numDots,
    urlLength,
    keywordHits,
    tld,
    tldSuspicious,
    brandImpersonation
  } = features;

  const redFlags: string[] = [];
  const notes: string[] = [];

  if (isIp) redFlags.push("Uses raw IP instead of normal domain name.");
  if (hasAt) redFlags.push("Contains @ which can hide the real destination.");
  if (numDots >= 3) {
    redFlags.push("Many dots in domain, often used to hide real site.");
  }
  if (urlLength > 80) {
    redFlags.push("Very long URL, common in phishing links.");
  }
  if (keywordHits.length > 0) {
    redFlags.push("Contains sensitive words: " + keywordHits.join(", "));
  }
  if (tldSuspicious) {
    redFlags.push(`Uses uncommon TLD: ${tld}.`);
  }
  if (brandImpersonation) {
    redFlags.push(
      `Domain contains brand name "${brandImpersonation}" but is not official ${brandImpersonation}.com.`
    );
  }

  if (!redFlags.length) {
    notes.push("No strong structural phishing signs in the URL alone.");
  }

  const verdict =
    redFlags.length >= 2
      ? "likely_phishing"
      : redFlags.length === 1
      ? "suspicious"
      : "no_strong_signals";

  const explanationLines: string[] = [];
  explanationLines.push(`Website checked: ${fullUrl}`);
  explanationLines.push(`Domain: ${domain}`);
  explanationLines.push("");

  if (redFlags.length) {
    explanationLines.push("Major red flags:");
    redFlags.forEach((f, i) => explanationLines.push(`${i + 1}. ${f}`));
  } else {
    explanationLines.push("No strong red flags detected from URL alone.");
  }

  if (notes.length) {
    explanationLines.push("");
    explanationLines.push("Notes:");
    notes.forEach((n, i) => explanationLines.push(`${i + 1}. ${n}`));
  }

  return {
    verdict,
    redFlags,
    explanation: explanationLines.join("\n")
  };
}

/**
 * Quest Verification endpoint - Verify protocol interactions and award passes
 */
app.post("/api/quest/verify", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ 
        success: false,
        error: "Wallet address is required" 
      });
    }

    // Normalize address to lowercase for consistency
    const normalizedAddress = address.toLowerCase().trim();

    // Validate address format (accept lowercase hex)
    if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid Ethereum address format: ${address}. Expected 0x followed by 40 hex characters.` 
      });
    }

    logger.info(`Quest verification requested for: ${normalizedAddress}`);

    // Import quest verifier
    const { verifyAllQuests } = await import("./utils/quest-verifier");
    
    // Verify all quests
    const questPass = await verifyAllQuests(normalizedAddress);

    logger.info(`Quest verification complete: ${questPass.totalCompleted}/5 quests completed for ${normalizedAddress}`);

    return res.status(200).json({
      success: true,
      data: questPass,
    });
  } catch (error) {
    logger.error("Quest verification error:", error);
    const errorMessage = (error as any)?.message || "Failed to verify quests";
    return res.status(500).json({
      success: false,
      error: errorMessage,
      message: errorMessage, // Include both for compatibility
    });
  }
});

/**
 * Mint Web3Base Quest NFT on ZetaChain testnet
 */
app.post("/api/quest/mint-nft", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ 
        success: false,
        error: "Wallet address is required" 
      });
    }

    // Normalize address to lowercase
    const normalizedAddress = address.toLowerCase().trim();

    // Validate address format
    if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid Ethereum address format: ${address}` 
      });
    }

    logger.info(`NFT mint requested for: ${normalizedAddress}`);

    // Verify that user has earned the pass
    const { verifyAllQuests } = await import("./utils/quest-verifier");
    const questPass = await verifyAllQuests(normalizedAddress);

    if (!questPass.passAwarded) {
      return res.status(403).json({
        success: false,
        error: "Quest pass not earned. Complete at least 3 quests to mint NFT.",
      });
    }

    // Prepare NFT minting transaction for ZetaChain testnet
    const ZETACHAIN_TESTNET_RPC = "https://zeta-chain-testnet.drpc.org";
    const ZETACHAIN_TESTNET_CHAIN_ID = 7001; // ZetaChain Testnet chain ID
    const NFT_CONTRACT_ADDRESS = process.env.WEB3BASE_NFT_CONTRACT || "";

    if (!NFT_CONTRACT_ADDRESS) {
      logger.warn("NFT contract address not configured");
      return res.status(200).json({
        success: true,
        message: "Quest pass verified. NFT minting will be available once contract is deployed.",
        data: {
          address: normalizedAddress,
          questPass: questPass,
          nftMinted: false,
          network: "ZetaChain Testnet",
          chainId: ZETACHAIN_TESTNET_CHAIN_ID,
          faucetUrl: "https://zetachain.faucetme.pro/",
          note: "NFT contract address needs to be configured. Get testnet tokens from the faucet.",
        },
      });
    }

    // Get nonce for the transaction
    let nonce: number;
    try {
      const nonceResponse = await fetch(ZETACHAIN_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionCount",
          params: [normalizedAddress, "latest"],
          id: 1,
        }),
      });
      
      if (nonceResponse.ok) {
        const nonceData: any = await nonceResponse.json();
        nonce = parseInt(nonceData.result || "0x0", 16);
      } else {
        nonce = 0;
      }
    } catch (err) {
      logger.warn("Failed to get nonce, using 0");
      nonce = 0;
    }

    // Prepare mint transaction data
    // Using questMint(address) function from Web3BaseQuestNFT contract
    // Function signature: keccak256("questMint(address)") = 0x1c42a4d1
    const MINT_FUNCTION_SIGNATURE = "0x1c42a4d1"; // questMint(address) - public mint function
    // Pad address to 32 bytes (64 hex chars)
    const paddedAddress = normalizedAddress.slice(2).toLowerCase().padStart(64, "0");
    const transactionData = MINT_FUNCTION_SIGNATURE + paddedAddress;

    logger.info(`NFT mint transaction prepared for ${normalizedAddress} on ZetaChain testnet - ${questPass.totalCompleted}/5 quests completed`);

    return res.status(200).json({
      success: true,
      message: "NFT minting transaction prepared",
      data: {
        address: normalizedAddress,
        questPass: questPass,
        network: "ZetaChain Testnet",
        chainId: ZETACHAIN_TESTNET_CHAIN_ID,
        rpcUrl: ZETACHAIN_TESTNET_RPC,
        contractAddress: NFT_CONTRACT_ADDRESS,
        transaction: {
          to: NFT_CONTRACT_ADDRESS,
          data: transactionData,
          value: "0x0", // No ETH needed for minting
          gas: "0x186a0", // ~100,000 gas (standard for NFT mint)
        },
        nonce: nonce,
        faucetUrl: "https://zetachain.faucetme.pro/",
        note: "Sign this transaction with MetaMask to mint your NFT",
      },
    });
  } catch (error) {
    logger.error("NFT mint error:", error);
    const errorMessage = (error as any)?.message || "Failed to mint NFT";
    return res.status(500).json({
      success: false,
      error: errorMessage,
      message: errorMessage,
    });
  }
});

// A2A-style endpoint: URL features agent -> phishing red-flag agent
app.post("/check", (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "missing or invalid url" });
  }

  try {
    const features = urlFeatureAgent(url);
    const result = phishingRedFlagAgent(features);

    return res.json({
      url,
      features,
      verdict: result.verdict,
      redFlags: result.redFlags,
      explanation: result.explanation
    });
  } catch (e) {
    console.error("Error in /check:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// AgentCard definition for Verisense / other A2A registries
const agentBaseUrl =
  "https://webwatcher.lever-labs.com";

const agentCard = {
  id: "webwatcher-phish-checker",
  name: "WebWatcher Phishing URL Checker",
  description:
    "Cybersecurity agent that inspects a URL and reports phishing red flags using an internal A2A pipeline. Supports MCP for semantic web search and A2A coordination for multi-agent security workflows.",
  version: "1.0.0",
  author: {
    name: "NetWatch Team",
    contact: "https://github.com/edwardtay/webwatcher"
  },
  license: "Apache-2.0",
  repository: "https://github.com/edwardtay/webwatcher",
  tags: ["cybersecurity", "phishing", "url-analysis", "security", "a2a", "mcp"],
  // extra fields so registries can auto-fill Agent URL
  agentUrl: agentBaseUrl,
  baseUrl: agentBaseUrl,
  protocols: ["A2A", "MCP", "HTTP"],
  capabilities: {
    functions: [
      {
        name: "checkUrl",
        description: "Analyze a URL and return phishing red flags using A2A coordination.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to analyze for phishing indicators."
            }
          },
          required: ["url"]
        },
        outputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            verdict: { type: "string" },
            redFlags: { type: "array", items: { type: "string" } },
            explanation: { type: "string" },
            a2aFlow: { 
              type: "string", 
              description: "A2A coordination flow showing agent interactions" 
            }
          }
        }
      }
    ],
    a2a: {
      version: "1.0",
      agentType: "security_analyst",
      discoveryEndpoint: "/.well-known/agent.json",
      messageTypes: ["discovery", "task_request", "task_response", "status"],
      coordinationTypes: [
        "vulnerability_scan",
        "incident_response",
        "compliance_check",
        "threat_analysis",
        "remediation",
        "url_analysis"
      ],
      canCoordinateWith: ["scanner", "triage", "fix", "governance"],
      internalAgents: [
        {
          name: "UrlFeatureAgent",
          role: "Extract URL features and structural analysis"
        },
        {
          name: "UrlScanAgent",
          role: "Call urlscan.io API for security scanning"
        },
        {
          name: "PhishingRedFlagAgent",
          role: "Analyze and flag phishing indicators"
        }
      ]
    },
    mcp: {
      version: "2024-11-05",
      servers: [
        {
          name: "exa-mcp",
          description: "Exa AI semantic web search via MCP",
          transport: ["stdio", "http"],
          tools: ["exa_search"]
        }
      ],
      tools: [
        {
          name: "exa_search",
          description: "Search the web using Exa AI semantic search",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              numResults: { type: "number", default: 20, description: "Number of results" }
            },
            required: ["query"]
          }
        }
      ]
    }
  },
  endpoints: {
    checkUrl: {
      method: "POST",
      path: "/check",
      description: "A2A endpoint for URL phishing analysis"
    },
    chat: {
      method: "POST",
      path: "/api/chat",
      description: "General chat endpoint with MCP and A2A support"
    },
    health: {
      method: "GET",
      path: "/healthz",
      description: "Health check endpoint"
    },
    agentCard: {
      method: "GET",
      path: "/.well-known/agent.json",
      description: "Agent discovery endpoint"
    }
  }
};

// Well-known endpoint for auto-discovery
app.get("/.well-known/agent.json", (_req, res) => {
  res.json(agentCard);
});

// Serve static files from frontend directory ONLY in development (AFTER all API routes)
// Production: Cloud Run is API-only, frontend served separately on Vercel
if (process.env.NODE_ENV === 'development' || process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(process.cwd(), "frontend")));
}

// Export app for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== "1") {
  // OPTIMIZATION: Pre-initialize agent in background on server startup
  preInitializeAgent().catch(err => {
    logger.warn("Background agent pre-initialization failed:", err);
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`[INFO] http server listening on port ${port}`);
  });
}
