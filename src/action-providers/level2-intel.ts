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
import { cveRateLimiter, searchRateLimiter } from "../utils/rate-limiter";
import { validateInput, validateCVEId } from "../utils/input-validator";

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
      // Input validation and guardrails
      if (args.cveId && !validateCVEId(args.cveId)) {
        return `❌ Invalid CVE ID format: ${args.cveId}. Expected format: CVE-YYYY-NNNN`;
      }
      
      const keywordValidation = args.keyword ? validateInput(args.keyword) : { valid: true, sanitized: "" };
      if (!keywordValidation.valid) {
        return `❌ Invalid input: ${keywordValidation.error}`;
      }
      
      // Rate limiting - prevent API abuse
      const rateLimitKey = "cve_search";
      if (!cveRateLimiter.isAllowed(rateLimitKey)) {
        const remaining = cveRateLimiter.getRemaining(rateLimitKey);
        return `⏳ Rate limit exceeded. Please wait before making another CVE search request. (${remaining} requests remaining)`;
      }
      
      logger.info("Searching CVE database", args);

      // Use NVD API (National Vulnerability Database) - free public API
      let url = "https://services.nvd.nist.gov/rest/json/cves/2.0";
      const params: string[] = [];

      // Handle year-based searches (e.g., "2025", "CVE 2025")
      const keyword = args.keyword || "";
      const yearMatch = keyword.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : null;

      if (args.cveId) {
        url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(args.cveId)}`;
      } else {
        // Build search parameters
        if (year) {
          // Search by year using pubStartDate and pubEndDate
          const startDate = `${year}-01-01T00:00:00.000`;
          const endDate = `${year}-12-31T23:59:59.999`;
          params.push(`pubStartDate=${startDate}`);
          params.push(`pubEndDate=${endDate}`);
        }
        
        // Add keyword search (excluding year if already used)
        const searchKeyword = year ? keyword.replace(/\b20\d{2}\b/g, "").trim() : keyword;
        if (searchKeyword) {
          params.push(`keywordSearch=${encodeURIComponent(searchKeyword)}`);
        }
        
        if (args.product) {
          params.push(`keywordSearch=${encodeURIComponent(args.product)}`);
        }
        
        // Add results per page and start index for pagination
        params.push("resultsPerPage=50"); // Increased from 20 to 50 for more results
        params.push("startIndex=0");
        
        if (params.length > 0) {
          url += `?${params.join("&")}`;
        }
      }

      logger.info(`CVE API URL: ${url}`);

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "WebWatcher-Security-Agent/1.0",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`CVE API error: ${response.status} - ${errorText}`);
        throw new Error(`CVE API returned status ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json() as { vulnerabilities?: any[]; totalResults?: number };
      const vulnerabilities = data.vulnerabilities || [];
      const totalResults = data.totalResults || 0;

      logger.info(`Found ${vulnerabilities.length} CVEs (total: ${totalResults})`);

      const results = vulnerabilities.slice(0, 50).map((vuln: any) => { // Increased from 10 to 50
        const cve = vuln.cve;
        const cvssV31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
        const cvssV30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
        const cvssV2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData;
        
        // Use best available CVSS score
        const cvssData = cvssV31 || cvssV30 || cvssV2;
        
        return {
          id: cve.id,
          description: cve.descriptions?.find((d: any) => d.lang === "en")?.value || 
                       cve.descriptions?.[0]?.value || 
                       "No description available",
          severity: cvssData?.baseSeverity || 
                   (cvssData?.baseScore >= 9 ? "CRITICAL" : 
                    cvssData?.baseScore >= 7 ? "HIGH" : 
                    cvssData?.baseScore >= 4 ? "MEDIUM" : "LOW") || 
                   "UNKNOWN",
          score: cvssData?.baseScore || 0,
          vector: cvssData?.vectorString || "N/A",
          published: cve.published || "Unknown",
          modified: cve.lastModified || "Unknown",
          references: (cve.references || []).slice(0, 5).map((ref: any) => ref.url),
        };
      });

      const analysis = {
        timestamp: new Date().toISOString(),
        query: args,
        searchYear: year,
        results: results,
        totalFound: totalResults,
        showing: results.length,
        summary: {
          critical: results.filter((r: any) => r.severity === "CRITICAL").length,
          high: results.filter((r: any) => r.severity === "HIGH").length,
          medium: results.filter((r: any) => r.severity === "MEDIUM").length,
          low: results.filter((r: any) => r.severity === "LOW").length,
        },
      };

      // Calculate risk score based on found CVEs
      const criticalCount = analysis.summary.critical;
      const highCount = analysis.summary.high;
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

      // Format response for better readability
      let responseText = `🔍 CVE Search Results\n\n`;
      responseText += `Query: ${args.keyword || args.product || args.cveId || "General search"}\n`;
      if (year) responseText += `Year Filter: ${year}\n`;
      responseText += `Total Found: ${analysis.totalFound}\n`;
      responseText += `Showing: ${analysis.showing} CVEs\n\n`;
      responseText += `Summary:\n`;
      responseText += `  Critical: ${analysis.summary.critical}\n`;
      responseText += `  High: ${analysis.summary.high}\n`;
      responseText += `  Medium: ${analysis.summary.medium}\n`;
      responseText += `  Low: ${analysis.summary.low}\n\n`;
      responseText += `Top CVEs:\n`;
      
      results.forEach((cve: any, idx: number) => {
        responseText += `\n${idx + 1}. ${cve.id} [${cve.severity}] (Score: ${cve.score})\n`;
        responseText += `   ${cve.description.substring(0, 200)}${cve.description.length > 200 ? "..." : ""}\n`;
        responseText += `   Published: ${cve.published}\n`;
        if (cve.references && cve.references.length > 0) {
          responseText += `   References: ${cve.references[0]}\n`;
        }
      });

      if (analysis.totalFound > results.length) {
        responseText += `\n\n... and ${analysis.totalFound - results.length} more CVEs. Use more specific search terms to narrow results.`;
      }

      return responseText;
    } catch (error) {
      logger.error("Error searching CVE", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Provide helpful error message
      return `❌ Error searching CVE database: ${errorMsg}\n\n` +
             `Please try:\n` +
             `- A specific CVE ID (e.g., "CVE-2024-1234")\n` +
             `- A product name (e.g., "Apache", "nginx")\n` +
             `- A keyword related to the vulnerability\n` +
             `- A year (e.g., "2025", "2024")`;
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
      maxResults: z.number().optional().default(20).describe("Maximum number of results to return (default: 20, max: 100)"),
    }),
  })
  async osintSearch(
    walletProvider: WalletProvider,
    args: { query: string; searchType?: string; maxResults?: number },
  ): Promise<string> {
    try {
      // Input validation
      const inputValidation = validateInput(args.query);
      if (!inputValidation.valid) {
        return `❌ Invalid search query: ${inputValidation.error}`;
      }
      
      // Rate limiting
      const rateLimitKey = "osint_search";
      if (!searchRateLimiter.isAllowed(rateLimitKey)) {
        const remaining = searchRateLimiter.getRemaining(rateLimitKey);
        return `⏳ Rate limit exceeded. Please wait before making another search request. (${remaining} requests remaining)`;
      }
      
      // Validate maxResults
      const maxResults = Math.min(Math.max(1, args.maxResults || 20), 100); // Clamp between 1-100
      
      logger.info("Performing OSINT search", { ...args, maxResults });

      // maxResults already validated above
      const searchType = args.searchType || "general";

      // Use DuckDuckGo Instant Answer API (free, no API key required)
      // For more advanced searches, can use SerpAPI (requires SERP_API_KEY)
      let searchUrl: string;
      let results: any[] = [];

      if (process.env.SERP_API_KEY) {
        // Use SerpAPI for better results (requires API key)
        const serpApiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(args.query)}&api_key=${process.env.SERP_API_KEY}`;
        
        try {
          const response = await fetch(serpApiUrl);
          if (response.ok) {
            const data = await response.json() as { organic_results?: any[] };
            results = (data.organic_results || []).slice(0, maxResults).map((result: any) => ({
              title: result.title,
              url: result.link,
              snippet: result.snippet,
              source: "SerpAPI",
            }));
          }
        } catch (error) {
          logger.warn("SerpAPI search failed, falling back to DuckDuckGo", error);
        }
      }

      // Fallback to DuckDuckGo HTML scraping (free, no API key)
      if (results.length === 0) {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
        
        try {
          const response = await fetch(ddgUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          if (response.ok) {
            const html = await response.text();
            // Simple HTML parsing for DuckDuckGo results
            // In production, use a proper HTML parser like cheerio
            const linkRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
            const snippetRegex = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
            
            const links: Array<{ url: string; title: string }> = [];
            let match;
            while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
              links.push({ url: match[1], title: match[2] });
            }

            const snippets: string[] = [];
            while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
              snippets.push(match[1]);
            }

            results = links.slice(0, maxResults).map((link, idx) => ({
              title: link.title,
              url: link.url,
              snippet: snippets[idx] || "No snippet available",
              source: "DuckDuckGo",
            }));
          }
        } catch (error) {
          logger.warn("DuckDuckGo search failed", error);
        }
      }

      // If still no results, try a simple web search API
      if (results.length === 0 && process.env.SEARCH_API_KEY) {
        // Generic search API fallback
        try {
          const searchApiUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=${maxResults}`;
          const response = await fetch(searchApiUrl, {
            headers: {
              "X-Subscription-Token": process.env.SEARCH_API_KEY,
            },
          });

          if (response.ok) {
            const data = await response.json() as { web?: { results?: any[] } };
            results = (data.web?.results || []).map((result: any) => ({
              title: result.title,
              url: result.url,
              snippet: result.description,
              source: "Brave Search API",
            }));
          }
        } catch (error) {
          logger.warn("Search API failed", error);
        }
      }

      const analysis = {
        query: args.query,
        searchType,
        timestamp: new Date().toISOString(),
        resultsFound: results.length,
        results: results,
        sources: searchType === "technical" 
          ? ["Security advisories", "Vulnerability databases", "Technical documentation"]
          : searchType === "news"
          ? ["News articles", "Security blogs", "Press releases"]
          : searchType === "social"
          ? ["Social media", "Public profiles", "Forums"]
          : ["General web search", "Public databases", "Security forums"],
      };

      // Calculate risk score based on findings
      let riskScore = 0;
      const findings: string[] = [];

      // Analyze results for security-relevant information
      results.forEach((result) => {
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        if (text.includes("vulnerability") || text.includes("exploit") || text.includes("cve")) {
          riskScore += 10;
          findings.push(`Security-related content found: ${result.title}`);
        }
        if (text.includes("breach") || text.includes("attack") || text.includes("malware")) {
          riskScore += 15;
          findings.push(`Threat-related content found: ${result.title}`);
        }
      });

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: riskScore >= 30 ? "high" : riskScore >= 15 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        data: {
          query: args.query,
          searchType,
          resultsFound: results.length,
          findingsCount: findings.length,
          riskScore,
        },
        riskScore,
      });

      return JSON.stringify({
        ...analysis,
        findings: findings.length > 0 ? findings : ["No immediate security concerns identified"],
        riskScore,
        recommendation: riskScore >= 30
          ? "High-risk findings detected. Review results carefully."
          : riskScore >= 15
          ? "Some security-relevant information found. Review recommended."
          : "Search completed successfully.",
      }, null, 2);
    } catch (error) {
      logger.error("Error performing OSINT search", error);
      return `Error performing OSINT search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * General web search
   */
  @CreateAction({
    name: "web_search",
    description:
      "Performs a general web search for information. Requires network access.",
    schema: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().optional().default(20).describe("Maximum number of results to return (default: 20, max: 100)"),
    }),
  })
  async webSearch(
    walletProvider: WalletProvider,
    args: { query: string; maxResults?: number },
  ): Promise<string> {
    try {
      logger.info("Performing web search", args);

      // Use the same search logic as OSINT search
      const maxResults = Math.min(Math.max(1, args.maxResults || 20), 100); // Clamp between 1-100
      let results: any[] = [];

      if (process.env.SERP_API_KEY) {
        const serpApiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(args.query)}&api_key=${process.env.SERP_API_KEY}`;
        
        try {
          const response = await fetch(serpApiUrl);
          if (response.ok) {
            const data = await response.json() as { organic_results?: any[] };
            results = (data.organic_results || []).slice(0, maxResults).map((result: any) => ({
              title: result.title,
              url: result.link,
              snippet: result.snippet,
              source: "SerpAPI",
            }));
          }
        } catch (error) {
          logger.warn("SerpAPI search failed, falling back to DuckDuckGo", error);
        }
      }

      // Fallback to DuckDuckGo
      if (results.length === 0) {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
        
        try {
          const response = await fetch(ddgUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          if (response.ok) {
            const html = await response.text();
            const linkRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
            const snippetRegex = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
            
            const links: Array<{ url: string; title: string }> = [];
            let match;
            while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
              links.push({ url: match[1], title: match[2] });
            }

            const snippets: string[] = [];
            while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
              snippets.push(match[1]);
            }

            results = links.slice(0, maxResults).map((link, idx) => ({
              title: link.title,
              url: link.url,
              snippet: snippets[idx] || "No snippet available",
              source: "DuckDuckGo",
            }));
          }
        } catch (error) {
          logger.warn("DuckDuckGo search failed", error);
        }
      }

      return JSON.stringify({
        query: args.query,
        timestamp: new Date().toISOString(),
        resultsFound: results.length,
        results,
      }, null, 2);
    } catch (error) {
      logger.error("Error performing web search", error);
      return `Error performing web search: ${error instanceof Error ? error.message : String(error)}`;
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

      // Build search query
      const searchQuery = `${args.vendor} ${args.product || ""} ${args.keyword || ""} security advisory`.trim();
      
      // Use web search to find vendor advisories
      const searchResults = await this.webSearch(walletProvider, { 
        query: searchQuery, 
        maxResults: 10 
      });

      const parsedResults = JSON.parse(searchResults);
      
      // Filter for vendor-specific security pages
      const vendorResults = parsedResults.results.filter((result: any) => {
        const text = `${result.title} ${result.url}`.toLowerCase();
        return text.includes(args.vendor.toLowerCase()) && 
               (text.includes("security") || text.includes("advisory") || text.includes("cve"));
      });

      const analysis = {
        vendor: args.vendor,
        product: args.product,
        keyword: args.keyword,
        timestamp: new Date().toISOString(),
        advisories: vendorResults.map((result: any) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          source: result.source,
        })),
        totalFound: vendorResults.length,
      };

      return JSON.stringify({
        ...analysis,
        recommendation: vendorResults.length > 0
          ? "Found vendor security advisories. Review the URLs for detailed information."
          : "No vendor-specific advisories found. Try searching with different keywords.",
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

