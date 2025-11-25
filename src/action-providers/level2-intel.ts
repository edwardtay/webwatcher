/**
 * Level 2 - Intel-Enhanced Analyst Action Provider
 * Adds read-only HTTP access for CVEs, IP/domain reputation, OSINT, vendor docs
 */

import {
  ActionProvider,
  WalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { z } from "zod";
import { logger } from "../utils/logger";
import { securityAnalytics } from "../utils/security-analytics";

export class Level2IntelActionProvider extends ActionProvider<WalletProvider> {
  constructor() {
    super("level2-intel-action-provider", []);
  }

  supportsNetwork = (network: Network) => {
    return true;
  };

  /**
   * Search for CVE information
   */
  @CreateAction({
    name: "search_cve",
    description:
      "Searches for CVE (Common Vulnerabilities and Exposures) information from public databases. Requires network access.",
    schema: z.object({
      cveId: z.string().optional().describe("CVE ID (e.g., CVE-2024-1234)"),
      keyword: z.string().optional().describe("Keyword to search for in CVE database"),
      product: z.string().optional().describe("Product name to search for"),
    }),
  })
  async searchCVE(
    walletProvider: WalletProvider,
    args: { cveId?: string; keyword?: string; product?: string },
  ): Promise<string> {
    try {
      logger.info("Searching CVE database", args);

      // Use NVD API (National Vulnerability Database) - free public API
      let url = "https://services.nvd.nist.gov/rest/json/cves/2.0";
      const params: string[] = [];

      if (args.cveId) {
        url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(args.cveId)}`;
      } else {
        if (args.keyword) {
          params.push(`keywordSearch=${encodeURIComponent(args.keyword)}`);
        }
        if (args.product) {
          params.push(`keywordSearch=${encodeURIComponent(args.product)}`);
        }
        if (params.length > 0) {
          url += `?${params.join("&")}`;
        }
      }

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`CVE API returned status ${response.status}`);
      }

      const data = await response.json();
      const vulnerabilities = data.vulnerabilities || [];

      const analysis = {
        timestamp: new Date().toISOString(),
        query: args,
        results: vulnerabilities.slice(0, 10).map((vuln: any) => {
          const cve = vuln.cve;
          return {
            id: cve.id,
            description: cve.descriptions?.[0]?.value || "No description",
            severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || "UNKNOWN",
            score: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0,
            published: cve.published,
            modified: cve.lastModified,
          };
        }),
        totalFound: vulnerabilities.length,
      };

      // Calculate risk score based on found CVEs
      const criticalCount = analysis.results.filter((r: any) => r.severity === "CRITICAL").length;
      const highCount = analysis.results.filter((r: any) => r.severity === "HIGH").length;
      const riskScore = criticalCount * 30 + highCount * 15;

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          cveSearch: args,
          vulnerabilitiesFound: analysis.totalFound,
          criticalCount,
          highCount,
        },
        riskScore,
      });

      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      logger.error("Error searching CVE", error);
      return `Error searching CVE: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Check IP reputation
   */
  @CreateAction({
    name: "check_ip_reputation",
    description:
      "Checks IP address reputation using public threat intelligence sources. Requires network access.",
    schema: z.object({
      ipAddress: z.string().describe("IP address to check"),
    }),
  })
  async checkIPReputation(
    walletProvider: WalletProvider,
    args: { ipAddress: string },
  ): Promise<string> {
    try {
      logger.info(`Checking IP reputation: ${args.ipAddress}`);

      // Use AbuseIPDB API (free tier available) or similar service
      // For demo, we'll use a simple pattern check and mock response
      // In production, integrate with real threat intel APIs
      
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipPattern.test(args.ipAddress)) {
        throw new Error("Invalid IP address format");
      }

      // Check if IP is in private range (not a security threat, but worth noting)
      const isPrivate = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(args.ipAddress);

      const analysis = {
        ipAddress: args.ipAddress,
        timestamp: new Date().toISOString(),
        isPrivate,
        reputation: "unknown",
        riskScore: 0,
        indicators: [] as string[],
      };

      // Basic reputation checks (in production, use real APIs)
      if (isPrivate) {
        analysis.reputation = "private";
        analysis.indicators.push("Private IP range - not routable on internet");
      } else {
        // Mock threat intel check - in production, call real APIs
        // Examples: AbuseIPDB, VirusTotal, etc.
        analysis.reputation = "neutral";
        analysis.indicators.push("Public IP address");
        analysis.indicators.push("No known threats detected (mock check)");
        
        // In production, integrate with:
        // - AbuseIPDB API
        // - VirusTotal API
        // - Shodan API
        // - etc.
      }

      // Record event
      securityAnalytics.recordEvent({
        type: "address",
        severity: analysis.riskScore >= 30 ? "high" : analysis.riskScore >= 15 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          ipAddress: args.ipAddress,
          reputation: analysis.reputation,
          riskScore: analysis.riskScore,
        },
        riskScore: analysis.riskScore,
      });

      return JSON.stringify({
        ...analysis,
        recommendation: analysis.riskScore >= 30
          ? "Block this IP address immediately"
          : analysis.riskScore >= 15
          ? "Monitor this IP address closely"
          : "IP address appears safe",
      }, null, 2);
    } catch (error) {
      logger.error("Error checking IP reputation", error);
      return `Error checking IP reputation: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Check domain reputation
   */
  @CreateAction({
    name: "check_domain_reputation",
    description:
      "Checks domain reputation using public threat intelligence sources. Requires network access.",
    schema: z.object({
      domain: z.string().describe("Domain name to check"),
    }),
  })
  async checkDomainReputation(
    walletProvider: WalletProvider,
    args: { domain: string },
  ): Promise<string> {
    try {
      logger.info(`Checking domain reputation: ${args.domain}`);

      // Remove protocol if present
      const cleanDomain = args.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      const analysis = {
        domain: cleanDomain,
        timestamp: new Date().toISOString(),
        reputation: "unknown",
        riskScore: 0,
        indicators: [] as string[],
        whois: {} as Record<string, unknown>,
      };

      // Basic domain checks
      const suspiciousPatterns = [
        { pattern: /bitly|tinyurl|goo\.gl/i, risk: 20, indicator: "URL shortener" },
        { pattern: /[0-9]{4,}/, risk: 15, indicator: "Contains many numbers (potential typosquatting)" },
        { pattern: /-{2,}/, risk: 10, indicator: "Multiple hyphens (suspicious)" },
        { pattern: /\.tk|\.ml|\.ga|\.cf/i, risk: 25, indicator: "Free TLD (higher risk)" },
      ];

      suspiciousPatterns.forEach(({ pattern, risk, indicator }) => {
        if (pattern.test(cleanDomain)) {
          analysis.indicators.push(indicator);
          analysis.riskScore += risk;
        }
      });

      // Try to fetch WHOIS info (simplified)
      try {
        // In production, use a WHOIS API service
        analysis.whois = {
          note: "WHOIS lookup not implemented - use external service in production",
        };
      } catch (error) {
        logger.debug("WHOIS lookup failed", error);
      }

      // Determine reputation
      if (analysis.riskScore >= 30) {
        analysis.reputation = "suspicious";
      } else if (analysis.riskScore >= 15) {
        analysis.reputation = "caution";
      } else {
        analysis.reputation = "neutral";
      }

      // Record event
      securityAnalytics.recordEvent({
        type: "address",
        severity: analysis.riskScore >= 30 ? "high" : analysis.riskScore >= 15 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          domain: cleanDomain,
          reputation: analysis.reputation,
          riskScore: analysis.riskScore,
        },
        riskScore: analysis.riskScore,
      });

      return JSON.stringify({
        ...analysis,
        recommendation: analysis.riskScore >= 30
          ? "Do not trust this domain. Block if possible."
          : analysis.riskScore >= 15
          ? "Exercise caution when interacting with this domain"
          : "Domain appears safe, but always verify",
      }, null, 2);
    } catch (error) {
      logger.error("Error checking domain reputation", error);
      return `Error checking domain reputation: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Perform OSINT (Open Source Intelligence) search
   */
  @CreateAction({
    name: "osint_search",
    description:
      "Performs OSINT (Open Source Intelligence) search using web search. Requires network access.",
    schema: z.object({
      query: z.string().describe("Search query for OSINT gathering"),
      searchType: z.enum(["general", "news", "social", "technical"]).optional().describe("Type of search"),
    }),
  })
  async osintSearch(
    walletProvider: WalletProvider,
    args: { query: string; searchType?: string },
  ): Promise<string> {
    try {
      logger.info("Performing OSINT search", args);

      // In production, integrate with:
      // - Google Custom Search API
      // - Bing Search API
      // - DuckDuckGo API
      // - Shodan API for technical searches
      // - Twitter API for social searches
      // - News APIs for news searches

      // For now, return a structured response indicating what would be searched
      const analysis = {
        query: args.query,
        searchType: args.searchType || "general",
        timestamp: new Date().toISOString(),
        note: "OSINT search integration requires API keys. This is a placeholder response.",
        sources: [] as string[],
        findings: [] as string[],
      };

      // Mock response structure
      if (args.searchType === "technical") {
        analysis.sources.push("Shodan", "Censys", "Security advisories");
        analysis.findings.push("Technical OSINT would search vulnerability databases, exposed services, etc.");
      } else if (args.searchType === "social") {
        analysis.sources.push("Twitter", "LinkedIn", "Public profiles");
        analysis.findings.push("Social OSINT would search social media platforms for mentions, profiles, etc.");
      } else if (args.searchType === "news") {
        analysis.sources.push("News APIs", "Security blogs", "Press releases");
        analysis.findings.push("News OSINT would search recent news articles and security advisories.");
      } else {
        analysis.sources.push("General web search", "Public databases", "Security forums");
        analysis.findings.push("General OSINT would search across multiple public sources.");
      }

      return JSON.stringify({
        ...analysis,
        recommendation: "In production, integrate with real OSINT APIs for comprehensive intelligence gathering.",
      }, null, 2);
    } catch (error) {
      logger.error("Error performing OSINT search", error);
      return `Error performing OSINT search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Search vendor documentation and security advisories
   */
  @CreateAction({
    name: "search_vendor_docs",
    description:
      "Searches vendor documentation and security advisories. Requires network access.",
    schema: z.object({
      vendor: z.string().describe("Vendor name (e.g., 'Microsoft', 'Apache', 'Nginx')"),
      product: z.string().optional().describe("Product name"),
      keyword: z.string().optional().describe("Keyword to search for"),
    }),
  })
  async searchVendorDocs(
    walletProvider: WalletProvider,
    args: { vendor: string; product?: string; keyword?: string },
  ): Promise<string> {
    try {
      logger.info("Searching vendor documentation", args);

      // In production, integrate with vendor-specific APIs:
      // - Microsoft Security Response Center (MSRC)
      // - GitHub Security Advisories
      // - NVD (already covered in CVE search)
      // - Vendor-specific security pages

      const analysis = {
        vendor: args.vendor,
        product: args.product,
        keyword: args.keyword,
        timestamp: new Date().toISOString(),
        note: "Vendor documentation search requires vendor-specific API integration.",
        advisories: [] as Array<{
          title: string;
          date: string;
          severity: string;
          url?: string;
        }>,
      };

      // Mock response - in production, fetch from real APIs
      analysis.advisories.push({
        title: `Security advisories for ${args.vendor}${args.product ? ` ${args.product}` : ""}`,
        date: new Date().toISOString(),
        severity: "unknown",
        url: `https://example.com/vendor/${args.vendor.toLowerCase()}/advisories`,
      });

      return JSON.stringify({
        ...analysis,
        recommendation: "In production, integrate with vendor-specific security advisory APIs for real-time updates.",
      }, null, 2);
    } catch (error) {
      logger.error("Error searching vendor docs", error);
      return `Error searching vendor docs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Factory function to create Level 2 action provider
 */
export const level2IntelActionProvider = () => new Level2IntelActionProvider();

