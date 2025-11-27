/**
 * Website scanning utility - extracted from UnifiedActionProvider
 * to avoid decorator metadata issues
 */

import { logger } from "./logger";
import { securityAnalytics } from "./security-analytics";

/**
 * Call UrlScanAgent via A2A to get urlscan.io API data
 */
async function callUrlScanAgent(url: string): Promise<any> {
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
 * Scan website for phishing red flags (A2A style)
 */
export async function scanWebsite(url: string): Promise<string> {
  try {
    logger.info("[A2A] Website scan request initiated", { url });

    const a2aFlow: string[] = [];
    a2aFlow.push("**🤖 A2A Agent Coordination Active**\n");
    a2aFlow.push("`[User -> UrlFeatureAgent]`");
    a2aFlow.push(`${url}\n`);

    // Step 1: Extract URL features (UrlFeatureAgent logic)
    let input = url.trim();
    if (!input.startsWith("http://") && !input.startsWith("https://")) {
      input = "https://" + input;
    }

    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch (e) {
      return JSON.stringify({
        error: "invalid_url",
        raw: url,
        message: `Input does not look like a valid URL: "${url}"`,
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
      "login", "signin", "verify", "update", "secure",
      "account", "wallet", "password", "support",
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
      fullUrl, domain, path, isIp, hasAt, numDots, urlLength,
      keywordHits, tld, tldSuspicious, brandImpersonation,
    };

    a2aFlow.push("`[UrlFeatureAgent -> UrlScanAgent]`");
    a2aFlow.push("```json");
    a2aFlow.push(JSON.stringify(features, null, 2));
    a2aFlow.push("```\n");

    // Step 2: Call UrlScanAgent via A2A to get urlscan.io data
    logger.info("[A2A] UrlFeatureAgent -> UrlScanAgent: Requesting urlscan.io scan");
    let urlscanData: any = null;
    try {
      urlscanData = await callUrlScanAgent(fullUrl);
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

    if (isIp) redFlags.push("Uses a raw IP instead of a normal domain name.");
    if (hasAt) redFlags.push("Contains @ which can hide the real destination domain.");
    if (numDots >= 3) redFlags.push("Has many dots in the domain which can hide the true site.");
    if (urlLength > 80) redFlags.push("URL is very long which is common for phishing links.");
    if (keywordHits && keywordHits.length > 0) {
      redFlags.push(`Contains sensitive words in the link like: ${keywordHits.join(", ")}.`);
    }
    if (tldSuspicious) redFlags.push(`Uses a less common top level domain (${tld}).`);
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
    return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
  }
}

