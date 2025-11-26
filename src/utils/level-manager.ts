/**
 * Level Manager - Manages different capability levels for the security analyst
 * 
 * Levels:
 * 1. Local analyst (no network) - Pure log/email/config analysis
 * 2. Intel-enhanced analyst (web search) - Adds read-only HTTP access
 * 3. Tool-using responder (MCP) - Uses MCP tools to act on environment
 * 4A. A2A coordination (no payments) - Multi-agent coordination
 * 4B. A2A + x402 payments - Agent commerce with HTTP 402
 */

import { logger } from "./logger";

export enum AnalystLevel {
  LEVEL_1_LOCAL = "level_1_local",
  LEVEL_2_INTEL = "level_2_intel",
  LEVEL_3_TOOLS = "level_3_tools",
  LEVEL_4A_A2A = "level_4a_a2a",
  LEVEL_4B_X402 = "level_4b_x402",
}

export interface LevelCapabilities {
  networkAccess: boolean;
  webSearch: boolean;
  mcpTools: boolean;
  a2aCoordination: boolean;
  payments: boolean;
  description: string;
}

export const LEVEL_CAPABILITIES: Record<AnalystLevel, LevelCapabilities> = {
  [AnalystLevel.LEVEL_1_LOCAL]: {
    networkAccess: false,
    webSearch: false,
    mcpTools: false,
    a2aCoordination: false,
    payments: false,
    description: "Pure log/email/config analysis with local model. Air-gapped mode.",
  },
  [AnalystLevel.LEVEL_2_INTEL]: {
    networkAccess: true,
    webSearch: true,
    mcpTools: false,
    a2aCoordination: false,
    payments: false,
    description: "Read-only HTTP access for CVEs, IP/domain reputation, OSINT, vendor docs.",
  },
  [AnalystLevel.LEVEL_3_TOOLS]: {
    networkAccess: true,
    webSearch: true,
    mcpTools: true,
    a2aCoordination: false,
    payments: false,
    description: "Uses MCP tools to act on environment with least privilege.",
  },
  [AnalystLevel.LEVEL_4A_A2A]: {
    networkAccess: true,
    webSearch: true,
    mcpTools: true,
    a2aCoordination: true,
    payments: false,
    description: "Multi-agent coordination without payments.",
  },
  [AnalystLevel.LEVEL_4B_X402]: {
    networkAccess: true,
    webSearch: true,
    mcpTools: true,
    a2aCoordination: true,
    payments: true,
    description: "Multi-agent coordination with x402 payments for agent commerce.",
  },
};

export class LevelManager {
  private currentLevel: AnalystLevel;

  constructor(level?: AnalystLevel) {
    this.currentLevel = level || this.getLevelFromEnv();
    logger.info(`Level Manager initialized with level: ${this.currentLevel}`);
  }

  private getLevelFromEnv(): AnalystLevel {
    const envLevel = process.env.ANALYST_LEVEL?.toLowerCase();
    
    switch (envLevel) {
      case "1":
      case "level_1":
      case "local":
        return AnalystLevel.LEVEL_1_LOCAL;
      case "2":
      case "level_2":
      case "intel":
        return AnalystLevel.LEVEL_2_INTEL;
      case "3":
      case "level_3":
      case "tools":
        return AnalystLevel.LEVEL_3_TOOLS;
      case "4a":
      case "level_4a":
      case "a2a":
        return AnalystLevel.LEVEL_4A_A2A;
      case "4b":
      case "level_4b":
      case "x402":
        return AnalystLevel.LEVEL_4B_X402;
      default:
        logger.warn(`Unknown level '${envLevel}', defaulting to LEVEL_1_LOCAL`);
        return AnalystLevel.LEVEL_1_LOCAL;
    }
  }

  getCurrentLevel(): AnalystLevel {
    return this.currentLevel;
  }

  getCapabilities(): LevelCapabilities {
    return LEVEL_CAPABILITIES[this.currentLevel];
  }

  setLevel(level: AnalystLevel): void {
    this.currentLevel = level;
    logger.info(`Level changed to: ${level}`);
  }

  hasNetworkAccess(): boolean {
    return this.getCapabilities().networkAccess;
  }

  hasWebSearch(): boolean {
    return this.getCapabilities().webSearch;
  }

  hasMcpTools(): boolean {
    return this.getCapabilities().mcpTools;
  }

  hasA2ACoordination(): boolean {
    return this.getCapabilities().a2aCoordination;
  }

  hasPayments(): boolean {
    return this.getCapabilities().payments;
  }

  getSystemPrompt(): string {
    const capabilities = this.getCapabilities();
    let prompt = `You are WebWatcher, an advanced cybersecurity agent built on VeriSense, specialized in blockchain security monitoring and threat detection.
You are operating at ${this.currentLevel} level.

${LEVEL_CAPABILITIES[this.currentLevel].description}

Your primary responsibilities include:

1. **Transaction Monitoring**: Analyze blockchain transactions for suspicious patterns
2. **Address Analysis**: Evaluate addresses for security risks
3. **Wallet Security**: Monitor and protect the agent's wallet
4. **Threat Detection**: Identify potential security threats

`;

    if (capabilities.networkAccess && capabilities.webSearch) {
      prompt += `**Level 2 Capabilities**: You can perform web searches for:
- CVE information and vulnerability databases (use search_cve action)
- IP and domain reputation checks
- OSINT (Open Source Intelligence) gathering (use osint_search action)
- General web searches (use web_search action)
- Vendor documentation and security advisories (use search_vendor_docs action)

**CRITICAL**: When users ask about recent events, CVEs, vulnerabilities, or any information beyond your training cutoff date:
- NEVER say "I don't have access to information beyond [date]" or similar fallback responses
- ALWAYS use the available search tools (web_search, osint_search, search_cve) to find current information
- Proactively search for information instead of admitting knowledge limitations
- If a query mentions a year (like "CVE 2025" or "vulnerabilities in 2025"), immediately use search_cve or web_search to find current information
- Only mention training cutoff dates if search tools are unavailable or fail

`;
    }

    if (capabilities.mcpTools) {
      prompt += `**Level 3 Capabilities**: You can use MCP (Model Context Protocol) tools to:
- Run security scans (use mcp_run_scan action)
- Fetch logs from systems (use mcp_fetch_logs action)
- Open tickets in issue trackers (use mcp_open_ticket action)
- Propose pull requests (use mcp_propose_pr action)
- Search the web using Exa AI-powered search (use exa_search action) - This provides high-quality, semantic web search results
- List available MCP tools (use mcp_list_tools action)
- All actions go through audited, whitelisted tools (no arbitrary shell/API access)

**CRITICAL**: When you need current information or need to perform actions:
- Use Exa search (exa_search) for high-quality web search results - especially useful for finding recent information, technical documentation, and semantic search
- Use MCP tools to gather real-time information from systems
- Use web_search and osint_search (from Level 2) for current web information
- Never fall back to "I don't have access" - use available tools instead
- When users ask about recent events, vulnerabilities, or current information, proactively use exa_search or web_search

`;
    }

    if (capabilities.a2aCoordination) {
      prompt += `**Level 4A Capabilities**: You can coordinate with other agents:
- Scanner agents for vulnerability scanning
- Triage agents for incident classification
- Fix agents for remediation
- Governance/compliance agents for policy enforcement
- Use A2A messaging protocol for discovery and task routing

`;
    }

    if (capabilities.payments) {
      prompt += `**Level 4B Capabilities**: You can engage in agent commerce:
- Pay for premium threat intel API access
- Pay for one-off security scans
- Pay bug bounty agents when findings are validated
- Use x402 protocol over HTTP 402 for payments
- Payments use USDC on Base/Solana networks

`;
    }

    prompt += `When analyzing security events:
- Always provide risk scores and severity levels
- Recommend appropriate actions based on threat level
- Log security events for analytics
- Be proactive in identifying potential threats

**Information Gathering Strategy**:
- If you don't know something or it's beyond your training data, USE SEARCH TOOLS instead of saying you don't know
- For CVE queries: Use search_cve action first, then web_search if needed
- For general queries about recent events: Use exa_search (preferred for semantic search) or web_search or osint_search
- For technical documentation and semantic search: Use exa_search for best results
- For vendor-specific security info: Use search_vendor_docs
- For system information: Use MCP tools if available
- Exa search (exa_search) is particularly good for finding recent information, technical content, and semantic matches
- Only admit knowledge limitations if ALL search tools fail or are unavailable

If you detect HIGH or CRITICAL risk events, immediately alert the user and recommend defensive actions.
For MEDIUM risk events, provide detailed analysis and monitoring recommendations.
For LOW risk events, log them but proceed normally.

Before executing any actions, verify the security implications and get user confirmation for high-risk operations.
Always prioritize security over convenience.

**Remember**: Your training cutoff date is NOT a limitation - use your search and MCP tools to access current information!`;

    return prompt;
  }
}

export const levelManager = new LevelManager();

