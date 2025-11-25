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
import { securityActionProvider } from "./action-providers/security";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";

dotenv.config();

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
  ];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    logger.error("Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    logger.warn("NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

/**
 * Initialize the VeriSense cybersecurity agent with AgentKit
 */
export async function initializeAgent() {
  try {
    logger.info("Initializing VeriSense Cybersecurity Agent...");

    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3, // Lower temperature for more consistent security analysis
    });

    // Configure CDP Wallet Provider
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

    const walletProvider = await CdpEvmWalletProvider.configureWithWallet(
      cdpWalletConfig,
    );

    const walletDetails = await walletProvider.getWalletDetails();
    logger.info(`Wallet initialized: ${walletDetails.address}`);

    // Initialize action providers including custom security provider
    const actionProviders = [
      walletActionProvider(),
      cdpApiActionProvider({
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeyPrivate: process.env.CDP_API_KEY_SECRET!,
      }),
      cdpEvmWalletActionProvider(),
      erc20ActionProvider(),
      securityActionProvider(), // Custom cybersecurity actions
    ];

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    const tools = await getLangChainTools(agentkit);
    logger.info(`Loaded ${tools.length} tools for the agent`);

    // Store conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = {
      configurable: { thread_id: "verisense-cybersecurity-agent" },
    };

    // Create React Agent with cybersecurity-focused system prompt
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are VeriSense, an advanced cybersecurity agent specialized in blockchain security monitoring and threat detection.
        Your primary responsibilities include:
        
        1. **Transaction Monitoring**: Analyze blockchain transactions for suspicious patterns, including:
           - Unusually large transfers
           - Rapid transaction sequences
           - Failed or reverted transactions
           - High gas usage anomalies
        
        2. **Address Analysis**: Evaluate addresses for security risks:
           - Contract vs EOA verification
           - Balance anomalies
           - Transaction history patterns
           - Known threat indicators
        
        3. **Wallet Security**: Monitor and protect the agent's wallet:
           - Balance monitoring
           - Unauthorized access detection
           - Security status reporting
        
        4. **Threat Detection**: Identify potential security threats:
           - Phishing attempts
           - Scam addresses
           - Suspicious contract interactions
           - Unusual activity patterns
        
        When analyzing security events:
        - Always provide risk scores and severity levels
        - Recommend appropriate actions based on threat level
        - Log security events for analytics
        - Be proactive in identifying potential threats
        
        If you detect HIGH or CRITICAL risk events, immediately alert the user and recommend defensive actions.
        For MEDIUM risk events, provide detailed analysis and monitoring recommendations.
        For LOW risk events, log them but proceed normally.
        
        You have access to blockchain monitoring tools, transaction analysis capabilities, and address verification tools.
        Use these tools proactively to maintain security posture.
        
        Before executing any onchain actions, verify the security implications and get user confirmation for high-risk operations.
        Always prioritize security over convenience.
      `,
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
  logger.info("Starting chat mode... Type 'exit' to end, 'summary' for security summary");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\n[VeriSense] > ");

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
    console.log("\n=== VeriSense Cybersecurity Agent ===");
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
    logger.info("=== VeriSense Cybersecurity Agent ===");
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

