import express from "express";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import { validateInput } from "./utils/input-validator";
import { exaSearch } from "./utils/mcp-client";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
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

// Root info page - API only (frontend is deployed separately on Vercel)
app.get("/", (_req, res) => {
  res.status(200).json({
    service: "WebWatcher API",
    status: "running",
    endpoints: {
      chat: "POST /api/chat",
      health: "GET /healthz",
      check: "POST /check",
      agentCard: "GET /.well-known/agent.json"
    },
    frontend: "Deployed separately on Vercel"
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
    
    let exaSearchResults: Array<{ title: string; url: string; text: string; snippet?: string; source?: string }> = [];
    if (isSearchQuery) {
      try {
        logger.info(`Detected search query, attempting Exa search: ${sanitizedMessage}`);
        exaSearchResults = await exaSearch(sanitizedMessage, 5);
        const mcpCount = exaSearchResults.filter((r: any) => r.source === "MCP").length;
        const apiCount = exaSearchResults.filter((r: any) => r.source === "API").length;
        logger.info(`Exa search returned ${exaSearchResults.length} results (${mcpCount} from MCP, ${apiCount} from API)`);
      } catch (error) {
        logger.warn("Exa search failed, continuing with agent response", error);
      }
    }

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
        if (errorMsg.includes("CDP_API_KEY") || errorMsg.includes("OPENAI_API_KEY")) {
          return res.status(503).json({
            error: "Agent not initialized",
            message: "Missing required API keys. Please check your .env file.",
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

    const { agent, config } = await getAgent();
    
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

    res.json({
      response: enhancedResponse,
      chunks,
      threadId: configWithThread.configurable.thread_id,
    });
  } catch (error) {
    logger.error("Error in chat endpoint", error);
    res.status(500).json({
      error: "Failed to process chat message",
      message: error instanceof Error ? error.message : String(error),
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
  "https://verisense-agentkit-414780218994.us-central1.run.app";

const agentCard = {
  id: "webwatcher-phish-checker",
  name: "WebWatcher Phishing URL Checker",
  description:
    "Cybersecurity agent that inspects a URL and reports phishing red flags using an internal A2A pipeline.",
  version: "1.0.0",
  author: {
    name: "NetWatch Team"
  },
  // extra fields so registries can auto-fill Agent URL
  agentUrl: agentBaseUrl,
  baseUrl: agentBaseUrl,
  capabilities: {
    functions: [
      {
        name: "checkUrl",
        description: "Analyze a URL and return phishing red flags.",
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
            explanation: { type: "string" }
          }
        }
      }
    ]
  },
  endpoints: {
    checkUrl: {
      method: "POST",
      path: "/check"
    }
  }
};

// Well-known endpoint for auto-discovery
app.get("/.well-known/agent.json", (_req, res) => {
  res.json(agentCard);
});

// Export app for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== "1") {
  app.listen(port, "0.0.0.0", () => {
    console.log(`[INFO] http server listening on port ${port}`);
  });
}
