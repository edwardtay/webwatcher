/**
 * Unified Action Provider - Combines all capabilities
 * No levels - agent intelligently uses all available tools
 * All searches use Exa MCP
 * A2A calls are automatic when appropriate
 */

import {
  ActionProvider,
  WalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { z } from "zod";
import * as fs from "fs/promises";
import { logger } from "../utils/logger";
import { securityAnalytics } from "../utils/security-analytics";
import {
  exaSearch as mcpExaSearch,
  searchCVE,
  analyzeTransaction,
  scanWalletRisks,
  summarizeSecurityState,
} from "../utils/mcp-client";
import { validateInput, validateCVEId } from "../utils/input-validator";
import { cveRateLimiter } from "../utils/rate-limiter";

// A2A types
export interface AgentMessage {
  from: string;
  to?: string;
  type: "discovery" | "task_request" | "task_response" | "status";
  payload: Record<string, any>;
  timestamp: string;
  messageId: string;
}

export class UnifiedActionProvider extends ActionProvider<WalletProvider> {
  private agentId: string;
  private agentRegistry: Map<string, {
    id: string;
    type: string;
    capabilities: string[];
    status: "available" | "busy" | "offline";
    lastSeen: string;
  }> = new Map();
  private messageQueue: AgentMessage[] = [];

  constructor() {
    super("unified-action-provider", []);
    this.agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.registerSelf();
    logger.info(`Unified Action Provider initialized with Agent ID: ${this.agentId}`);
  }

  supportsNetwork = (network: Network) => {
    return true;
  };

  /**
   * Register this agent in the registry
   */
  private registerSelf(): void {
    this.agentRegistry.set(this.agentId, {
      id: this.agentId,
      type: "security_analyst",
      capabilities: [
        "incident_classification",
        "threat_analysis",
        "remediation_proposal",
        "security_monitoring",
        "vulnerability_scanning",
        "transaction_analysis",
        "wallet_risk_assessment",
      ],
      status: "available",
      lastSeen: new Date().toISOString(),
    });
  }

  /**
   * Call UrlScanAgent via A2A to get urlscan.io API data
   */
  private async callUrlScanAgent(url: string): Promise<any> {
    try {
      const urlscanApiKey = process.env.URLSCAN_API_KEY;
      if (!urlscanApiKey) {
        logger.warn("[A2A] UrlScanAgent: URLSCAN_API_KEY not configured");
        return null;
      }

      logger.info(`[A2A] UrlScanAgent: Submitting ${url} to urlscan.io`);

      // Submit URL to urlscan.io
      const submitResponse = await fetch("https://urlscan.io/api/v1/scan/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Key": urlscanApiKey,
        },
        body: JSON.stringify({
          url: url,
          visibility: "public",
        }),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        logger.warn(`[A2A] UrlScanAgent: Submission failed: ${errorText}`);
        return null;
      }

      const submitData = await submitResponse.json() as any;
      const scanUuid = submitData.uuid;

      if (!scanUuid) {
        logger.warn("[A2A] UrlScanAgent: No UUID returned from urlscan.io");
        return null;
      }

      logger.info(`[A2A] UrlScanAgent: Scan submitted, UUID: ${scanUuid}`);

      // Poll for results (urlscan.io takes a few seconds to process)
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

        const resultResponse = await fetch(`https://urlscan.io/api/v1/result/${scanUuid}/`, {
          headers: {
            "API-Key": urlscanApiKey,
          },
        });

        if (resultResponse.ok) {
          const resultData = await resultResponse.json() as any;
          logger.info(`[A2A] UrlScanAgent: Results received for ${url}`);

          return {
            uuid: scanUuid,
            url: resultData.task?.url || url,
            verdict: resultData.verdicts?.overall?.verdict || "unknown",
            malicious: resultData.verdicts?.overall?.malicious || false,
            screenshot: resultData.task?.screenshotURL || null,
            reportUrl: `https://urlscan.io/result/${scanUuid}/`,
            stats: resultData.stats || {},
            lists: resultData.lists || {},
            page: resultData.page || {},
          };
        } else if (resultResponse.status === 404) {
          // Still processing
          attempts++;
          continue;
        } else {
          const errorText = await resultResponse.text();
          logger.warn(`[A2A] UrlScanAgent: Error fetching results: ${errorText}`);
          break;
        }
      }

      logger.warn(`[A2A] UrlScanAgent: Timeout waiting for results after ${maxAttempts} attempts`);
      return {
        uuid: scanUuid,
        url: url,
        status: "pending",
        reportUrl: `https://urlscan.io/result/${scanUuid}/`,
        message: "Scan submitted but results not yet available",
      };
    } catch (error) {
      logger.error("[A2A] UrlScanAgent: Error calling urlscan.io", error);
      return null;
    }
  }

  /**
   * Automatically determine if A2A coordination is needed and call appropriate agents
   */
  private async autoA2ACoordinate(taskType: string, taskData: any): Promise<any> {
    // Intelligent A2A coordination - automatically call other agents when needed
    const a2aTriggers: Record<string, string[]> = {
      "vulnerability_scan": ["scanner", "triage"],
      "incident_response": ["triage", "fix"],
      "compliance_check": ["governance"],
      "threat_analysis": ["scanner", "triage"],
      "remediation": ["fix"],
    };

    const neededAgents = a2aTriggers[taskType] || [];
    if (neededAgents.length === 0) {
      return null;
    }

    logger.info(`[A2A] Auto-coordinating with agents: ${neededAgents.join(", ")}`);
    
    // In production, this would actually call other agents
    // For now, return structured response indicating A2A coordination
    return {
      coordinated: true,
      taskType,
      agentsContacted: neededAgents,
      timestamp: new Date().toISOString(),
    };
  }

  // ========== SEARCH ACTIONS (All use Exa MCP) ==========

  /**
   * Search the web using Exa MCP (primary search method)
   */
  @CreateAction({
    name: "exa_search",
    description:
      "Search the web using Exa MCP server. This is the primary search method - always use this for web searches. Returns relevant search results with URLs and snippets.",
    schema: z.object({
      query: z.string().describe("Search query string"),
      numResults: z.number().optional().default(20).describe("Number of results to return (default: 20, max: 100)"),
      category: z.string().optional().describe("Optional category filter"),
    }),
  })
  async exaSearch(
    walletProvider: WalletProvider,
    args: { query: string; numResults?: number; category?: string },
  ): Promise<string> {
    try {
      logger.info("Exa search request", args);

      const numResults = Math.min(Math.max(1, args.numResults || 20), 100);
      const searchResults = await mcpExaSearch(
        args.query,
        numResults,
        args.category,
      );

      securityAnalytics.recordEvent({
        type: "alert",
        severity: "low",
        timestamp: new Date().toISOString(),
        data: {
          action: "exa_search",
          query: args.query,
          resultsCount: searchResults.length,
        },
        riskScore: 0,
      });

      return JSON.stringify({
        results: searchResults,
        query: args.query,
        numResults: searchResults.length,
        source: searchResults[0]?.source || "MCP",
      }, null, 2);
    } catch (error) {
      logger.error("Error performing Exa search", error);
      return `Error performing Exa search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Search CVE entries using WebWatcher MCP (uses Exa internally)
   */
  @CreateAction({
    name: "search_cve",
    description:
      "Search CVE (Common Vulnerabilities and Exposures) entries. Uses Exa MCP for search. Returns relevant CVE reports with URLs and snippets.",
    schema: z.object({
      query: z.string().describe("Product, library, or CVE keyword to search for"),
      year: z.string().optional().describe("Optional year filter (e.g., '2024' or '2025')"),
      numResults: z.number().optional().default(5).describe("Number of results to return (default: 5, max: 20)"),
    }),
  })
  async searchCVE(
    walletProvider: WalletProvider,
    args: { query: string; year?: string; numResults?: number },
  ): Promise<string> {
    try {
      logger.info("CVE search request", args);

      // Input validation
      if (args.query && !validateInput(args.query).valid) {
        return `❌ Invalid input: ${validateInput(args.query).error}`;
      }

      // Rate limiting
      const rateLimitKey = "cve_search";
      if (!cveRateLimiter.isAllowed(rateLimitKey)) {
        const remaining = cveRateLimiter.getRemaining(rateLimitKey);
        return `⏳ Rate limit exceeded. Please wait before making another CVE search request. (${remaining} requests remaining)`;
      }

      const numResults = Math.min(Math.max(1, args.numResults || 5), 20);
      const results = await searchCVE(args.query, args.year, numResults);

      // Auto A2A coordination for vulnerability scanning
      await this.autoA2ACoordinate("vulnerability_scan", { query: args.query, results });

      securityAnalytics.recordEvent({
        type: "alert",
        severity: "low",
        timestamp: new Date().toISOString(),
        data: {
          action: "search_cve",
          query: args.query,
          year: args.year,
          resultsCount: results.length,
        },
        riskScore: 0,
      });

      return JSON.stringify({
        results,
        query: args.query,
        year: args.year,
        numResults: results.length,
        source: results[0]?.source || "MCP",
      }, null, 2);
    } catch (error) {
      logger.error("Error performing CVE search", error);
      return `Error performing CVE search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Web search using Exa MCP (fallback for general queries)
   */
  @CreateAction({
    name: "web_search",
    description:
      "Search the web using Exa MCP. Use this for general web searches, OSINT, or vendor documentation. Always uses Exa MCP.",
    schema: z.object({
      query: z.string().describe("Search query string"),
      numResults: z.number().optional().default(20).describe("Number of results to return (default: 20, max: 100)"),
    }),
  })
  async webSearch(
    walletProvider: WalletProvider,
    args: { query: string; numResults?: number },
  ): Promise<string> {
    // Delegate to exa_search
    return this.exaSearch(walletProvider, args);
  }

  /**
   * OSINT search using Exa MCP
   */
  @CreateAction({
    name: "osint_search",
    description:
      "Open Source Intelligence (OSINT) search using Exa MCP. Use this for threat intelligence, security research, or public information gathering.",
    schema: z.object({
      query: z.string().describe("OSINT search query"),
      numResults: z.number().optional().default(20).describe("Number of results to return (default: 20, max: 100)"),
    }),
  })
  async osintSearch(
    walletProvider: WalletProvider,
    args: { query: string; numResults?: number },
  ): Promise<string> {
    // Delegate to exa_search
    return this.exaSearch(walletProvider, args);
  }

  // ========== BLOCKCHAIN SECURITY ACTIONS ==========

  /**
   * Analyze blockchain transaction using WebWatcher MCP
   */
  @CreateAction({
    name: "analyze_transaction",
    description:
      "Analyze a blockchain transaction for suspicious patterns, risk assessment, and security findings.",
    schema: z.object({
      chain: z.string().describe("Chain identifier or name (e.g., 'ethereum', 'base', 'polygon')"),
      txHash: z.string().describe("Transaction hash to analyze"),
    }),
  })
  async analyzeTransaction(
    walletProvider: WalletProvider,
    args: { chain: string; txHash: string },
  ): Promise<string> {
    try {
      logger.info("Transaction analysis request", args);

      const result = await analyzeTransaction(args.chain, args.txHash);

      // Auto A2A coordination for threat analysis
      if (result.riskScore > 50) {
        await this.autoA2ACoordinate("threat_analysis", { chain: args.chain, txHash: args.txHash, result });
      }

      securityAnalytics.recordEvent({
        type: "alert",
        severity: result.riskScore > 70 ? "high" : result.riskScore > 40 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          action: "analyze_transaction",
          chain: args.chain,
          txHash: args.txHash,
          riskScore: result.riskScore,
          findingsCount: result.findings.length,
        },
        riskScore: result.riskScore,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.error("Error analyzing transaction", error);
      return `Error analyzing transaction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Scan wallet for risks using WebWatcher MCP
   */
  @CreateAction({
    name: "scan_wallet_risks",
    description:
      "Scan a wallet address for risk factors, anomalies, and security threats. Returns risk score, tags, alerts, and summary.",
    schema: z.object({
      chain: z.string().describe("Chain identifier or name (e.g., 'ethereum', 'base', 'polygon')"),
      address: z.string().describe("Wallet or contract address to scan"),
    }),
  })
  async scanWalletRisks(
    walletProvider: WalletProvider,
    args: { chain: string; address: string },
  ): Promise<string> {
    try {
      logger.info("Wallet risk scan request", args);

      const result = await scanWalletRisks(args.chain, args.address);

      // Auto A2A coordination for high-risk wallets
      if (result.riskScore > 50) {
        await this.autoA2ACoordinate("threat_analysis", { chain: args.chain, address: args.address, result });
      }

      securityAnalytics.recordEvent({
        type: "alert",
        severity: result.riskScore > 70 ? "high" : result.riskScore > 40 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          action: "scan_wallet_risks",
          chain: args.chain,
          address: args.address,
          riskScore: result.riskScore,
          tags: result.tags,
          alertsCount: result.alerts.length,
        },
        riskScore: result.riskScore,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.error("Error scanning wallet risks", error);
      return `Error scanning wallet risks: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Summarize security state using WebWatcher MCP
   */
  @CreateAction({
    name: "summarize_security_state",
    description:
      "Summarize overall security posture for a given address, contract, domain, or project. Returns summary and recommendations.",
    schema: z.object({
      subject: z.string().describe("Wallet address, contract address, domain, or project name"),
      context: z.string().optional().describe("Extra context like chain, protocol, or use case"),
    }),
  })
  async summarizeSecurityState(
    walletProvider: WalletProvider,
    args: { subject: string; context?: string },
  ): Promise<string> {
    try {
      logger.info("Security state summary request", args);

      const result = await summarizeSecurityState(args.subject, args.context);

      securityAnalytics.recordEvent({
        type: "alert",
        severity: "low",
        timestamp: new Date().toISOString(),
        data: {
          action: "summarize_security_state",
          subject: args.subject,
          context: args.context,
          recommendationsCount: result.recommendations.length,
        },
        riskScore: 0,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.error("Error summarizing security state", error);
      return `Error summarizing security state: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // ========== WEBSITE SECURITY ACTIONS ==========

  /**
   * Scan website for phishing red flags (A2A style)
   */
  @CreateAction({
    name: "scan_website",
    description:
      "Scan a website URL for phishing red flags and security risks. Uses A2A-style analysis with feature extraction and red flag detection. Shows clear A2A agent communication flow.",
    schema: z.object({
      url: z.string().describe("Website URL to scan for phishing and security risks"),
    }),
  })
  async scanWebsite(
    walletProvider: WalletProvider,
    args: { url: string },
  ): Promise<string> {
    try {
      logger.info("[A2A] Website scan request initiated", args);

      const a2aFlow: string[] = [];
      a2aFlow.push("**🤖 A2A Agent Coordination Active**\n");
      a2aFlow.push("`[User -> UrlFeatureAgent]`");
      a2aFlow.push(`${args.url}\n`);

      // Step 1: Extract URL features (UrlFeatureAgent logic)
      let input = args.url.trim();
      if (!input.startsWith("http://") && !input.startsWith("https://")) {
        input = "https://" + input;
      }

      let parsed: URL;
      try {
        parsed = new URL(input);
      } catch (e) {
        return JSON.stringify({
          error: "invalid_url",
          raw: args.url,
          message: `Input does not look like a valid URL: "${args.url}"`,
        }, null, 2);
      }

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
        "support",
      ];

      const keywordHits = suspiciousKeywords.filter(
        (k) => pathLower.includes(k) || domainLower.includes(k),
      );

      const weirdTlds = [".cn", ".ru", ".tk", ".ml", ".ga", ".gq", ".cf"];
      const tld = domainLower.slice(domainLower.lastIndexOf("."));
      const tldSuspicious = weirdTlds.includes(tld);

      const bigBrands = ["apple", "paypal", "google", "microsoft", "facebook", "binance"];
      let brandImpersonation: string | null = null;
      for (const b of bigBrands) {
        if (domainLower.includes(b) && !domainLower.endsWith(`${b}.com`)) {
          brandImpersonation = b;
          break;
        }
      }

      const features = {
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
        brandImpersonation,
      };

      a2aFlow.push("`[UrlFeatureAgent -> UrlScanAgent]`");
      a2aFlow.push("```json");
      a2aFlow.push(JSON.stringify(features, null, 2));
      a2aFlow.push("```\n");

      // Step 2: Call UrlScanAgent via A2A to get urlscan.io data
      logger.info("[A2A] UrlFeatureAgent -> UrlScanAgent: Requesting urlscan.io scan");
      let urlscanData: any = null;
      try {
        urlscanData = await this.callUrlScanAgent(fullUrl);
        a2aFlow.push("`[UrlScanAgent -> PhishingRedFlagAgent]`");
        a2aFlow.push("```json");
        a2aFlow.push(JSON.stringify({
          urlscanResult: urlscanData ? "Available" : "Not available",
          verdict: urlscanData?.verdict || "Pending",
          malicious: urlscanData?.malicious || false,
          screenshot: urlscanData?.screenshot ? "Available" : "Not available",
        }, null, 2));
        a2aFlow.push("```\n");
        logger.info("[A2A] UrlScanAgent -> PhishingRedFlagAgent: urlscan.io data received");
      } catch (error) {
        logger.warn("[A2A] UrlScanAgent unavailable or error:", error);
        a2aFlow.push("`[UrlScanAgent -> PhishingRedFlagAgent]`");
        a2aFlow.push("```json");
        a2aFlow.push(JSON.stringify({
          error: "UrlScanAgent unavailable",
          message: "Falling back to local analysis",
        }, null, 2));
        a2aFlow.push("```\n");
      }

      // Step 3: Analyze for red flags (PhishingRedFlagAgent logic)
      logger.info("[A2A] PhishingRedFlagAgent analyzing combined data");
      const redFlags: string[] = [];
      const notes: string[] = [];

      if (isIp) {
        redFlags.push("Uses a raw IP instead of a normal domain name.");
      }

      if (hasAt) {
        redFlags.push("Contains @ which can hide the real destination domain.");
      }

      if (numDots >= 3) {
        redFlags.push("Has many dots in the domain which can hide the true site.");
      }

      if (urlLength > 80) {
        redFlags.push("URL is very long which is common for phishing links.");
      }

      if (keywordHits && keywordHits.length > 0) {
        redFlags.push(
          `Contains sensitive words in the link like: ${keywordHits.join(", ")}.`,
        );
      }

      if (tldSuspicious) {
        redFlags.push(`Uses a less common top level domain (${tld}).`);
      }

      if (brandImpersonation) {
        redFlags.push(
          `Domain contains brand name "${brandImpersonation}" but is not the official ${brandImpersonation}.com domain.`,
        );
      }

      // Incorporate urlscan.io data into analysis
      if (urlscanData) {
        if (urlscanData.malicious) {
          redFlags.push(`urlscan.io flagged this URL as malicious (verdict: ${urlscanData.verdict}).`);
        }
        if (urlscanData.verdict === "malicious" || urlscanData.verdict === "phishing") {
          redFlags.push(`urlscan.io security scan detected ${urlscanData.verdict} activity.`);
        }
        if (urlscanData.reportUrl) {
          notes.push(`Full security report available at: ${urlscanData.reportUrl}`);
        }
      }

      if (!redFlags.length) {
        notes.push("No obvious structural phishing red flags in the URL itself.");
        if (urlscanData && !urlscanData.malicious) {
          notes.push("urlscan.io security scan did not detect malicious activity.");
        }
      }

      // Auto A2A coordination for phishing detection
      if (redFlags.length > 0 || urlscanData?.malicious) {
        await this.autoA2ACoordinate("threat_analysis", { 
          url: fullUrl, 
          redFlags,
          urlscanData: urlscanData ? {
            malicious: urlscanData.malicious,
            verdict: urlscanData.verdict,
            reportUrl: urlscanData.reportUrl,
          } : null,
        });
      }

      a2aFlow.push("`[PhishingRedFlagAgent -> User]`");
      a2aFlow.push(`Website checked: ${fullUrl}`);
      a2aFlow.push(`Domain: ${domain}\n`);

      const verdict = redFlags.length > 0
        ? "possible phishing, treat with caution"
        : "no strong phishing red flags from the URL alone";

      a2aFlow.push(`**Overall verdict:** ${verdict}\n`);

      if (redFlags.length > 0) {
        a2aFlow.push("**Major red flags from the URL shape:**");
        redFlags.forEach((f, i) => a2aFlow.push(`${i + 1}. ${f}`));
        a2aFlow.push("");
      }

      if (notes.length > 0) {
        a2aFlow.push("**Notes:**");
        notes.forEach((n, i) => a2aFlow.push(`${i + 1}. ${n}`));
        a2aFlow.push("");
      }

      a2aFlow.push("**Human safety tips:**");
      a2aFlow.push("- Do not enter passwords or seed phrases if you are not 100 percent sure.");
      a2aFlow.push("- Check the address bar carefully for spelling and extra words.");
      a2aFlow.push("- When unsure, type the official site address manually in a new tab.");

      logger.info("[A2A] PhishingRedFlagAgent -> User: Analysis complete");

      const result = {
        a2aFlow: a2aFlow.join("\n"),
        website: fullUrl,
        domain: domain,
        verdict: verdict,
        redFlags: redFlags,
        notes: notes,
        features: features,
        urlscanData: urlscanData ? {
          malicious: urlscanData.malicious,
          verdict: urlscanData.verdict,
          reportUrl: urlscanData.reportUrl,
          screenshot: urlscanData.screenshot,
        } : null,
        safetyTips: [
          "Do not enter passwords or seed phrases if you are not 100 percent sure.",
          "Check the address bar carefully for spelling and extra words.",
          "When unsure, type the official site address manually in a new tab.",
          urlscanData?.reportUrl ? `View full security report: ${urlscanData.reportUrl}` : null,
        ].filter(Boolean),
      };

      securityAnalytics.recordEvent({
        type: "alert",
        severity: redFlags.length > 2 ? "high" : redFlags.length > 0 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          action: "scan_website",
          url: fullUrl,
          domain: domain,
          redFlagsCount: redFlags.length,
        },
        riskScore: redFlags.length * 15,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.error("Error scanning website", error);
      return `Error scanning website: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // ========== LOCAL ANALYSIS ACTIONS ==========

  /**
   * Analyze log files for security incidents
   */
  @CreateAction({
    name: "analyze_logs",
    description:
      "Analyzes log files locally for security incidents, attack patterns, and anomalies. Works offline.",
    schema: z.object({
      logPath: z.string().describe("Path to the log file to analyze"),
      pattern: z.string().optional().describe("Optional: specific pattern to search for"),
    }),
  })
  async analyzeLogs(
    walletProvider: WalletProvider,
    args: { logPath: string; pattern?: string },
  ): Promise<string> {
    try {
      logger.info(`Analyzing logs from: ${args.logPath}`);
      
      const logContent = await fs.readFile(args.logPath, "utf-8");
      const lines = logContent.split("\n");

      const analysis = {
        file: args.logPath,
        totalLines: lines.length,
        timestamp: new Date().toISOString(),
        incidents: [] as Array<{
          line: number;
          severity: "low" | "medium" | "high" | "critical";
          type: string;
          description: string;
        }>,
        riskScore: 0,
      };

      // Pattern detection for common security issues
      const securityPatterns = [
        { pattern: /failed.*login/i, severity: "medium" as const, type: "Authentication Failure" },
        { pattern: /unauthorized/i, severity: "high" as const, type: "Unauthorized Access" },
        { pattern: /sql.*injection/i, severity: "critical" as const, type: "SQL Injection Attempt" },
        { pattern: /xss/i, severity: "high" as const, type: "XSS Attempt" },
        { pattern: /csrf/i, severity: "medium" as const, type: "CSRF Attempt" },
        { pattern: /brute.*force/i, severity: "high" as const, type: "Brute Force Attack" },
        { pattern: /ddos/i, severity: "critical" as const, type: "DDoS Attack" },
        { pattern: /malware/i, severity: "critical" as const, type: "Malware Detection" },
        { pattern: /phishing/i, severity: "high" as const, type: "Phishing Attempt" },
        { pattern: /suspicious.*activity/i, severity: "medium" as const, type: "Suspicious Activity" },
      ];

      lines.forEach((line, index) => {
        if (args.pattern && !line.toLowerCase().includes(args.pattern.toLowerCase())) {
          return;
        }

        for (const { pattern, severity, type } of securityPatterns) {
          if (pattern.test(line)) {
            analysis.incidents.push({
              line: index + 1,
              severity,
              type,
              description: line.substring(0, 200),
            });

            const severityScores = { low: 5, medium: 15, high: 30, critical: 50 };
            analysis.riskScore += severityScores[severity];
          }
        }
      });

      const riskLevel = analysis.riskScore >= 75 ? "CRITICAL" : analysis.riskScore >= 50 ? "HIGH" : analysis.riskScore >= 25 ? "MEDIUM" : "LOW";

      // Auto A2A coordination for critical incidents
      if (analysis.riskScore >= 75) {
        await this.autoA2ACoordinate("incident_response", { logPath: args.logPath, analysis });
      }

      securityAnalytics.recordEvent({
        type: "alert",
        severity: riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
        timestamp: new Date().toISOString(),
        data: {
          action: "analyze_logs",
          file: args.logPath,
          incidentsCount: analysis.incidents.length,
          riskScore: analysis.riskScore,
        },
        riskScore: analysis.riskScore,
      });

      return JSON.stringify({
        ...analysis,
        riskLevel,
        summary: `Found ${analysis.incidents.length} security incidents in ${analysis.totalLines} lines. Risk level: ${riskLevel}`,
      }, null, 2);
    } catch (error) {
      logger.error("Error analyzing logs", error);
      return `Error analyzing logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // ========== A2A COORDINATION ACTIONS (Automatic but also available manually) ==========

  /**
   * Discover other agents (for manual use, but usually automatic)
   */
  @CreateAction({
    name: "a2a_discover_agents",
    description:
      "Discovers other agents in the A2A network. Usually called automatically, but can be used manually if needed.",
    schema: z.object({
      agentType: z.string().optional().describe("Filter by agent type (e.g., 'scanner', 'triage', 'fix')"),
      capability: z.string().optional().describe("Filter by capability"),
    }),
  })
  async a2aDiscoverAgents(
    walletProvider: WalletProvider,
    args: { agentType?: string; capability?: string },
  ): Promise<string> {
    try {
      logger.info("Discovering agents via A2A", args);

      const discoveryMessage: AgentMessage = {
        from: this.agentId,
        type: "discovery",
        payload: {
          agentType: "security_analyst",
          capabilities: this.agentRegistry.get(this.agentId)?.capabilities || [],
        },
        timestamp: new Date().toISOString(),
        messageId: `msg-${Date.now()}`,
      };

      this.messageQueue.push(discoveryMessage);

      // In production, this would broadcast to A2A network
      const discoveredAgents = Array.from(this.agentRegistry.values()).filter((agent) => {
        if (args.agentType && agent.type !== args.agentType) return false;
        if (args.capability && !agent.capabilities.includes(args.capability)) return false;
        return agent.id !== this.agentId;
      });

      return JSON.stringify({
        agentId: this.agentId,
        discoveredAgents,
        message: "A2A discovery completed",
      }, null, 2);
    } catch (error) {
      logger.error("Error discovering agents", error);
      return `Error discovering agents: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Factory function to create unified action provider
 */
export const unifiedActionProvider = () => new UnifiedActionProvider();

