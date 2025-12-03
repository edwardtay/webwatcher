/**
 * MCP Client Utility for connecting to MCP servers
 * Supports Exa and other MCP servers
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { logger } from "./logger";

let exaClient: Client | null = null;
let webwatcherClient: Client | null = null;

/**
 * Helper function to extract title from text content
 */
function extractTitleFromText(text: string): string {
  if (!text) return "";
  // Try to find title patterns
  const titleMatch = text.match(/title[:\s]+([^\n]+)/i) || 
                     text.match(/^#+\s+(.+)$/m) ||
                     text.match(/^(.{10,80})$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  // Return first sentence or first 60 chars
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > 60 ? firstLine.substring(0, 60) + "..." : firstLine;
}

/**
 * Helper function to extract title from URL
 */
function extractTitleFromUrl(url: string): string {
  if (!url) return "";
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      // Decode and format
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

/**
 * Initialize Exa MCP client
 * Exa MCP server should be configured in your MCP config file
 * Example config location: ~/.config/cursor/mcp.json or similar
 */
export async function getExaClient(): Promise<Client | null> {
  if (exaClient) {
    return exaClient;
  }

  // Check if HTTP-based MCP server URL is provided (for Cloud Run)
  const mcpServerUrl = process.env.EXA_MCP_SERVER_URL;
  
  if (mcpServerUrl) {
    // Use HTTP transport for Cloud Run/serverless environments
    try {
      logger.info(`Connecting to Exa MCP server via HTTP: ${mcpServerUrl}`);
      
      const transport = new StreamableHTTPClientTransport(
        new URL(mcpServerUrl),
        {
          requestInit: {
            headers: {
              "Authorization": `Bearer ${process.env.EXA_API_KEY || ""}`,
              "Content-Type": "application/json",
            },
          },
        }
      );

      exaClient = new Client(
        {
          name: "verisense-exa-client",
          version: "1.0.0",
        },
        {},
      );

      await exaClient.connect(transport);
      logger.info("✓ Connected to Exa MCP server via HTTP");
      return exaClient;
    } catch (error) {
      logger.warn("Failed to connect to Exa MCP server via HTTP, will use direct API", error);
      return null;
    }
  }

  // Check if we're in a serverless environment without HTTP MCP URL
  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    logger.info("Serverless environment detected. Set EXA_MCP_SERVER_URL to use MCP, otherwise using direct API");
    return null;
  }

  // Only try stdio MCP if explicitly enabled (for local development)
  if (process.env.EXA_USE_MCP !== "true") {
    logger.info("Exa MCP server disabled (set EXA_USE_MCP=true or EXA_MCP_SERVER_URL for HTTP). Using direct API.");
    return null;
  }

  // Use stdio transport for local development
  try {
    // Check if local exa-mcp.ts file exists, use tsx to run it
    const fs = await import("fs/promises");
    const path = await import("path");
    const localMcpPath = path.join(process.cwd(), "mcp", "exa-mcp.ts");
    
    let exaServerCommand: string;
    let exaServerArgs: string[];
    
    try {
      await fs.access(localMcpPath);
      // Use local MCP server file
      // Try npx tsx first (uses local node_modules), then tsx (global), then node with tsx
      const nodeModulesTsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");
      try {
        await fs.access(nodeModulesTsx);
        exaServerCommand = nodeModulesTsx;
        exaServerArgs = [localMcpPath];
        logger.info(`Using local Exa MCP server via node_modules tsx: ${localMcpPath}`);
      } catch {
        // Try npx tsx (will use local or download)
        exaServerCommand = "npx";
        exaServerArgs = ["-y", "tsx", localMcpPath];
        logger.info(`Using local Exa MCP server via npx tsx: ${localMcpPath}`);
      }
    } catch {
      // Fall back to global exa-mcp command or env var
      exaServerCommand = process.env.EXA_MCP_SERVER_COMMAND || "exa-mcp";
      exaServerArgs = process.env.EXA_MCP_SERVER_ARGS 
        ? process.env.EXA_MCP_SERVER_ARGS.split(" ")
        : [];
    }

    logger.info(`Connecting to Exa MCP server via stdio: ${exaServerCommand} ${exaServerArgs.length > 0 ? exaServerArgs.join(" ") : ""}`);

    const transport = new StdioClientTransport({
      command: exaServerCommand,
      args: exaServerArgs,
      env: {
        ...process.env,
        EXA_API_KEY: process.env.EXA_API_KEY || "",
      },
    });

    exaClient = new Client(
      {
        name: "verisense-exa-client",
        version: "1.0.0",
      },
      {},
    );

    await exaClient.connect(transport);
    logger.info("✓ Connected to Exa MCP server via stdio");

    return exaClient;
  } catch (error) {
    logger.warn("Failed to connect to Exa MCP server via stdio, will use direct API", error);
    return null;
  }
}

/**
 * Search using Exa API directly (fallback if MCP server not available)
 */
async function exaSearchDirect(
  query: string,
  numResults: number = 5,
): Promise<Array<{ title: string; url: string; text: string; snippet?: string; source?: string }>> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY not found in environment variables");
  }

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        num_results: numResults,
        contents: {
          text: { max_characters: 500 },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Exa API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { results?: any[] };
    
    if (data.results && Array.isArray(data.results)) {
      return data.results.map((result: any, idx: number) => ({
        title: result.title || result.name || extractTitleFromText(String(result.text || "")) || extractTitleFromUrl(String(result.url || "")) || `Result ${idx + 1}`,
        url: String(result.url || result.id || ""),
        text: String(result.text || result.content || ""),
        snippet: String(result.snippet || result.text?.substring(0, 200) || result.content?.substring(0, 200) || ""),
      }));
    }

    return [];
  } catch (error) {
    logger.error("Error calling Exa API directly", error);
    throw error;
  }
}

/**
 * Search using Exa MCP server, with fallback to direct API
 */
export async function exaSearch(
  query: string,
  numResults: number = 5,
  category?: string,
): Promise<Array<{ title: string; url: string; text: string; snippet?: string; source?: string }>> {
  try {
    // Check if EXA_API_KEY is available for direct API fallback
    const hasApiKey = !!process.env.EXA_API_KEY;
    
    if (!hasApiKey) {
      logger.warn("EXA_API_KEY not set. Exa search will not work. Please set EXA_API_KEY in your environment.");
      throw new Error("EXA_API_KEY not configured");
    }
    
    // Try MCP server first (if available)
    logger.info(`[Exa Search] Attempting search via MCP server for: "${query}"`);
    const client = await getExaClient();
    
    if (client) {
      try {
        // List available tools first to see what Exa MCP server provides
        const tools = await client.listTools();
        logger.debug(`Exa MCP server provides ${tools.tools.length} tools: ${tools.tools.map((t: any) => t.name).join(", ")}`);
        
        // Find the search tool (could be "search", "exa_search", "search_web", etc.)
        const searchTool = tools.tools.find((t: any) => 
          t.name.toLowerCase().includes("search") || 
          t.name.toLowerCase().includes("exa")
        ) || tools.tools[0];
        
        if (!searchTool) {
          throw new Error("No search tool found in Exa MCP server");
        }
        
        logger.info(`Using Exa MCP tool: ${searchTool.name}`);
        
        // Call Exa search tool via MCP
        // Build arguments based on tool schema
        // The MCP server expects: { query: string, numResults: number }
        const toolArgs: any = {
          query,
          numResults: numResults, // Use camelCase as per MCP server schema
        };
        if (category && (searchTool.inputSchema?.properties?.category)) {
          toolArgs.category = category;
        }
        
        const result = await client.callTool({
          name: searchTool.name,
          arguments: toolArgs,
        });

        logger.info(`Exa MCP tool call successful for: ${query}`);

        // Parse results from MCP response
        // Exa MCP server returns structuredContent with results array
        if (result.structuredContent && typeof result.structuredContent === 'object') {
          const structured = result.structuredContent as any;
          if (structured.results && Array.isArray(structured.results)) {
            const parsed = structured.results.map((item: any) => ({
              title: String(item.title || ""),
              url: String(item.url || ""),
              text: String(item.text || item.snippet || ""),
              snippet: String(item.snippet || item.text?.substring(0, 200) || ""),
            }));
            
            if (parsed.length > 0) {
              logger.info(`✓ [MCP] Exa search via MCP returned ${parsed.length} results`);
              // Mark results as coming from MCP
              return parsed.map((r: any) => ({ ...r, source: "MCP" }));
            }
          }
        }

        // Fallback: parse from content field
        const content = result.content as unknown;
        logger.debug("Exa MCP result content type:", typeof content);
        logger.debug("Exa MCP result content:", JSON.stringify(content).substring(0, 500));
        
        if (content && Array.isArray(content)) {
          const parsed = (content as any[]).map((item: any, idx: number) => {
            // Handle different content formats from Exa MCP
            if (typeof item === "string") {
              try {
                const parsedItem = JSON.parse(item);
                return {
                  title: parsedItem.title || parsedItem.name || extractTitleFromText(parsedItem.text) || `Result ${idx + 1}`,
                  url: parsedItem.url || parsedItem.id || "",
                  text: parsedItem.text || parsedItem.content || parsedItem.snippet || "",
                  snippet: parsedItem.snippet || parsedItem.text?.substring(0, 200) || parsedItem.content?.substring(0, 200) || "",
                };
              } catch (e) {
                // If it's a plain string, try to extract URL and title
                const urlMatch = item.match(/https?:\/\/[^\s\)]+/);
                return {
                  title: extractTitleFromText(item) || `Result ${idx + 1}`,
                  url: urlMatch ? urlMatch[0] : "",
                  text: item,
                  snippet: item.substring(0, 200),
                };
              }
            }
            
            // Handle object format
            if (typeof item === "object" && item !== null) {
              return {
                title: item.title || item.name || extractTitleFromText(item.text || item.content) || extractTitleFromUrl(item.url || item.id) || `Result ${idx + 1}`,
                url: item.url || item.id || "",
                text: item.text || item.content || item.snippet || "",
                snippet: item.snippet || item.text?.substring(0, 200) || item.content?.substring(0, 200) || "",
              };
            }
            
            return {
              title: `Result ${idx + 1}`,
              url: "",
              text: String(item),
              snippet: String(item).substring(0, 200),
            };
          });
          
          if (parsed.length > 0) {
            logger.info(`✓ [MCP] Exa search via MCP returned ${parsed.length} results`);
            // Mark results as coming from MCP
            return parsed.map((r: any) => ({ ...r, source: "MCP" }));
          }
        }

        // Fallback: try to parse as JSON string
        if (content && typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              return parsed.map((item: any, idx: number) => ({
                title: String(item.title || item.name || extractTitleFromText(String(item.text || "")) || `Result ${idx + 1}`),
                url: String(item.url || item.id || ""),
                text: String(item.text || item.content || ""),
                snippet: String(item.snippet || item.text?.substring(0, 200) || ""),
              }));
            }
            if (parsed.results && Array.isArray(parsed.results)) {
              const mcpResults = parsed.results.map((item: any, idx: number) => ({
                title: item.title || item.name || extractTitleFromText(String(item.text || "")) || `Result ${idx + 1}`,
                url: String(item.url || item.id || ""),
                text: String(item.text || item.content || ""),
                snippet: String(item.snippet || item.text?.substring(0, 200) || ""),
                source: "MCP" as const,
              }));
              logger.info(`✓ [MCP] Exa search via MCP returned ${mcpResults.length} results`);
              return mcpResults;
            }
          } catch (e) {
            // Not JSON, try to extract URLs and text from string
            const urlRegex = /https?:\/\/[^\s\)]+/g;
            const urls = (content as string).match(urlRegex) || [];
            if (urls.length > 0) {
              return urls.map((url, idx) => ({
                title: extractTitleFromUrl(url) || `Result ${idx + 1}`,
                url: url,
                text: String(content),
                snippet: String(content).substring(0, 200),
              }));
            }
          }
        }
      } catch (mcpError) {
        logger.warn(`[MCP] MCP search failed, falling back to direct API:`, mcpError);
      }
    }

    // Fallback to direct API call (always works if EXA_API_KEY is set)
    logger.info(`[API] Exa MCP server not available, using Exa API directly`);
    logger.info(`[API] Searching for: "${query}"`);
    const apiResults = await exaSearchDirect(query, numResults);
    logger.info(`✓ [API] Exa direct API returned ${apiResults.length} results`);
    // Mark results as coming from direct API
    return apiResults.map((r: any) => ({ ...r, source: "API" }));
  } catch (error) {
    logger.error("Error calling Exa search", error);
    throw error;
  }
}

/**
 * Initialize WebWatcher MCP client (for webwatcher-mcp.ts)
 */
export async function getWebWatcherClient(): Promise<Client | null> {
  if (webwatcherClient) {
    return webwatcherClient;
  }

  // Check if HTTP-based MCP server URL is provided (for Cloud Run)
  const mcpServerUrl = process.env.WEBWATCHER_MCP_SERVER_URL;
  
  if (mcpServerUrl) {
    // Use HTTP transport for Cloud Run/serverless environments
    try {
      logger.info(`Connecting to WebWatcher MCP server via HTTP: ${mcpServerUrl}`);
      
      const transport = new StreamableHTTPClientTransport(
        new URL(mcpServerUrl),
        {
          requestInit: {
            headers: {
              "Authorization": `Bearer ${process.env.EXA_API_KEY || ""}`,
              "Content-Type": "application/json",
            },
          },
        }
      );

      webwatcherClient = new Client(
        {
          name: "verisense-webwatcher-client",
          version: "1.0.0",
        },
        {},
      );

      await webwatcherClient.connect(transport);
      logger.info("✓ Connected to WebWatcher MCP server via HTTP");
      return webwatcherClient;
    } catch (error) {
      logger.warn("Failed to connect to WebWatcher MCP server via HTTP", error);
      return null;
    }
  }

  // Check if we're in a serverless environment without HTTP MCP URL
  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    logger.info("Serverless environment detected. Set WEBWATCHER_MCP_SERVER_URL to use MCP, otherwise skipping.");
    return null;
  }

  // Only try stdio MCP if explicitly enabled (for local development)
  if (process.env.WEBWATCHER_USE_MCP !== "true" && process.env.EXA_USE_MCP !== "true") {
    logger.info("WebWatcher MCP server disabled (set WEBWATCHER_USE_MCP=true or WEBWATCHER_MCP_SERVER_URL for HTTP).");
    return null;
  }

  // Use stdio transport for local development
  try {
    // Check if local webwatcher-mcp.ts file exists, use tsx to run it
    const fs = await import("fs/promises");
    const path = await import("path");
    const localMcpPath = path.join(process.cwd(), "mcp", "webwatcher-mcp.ts");
    
    let mcpServerCommand: string;
    let mcpServerArgs: string[];
    
    try {
      await fs.access(localMcpPath);
      // Use local MCP server file
      const nodeModulesTsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");
      try {
        await fs.access(nodeModulesTsx);
        mcpServerCommand = nodeModulesTsx;
        mcpServerArgs = [localMcpPath];
        logger.info(`Using local WebWatcher MCP server via node_modules tsx: ${localMcpPath}`);
      } catch {
        // Try npx tsx (will use local or download)
        mcpServerCommand = "npx";
        mcpServerArgs = ["-y", "tsx", localMcpPath];
        logger.info(`Using local WebWatcher MCP server via npx tsx: ${localMcpPath}`);
      }
    } catch {
      // Fall back to global webwatcher-mcp command or env var
      mcpServerCommand = process.env.WEBWATCHER_MCP_SERVER_COMMAND || "webwatcher-mcp";
      mcpServerArgs = process.env.WEBWATCHER_MCP_SERVER_ARGS 
        ? process.env.WEBWATCHER_MCP_SERVER_ARGS.split(" ")
        : [];
    }

    logger.info(`Connecting to WebWatcher MCP server via stdio: ${mcpServerCommand} ${mcpServerArgs.length > 0 ? mcpServerArgs.join(" ") : ""}`);

    const transport = new StdioClientTransport({
      command: mcpServerCommand,
      args: mcpServerArgs,
      env: {
        ...process.env,
        EXA_API_KEY: process.env.EXA_API_KEY || "",
      },
    });

    webwatcherClient = new Client(
      {
        name: "verisense-webwatcher-client",
        version: "1.0.0",
      },
      {},
    );

    await webwatcherClient.connect(transport);
    logger.info("✓ Connected to WebWatcher MCP server via stdio");

    return webwatcherClient;
  } catch (error) {
    logger.warn("Failed to connect to WebWatcher MCP server via stdio", error);
    return null;
  }
}

/**
 * Call a WebWatcher MCP tool
 */
async function callWebWatcherTool(
  toolName: string,
  args: any,
): Promise<any> {
  const client = await getWebWatcherClient();
  if (!client) {
    throw new Error("WebWatcher MCP client not available");
  }

  const tools = await client.listTools();
  const tool = tools.tools.find((t: any) => t.name === toolName);
  
  if (!tool) {
    throw new Error(`Tool ${toolName} not found in WebWatcher MCP server`);
  }

  logger.info(`[MCP] Calling WebWatcher MCP tool: ${toolName}`);
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  return result;
}

/**
 * Search CVE entries using WebWatcher MCP
 */
export async function searchCVE(
  query: string,
  year?: string,
  numResults: number = 5,
): Promise<Array<{ title: string; url: string; snippet?: string; source: string }>> {
  try {
    const result = await callWebWatcherTool("search_cve", {
      query,
      year,
      numResults,
    });

    if (result.structuredContent?.results) {
      logger.info(`✓ [MCP] search_cve returned ${result.structuredContent.results.length} results`);
      return result.structuredContent.results.map((r: any) => ({
        title: String(r.title || ""),
        url: String(r.url || ""),
        snippet: String(r.snippet || ""),
        source: "MCP",
      }));
    }

    return [];
  } catch (error) {
    logger.error("Error calling search_cve via MCP", error);
    throw error;
  }
}

/**
 * Analyze blockchain transaction using WebWatcher MCP
 */
export async function analyzeTransaction(
  chain: string,
  txHash: string,
): Promise<{
  chain: string;
  txHash: string;
  riskScore: number;
  findings: string[];
  summary: string;
  source: string;
}> {
  try {
    const result = await callWebWatcherTool("analyze_transaction", {
      chain,
      txHash,
    });

    if (result.structuredContent) {
      logger.info(`✓ [MCP] analyze_transaction completed for ${txHash}`);
      return {
        ...(result.structuredContent as {
          chain: string;
          txHash: string;
          riskScore: number;
          findings: string[];
          summary: string;
        }),
        source: "MCP",
      };
    }

    throw new Error("Invalid response from analyze_transaction");
  } catch (error) {
    logger.error("Error calling analyze_transaction via MCP", error);
    throw error;
  }
}

/**
 * Scan wallet for risks using WebWatcher MCP
 */
export async function scanWalletRisks(
  chain: string,
  address: string,
): Promise<{
  chain: string;
  address: string;
  riskScore: number;
  tags: string[];
  alerts: string[];
  summary: string;
  source: string;
}> {
  try {
    const result = await callWebWatcherTool("scan_wallet_risks", {
      chain,
      address,
    });

    if (result.structuredContent) {
      logger.info(`✓ [MCP] scan_wallet_risks completed for ${address}`);
      return {
        ...(result.structuredContent as {
          chain: string;
          address: string;
          riskScore: number;
          tags: string[];
          alerts: string[];
          summary: string;
        }),
        source: "MCP",
      };
    }

    throw new Error("Invalid response from scan_wallet_risks");
  } catch (error) {
    logger.error("Error calling scan_wallet_risks via MCP", error);
    throw error;
  }
}

/**
 * Summarize security state using WebWatcher MCP
 */
export async function summarizeSecurityState(
  subject: string,
  context?: string,
): Promise<{
  subject: string;
  context?: string;
  summary: string;
  recommendations: string[];
  source: string;
}> {
  try {
    const result = await callWebWatcherTool("summarize_security_state", {
      subject,
      context,
    });

    if (result.structuredContent) {
      logger.info(`✓ [MCP] summarize_security_state completed for ${subject}`);
      return {
        ...(result.structuredContent as {
          subject: string;
          context?: string;
          summary: string;
          recommendations: string[];
        }),
        source: "MCP",
      };
    }

    throw new Error("Invalid response from summarize_security_state");
  } catch (error) {
    logger.error("Error calling summarize_security_state via MCP", error);
    throw error;
  }
}

/**
 * Close Exa MCP client connection
 */
export async function closeExaClient(): Promise<void> {
  if (exaClient) {
    try {
      await exaClient.close();
      exaClient = null;
      logger.info("Closed Exa MCP client connection");
    } catch (error) {
      logger.error("Error closing Exa MCP client", error);
    }
  }
}

/**
 * Close WebWatcher MCP client connection
 */
export async function closeWebWatcherClient(): Promise<void> {
  if (webwatcherClient) {
    try {
      await webwatcherClient.close();
      webwatcherClient = null;
      logger.info("Closed WebWatcher MCP client connection");
    } catch (error) {
      logger.error("Error closing WebWatcher MCP client", error);
    }
  }
}

