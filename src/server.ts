import express from "express";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import { validateInput } from "./utils/input-validator";
import { exaSearch } from "./utils/mcp-client.js";
import * as dotenv from "dotenv";
import http from "http";

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Verisense AgentKit is running\n");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
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
      // Use dynamic import - tsx handles this better than require for TypeScript files
      // Try both .js and without extension for tsx compatibility
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
      const errorStack = error instanceof Error ? error.stack : String(error);
      logger.error("Failed to load agent modules:", errorMsg);
      logger.error("Error details:", errorStack);
      return false;
    }
  }
  return true;
}

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(express.json());
app.use(express.static("public"));

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

// Initialize agent (singleton)
let agentInstance: any = null;
let agentInitialized = false;

async function getAgent() {
  // Try to load modules if not already loaded
  if (!initializeAgent) {
    const loaded = await loadAgentModules();
    if (!loaded) {
      throw new Error("Agent initialization module not available - decorator metadata issue");
    }
  }
  
  if (!initializeAgent) {
    throw new Error("Agent initialization module not available");
  }
  
  // Initialize agent if not already initialized
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

// API Routes

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    agentInitialized,
    timestamp: new Date().toISOString(),
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

    // Input validation and sanitization (best practice: guardrails)
    const inputValidation = validateInput(message);
    if (!inputValidation.valid) {
      return res.status(400).json({
        error: "Invalid input",
        message: inputValidation.error,
      });
    }
    
    const sanitizedMessage = inputValidation.sanitized;

    // Check if this is a website scan request
    const websiteScanPattern = /scan\s+(?:website|site|url|link)?\s+(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,})/i;
    const websiteScanMatch = sanitizedMessage.match(websiteScanPattern);
    let websiteToScan: string | null = null;
    if (websiteScanMatch) {
      websiteToScan = websiteScanMatch[1];
      logger.info(`Detected website scan request: ${websiteToScan}`);
    }

    // Check if this is a search query and try Exa search directly
    // Enhanced detection for better search query recognition
    const searchKeywords = [
      "search", "find", "look for", "show me", "what is", "tell me about",
      "cve", "vulnerability", "exploit", "threat", "security", "breach",
      "attack", "malware", "ransomware", "phishing", "zero-day",
      "patch", "update", "advisory", "alert", "incident"
    ];
    const isSearchQuery = !websiteToScan && sanitizedMessage.length > 3 && (
      searchKeywords.some(keyword => sanitizedMessage.toLowerCase().includes(keyword)) ||
      sanitizedMessage.match(/^\d{4}/) || // Year queries like "2025"
      sanitizedMessage.match(/cve-\d{4}-\d+/i) || // CVE IDs
      sanitizedMessage.split(' ').length <= 5 // Short queries are likely searches
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
      // Try to load and initialize agent
      try {
        await getAgent();
      } catch (error) {
        logger.error("Agent initialization error in chat endpoint:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Check if it's a missing API key issue (Level 1 can work without CDP keys)
        if (errorMsg.includes("CDP_API_KEY") || errorMsg.includes("OPENAI_API_KEY")) {
          return res.status(503).json({
            error: "Agent not initialized",
            message: "Missing required API keys. Please check your .env file.",
            details: errorMsg,
            hint: "For Level 1 (local), only OPENAI_API_KEY is required. For other levels, CDP keys are needed.",
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
      messageToSend = `Scan website ${websiteToScan} for phishing and security risks`;
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
        // Check if agent provided meaningful context (not just "searching" or "let me")
        if (content.length > 50 && !content.toLowerCase().includes("let me search") && 
            !content.toLowerCase().includes("searching for")) {
          agentProvidedContext = true;
        }
      } else if ("tools" in chunk) {
        const toolContent = chunk.tools.messages[0].content;
        logger.debug("Tool execution:", toolContent);
        
        // Check if this is an Exa search result or website scan result
        try {
          // Try to parse JSON from tool response
          const jsonMatch = toolContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.results && Array.isArray(parsed.results) && parsed.query) {
              // This looks like Exa search results
              agentExaResults = parsed.results;
              logger.info(`Exa search executed: "${parsed.query}" returned ${parsed.results.length} results`);
            } else if (parsed.a2aFlow && parsed.website) {
              // This is a website scan result with A2A flow - prepend A2A flow to response
              logger.info(`[A2A] Website scan completed for ${parsed.website}`);
              if (!fullResponse.includes("A2A Agent Coordination")) {
                fullResponse = parsed.a2aFlow + "\n\n" + fullResponse;
              }
            }
          }
        } catch (e) {
          // Not JSON or not Exa results, continue
        }
      }
    }

    // Use agent results if available, otherwise use direct Exa search results
    const finalExaResults = agentExaResults.length > 0 ? agentExaResults : exaSearchResults;
    
    // If agent didn't provide context and we have search results, add a helpful intro
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
    
    // Enhance response with Exa results if available
    let enhancedResponse = fullResponse;
    if (finalExaResults.length > 0) {
      // Add a helpful summary if agent didn't provide one
      if (!fullResponse.toLowerCase().includes("found") && !fullResponse.toLowerCase().includes("result")) {
        enhancedResponse += `\n\nI found ${finalExaResults.length} relevant result${finalExaResults.length > 1 ? 's' : ''} for your query.`;
      }
      
      // Add search results with better formatting
      if (!fullResponse.includes("**Search Results:**") && !fullResponse.includes("**Results:**")) {
        enhancedResponse += "\n\n**📋 Search Results:**\n\n";
      }
      
      // Group and format results with better context
      finalExaResults.slice(0, 8).forEach((result, idx) => {
        const title = result.title && result.title !== "Untitled" && result.title !== "Search Result" 
          ? result.title 
          : result.url 
            ? extractTitleFromUrl(result.url) 
            : `Result ${idx + 1}`;
        const url = result.url || "";
        const source = (result as any).source || "Unknown";
        
        // Extract domain for context
        let domain = "";
        try {
          if (url) {
            const urlObj = new URL(url);
            domain = urlObj.hostname.replace(/^www\./, '');
          }
        } catch (e) {
          // Invalid URL, skip domain
        }
        
        // Format snippet better
        let snippet = "";
        if (result.snippet && result.snippet.trim()) {
          snippet = result.snippet.trim();
        } else if (result.text && result.text.trim()) {
          snippet = result.text.trim();
        }
        
        // Clean up snippet
        if (snippet) {
          // Remove excessive whitespace
          snippet = snippet.replace(/\s+/g, ' ').trim();
          // Limit length but keep it meaningful
          if (snippet.length > 250) {
            const lastSpace = snippet.substring(0, 250).lastIndexOf(' ');
            snippet = snippet.substring(0, lastSpace > 0 ? lastSpace : 250) + '...';
          }
        }
        
        // Build formatted result with clickable links
        if (url) {
          // Use markdown link format: [title](url)
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
      ...(finalExaResults.length > 0 && { exaSearchResults: finalExaResults }),
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
 * Security analytics endpoint
 */
app.get("/api/analytics", (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const summary = securityAnalytics.getSummary(hours);
    res.json(summary);
  } catch (error) {
    logger.error("Error getting analytics", error);
    res.status(500).json({
      error: "Failed to get analytics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Security events endpoint
 */
app.get("/api/events", (req, res) => {
  try {
    const events = securityAnalytics.getAllEvents();
    const limit = parseInt(req.query.limit as string) || 100;
    res.json({
      events: events.slice(-limit),
      total: events.length,
    });
  } catch (error) {
    logger.error("Error getting events", error);
    res.status(500).json({
      error: "Failed to get events",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Wallet info endpoint
 */
app.get("/api/wallet", async (req, res) => {
  try {
    const { agent } = await getAgent();
    // Use agent to get wallet details via a simple query
    const stream = await agent.stream(
      { messages: [new HumanMessage("Get wallet details")] },
      (await getAgent()).config,
    );

    let response = "";
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content;
      }
    }

    res.json({
      info: response,
    });
  } catch (error) {
    logger.error("Error getting wallet info", error);
    res.status(500).json({
      error: "Failed to get wallet info",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Wallet connect endpoint - Store wallet connection info
 */
app.post("/api/wallet/connect", (req, res) => {
  try {
    const { type, address, network, chainId, name } = req.body;
    logger.info(`Wallet connected: ${type} - ${address}`);
    res.json({
      success: true,
      message: "Wallet connection info received",
      wallet: { type, address, network, chainId, name },
    });
  } catch (error) {
    logger.error("Error storing wallet info", error);
    res.status(500).json({
      error: "Failed to store wallet info",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Exa search endpoint using MCP server
 */
app.post("/api/exa/search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Query is required and must be a string",
      });
    }

    // Input validation
    const inputValidation = validateInput(query);
    if (!inputValidation.valid) {
      return res.status(400).json({
        error: "Invalid input",
        message: inputValidation.error,
      });
    }

    logger.info(`Exa search request: ${query}`);

    // Use agent with MCP tools to perform Exa search
    const { agent, config } = await getAgent();
    
    if (!HumanMessage) {
      await loadAgentModules();
      if (!HumanMessage) {
        return res.status(503).json({
          error: "Missing dependencies",
          message: "HumanMessage class not available",
        });
      }
    }

    // Create search prompt that will trigger Exa MCP tool
    const searchPrompt = `Search the web using Exa for: ${inputValidation.sanitized}`;
    
    const stream = await agent.stream(
      { messages: [new HumanMessage(searchPrompt)] },
      config,
    );

    let fullResponse = "";
    const searchResults: Array<{ title: string; url: string; text: string; snippet?: string }> = [];

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        const content = chunk.agent.messages[0].content;
        fullResponse += content;
      } else if ("tools" in chunk) {
        // Extract search results from tool execution
        const toolContent = chunk.tools.messages[0].content;
        logger.debug("Exa tool execution:", toolContent);
        
        // Try to parse JSON results from tool response
        try {
          const jsonMatch = toolContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.results && Array.isArray(parsed.results)) {
              searchResults.push(...parsed.results);
            } else if (parsed.title || parsed.url) {
              searchResults.push(parsed);
            }
          }
        } catch (e) {
          // If not JSON, try to extract URLs and text from response
          const urlRegex = /https?:\/\/[^\s]+/g;
          const urls = toolContent.match(urlRegex) || [];
          urls.forEach((url: string, idx: number) => {
            if (!searchResults.find(r => r.url === url)) {
              searchResults.push({
                title: `Result ${idx + 1}`,
                url: url,
                text: toolContent.substring(0, 200),
                snippet: toolContent.substring(0, 150),
              });
            }
          });
        }
      }
    }

    // If no structured results found, try to extract from full response
    if (searchResults.length === 0 && fullResponse) {
      const urlRegex = /https?:\/\/[^\s\)]+/g;
      const urls = fullResponse.match(urlRegex) || [];
      urls.slice(0, 10).forEach((url: string, idx: number) => {
        searchResults.push({
          title: `Search Result ${idx + 1}`,
          url: url,
          text: fullResponse.substring(0, 200),
          snippet: fullResponse.substring(0, 150),
        });
      });
    }

    // If still no results, return a message indicating search was performed
    if (searchResults.length === 0) {
      return res.json({
        results: [],
        message: "Search completed but no structured results found",
        rawResponse: fullResponse.substring(0, 500),
      });
    }

    res.json({
      results: searchResults,
      query: inputValidation.sanitized,
    });
  } catch (error) {
    logger.error("Error performing Exa search", error);
    res.status(500).json({
      error: "Failed to perform search",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Serve Exa search page
app.get("/exa", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exa Web Search - VeriSense</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', monospace;
            background: #0a0e1a;
            background-image: 
                radial-gradient(circle at 20% 50%, rgba(0, 255, 255, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(0, 255, 200, 0.03) 0%, transparent 50%);
            min-height: 100vh;
            padding: 20px;
            color: #a0a8b8;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: #0f1419;
            border: 1px solid rgba(0, 255, 255, 0.15);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 255, 255, 0.05);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 200, 255, 0.08) 100%);
            border-bottom: 1px solid rgba(0, 255, 255, 0.2);
            color: #e0e8f0;
            padding: 30px;
            text-align: center;
            box-shadow: inset 0 -1px 0 rgba(0, 255, 255, 0.1);
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .search-section {
            background: rgba(0, 255, 255, 0.05);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(0, 255, 255, 0.2);
        }
        .search-input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .search-input-group input {
            flex: 1;
            padding: 14px 16px;
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 4px;
            font-size: 1em;
            color: #e0e8f0;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
        }
        .search-input-group input:focus {
            outline: none;
            border-color: rgba(0, 255, 255, 0.4);
            box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.1), 0 0 10px rgba(0, 255, 255, 0.1);
            background: #0f1419;
        }
        .search-input-group button {
            padding: 14px 28px;
            background: rgba(0, 255, 255, 0.1);
            color: #00ffff;
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 2px 8px rgba(0, 255, 255, 0.1);
        }
        .search-input-group button:hover:not(:disabled) {
            background: rgba(0, 255, 255, 0.15);
            border-color: rgba(0, 255, 255, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.2), 0 2px 8px rgba(0, 255, 255, 0.15);
            transform: translateY(-1px);
        }
        .search-input-group button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .results-section {
            margin-top: 20px;
        }
        .result-item {
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.1);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 15px;
            transition: all 0.3s;
        }
        .result-item:hover {
            border-color: rgba(0, 255, 255, 0.3);
            box-shadow: 0 4px 12px rgba(0, 255, 255, 0.1);
        }
        .result-title {
            color: #00d4ff;
            font-size: 1.2em;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .result-title a {
            color: #00d4ff;
            text-decoration: none;
            transition: all 0.3s;
        }
        .result-title a:hover {
            color: #00ffff;
            text-shadow: 0 0 8px rgba(0, 212, 255, 0.3);
        }
        .result-url {
            color: #6a7888;
            font-size: 0.9em;
            margin-bottom: 10px;
            font-family: 'Courier New', monospace;
        }
        .result-snippet {
            color: #a0a8b8;
            line-height: 1.6;
            margin-top: 10px;
        }
        .loading {
            text-align: center;
            color: #6a7888;
            padding: 40px;
            font-family: 'Courier New', monospace;
        }
        .error {
            background: rgba(255, 68, 68, 0.1);
            border: 1px solid rgba(255, 68, 68, 0.3);
            border-radius: 6px;
            padding: 15px;
            color: #ff4444;
            margin-bottom: 15px;
        }
        .no-results {
            text-align: center;
            color: #6a7888;
            padding: 40px;
            font-family: 'Courier New', monospace;
        }
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #00d4ff;
            text-decoration: none;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
        }
        .back-link:hover {
            color: #00ffff;
            text-shadow: 0 0 8px rgba(0, 212, 255, 0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Exa Web Search</h1>
            <p>AI-Powered Web Search using Exa MCP Server</p>
        </div>
        <div class="content">
            <a href="/" class="back-link">← Back to WebWatcher</a>
            <div class="search-section">
                <div class="search-input-group">
                    <input type="text" id="searchInput" placeholder="Enter your search query..." onkeypress="if(event.key==='Enter') performSearch()">
                    <button type="button" onclick="performSearch()" id="searchButton">Search</button>
                </div>
            </div>
            <div id="resultsContainer">
                <div class="no-results">Enter a search query above to get started</div>
            </div>
        </div>
    </div>

    <script>
        async function performSearch() {
            const input = document.getElementById('searchInput');
            const button = document.getElementById('searchButton');
            const resultsContainer = document.getElementById('resultsContainer');
            
            const query = input.value.trim();
            if (!query) {
                return;
            }
            
            button.disabled = true;
            button.textContent = 'Searching...';
            resultsContainer.innerHTML = '<div class="loading">🔍 Searching the web...</div>';
            
            try {
                const response = await fetch('/api/exa/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || \`HTTP \${response.status}\`);
                }
                
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    resultsContainer.innerHTML = data.results.map(result => \`
                        <div class="result-item">
                            <div class="result-title">
                                <a href="\${result.url}" target="_blank">\${result.title || 'Untitled'}</a>
                            </div>
                            <div class="result-url">\${result.url}</div>
                            <div class="result-snippet">\${result.text || result.snippet || 'No description available'}</div>
                        </div>
                    \`).join('');
                } else {
                    resultsContainer.innerHTML = '<div class="no-results">No results found. Try a different search query.</div>';
                }
            } catch (error) {
                console.error('Search error:', error);
                resultsContainer.innerHTML = \`<div class="error">Error: \${error.message || 'Failed to perform search'}</div>\`;
            } finally {
                button.disabled = false;
                button.textContent = 'Search';
            }
        }
    </script>
</body>
</html>
  `);
});

// Serve HTML interface
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VeriSense - Cybersecurity Agent</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            background: #0d1117;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 0;
            color: #c9d1d9;
        }
        .container {
            max-width: 1000px;
            width: 100%;
            margin: 0 auto;
            background: #161b22;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            overflow: hidden;
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-top: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        }
        .header {
            background: #161b22;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            color: #f0f6fc;
            padding: 32px 40px;
            text-align: center;
        }
        .header {
            position: relative;
        }
        .header-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }
        .header h1 {
            font-size: 2em;
            margin-bottom: 8px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        .header p {
            opacity: 0.7;
            font-size: 0.95em;
            font-weight: 400;
        }
        .info-icon {
            position: absolute;
            top: 32px;
            right: 40px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #c9d1d9;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 18px;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        .info-icon:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.2);
            color: #f0f6fc;
            transform: scale(1.05);
        }
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        .modal-overlay.active {
            display: flex;
        }
        .modal {
            background: #161b22;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            animation: modalSlideIn 0.3s ease;
        }
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .modal-header {
            padding: 24px 32px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .modal-header h2 {
            margin: 0;
            font-size: 1.5em;
            font-weight: 600;
            color: #f0f6fc;
        }
        .modal-close {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #c9d1d9;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: all 0.2s ease;
        }
        .modal-close:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
            color: #f0f6fc;
        }
        .modal-body {
            padding: 32px;
            color: #c9d1d9;
            line-height: 1.6;
        }
        .modal-body h3 {
            color: #f0f6fc;
            font-size: 1.2em;
            margin-top: 24px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .modal-body h3:first-child {
            margin-top: 0;
        }
        .modal-body p {
            margin-bottom: 16px;
            font-size: 0.95em;
        }
        .modal-body ul {
            margin-left: 20px;
            margin-bottom: 16px;
        }
        .modal-body li {
            margin-bottom: 8px;
            font-size: 0.95em;
        }
        .modal-body code {
            background: rgba(255, 255, 255, 0.05);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #58a6ff;
        }
        .content {
            padding: 32px 40px;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
        }
        .chat-section {
            background: transparent;
            border-radius: 0;
            padding: 0;
            border: none;
            box-shadow: none;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            height: 100%;
        }
        .analytics-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }
        .chat-section h2, .analytics-section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        .chat-section h2 {
            color: #f0f6fc;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.25em;
            font-weight: 500;
            margin-bottom: 24px;
            flex-shrink: 0;
        }
        .chat-messages {
            background: #0d1117;
            border-radius: 8px;
            padding: 24px;
            flex: 1 1 auto;
            overflow-y: auto;
            overflow-x: hidden;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            min-height: 0;
            max-height: none;
        }
        .chat-messages::-webkit-scrollbar {
            width: 8px;
        }
        .chat-messages::-webkit-scrollbar-track {
            background: #0a0e14;
            border-radius: 4px;
        }
        .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(0, 255, 255, 0.3);
            border-radius: 4px;
        }
        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 255, 255, 0.5);
        }
        .message {
            margin-bottom: 20px;
            padding: 16px 20px;
            border-radius: 8px;
        }
        .message.user {
            background: rgba(56, 139, 253, 0.1);
            text-align: right;
            border: 1px solid rgba(56, 139, 253, 0.2);
        }
        .message.agent {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .message-label {
            font-weight: 600;
            font-size: 0.85em;
            margin-bottom: 8px;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .chat-input {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex-shrink: 0;
        }
        .chat-input-row {
            display: flex;
            gap: 10px;
            width: 100%;
            align-items: center;
            flex-shrink: 0;
        }
        .chat-input input {
            flex: 1;
            padding: 16px 20px;
            background: #0d1117;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            font-size: 0.95em;
            color: #f0f6fc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            transition: all 0.2s ease;
            width: 100%;
            min-width: 0;
        }
        .chat-input input:focus {
            outline: none;
            border-color: rgba(56, 139, 253, 0.5);
            background: #161b22;
            box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.1);
        }
        .chat-input input::placeholder {
            color: #6e7681;
        }
        .chat-input button {
            padding: 16px 20px;
            background: #238636;
            color: #ffffff;
            border: 1px solid #238636;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.2em;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            transition: all 0.2s ease;
            min-width: 60px;
            box-shadow: 0 1px 3px rgba(35, 134, 54, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .chat-input button:hover:not(:disabled) {
            background: #2ea043;
            border-color: #2ea043;
            box-shadow: 0 2px 6px rgba(35, 134, 54, 0.4);
            transform: translateY(-1px);
        }
        .chat-input button:active:not(:disabled) {
            background: #238636;
            border-color: #238636;
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(35, 134, 54, 0.3);
        }
        .mcp-suggestion-btn {
            padding: 10px 18px;
            background: rgba(35, 134, 54, 0.1);
            color: #3fb950;
            border: 1px solid rgba(35, 134, 54, 0.3);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875em;
            font-weight: 500;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        .mcp-suggestion-btn:hover {
            background: rgba(35, 134, 54, 0.2);
            border-color: rgba(35, 134, 54, 0.5);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(35, 134, 54, 0.2);
        }
        .mcp-suggestion-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(35, 134, 54, 0.15);
        }
        .chat-input button:disabled {
            background: #21262d;
            color: #6e7681;
            border-color: #30363d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .mcp-suggestion-btn {
            padding: 10px 18px;
            background: rgba(35, 134, 54, 0.1);
            color: #3fb950;
            border: 1px solid rgba(35, 134, 54, 0.3);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875em;
            font-weight: 500;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        .mcp-suggestion-btn:hover {
            background: rgba(35, 134, 54, 0.2);
            border-color: rgba(35, 134, 54, 0.5);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(35, 134, 54, 0.2);
        }
        .mcp-suggestion-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(35, 134, 54, 0.15);
        }
        .analytics-card {
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.1);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: inset 0 1px 0 rgba(0, 255, 255, 0.05);
        }
        .analytics-card h3 {
            color: #00d4ff;
            margin-bottom: 10px;
            text-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
        }
        .stat {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0, 255, 255, 0.05);
        }
        .stat:last-child {
            border-bottom: none;
        }
        .stat-label {
            color: #8a98a8;
        }
        .stat-value {
            font-weight: bold;
            color: #00ffff;
            font-family: 'Courier New', monospace;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
            box-shadow: 0 0 6px currentColor;
        }
        .status-online {
            background: #00ff88;
            color: #00ff88;
        }
        .status-offline {
            background: #ff4444;
            color: #ff4444;
        }
        .loading {
            text-align: center;
            color: #6a7888;
            padding: 20px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.1);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9em;
            color: #a0d0ff;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="info-icon" onclick="openInfoModal()" title="About WebWatcher">ℹ</div>
            <h1>🔒 WebWatcher</h1>
            <p>Cybersecurity Agent for Web2 and Web3</p>
            <div style="margin-top: 16px; padding: 10px 16px; background: rgba(35, 134, 54, 0.1); border: 1px solid rgba(35, 134, 54, 0.2); border-radius: 6px; text-align: center;">
                <div style="color: #3fb950; font-size: 0.875em; font-weight: 500;">
                    <strong>✓ MCP and A2A enabled</strong> <span style="color: #6e7681; margin: 0 8px;">•</span> <span style="color: #8b949e;">x402 coming soon</span>
                </div>
            </div>
        </div>
        
        <!-- Info Modal -->
        <div class="modal-overlay" id="infoModal" onclick="closeInfoModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>About WebWatcher</h2>
                    <button class="modal-close" onclick="closeInfoModal(event)">×</button>
                </div>
                <div class="modal-body">
                    <h3>Overview</h3>
                    <p>
                        WebWatcher is an advanced cybersecurity agent built on <strong>VeriSense</strong> and <strong>AgentKit</strong>. 
                        It provides comprehensive security analysis, threat detection, and monitoring capabilities for both Web2 and Web3 environments.
                    </p>
                    
                    <h3>Key Features</h3>
                    <ul>
                        <li><strong>Website Security Scanning</strong> - Detect phishing red flags and security risks using A2A (Agent-to-Agent) coordination</li>
                        <li><strong>CVE Vulnerability Search</strong> - Search Common Vulnerabilities and Exposures database</li>
                        <li><strong>Blockchain Transaction Analysis</strong> - Analyze blockchain transactions for suspicious patterns and risks</li>
                        <li><strong>Wallet Risk Scanning</strong> - Scan wallet addresses for security threats and anomalies</li>
                        <li><strong>Security State Summaries</strong> - Get comprehensive security posture assessments</li>
                        <li><strong>Advanced Web Search</strong> - Powered by Exa MCP for high-quality, semantic search results</li>
                    </ul>
                    
                    <h3>Technology Stack</h3>
                    <ul>
                        <li><strong>AgentKit</strong> - Coinbase's framework for building AI agents</li>
                        <li><strong>VeriSense</strong> - Security-focused agent platform</li>
                        <li><strong>MCP (Model Context Protocol)</strong> - For tool integration and agent coordination</li>
                        <li><strong>A2A Coordination</strong> - Automatic agent-to-agent communication for complex tasks</li>
                        <li><strong>Exa Search</strong> - Advanced semantic web search capabilities</li>
                    </ul>
                    
                    <h3>How It Works</h3>
                    <p>
                        WebWatcher uses intelligent agent coordination to analyze security threats. When you scan a website, 
                        multiple specialized agents work together:
                    </p>
                    <ul>
                        <li><code>UrlFeatureAgent</code> extracts URL features and patterns</li>
                        <li><code>PhishingRedFlagAgent</code> analyzes features for phishing indicators</li>
                        <li>Results are automatically coordinated via A2A protocol</li>
                    </ul>
                    
                    <h3>Usage</h3>
                    <p>
                        Simply type your security questions or use the quick action buttons above the input field. 
                        Try commands like:
                    </p>
                    <ul>
                        <li>"scan website example.com" - Scan for phishing risks</li>
                        <li>"search CVE log4j" - Find vulnerability information</li>
                        <li>"analyze transaction 0x..." - Analyze blockchain transactions</li>
                    </ul>
                    
                    <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); color: #8b949e; font-size: 0.9em;">
                        Built with ⚡ <strong>AgentKit</strong> and 🔒 <strong>VeriSense</strong> | Made by <strong>Edward</strong>
                    </p>
                </div>
            </div>
        </div>
        <div class="content">
            <div class="chat-section">
                <h2>💬 Chat with WebWatcher</h2>
                <div class="chat-messages" id="chatMessages">
                </div>
                <div class="chat-input">
                    <div id="mcpSuggestions" style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
                        <button type="button" onclick="useMcpCommand('search_cve')" class="mcp-suggestion-btn" title="Search CVE vulnerabilities">
                            🔍 Search CVE
                        </button>
                        <button type="button" onclick="useMcpCommand('analyze_transaction')" class="mcp-suggestion-btn" title="Analyze blockchain transaction">
                            🔎 Analyze Transaction
                        </button>
                        <button type="button" onclick="useMcpCommand('scan_wallet_risks')" class="mcp-suggestion-btn" title="Scan wallet for risks">
                            🛡️ Scan Wallet
                        </button>
                        <button type="button" onclick="useMcpCommand('summarize_security_state')" class="mcp-suggestion-btn" title="Get security summary">
                            📊 Security Summary
                        </button>
                    </div>
                    <div class="chat-input-row">
                        <input type="text" id="messageInput" placeholder="Ask about security analysis, transactions, addresses... (or click buttons above)" onkeypress="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }">
                        <button type="button" onclick="sendMessage()" id="sendButton" style="cursor: pointer;">➡️</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let threadId = 'web-' + Date.now();

        function openInfoModal() {
            const modal = document.getElementById('infoModal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }

        function closeInfoModal(event) {
            if (event) {
                event.stopPropagation();
            }
            const modal = document.getElementById('infoModal');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        // Close modal on Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeInfoModal(event);
            }
        });

        async function checkStatus() {
            // Status check removed per user request
            try {
                const response = await fetch('/health');
                const data = await response.json();
                // Status display removed
            } catch (error) {
                // Status display removed
            }
        }

        async function sendMessage() {
            try {
                const input = document.getElementById('messageInput');
                if (!input) {
                    console.error('Message input not found');
                    return;
                }
                
                const message = input.value.trim();
                if (!message) {
                    console.log('Empty message, ignoring');
                    return;
                }

                const sendButton = document.getElementById('sendButton');
                if (!sendButton) {
                    console.error('Send button not found');
                    return;
                }
                
                sendButton.disabled = true;
                sendButton.textContent = '⏳';

                // Add user message to chat
                addMessage('user', message);
                input.value = '';

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, threadId })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || \`HTTP \${response.status}\`);
                }

                const data = await response.json();
                if (data.response) {
                    addMessage('agent', data.response);
                } else {
                    addMessage('agent', 'Error: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error sending message:', error);
                addMessage('agent', 'Error: Failed to send message. ' + (error.message || 'Unknown error'));
            } finally {
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = '➡️';
                }
                // Analytics refresh removed - section no longer exists
                // refreshAnalytics();
            }
        }
        
        // Make sendMessage available globally
        window.sendMessage = sendMessage;

        // MCP command suggestions handler
        function useMcpCommand(command) {
            const input = document.getElementById('messageInput');
            if (!input) return;

            const examples = {
                'search_cve': 'Search for CVE vulnerabilities in OpenSSL 2024',
                'analyze_transaction': 'Analyze transaction 0x123... on ethereum',
                'scan_wallet_risks': 'Scan wallet 0x456... on base for risks',
                'summarize_security_state': 'Summarize security for address 0x789...'
            };

            const example = examples[command] || '';
            input.value = example;
            input.focus();
            // Optionally auto-send
            // sendMessage();
        }
        window.useMcpCommand = useMcpCommand;

        function addMessage(type, content) {
            const messagesDiv = document.getElementById('chatMessages');
            if (!messagesDiv) return;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            messageDiv.innerHTML = '<div class="message-label">' + (type === 'user' ? 'You' : 'WebWatcher Agent') + '</div><div>' + formatMessage(content) + '</div>';
            messagesDiv.appendChild(messageDiv);
            
            // Force scroll to bottom - use requestAnimationFrame for smooth scrolling
            requestAnimationFrame(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            });
            
            // Also scroll after a short delay to ensure content is rendered
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 50);
        }

        function formatMessage(content) {
            // Simple formatting for JSON and code blocks
            if (content.includes('{') && content.includes('}')) {
                try {
                    const jsonMatch = content.match(/\\{[\\s\\S]*\\}/);
                    if (jsonMatch) {
                        const json = JSON.parse(jsonMatch[0]);
                        return content.replace(jsonMatch[0], '<pre>' + JSON.stringify(json, null, 2) + '</pre>');
                    }
                } catch (e) {
                    // Not valid JSON, continue
                }
            }
            
            // Convert markdown code blocks and inline code
            // Note: Using String.fromCharCode to avoid template string delimiter conflicts
            const bt = String.fromCharCode(96);
            const codeBlockRe = new RegExp(bt + bt + bt + '([\\s\\S]*?)' + bt + bt + bt, 'g');
            content = content.replace(codeBlockRe, '<pre style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); padding: 10px; border-radius: 4px; overflow-x: auto; margin: 10px 0;"><code>$1</code></pre>');
            const inlineCodeRe = new RegExp(bt + '([^' + bt + ']+)' + bt, 'g');
            content = content.replace(inlineCodeRe, function(match, code) {
                // Highlight A2A flow indicators with green background
                if (code.indexOf('->') !== -1 || code.indexOf('Agent') !== -1 || code.indexOf('User') !== -1) {
                    return '<code style="background: rgba(0, 255, 136, 0.2); padding: 2px 6px; border-radius: 3px; color: #00ff88; font-weight: bold; border: 1px solid rgba(0, 255, 136, 0.4);">' + code + '</code>';
                }
                return '<code style="background: rgba(0, 255, 255, 0.1); padding: 2px 4px; border-radius: 3px;">' + code + '</code>';
            });
            
            // Convert markdown links [text](url) to HTML hyperlinks (must be done before other markdown)
            content = content.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #00d4ff; text-decoration: underline; cursor: pointer;">$1</a>');
            
            // Convert markdown bold **text** to HTML (handle multiple bold sections)
            content = content.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
            
            // Convert markdown italic *text* to HTML (avoid matching **bold**)
            // Match single * that aren't preceded or followed by another *
            content = content.replace(/(^|[^*])\\*([^*]+)\\*([^*]|$)/g, '$1<em>$2</em>$3');
            
            // Convert markdown headers # Header to HTML
            content = content.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            content = content.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            content = content.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            
            // Convert markdown lists - item to HTML
            content = content.replace(/^- (.*$)/gm, '<li>$1</li>');
            
            // Convert line breaks
            content = content.replace(/\\n/g, '<br>');
            
            return content;
        }

        async function refreshAnalytics() {
            try {
                const response = await fetch('/api/analytics?hours=24');
                const data = await response.json();
                
                const analyticsDiv = document.getElementById('analyticsContent');
                if (!analyticsDiv) {
                    // Analytics section removed, skip refresh
                    return;
                }
                analyticsDiv.innerHTML =
                    '<div class="analytics-card">' +
                        '<h3>📈 Summary (Last 24 Hours)</h3>' +
                        '<div class="stat">' +
                            '<span class="stat-label">Total Events</span>' +
                            '<span class="stat-value">' + data.totalEvents + '</span>' +
                        '</div>' +
                        '<div class="stat">' +
                            '<span class="stat-label">Average Risk Score</span>' +
                            '<span class="stat-value">' + data.averageRiskScore.toFixed(2) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="analytics-card">' +
                        '<h3>⚠️ By Severity</h3>' +
                        '<div class="stat">' +
                            '<span class="stat-label">Low</span>' +
                            '<span class="stat-value">' + (data.bySeverity.low || 0) + '</span>' +
                        '</div>' +
                        '<div class="stat">' +
                            '<span class="stat-label">Medium</span>' +
                            '<span class="stat-value">' + (data.bySeverity.medium || 0) + '</span>' +
                        '</div>' +
                        '<div class="stat">' +
                            '<span class="stat-label">High</span>' +
                            '<span class="stat-value">' + (data.bySeverity.high || 0) + '</span>' +
                        '</div>' +
                        '<div class="stat">' +
                            '<span class="stat-label">Critical</span>' +
                            '<span class="stat-value">' + (data.bySeverity.critical || 0) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="analytics-card">' +
                        '<h3>📋 By Type</h3>' +
                        Object.entries(data.byType || {}).map(([type, count]) => 
                            '<div class="stat">' +
                                '<span class="stat-label">' + type + '</span>' +
                                '<span class="stat-value">' + count + '</span>' +
                            '</div>'
                        ).join('') +
                    '</div>' +
                '';
            } catch (error) {
                document.getElementById('analyticsContent').innerHTML = '<div class="loading">Error loading analytics</div>';
            }
        }

        // Initialize
        checkStatus();
        // Analytics refresh removed - section no longer exists
        // refreshAnalytics();
        setInterval(checkStatus, 5000);
        // setInterval(refreshAnalytics, 30000);
    </script>
    
    <footer style="background: rgba(0, 255, 255, 0.05); border-top: 1px solid rgba(0, 255, 255, 0.15); color: #8a98a8; padding: 20px; text-align: center; margin-top: auto; width: 100%;">
        <div style="font-size: 0.95em; line-height: 1.8; font-family: 'Courier New', monospace;">
            Built with 
            <a href="https://github.com/coinbase/agentkit" target="_blank" style="color: #00d4ff; text-decoration: none; border-bottom: 1px dotted rgba(0, 212, 255, 0.4); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(0, 212, 255, 0.8)'; this.style.textShadow='0 0 8px rgba(0, 212, 255, 0.3)'" onmouseout="this.style.borderBottomColor='rgba(0, 212, 255, 0.4)'; this.style.textShadow='none'">AgentKit</a>
            and 
            <a href="https://verisense.network/" target="_blank" style="color: #00d4ff; text-decoration: none; border-bottom: 1px dotted rgba(0, 212, 255, 0.4); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(0, 212, 255, 0.8)'; this.style.textShadow='0 0 8px rgba(0, 212, 255, 0.3)'" onmouseout="this.style.borderBottomColor='rgba(0, 212, 255, 0.4)'; this.style.textShadow='none'">VeriSense</a>
            | Made by 
            <a href="https://github.com/edwardtay" target="_blank" style="color: #00d4ff; text-decoration: none; border-bottom: 1px dotted rgba(0, 212, 255, 0.4); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(0, 212, 255, 0.8)'; this.style.textShadow='0 0 8px rgba(0, 212, 255, 0.3)'" onmouseout="this.style.borderBottomColor='rgba(0, 212, 255, 0.4)'; this.style.textShadow='none'">Edward</a>
        </div>
    </footer>
</body>
</html>
  `);
});

// Start server
async function startServer() {
  // Start server even if agent initialization fails
  // Listen on 0.0.0.0 for Cloud Run compatibility
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 WebWatcher Server running on port ${PORT}`);
    logger.info(`📊 Web Interface: http://0.0.0.0:${PORT}`);
    logger.info(`🔌 API Endpoints:`);
    logger.info(`   POST /api/chat - Chat with agent`);
    logger.info(`   GET  /api/analytics - Get security analytics`);
    logger.info(`   GET  /api/events - Get security events`);
    logger.info(`   GET  /api/wallet - Get wallet info`);
    logger.info(`   GET  /health - Health check`);
  });

  // Don't pre-initialize agent - let it initialize on first API call
  // This prevents decorator metadata errors from crashing the server
  logger.info("Server started. Agent will initialize on first API call if needed.");
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error("Fatal error starting server", error);
    process.exit(1);
  });
}

