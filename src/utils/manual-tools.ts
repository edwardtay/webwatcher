/**
 * Manual LangChain tools that work without AgentKit
 * These tools call the action provider functions directly
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "./logger";
import { scanWebsite } from "./scan-website";

// Create manual tools
export function createManualTools(): any[] {
  return [
    new DynamicStructuredTool({
      name: "scan_website",
      description: "Scan a website URL for phishing red flags and security risks. Uses A2A coordination with UrlFeatureAgent, UrlScanAgent (urlscan.io API), and PhishingRedFlagAgent.",
      schema: z.object({
        url: z.string().describe("Website URL to scan"),
      }),
      func: async ({ url }: { url: string }) => {
        try {
          return await scanWebsite(url);
        } catch (error) {
          logger.error("Error in scan_website tool:", error);
          return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    }),
    new DynamicStructuredTool({
      name: "exa_search",
      description: "Search the web using Exa MCP server. Returns relevant search results with URLs and snippets.",
      schema: z.object({
        query: z.string(),
        numResults: z.number().optional().default(20),
      }),
      func: async ({ query, numResults }: { query: string; numResults?: number }) => {
        const { exaSearch } = await import("./mcp-client");
        const results = await exaSearch(query, numResults || 20);
        return JSON.stringify({ results, query, numResults: results.length });
      },
    }),
  ];
}

