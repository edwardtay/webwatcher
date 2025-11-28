/**
 * Manual LangChain tools that work without AgentKit
 * These tools call the action provider functions directly
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "./logger";
import { scanWebsite } from "./scan-website";

// Create manual tools as proper LangChain tool instances
// Using explicit type annotations to avoid deep type instantiation issues
export function createManualTools(): any[] {
  // Define schemas separately to avoid type inference issues
  const scanWebsiteSchema: z.ZodObject<any> = z.object({
    url: z.string().describe("Website URL to scan for phishing red flags and security risks"),
  });

  const exaSearchSchema: z.ZodObject<any> = z.object({
    query: z.string().describe("Search query"),
    numResults: z.number().optional().default(20).describe("Number of results to return"),
  });

  // Create tools with explicit any types to avoid deep instantiation
  const scanTool = new DynamicStructuredTool({
    name: "scan_website",
    description: "Scan a website URL for phishing red flags and security risks. Uses A2A coordination with UrlFeatureAgent, UrlScanAgent (urlscan.io API), and PhishingRedFlagAgent.",
    schema: scanWebsiteSchema as any,
    func: async (input: any) => {
      try {
        const url = input.url as string;
        return await scanWebsite(url);
      } catch (error) {
        logger.error("Error in scan_website tool:", error);
        return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
      }
    },
  });

  const exaTool = new DynamicStructuredTool({
    name: "exa_search",
    description: "Search the web using Exa MCP server. Returns relevant search results with URLs and snippets.",
    schema: exaSearchSchema as any,
    func: async (input: any) => {
      try {
        const query = input.query as string;
        const numResults = (input.numResults as number) || 20;
        const { exaSearch } = await import("./mcp-client");
        const results = await exaSearch(query, numResults);
        return JSON.stringify({ results, query, numResults: results.length });
      } catch (error) {
        logger.error("Error in exa_search tool:", error);
        return JSON.stringify({ error: error instanceof Error ? error.message : String(error), results: [] });
      }
    },
  });

  return [scanTool, exaTool];
}

