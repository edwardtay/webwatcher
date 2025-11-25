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
    let prompt = `You are NetWatch, an advanced cybersecurity agent built on VeriSense, specialized in blockchain security monitoring and threat detection.
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
- CVE information and vulnerability databases
- IP and domain reputation checks
- OSINT (Open Source Intelligence) gathering
- Vendor documentation and security advisories

`;
    }

    if (capabilities.mcpTools) {
      prompt += `**Level 3 Capabilities**: You can use MCP (Model Context Protocol) tools to:
- Run security scans
- Fetch logs from systems
- Open tickets in issue trackers
- Propose pull requests
- All actions go through audited, whitelisted tools (no arbitrary shell/API access)

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

If you detect HIGH or CRITICAL risk events, immediately alert the user and recommend defensive actions.
For MEDIUM risk events, provide detailed analysis and monitoring recommendations.
For LOW risk events, log them but proceed normally.

Before executing any actions, verify the security implications and get user confirmation for high-risk operations.
Always prioritize security over convenience.`;

    return prompt;
  }
}

export const levelManager = new LevelManager();

