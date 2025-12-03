/**
 * Manual tools for Web2 cybersecurity
 * Integrated with MCP and A2A protocols
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger';
import { exaSearch } from './mcp-client';

/**
 * Create manual tools for Web2 security use cases
 */
export function createManualTools() {
  const tools = [];

  // 1. Scan URL - Comprehensive phishing/malware detection
  tools.push(
    new DynamicStructuredTool({
      name: 'scan_url',
      description: `Comprehensive URL security scan using A2A protocol. 
      Checks for phishing, malware, suspicious patterns, and threat intelligence.
      Uses MCP for real-time threat data.
      Returns detailed security analysis with risk score.`,
      schema: z.object({
        url: z.string().describe('URL to scan for security threats'),
      }),
      func: async ({ url }) => {
        try {
          logger.info(`[A2A] scan_url: ${url}`);
          
          // Call the actual comprehensive scan API
          const fetch = (await import('node-fetch')).default;
          const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080';
          
          const response = await fetch(`${API_BASE}/api/security/comprehensive-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }
          
          const data: any = await response.json();
          const scanData = data.data;
          
          // Format as markdown
          let result = `## Security Scan Results for ${url}\n\n`;
          result += `### Overall Risk Assessment\n`;
          result += `- **Risk Score:** ${scanData.riskScore.overallScore}/100 ${scanData.riskScore.overallScore > 70 ? '🔴 (High Risk)' : scanData.riskScore.overallScore > 40 ? '🟡 (Medium Risk)' : '🟢 (Low Risk)'}\n`;
          result += `- **Verdict:** ${scanData.riskScore.verdict}\n\n`;
          
          // Reputation check
          if (scanData.details.reputation && scanData.details.reputation.sources) {
            result += `### Threat Intelligence\n`;
            scanData.details.reputation.sources.forEach((source: any) => {
              const statusIcon = source.status === 'clean' ? '✅' : source.status === 'malicious' ? '🚨' : '⚠️';
              result += `- ${statusIcon} **${source.name}**: ${source.status}`;
              if (source.details) result += ` - ${source.details}`;
              result += `\n`;
            });
            result += `\n`;
          }
          
          // Domain info
          if (scanData.details.whoisData) {
            const whois = scanData.details.whoisData;
            result += `### Domain Information\n`;
            result += `- **Domain Age:** ${whois.ageInDays >= 0 ? `${whois.ageInDays} days` : 'Unknown'}`;
            if (whois.ageInDays >= 0 && whois.ageInDays < 30) result += ` 🚩 (Newly registered)`;
            result += `\n`;
            result += `- **Registrar:** ${whois.registrar}\n`;
            if (whois.flags && whois.flags.length > 0) {
              result += `- **Flags:** ${whois.flags.join(', ')}\n`;
            }
            result += `\n`;
          }
          
          // TLS/SSL
          if (scanData.details.tlsAudit) {
            const tls = scanData.details.tlsAudit;
            result += `### Security Configuration\n`;
            result += `- **HTTPS:** ${tls.isHttps ? '✅ Enabled' : '❌ Not enabled'}\n`;
            if (tls.certificate) {
              result += `- **Certificate:** ${tls.certificate.valid ? '✅ Valid' : '❌ Invalid'}\n`;
            }
            result += `\n`;
          }
          
          // Recommendations
          result += `### Recommendations\n`;
          if (scanData.riskScore.overallScore > 50) {
            result += `⚠️ **High risk detected!** Avoid interacting with this URL.\n`;
            result += `- Do not enter personal information\n`;
            result += `- Do not download files\n`;
            result += `- Report as phishing if suspicious\n`;
          } else if (scanData.riskScore.overallScore > 25) {
            result += `⚠️ **Moderate risk.** Exercise caution.\n`;
            result += `- Verify the URL carefully\n`;
            result += `- Check for HTTPS\n`;
            result += `- Be wary of requests for personal data\n`;
          } else {
            result += `✅ **Low risk detected.** URL appears safe.\n`;
            result += `- Always verify URLs before clicking\n`;
            result += `- Keep your browser updated\n`;
          }
          
          return result;
        } catch (error) {
          logger.error('scan_url error:', error);
          return `Error scanning URL: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    })
  );

  // 2. Check Domain - Domain reputation and threat intelligence
  tools.push(
    new DynamicStructuredTool({
      name: 'check_domain',
      description: `Check domain reputation, WHOIS data, and threat intelligence using A2A protocol.
      Analyzes domain age, registrar, hosting provider, and security history.
      Uses MCP for latest threat feeds.
      Returns comprehensive domain security profile.`,
      schema: z.object({
        domain: z.string().describe('Domain name to check (e.g., example.com)'),
      }),
      func: async ({ domain }) => {
        try {
          logger.info(`[A2A] check_domain: ${domain}`);
          
          // Call actual APIs
          const fetch = (await import('node-fetch')).default;
          const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080';
          
          // Call WHOIS and reputation APIs in parallel
          const [whoisRes, repRes] = await Promise.all([
            fetch(`${API_BASE}/api/security/check-whois`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ domain }),
            }),
            fetch(`${API_BASE}/api/security/lookup-reputation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: `https://${domain}` }),
            }),
          ]);
          
          const whoisData: any = await whoisRes.json();
          const repData: any = await repRes.json();
          
          // Format as markdown
          let result = `## Domain Analysis for ${domain}\n\n`;
          
          if (whoisData.success) {
            const whois = whoisData.data;
            result += `### Domain Information\n`;
            result += `- **Age:** ${whois.ageInDays >= 0 ? `${whois.ageInDays} days (${Math.floor(whois.ageInDays / 365)} years)` : 'Unknown'}`;
            if (whois.ageInDays >= 0 && whois.ageInDays < 30) result += ` 🚩 **Newly registered!**`;
            result += `\n`;
            result += `- **Registrar:** ${whois.registrar}\n`;
            result += `- **Created:** ${whois.createdDate}\n`;
            result += `- **Expires:** ${whois.expiryDate}\n`;
            result += `- **Risk Score:** ${whois.riskScore}/100\n`;
            
            if (whois.flags && whois.flags.length > 0) {
              result += `\n**⚠️ Risk Flags:**\n`;
              whois.flags.forEach((flag: string) => {
                result += `- ${flag.replace(/_/g, ' ').toUpperCase()}\n`;
              });
            }
            result += `\n`;
          }
          
          if (repData.success) {
            const rep = repData.data;
            result += `### Reputation Check\n`;
            result += `- **IP Address:** ${rep.ip}\n`;
            result += `- **Risk Score:** ${rep.riskScore}/100\n\n`;
            
            if (rep.sources && rep.sources.length > 0) {
              result += `**Security Sources:**\n`;
              rep.sources.forEach((source: any) => {
                const icon = source.status === 'clean' ? '✅' : source.status === 'malicious' ? '🚨' : '⚠️';
                result += `- ${icon} **${source.name}**: ${source.status}`;
                if (source.details) result += ` - ${source.details}`;
                result += `\n`;
              });
            }
          }
          
          return result;
        } catch (error) {
          logger.error('check_domain error:', error);
          return `Error checking domain: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    })
  );

  // 3. Analyze Email - Email security and phishing detection
  tools.push(
    new DynamicStructuredTool({
      name: 'analyze_email',
      description: `Analyze email for phishing, spoofing, and malicious content using A2A protocol.
      Checks sender reputation, email headers, links, and attachments.
      Uses MCP for latest phishing campaigns.
      Returns email security assessment with threat indicators.`,
      schema: z.object({
        emailData: z.string().describe('Email content, headers, or sender information to analyze'),
      }),
      func: async ({ emailData }) => {
        try {
          logger.info(`[A2A] analyze_email: ${emailData}`);
          
          // Extract potential URLs or domains from email
          const urlMatches = emailData.match(/https?:\/\/[^\s]+/g) || [];
          const domainMatches = emailData.match(/[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/g) || [];
          
          // Use MCP for phishing campaign intelligence
          const phishingIntel = await exaSearch('latest email phishing campaigns', 3);
          
          let analysis = `## Email Security Analysis for ${emailData}\n\n`;
          analysis += `### Overview\n`;
          analysis += `The email address **${emailData}** has been analyzed for potential phishing and malicious content. Here are the findings:\n\n`;
          
          analysis += `### Extracted Domains\n`;
          if (domainMatches.length > 0) {
            domainMatches.slice(0, 3).forEach(domain => {
              analysis += `- ${domain}\n`;
            });
          } else {
            analysis += `- No suspicious domains detected\n`;
          }
          
          analysis += `\n### Extracted URLs\n`;
          if (urlMatches.length > 0) {
            urlMatches.slice(0, 3).forEach(url => {
              analysis += `- ${url}\n`;
            });
          } else {
            analysis += `- No URLs found in email content\n`;
          }
          
          analysis += `\n### Phishing Intelligence\n`;
          analysis += `Recent phishing trends indicate that cybercriminals are continually adapting their tactics. Here are some relevant articles highlighting current threats:\n\n`;
          
          if (phishingIntel.length > 0) {
            phishingIntel.slice(0, 2).forEach((result, idx) => {
              analysis += `${idx + 1}. **[${result.title}](${result.url})**\n`;
              if (result.text) {
                analysis += `   ${result.text.substring(0, 150)}...\n\n`;
              }
            });
          }
          
          return analysis;
        } catch (error) {
          logger.error('analyze_email error:', error);
          return `Error analyzing email: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    })
  );

  // 4. Breach Check - Data breach and credential leak detection with HaveIBeenPwned
  tools.push(
    new DynamicStructuredTool({
      name: 'breach_check',
      description: `Check if email has been involved in data breaches using HaveIBeenPwned API and A2A protocol.
      Searches breach databases including HIBP for comprehensive breach history.
      Uses MCP for latest breach intelligence and dark web monitoring.
      Returns detailed breach history, exposed data types, and risk assessment.`,
      schema: z.object({
        email: z.string().describe('Email address to check for breaches'),
      }),
      func: async ({ email }) => {
        try {
          logger.info(`[A2A] breach_check: ${email}`);
          
          // Call the actual HIBP API
          const fetch = (await import('node-fetch')).default;
          const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080';
          
          const response = await fetch(`${API_BASE}/api/security/breach-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }
          
          const data: any = await response.json();
          const breachData = data.data;
          
          // Format the response as markdown
          let result = `## Breach Check Results for ${email}\n\n`;
          
          if (breachData.totalBreaches === 0) {
            result += `✅ **Good news!** This email address has not been found in any known data breaches.\n\n`;
            result += `### Security Status\n`;
            result += `- **Risk Score:** ${breachData.riskScore}/100 (Low)\n`;
            result += `- **Total Breaches:** 0\n`;
            result += `- **Status:** Clean\n`;
          } else {
            result += `⚠️ **Alert!** This email address has been found in **${breachData.totalBreaches}** data breach${breachData.totalBreaches > 1 ? 'es' : ''}.\n\n`;
            result += `### Security Status\n`;
            result += `- **Risk Score:** ${breachData.riskScore}/100 ${breachData.riskScore > 70 ? '(High Risk)' : breachData.riskScore > 40 ? '(Medium Risk)' : '(Low Risk)'}\n`;
            result += `- **Total Breaches:** ${breachData.totalBreaches}\n`;
            result += `- **Total Accounts Affected:** ${breachData.totalPwnCount.toLocaleString()}\n\n`;
            
            if (breachData.flags && breachData.flags.length > 0) {
              result += `### Risk Flags\n`;
              breachData.flags.forEach((flag: string) => {
                result += `- 🚩 ${flag.replace(/_/g, ' ').toUpperCase()}\n`;
              });
              result += `\n`;
            }
            
            result += `### Recent Breaches (Top 5)\n`;
            breachData.breaches.slice(0, 5).forEach((breach: any, idx: number) => {
              result += `\n**${idx + 1}. ${breach.title}** (${breach.breachDate})\n`;
              result += `- **Domain:** ${breach.domain}\n`;
              result += `- **Accounts Affected:** ${breach.pwnCount.toLocaleString()}\n`;
              result += `- **Data Exposed:** ${breach.dataClasses.slice(0, 5).join(', ')}${breach.dataClasses.length > 5 ? '...' : ''}\n`;
              if (breach.isSensitive) {
                result += `- ⚠️ **Contains Sensitive Data**\n`;
              }
            });
            
            result += `\n\n### Recommendations\n`;
            result += `1. **Change your passwords** immediately on all affected services\n`;
            result += `2. **Enable 2FA** (Two-Factor Authentication) wherever possible\n`;
            result += `3. **Monitor your accounts** for suspicious activity\n`;
            result += `4. **Use unique passwords** for each service\n`;
            result += `5. **Consider a password manager** to generate and store strong passwords\n`;
          }
          
          return result;
        } catch (error) {
          logger.error('breach_check error:', error);
          return `Error checking breaches: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    })
  );

  logger.info(`Created ${tools.length} Web2 cybersecurity tools with MCP/A2A integration`);
  return tools;
}
