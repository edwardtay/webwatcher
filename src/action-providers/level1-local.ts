/**
 * Level 1 - Local Analyst Action Provider
 * Pure log/email/config analysis with local model
 * No network access - air-gapped mode
 */

import {
  ActionProvider,
  WalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../utils/logger";
import { securityAnalytics } from "../utils/security-analytics";

export class Level1LocalActionProvider extends ActionProvider<WalletProvider> {
  constructor() {
    super("level1-local-action-provider", []);
  }

  supportsNetwork = (network: Network) => {
    return true; // Level 1 works offline, so network doesn't matter
  };

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
              description: line.substring(0, 200), // Truncate long lines
            });

            // Calculate risk score
            const severityScores = { low: 5, medium: 15, high: 30, critical: 50 };
            analysis.riskScore += severityScores[severity];
          }
        }
      });

      const riskLevel = analysis.riskScore >= 75 ? "CRITICAL" : analysis.riskScore >= 50 ? "HIGH" : analysis.riskScore >= 25 ? "MEDIUM" : "LOW";

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
        timestamp: new Date().toISOString(),
        data: {
          logFile: args.logPath,
          incidentsFound: analysis.incidents.length,
          riskScore: analysis.riskScore,
        },
        riskScore: analysis.riskScore,
      });

      return JSON.stringify({
        ...analysis,
        riskLevel,
        recommendation: riskLevel === "HIGH" || riskLevel === "CRITICAL"
          ? "Immediate investigation required"
          : riskLevel === "MEDIUM"
          ? "Review and monitor closely"
          : "No immediate action needed",
      }, null, 2);
    } catch (error) {
      logger.error("Error analyzing logs", error);
      return `Error analyzing logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Analyze email content for phishing and security threats
   */
  @CreateAction({
    name: "analyze_email",
    description:
      "Analyzes email content locally for phishing attempts, malicious links, and security threats. Works offline.",
    schema: z.object({
      emailContent: z.string().describe("The email content to analyze"),
      subject: z.string().optional().describe("Optional: email subject line"),
    }),
  })
  async analyzeEmail(
    walletProvider: WalletProvider,
    args: { emailContent: string; subject?: string },
  ): Promise<string> {
    try {
      logger.info("Analyzing email content");

      const analysis = {
        timestamp: new Date().toISOString(),
        subject: args.subject || "N/A",
        threats: [] as Array<{
          type: string;
          severity: "low" | "medium" | "high" | "critical";
          description: string;
        }>,
        riskScore: 0,
      };

      const content = (args.subject || "") + " " + args.emailContent.toLowerCase();

      // Phishing indicators
      const phishingPatterns = [
        { pattern: /urgent.*action.*required/i, severity: "medium" as const, type: "Urgency Manipulation" },
        { pattern: /click.*here.*now/i, severity: "high" as const, type: "Suspicious Link Request" },
        { pattern: /verify.*account/i, severity: "medium" as const, type: "Account Verification Request" },
        { pattern: /suspended.*account/i, severity: "high" as const, type: "Account Suspension Threat" },
        { pattern: /password.*expired/i, severity: "medium" as const, type: "Password Expiration Claim" },
        { pattern: /bitcoin|ethereum|crypto.*wallet/i, severity: "high" as const, type: "Cryptocurrency Scam" },
        { pattern: /http:\/\//i, severity: "medium" as const, type: "Unencrypted Link" },
        { pattern: /\.exe|\.zip|\.pdf.*attachment/i, severity: "high" as const, type: "Suspicious Attachment" },
      ];

      phishingPatterns.forEach(({ pattern, severity, type }) => {
        if (pattern.test(content)) {
          analysis.threats.push({
            type,
            severity,
            description: `Pattern detected: ${pattern.toString()}`,
          });

          const severityScores = { low: 5, medium: 15, high: 30, critical: 50 };
          analysis.riskScore += severityScores[severity];
        }
      });

      // Check for suspicious domains (basic pattern matching)
      const suspiciousDomains = /@(gmail|yahoo|hotmail|outlook)\.(com|net|org)/i;
      if (suspiciousDomains.test(content) && /official|secure|verify/i.test(content)) {
        analysis.threats.push({
          type: "Suspicious Domain Usage",
          severity: "high",
          description: "Email claims to be from official source but uses free email domain",
        });
        analysis.riskScore += 30;
      }

      const riskLevel = analysis.riskScore >= 75 ? "CRITICAL" : analysis.riskScore >= 50 ? "HIGH" : analysis.riskScore >= 25 ? "MEDIUM" : "LOW";

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
        timestamp: new Date().toISOString(),
        data: {
          emailSubject: args.subject,
          threatsFound: analysis.threats.length,
          riskScore: analysis.riskScore,
        },
        riskScore: analysis.riskScore,
      });

      return JSON.stringify({
        ...analysis,
        riskLevel,
        recommendation: riskLevel === "HIGH" || riskLevel === "CRITICAL"
          ? "Do not interact with this email. Mark as spam and delete."
          : riskLevel === "MEDIUM"
          ? "Exercise caution. Verify sender before clicking any links."
          : "Email appears safe, but always verify sender identity.",
      }, null, 2);
    } catch (error) {
      logger.error("Error analyzing email", error);
      return `Error analyzing email: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Analyze configuration files for security misconfigurations
   */
  @CreateAction({
    name: "analyze_config",
    description:
      "Analyzes configuration files locally for security misconfigurations, exposed secrets, and insecure settings. Works offline.",
    schema: z.object({
      configPath: z.string().describe("Path to the configuration file to analyze"),
      configType: z.enum(["env", "json", "yaml", "toml", "ini", "xml"]).optional().describe("Configuration file type"),
    }),
  })
  async analyzeConfig(
    walletProvider: WalletProvider,
    args: { configPath: string; configType?: string },
  ): Promise<string> {
    try {
      logger.info(`Analyzing config file: ${args.configPath}`);

      const configContent = await fs.readFile(args.configPath, "utf-8");
      
      const analysis = {
        file: args.configPath,
        timestamp: new Date().toISOString(),
        issues: [] as Array<{
          type: string;
          severity: "low" | "medium" | "high" | "critical";
          description: string;
          line?: number;
        }>,
        riskScore: 0,
      };

      const lines = configContent.split("\n");

      // Common security misconfigurations
      const securityChecks = [
        {
          pattern: /password\s*=\s*["']?([^"'\s]+)["']?/i,
          severity: "critical" as const,
          type: "Hardcoded Password",
          message: "Password found in plaintext",
        },
        {
          pattern: /api[_-]?key\s*=\s*["']?([^"'\s]+)["']?/i,
          severity: "critical" as const,
          type: "Exposed API Key",
          message: "API key found in plaintext",
        },
        {
          pattern: /secret\s*=\s*["']?([^"'\s]+)["']?/i,
          severity: "critical" as const,
          type: "Exposed Secret",
          message: "Secret found in plaintext",
        },
        {
          pattern: /debug\s*=\s*true/i,
          severity: "high" as const,
          type: "Debug Mode Enabled",
          message: "Debug mode should be disabled in production",
        },
        {
          pattern: /ssl\s*=\s*false|tls\s*=\s*false/i,
          severity: "high" as const,
          type: "Insecure Protocol",
          message: "SSL/TLS disabled",
        },
        {
          pattern: /cors\s*=\s*\*/i,
          severity: "medium" as const,
          type: "Permissive CORS",
          message: "CORS allows all origins",
        },
        {
          pattern: /admin.*password.*admin/i,
          severity: "critical" as const,
          type: "Default Credentials",
          message: "Default admin credentials detected",
        },
      ];

      lines.forEach((line, index) => {
        for (const check of securityChecks) {
          if (check.pattern.test(line)) {
            analysis.issues.push({
              type: check.type,
              severity: check.severity,
              description: `${check.message} at line ${index + 1}`,
              line: index + 1,
            });

            const severityScores = { low: 5, medium: 15, high: 30, critical: 50 };
            analysis.riskScore += severityScores[check.severity];
          }
        }
      });

      const riskLevel = analysis.riskScore >= 75 ? "CRITICAL" : analysis.riskScore >= 50 ? "HIGH" : analysis.riskScore >= 25 ? "MEDIUM" : "LOW";

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
        timestamp: new Date().toISOString(),
        data: {
          configFile: args.configPath,
          issuesFound: analysis.issues.length,
          riskScore: analysis.riskScore,
        },
        riskScore: analysis.riskScore,
      });

      return JSON.stringify({
        ...analysis,
        riskLevel,
        recommendation: riskLevel === "HIGH" || riskLevel === "CRITICAL"
          ? "Immediate remediation required. Rotate all exposed secrets immediately."
          : riskLevel === "MEDIUM"
          ? "Review and fix misconfigurations before deployment."
          : "Configuration appears secure, but review best practices.",
      }, null, 2);
    } catch (error) {
      logger.error("Error analyzing config", error);
      return `Error analyzing config: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Classify security incidents based on local analysis
   */
  @CreateAction({
    name: "classify_incident",
    description:
      "Classifies security incidents based on local analysis. Works offline.",
    schema: z.object({
      incidentDescription: z.string().describe("Description of the security incident"),
      evidence: z.string().optional().describe("Optional: additional evidence or context"),
    }),
  })
  async classifyIncident(
    walletProvider: WalletProvider,
    args: { incidentDescription: string; evidence?: string },
  ): Promise<string> {
    try {
      logger.info("Classifying security incident");

      const description = (args.incidentDescription + " " + (args.evidence || "")).toLowerCase();

      const classification = {
        timestamp: new Date().toISOString(),
        category: "Unknown",
        severity: "low" as "low" | "medium" | "high" | "critical",
        attackPath: [] as string[],
        remediation: [] as string[],
        riskScore: 0,
      };

      // Incident classification logic
      if (/data.*breach|leak|exposed/i.test(description)) {
        classification.category = "Data Breach";
        classification.severity = "critical";
        classification.attackPath = ["Initial Access", "Data Exfiltration"];
        classification.remediation = [
          "Immediately revoke access credentials",
          "Notify affected parties",
          "Conduct forensic analysis",
          "Implement additional monitoring",
        ];
        classification.riskScore = 80;
      } else if (/ransomware|encrypt/i.test(description)) {
        classification.category = "Ransomware";
        classification.severity = "critical";
        classification.attackPath = ["Initial Access", "Execution", "Impact"];
        classification.remediation = [
          "Isolate affected systems",
          "Do not pay ransom",
          "Restore from backups",
          "Patch vulnerabilities",
        ];
        classification.riskScore = 90;
      } else if (/ddos|denial.*service/i.test(description)) {
        classification.category = "DDoS Attack";
        classification.severity = "high";
        classification.attackPath = ["Network Flooding"];
        classification.remediation = [
          "Enable DDoS protection",
          "Rate limit requests",
          "Block malicious IPs",
          "Scale infrastructure",
        ];
        classification.riskScore = 60;
      } else if (/phishing|social.*engineering/i.test(description)) {
        classification.category = "Phishing";
        classification.severity = "medium";
        classification.attackPath = ["Social Engineering", "Credential Theft"];
        classification.remediation = [
          "Educate users",
          "Implement email filtering",
          "Enable MFA",
          "Monitor for credential reuse",
        ];
        classification.riskScore = 40;
      } else if (/malware|virus|trojan/i.test(description)) {
        classification.category = "Malware";
        classification.severity = "high";
        classification.attackPath = ["Initial Access", "Execution", "Persistence"];
        classification.remediation = [
          "Isolate affected systems",
          "Run antivirus scan",
          "Remove malware",
          "Patch vulnerabilities",
        ];
        classification.riskScore = 70;
      } else {
        classification.category = "Suspicious Activity";
        classification.severity = "medium";
        classification.attackPath = ["Unknown"];
        classification.remediation = [
          "Investigate further",
          "Monitor closely",
          "Review logs",
        ];
        classification.riskScore = 30;
      }

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: classification.severity,
        timestamp: new Date().toISOString(),
        data: {
          category: classification.category,
          attackPath: classification.attackPath,
          riskScore: classification.riskScore,
        },
        riskScore: classification.riskScore,
      });

      return JSON.stringify(classification, null, 2);
    } catch (error) {
      logger.error("Error classifying incident", error);
      return `Error classifying incident: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Factory function to create Level 1 action provider
 */
export const level1LocalActionProvider = () => new Level1LocalActionProvider();





