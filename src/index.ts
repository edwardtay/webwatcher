import {
  AgentKit,
  EvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  Network,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
// Action providers are loaded lazily to avoid decorator metadata issues
// See loadActionProviders() function below
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import { getSystemPrompt } from "./utils/system-prompt";
import { initializeLetta } from "./utils/letta-client";

dotenv.config();

/**
 * Validates that required environment variables are set
 * Returns error message if validation fails, null if OK
 */
function validateEnvironment(): string | null {
  const missingVars: string[] = [];
  const placeholderPattern = /^(your_|your|placeholder|example|test_|xxx|xxx_)/i;

  // OpenAI key is always required
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || placeholderPattern.test(openaiKey)) {
    missingVars.push("OPENAI_API_KEY");
  }

  // CDP keys are optional - only needed for blockchain operations
  // EXA_API_KEY is recommended for search functionality
  if (!process.env.EXA_API_KEY) {
    logger.warn("EXA_API_KEY not set - search functionality will be limited");
  }

  if (missingVars.length > 0) {
    const errorMsg = `Required environment variables are not set: ${missingVars.join(", ")}. Please set these in Cloud Run environment variables.`;
    logger.error(errorMsg);
    return errorMsg;
  }

  if (!process.env.NETWORK_ID) {
    logger.warn("NETWORK_ID not set, defaulting to base-sepolia testnet (blockchain features may be limited)");
  }

  return null;
}

// Lazy import unified action provider
let unifiedActionProviderFn: any;

async function loadActionProviders() {
  try {
    const unifiedModule = await import("./action-providers/unified-action-provider.js");
    unifiedActionProviderFn = unifiedModule.unifiedActionProvider;
    logger.info("✓ Unified action provider loaded");
  } catch (error) {
    logger.warn("Failed to load unified action provider:", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Initialize the WebWatcher cybersecurity agent with AgentKit (built on VeriSense)
 * No levels - agent intelligently uses all available tools
 */
export async function initializeAgent() {
  try {
    // Validate environment variables before initializing
    const validationError = validateEnvironment();
    if (validationError) {
      throw new Error(validationError);
    }

    logger.info("Initializing WebWatcher Agent (VeriSense)...");
    logger.info("Agent uses all available tools intelligently - no levels");

    // Initialize Letta for long-term memory and self-improvement (optional)
    const lettaEnabled = await initializeLetta();
    if (lettaEnabled) {
      logger.info("✓ Letta integration active - autonomous learning enabled");
    }

    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3, // Lower temperature for more consistent security analysis
    });

    // Configure CDP Wallet Provider (optional - only if CDP keys are provided)
    let walletProvider: any = null;
    let walletDetails: any = null;
    
    if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET && process.env.CDP_WALLET_SECRET) {
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

      try {
        // Try to initialize wallet provider, but don't fail if it doesn't work
        const walletProviderAny = EvmWalletProvider as any;
        if (walletProviderAny && typeof walletProviderAny.configureWithWallet === 'function') {
          walletProvider = await walletProviderAny.configureWithWallet(
            cdpWalletConfig,
          );
          walletDetails = await walletProvider.getWalletDetails();
          logger.info(`Wallet provider initialized: ${walletDetails.address} on ${walletDetails.network}`);
        } else {
          logger.warn("EvmWalletProvider.configureWithWallet is not available - continuing without wallet provider");
        }
      } catch (error) {
        logger.warn("Failed to initialize wallet provider (continuing without it):", error instanceof Error ? error.message : String(error));
        walletProvider = null; // Continue without wallet provider
      }
    } else {
      logger.info("CDP keys not provided - blockchain features will be limited");
    }

    // Initialize action providers
    const actionProviders: any[] = [];
    
    // Base blockchain providers (only if wallet provider is available)
    if (walletProvider && process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
      try {
        actionProviders.push(
          walletActionProvider(),
          cdpApiActionProvider(),
          cdpWalletActionProvider(),
          erc20ActionProvider(),
        );
      } catch (error) {
        logger.warn("Failed to load some blockchain providers:", error);
      }
    }
    
    // Load unified action provider (includes all capabilities)
    await loadActionProviders();
    
    if (unifiedActionProviderFn) {
      try {
        actionProviders.push(unifiedActionProviderFn());
      } catch (error) {
        logger.warn("Failed to instantiate unified action provider:", error);
      }
    }
    
    logger.info(`Loaded ${actionProviders.length} action provider(s) (some may have failed due to decorator metadata issues)`);

    // Try to create manual tools if AgentKit fails
    let agentkit: any = null;
    let tools: any[] = [];
    
    // Try to initialize AgentKit with action providers if available
    if (actionProviders.length > 0 && walletProvider) {
      try {
        logger.info(`Initializing AgentKit with ${actionProviders.length} action provider(s)...`);
        agentkit = await AgentKit.from({
          walletProvider,
          actionProviders,
        });
        
        if (agentkit) {
          logger.info("AgentKit initialized successfully, extracting tools...");
          tools = await getLangChainTools(agentkit);
          logger.info(`Successfully loaded ${tools.length} tools from AgentKit`);
        }
      } catch (error) {
        logger.warn("AgentKit initialization failed, will use manual tools");
      }
    }
    
    // If no tools from AgentKit, create manual tools
    if (tools.length === 0) {
      try {
        const { createManualTools } = await import("./utils/manual-tools");
        tools = createManualTools();
        logger.info(`Created ${tools.length} manual tools (scan_website, exa_search)`);
      } catch (error) {
        logger.warn("Failed to create manual tools:", error);
      }
    }

    logger.info(`Loaded ${tools.length} tools for the agent`);

    // Store conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = {
      configurable: { thread_id: `webwatcher-${Date.now()}` },
    };

    // Create React Agent with unified system prompt
    const systemPrompt = getSystemPrompt();
    
    // Best Practice: Always provide tools array (empty if no tools available)
    // Note: maxIterations and handleParsingErrors are handled by LangGraph configuration
    const agent = createReactAgent({
      llm,
      tools: tools.length > 0 ? tools : [], // Empty tools array if no wallet provider
      checkpointSaver: memory,
      messageModifier: systemPrompt,
    });

    logger.info("Agent initialized successfully");
    return { agent, config: agentConfig };
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
async function runChatMode(agent: any, config: any) {
  logger.info("Starting chat mode...");
  console.log(`\n=== WebWatcher Agent (Built on VeriSense) ===`);
  console.log("Agent uses all available tools intelligently");
  console.log("\nCommands:");
  console.log("  'exit' - Exit chat mode");
  console.log("  'summary' - Show security analytics summary");
  console.log("\nType your security analysis questions below:\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question(`\n[WebWatcher] > `);

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      if (userInput.toLowerCase() === "summary") {
        const summary = securityAnalytics.getSummary(24);
        console.log("\n=== Security Analytics Summary ===");
        console.log(JSON.stringify(summary, null, 2));
        continue;
      }

      const stream = await agent.stream(
        { messages: [new HumanMessage(userInput)] },
        config,
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
    console.log("\n=== WebWatcher Agent (Built on VeriSense) ===");
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
    logger.info("=== WebWatcher Agent (Built on VeriSense) ===");
    logger.info("Starting agent initialization...");

    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    const intervalSeconds =
      parseInt(process.env.MONITORING_INTERVAL_SECONDS || "30", 10) || 30;

    if (mode === "chat") {
      await runChatMode(agent, config);
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



