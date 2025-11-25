import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
// // SecurityActionProvider temporarily disabled due to decorator metadata issue
// import { securityActionProvider } from "./action-providers/security"; // Temporarily disabled due to decorator metadata issue
import { level1LocalActionProvider } from "./action-providers/level1-local";
import { level2IntelActionProvider } from "./action-providers/level2-intel";
import { level3McpActionProvider } from "./action-providers/level3-mcp";
import { level4AA2AActionProvider } from "./action-providers/level4a-a2a";
import { level4BX402ActionProvider } from "./action-providers/level4b-x402";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import { levelManager, AnalystLevel } from "./utils/level-manager";

dotenv.config();

/**
 * Validates that required environment variables are set
 * For Level 1 (local/air-gapped), only OpenAI key is required
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // OpenAI key is always required
  if (!process.env.OPENAI_API_KEY) {
    missingVars.push("OPENAI_API_KEY");
  }

  // Check current level - if Level 1, CDP keys are optional
  const level = process.env.ANALYST_LEVEL?.toLowerCase() || "level_1_local";
  const isLevel1 = level === "1" || level === "level_1" || level === "local" || level === "level_1_local";

  // CDP keys only required for levels 2+
  if (!isLevel1) {
    const cdpVars = [
      "CDP_API_KEY_ID",
      "CDP_API_KEY_SECRET",
      "CDP_WALLET_SECRET",
    ];

    cdpVars.forEach((varName) => {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    });
  }

  if (missingVars.length > 0) {
    logger.error("Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    if (!isLevel1) {
      process.exit(1);
    } else {
      logger.warn("Level 1 mode: CDP keys not required, but some features will be unavailable");
    }
  }

  if (!process.env.NETWORK_ID && !isLevel1) {
    logger.warn("NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

/**
 * Initialize the NetWatch cybersecurity agent with AgentKit (built on VeriSense)
 * @param level Optional analyst level (defaults to environment variable or LEVEL_1_LOCAL)
 */
export async function initializeAgent(level?: AnalystLevel) {
  try {
    // Set level if provided
    if (level) {
      levelManager.setLevel(level);
    }
    
    const currentLevel = levelManager.getCurrentLevel();
    const capabilities = levelManager.getCapabilities();
    
    logger.info(`Initializing NetWatch Agent (VeriSense) at ${currentLevel}...`);
    logger.info(`Capabilities: ${capabilities.description}`);

    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3, // Lower temperature for more consistent security analysis
    });

    // Configure CDP Wallet Provider (only if network access is needed)
    let walletProvider: any = null;
    let walletDetails: any = null;
    
    if (capabilities.networkAccess || capabilities.payments) {
      const networkId = process.env.NETWORK_ID || "base-sepolia";
      logger.info(`Using network: ${networkId}`);

      const cdpWalletConfig = {
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
        walletSecret: process.env.CDP_WALLET_SECRET!,
        idempotencyKey: process.env.IDEMPOTENCY_KEY,
        address: process.env.ADDRESS as `0x${string}` | undefined,
        networkId,
        rpcUrl: process.env.RPC_URL,
      };

      walletProvider = await CdpEvmWalletProvider.configureWithWallet(
        cdpWalletConfig,
      );

      walletDetails = await walletProvider.getWalletDetails();
      logger.info(`Wallet initialized: ${walletDetails.address}`);
    } else {
      logger.info("Level 1 mode: No network access, wallet not initialized");
    }

    // Initialize action providers based on level
    const actionProviders: any[] = [];
    
    // Base blockchain providers (only if network access available and CDP keys are set)
    if (capabilities.networkAccess && walletProvider && process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
      try {
        actionProviders.push(
          walletActionProvider(),
          cdpApiActionProvider({
            apiKeyId: process.env.CDP_API_KEY_ID!,
            apiKeyPrivate: process.env.CDP_API_KEY_SECRET!,
          }),
          cdpEvmWalletActionProvider(),
          erc20ActionProvider(),
        );
        // Note: securityActionProvider() is disabled due to decorator metadata issue
        // Use level-specific providers instead
      } catch (error) {
        logger.warn("Failed to load some blockchain providers:", error);
      }
    }
    
    // Level-specific providers
    actionProviders.push(level1LocalActionProvider()); // Always available
    
    if (capabilities.webSearch) {
      actionProviders.push(level2IntelActionProvider());
    }
    
    if (capabilities.mcpTools) {
      actionProviders.push(level3McpActionProvider());
    }
    
    if (capabilities.a2aCoordination) {
      actionProviders.push(level4AA2AActionProvider());
    }
    
    if (capabilities.payments) {
      actionProviders.push(level4BX402ActionProvider());
    }

    // Initialize AgentKit (only if wallet provider exists)
    let agentkit: any = null;
    let tools: any[] = [];
    
    if (walletProvider && actionProviders.length > 0) {
      try {
        agentkit = await AgentKit.from({
          walletProvider,
          actionProviders,
        });
        tools = await getLangChainTools(agentkit);
      } catch (error) {
        logger.warn("Failed to initialize AgentKit with wallet:", error);
        logger.info("Continuing with Level 1 local tools only");
      }
    } else {
      // For Level 1, we can work without AgentKit
      logger.info("Level 1 mode: Using local tools only (no AgentKit wallet required)");
      // Tools will be empty, but the agent can still use Level 1 action providers
      // We'll need to manually register them or use a different approach
    }

    logger.info(`Loaded ${tools.length} tools for the agent at ${currentLevel}`);

    // Store conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = {
      configurable: { thread_id: `verisense-netwatch-${currentLevel}-${Date.now()}` },
    };

    // Create React Agent with level-specific system prompt
    const systemPrompt = levelManager.getSystemPrompt();
    
    const agent = createReactAgent({
      llm,
      tools: tools.length > 0 ? tools : [], // Empty tools array if no wallet provider
      checkpointSaver: memory,
      messageModifier: systemPrompt,
    });

    logger.info(`Agent initialized successfully at ${currentLevel}`);
    return { agent, config: agentConfig, level: currentLevel, capabilities };
  } catch (error) {
    logger.error("Failed to initialize agent", error);
    throw error;
  }
}

/**
 * Run the agent in monitoring mode
 */
async function runMonitoringMode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  intervalSeconds: number = 30,
) {
  logger.info(`Starting monitoring mode (interval: ${intervalSeconds}s)...`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const monitoringPrompt =
        "Perform a security check: monitor wallet balance, check for any suspicious activity, " +
        "and provide a security status summary. If you detect any threats, alert immediately.";

      const stream = await agent.stream(
        { messages: [new HumanMessage(monitoringPrompt)] },
        config,
      );

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          const content = chunk.agent.messages[0].content;
          logger.info("Agent response:", content);
        } else if ("tools" in chunk) {
          logger.debug("Tool execution:", chunk.tools.messages[0].content);
        }
      }

      // Get analytics summary
      const summary = securityAnalytics.getSummary(24);
      if (summary.totalEvents > 0) {
        logger.info("Security Analytics Summary:", summary);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    } catch (error) {
      logger.error("Error in monitoring mode", error);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait before retry
    }
  }
}

/**
 * Run the agent interactively in chat mode
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any, level: AnalystLevel, capabilities: any) {
  logger.info(`Starting chat mode at ${level}...`);
  console.log(`\n=== NetWatch Agent (Built on VeriSense) ===`);
  console.log(`Current Level: ${level}`);
  console.log(`Capabilities: ${capabilities.description}`);
  console.log("\nCommands:");
  console.log("  'exit' - Exit chat mode");
  console.log("  'summary' - Show security analytics summary");
  console.log("  'level' - Show current level and capabilities");
  console.log("  'switch <level>' - Switch to different level (1, 2, 3, 4a, 4b)");
  console.log("\nType your security analysis questions below:\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  let currentAgent = agent;
  let currentConfig = config;
  let currentLevel = level;
  let currentCapabilities = capabilities;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question(`\n[NetWatch ${currentLevel}] > `);

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      if (userInput.toLowerCase() === "summary") {
        const summary = securityAnalytics.getSummary(24);
        console.log("\n=== Security Analytics Summary ===");
        console.log(JSON.stringify(summary, null, 2));
        continue;
      }

      if (userInput.toLowerCase() === "level") {
        console.log(`\nCurrent Level: ${currentLevel}`);
        console.log(`Description: ${currentCapabilities.description}`);
        console.log(`Network Access: ${currentCapabilities.networkAccess ? "Yes" : "No"}`);
        console.log(`Web Search: ${currentCapabilities.webSearch ? "Yes" : "No"}`);
        console.log(`MCP Tools: ${currentCapabilities.mcpTools ? "Yes" : "No"}`);
        console.log(`A2A Coordination: ${currentCapabilities.a2aCoordination ? "Yes" : "No"}`);
        console.log(`Payments: ${currentCapabilities.payments ? "Yes" : "No"}`);
        continue;
      }

      if (userInput.toLowerCase().startsWith("switch ")) {
        const levelArg = userInput.toLowerCase().replace("switch ", "").trim();
        let newLevel: AnalystLevel | null = null;
        
        switch (levelArg) {
          case "1":
          case "level_1":
          case "local":
            newLevel = AnalystLevel.LEVEL_1_LOCAL;
            break;
          case "2":
          case "level_2":
          case "intel":
            newLevel = AnalystLevel.LEVEL_2_INTEL;
            break;
          case "3":
          case "level_3":
          case "tools":
            newLevel = AnalystLevel.LEVEL_3_TOOLS;
            break;
          case "4a":
          case "level_4a":
          case "a2a":
            newLevel = AnalystLevel.LEVEL_4A_A2A;
            break;
          case "4b":
          case "level_4b":
          case "x402":
            newLevel = AnalystLevel.LEVEL_4B_X402;
            break;
          default:
            console.log(`Unknown level: ${levelArg}`);
            console.log("Available levels: 1, 2, 3, 4a, 4b");
            continue;
        }

        if (newLevel) {
          console.log(`\nSwitching to ${newLevel}...`);
          try {
            const { agent: newAgent, config: newConfig, level: newLvl, capabilities: newCaps } = await initializeAgent(newLevel);
            currentAgent = newAgent;
            currentConfig = newConfig;
            currentLevel = newLvl;
            currentCapabilities = newCaps;
            console.log(`Successfully switched to ${newLvl}`);
            console.log(`Capabilities: ${newCaps.description}`);
          } catch (error) {
            console.error(`Failed to switch level: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        continue;
      }

      const stream = await currentAgent.stream(
        { messages: [new HumanMessage(userInput)] },
        currentConfig,
      );

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          logger.debug("Tool execution:", chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    logger.error("Error in chat mode", error);
  } finally {
    rl.close();
  }
}

/**
 * Choose operation mode
 */
async function chooseMode(): Promise<"chat" | "monitor"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("\n=== NetWatch Agent (Built on VeriSense) ===");
    console.log("Available modes:");
    console.log("1. chat    - Interactive security analysis mode");
    console.log("2. monitor - Continuous security monitoring mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();

    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "monitor") {
      rl.close();
      return "monitor";
    }
    console.log("Invalid choice. Please try again.");
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    logger.info("=== NetWatch Agent (Built on VeriSense) ===");
    logger.info("Starting agent initialization...");

    const { agent, config, level, capabilities } = await initializeAgent();
    const mode = await chooseMode();

    const intervalSeconds =
      parseInt(process.env.MONITORING_INTERVAL_SECONDS || "30", 10) || 30;

    if (mode === "chat") {
      await runChatMode(agent, config, level, capabilities);
    } else {
      await runMonitoringMode(agent, config, intervalSeconds);
    }
  } catch (error) {
    logger.error("Fatal error", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error("Unhandled error", error);
    process.exit(1);
  });
}

