import express from "express";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import * as dotenv from "dotenv";

// Lazy import to avoid decorator metadata issues during module load
let initializeAgent: any;
let AnalystLevel: any;
let levelManager: any;
let HumanMessage: any;

async function loadAgentModules() {
  if (!initializeAgent) {
    try {
      logger.info("Attempting to load agent modules with dynamic import...");
      // Use dynamic import - tsx handles this better than require for TypeScript files
      const indexModule = await import("./index.js");
      initializeAgent = indexModule.initializeAgent;
      if (!initializeAgent) {
        throw new Error("initializeAgent not found in index module");
      }
      logger.info("✓ index module loaded");
      
      const langchainModule = await import("@langchain/core/messages");
      HumanMessage = langchainModule.HumanMessage;
      if (!HumanMessage) {
        throw new Error("HumanMessage not found in langchain module");
      }
      logger.info("✓ langchain module loaded");
      
      const levelManagerModule = await import("./utils/level-manager.js");
      AnalystLevel = levelManagerModule.AnalystLevel;
      levelManager = levelManagerModule.levelManager;
      if (!levelManager) {
        throw new Error("levelManager not found in level-manager module");
      }
      logger.info("✓ level-manager module loaded");
      
      logger.info("✓ All agent modules loaded successfully");
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : String(error);
      logger.error("Failed to load agent modules:", errorMsg);
      logger.error("Error details:", errorStack);
      return false;
    }
  }
  return true;
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize agent (singleton)
let agentInstance: any = null;
let agentInitialized = false;
let currentLevel: string = "level_2_intel";

async function getAgent(level?: string) {
  // Try to load modules if not already loaded
  if (!initializeAgent) {
    const loaded = await loadAgentModules();
    if (!loaded) {
      throw new Error("Agent initialization module not available - decorator metadata issue");
    }
  }
  
  if (!initializeAgent) {
    throw new Error("Agent initialization module not available");
  }
  
  // Reinitialize if level changed or not initialized
  if (!agentInstance || (level && level !== currentLevel)) {
    if (level && levelManager) {
      currentLevel = level;
      levelManager.setLevel(level);
    }
    try {
      logger.info(`Initializing agent at level: ${currentLevel}`);
      agentInstance = await initializeAgent(currentLevel);
      agentInitialized = true;
      logger.info(`Agent initialized/reinitialized at level: ${currentLevel}`);
    } catch (error) {
      logger.error("Failed to initialize agent", error);
      agentInitialized = false;
      throw error;
    }
  }
  return agentInstance;
}

// API Routes

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  let capabilities: any = {};
  if (levelManager) {
    try {
      capabilities = levelManager.getCapabilities();
    } catch (error) {
      capabilities = { description: "Capabilities not available" };
    }
  }
  res.json({
    status: "ok",
    agentInitialized,
    currentLevel: currentLevel,
    capabilities: capabilities.description ? {
      description: capabilities.description,
      networkAccess: capabilities.networkAccess,
      webSearch: capabilities.webSearch,
      mcpTools: capabilities.mcpTools,
      a2aCoordination: capabilities.a2aCoordination,
      payments: capabilities.payments,
    } : { description: "Not available" },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get available levels
 */
app.get("/api/levels", (req, res) => {
  if (!AnalystLevel || !levelManager) {
    return res.json({
      currentLevel: currentLevel,
      availableLevels: [],
      error: "Level manager not available",
    });
  }
  res.json({
    currentLevel: currentLevel,
    availableLevels: Object.values(AnalystLevel).map((level: string) => ({
      id: level,
      name: level.replace("LEVEL_", "").replace("_", " ").toUpperCase(),
      capabilities: levelManager.getCapabilities(),
    })),
    allCapabilities: Object.entries(AnalystLevel).map(([key, level]) => ({
      level,
      capabilities: (() => {
        const tempManager = levelManager;
        tempManager.setLevel(level);
        return tempManager.getCapabilities();
      })(),
    })),
  });
});

/**
 * Switch level endpoint
 */
app.post("/api/level", async (req, res) => {
  try {
    const { level } = req.body;

    if (!level) {
      return res.status(400).json({
        error: "Level is required",
      });
    }

    if (!AnalystLevel || !Object.values(AnalystLevel).includes(level)) {
      return res.status(400).json({
        error: "Invalid level",
        availableLevels: AnalystLevel ? Object.values(AnalystLevel) : [],
      });
    }

    // Reinitialize agent with new level
    agentInstance = null;
    await getAgent(level);

    const capabilities = levelManager ? levelManager.getCapabilities() : {};

    res.json({
      success: true,
      level: currentLevel,
      capabilities: capabilities.description ? {
        description: capabilities.description,
        networkAccess: capabilities.networkAccess,
        webSearch: capabilities.webSearch,
        mcpTools: capabilities.mcpTools,
        a2aCoordination: capabilities.a2aCoordination,
        payments: capabilities.payments,
      } : { description: "Not available" },
      message: `Successfully switched to ${currentLevel}`,
    });
  } catch (error) {
    logger.error("Error switching level", error);
    res.status(500).json({
      error: "Failed to switch level",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Chat endpoint - Send a message to the agent
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, threadId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }

    // Ensure modules are loaded
    if (!HumanMessage || !initializeAgent) {
      await loadAgentModules();
    }
    
    if (!agentInitialized) {
      // Try to load and initialize agent
      try {
        await getAgent();
      } catch (error) {
        logger.error("Agent initialization error in chat endpoint:", error);
        return res.status(503).json({
          error: "Agent not initialized",
          message: "Agent initialization failed. Please check server logs for details.",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const { agent, config } = await getAgent();
    
    if (!HumanMessage) {
      await loadAgentModules();
      if (!HumanMessage) {
        return res.status(503).json({
          error: "Missing dependencies",
          message: "HumanMessage class not available. Please check server logs.",
        });
      }
    }
    
    const configWithThread = {
      ...config,
      configurable: {
        ...config.configurable,
        thread_id: threadId || config.configurable.thread_id,
      },
    };

    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      configWithThread,
    );

    let fullResponse = "";
    const chunks: string[] = [];

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        const content = chunk.agent.messages[0].content;
        fullResponse += content;
        chunks.push(content);
      } else if ("tools" in chunk) {
        logger.debug("Tool execution:", chunk.tools.messages[0].content);
      }
    }

    res.json({
      response: fullResponse,
      chunks,
      threadId: configWithThread.configurable.thread_id,
    });
  } catch (error) {
    logger.error("Error in chat endpoint", error);
    res.status(500).json({
      error: "Failed to process chat message",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Security analytics endpoint
 */
app.get("/api/analytics", (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const summary = securityAnalytics.getSummary(hours);
    res.json(summary);
  } catch (error) {
    logger.error("Error getting analytics", error);
    res.status(500).json({
      error: "Failed to get analytics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Security events endpoint
 */
app.get("/api/events", (req, res) => {
  try {
    const events = securityAnalytics.getAllEvents();
    const limit = parseInt(req.query.limit as string) || 100;
    res.json({
      events: events.slice(-limit),
      total: events.length,
    });
  } catch (error) {
    logger.error("Error getting events", error);
    res.status(500).json({
      error: "Failed to get events",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Wallet info endpoint
 */
app.get("/api/wallet", async (req, res) => {
  try {
    const { agent } = await getAgent();
    // Use agent to get wallet details via a simple query
    const stream = await agent.stream(
      { messages: [new HumanMessage("Get wallet details")] },
      (await getAgent()).config,
    );

    let response = "";
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content;
      }
    }

    res.json({
      info: response,
    });
  } catch (error) {
    logger.error("Error getting wallet info", error);
    res.status(500).json({
      error: "Failed to get wallet info",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Wallet connect endpoint - Store wallet connection info
 */
app.post("/api/wallet/connect", (req, res) => {
  try {
    const { type, address, network, chainId, name } = req.body;
    logger.info(`Wallet connected: ${type} - ${address}`);
    res.json({
      success: true,
      message: "Wallet connection info received",
      wallet: { type, address, network, chainId, name },
    });
  } catch (error) {
    logger.error("Error storing wallet info", error);
    res.status(500).json({
      error: "Failed to store wallet info",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Serve HTML interface
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VeriSense - Cybersecurity Agent</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', monospace;
            background: #0a0e1a;
            background-image: 
                radial-gradient(circle at 20% 50%, rgba(0, 255, 255, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(0, 255, 200, 0.03) 0%, transparent 50%);
            min-height: 100vh;
            padding: 20px;
            color: #a0a8b8;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: #0f1419;
            border: 1px solid rgba(0, 255, 255, 0.15);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 255, 255, 0.05);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 200, 255, 0.08) 100%);
            border-bottom: 1px solid rgba(0, 255, 255, 0.2);
            color: #e0e8f0;
            padding: 30px;
            text-align: center;
            box-shadow: inset 0 -1px 0 rgba(0, 255, 255, 0.1);
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            padding: 30px;
        }
        @media (max-width: 768px) {
            .content {
                grid-template-columns: 1fr;
            }
        }
        .chat-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border: 2px solid #667eea;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
        }
        .analytics-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }
        .chat-section h2, .analytics-section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        .chat-section h2 {
            color: #667eea;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .chat-messages {
            background: white;
            border-radius: 8px;
            padding: 15px;
            height: 500px;
            overflow-y: auto;
            margin-bottom: 15px;
            border: 1px solid #e0e0e0;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }
        .chat-messages::-webkit-scrollbar {
            width: 8px;
        }
        .chat-messages::-webkit-scrollbar-track {
            background: #0a0e14;
            border-radius: 4px;
        }
        .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(0, 255, 255, 0.3);
            border-radius: 4px;
        }
        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 255, 255, 0.5);
        }
        .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 6px;
        }
        .message.user {
            background: #e3f2fd;
            text-align: right;
        }
        .message.agent {
            background: #f1f8e9;
        }
        .message-label {
            font-weight: bold;
            font-size: 0.9em;
            margin-bottom: 5px;
            color: #666;
        }
        .chat-input {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .chat-input input {
            flex: 1;
            padding: 14px 16px;
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 4px;
            font-size: 1em;
            color: #e0e8f0;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
        }
        .chat-input input:focus {
            outline: none;
            border-color: rgba(0, 255, 255, 0.4);
            box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.1), 0 0 10px rgba(0, 255, 255, 0.1);
            background: #0f1419;
        }
        .chat-input input::placeholder {
            color: #5a6678;
        }
        .chat-input button {
            padding: 14px 28px;
            background: rgba(0, 255, 255, 0.1);
            color: #00ffff;
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 2px 8px rgba(0, 255, 255, 0.1);
        }
        .chat-input button:hover:not(:disabled) {
            background: rgba(0, 255, 255, 0.15);
            border-color: rgba(0, 255, 255, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.2), 0 2px 8px rgba(0, 255, 255, 0.15);
            transform: translateY(-1px);
        }
        .chat-input button:active:not(:disabled) {
            transform: translateY(0);
        }
        .chat-input button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .analytics-card {
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.1);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: inset 0 1px 0 rgba(0, 255, 255, 0.05);
        }
        .analytics-card h3 {
            color: #00d4ff;
            margin-bottom: 10px;
            text-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
        }
        .stat {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0, 255, 255, 0.05);
        }
        .stat:last-child {
            border-bottom: none;
        }
        .stat-label {
            color: #8a98a8;
        }
        .stat-value {
            font-weight: bold;
            color: #00ffff;
            font-family: 'Courier New', monospace;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
            box-shadow: 0 0 6px currentColor;
        }
        .status-online {
            background: #00ff88;
            color: #00ff88;
        }
        .status-offline {
            background: #ff4444;
            color: #ff4444;
        }
        .loading {
            text-align: center;
            color: #6a7888;
            padding: 20px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #0a0e14;
            border: 1px solid rgba(0, 255, 255, 0.1);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9em;
            color: #a0d0ff;
            font-family: 'Courier New', monospace;
        }
        .level-checkboxes {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
            align-items: center;
            margin-top: 10px;
        }
        .level-checkbox-wrapper {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: rgba(0, 255, 255, 0.05);
            border-radius: 4px;
            border: 1px solid rgba(0, 255, 255, 0.2);
            cursor: pointer;
            transition: all 0.3s;
        }
        .level-checkbox-wrapper:hover {
            background: rgba(0, 255, 255, 0.1);
            border-color: rgba(0, 255, 255, 0.4);
        }
        .level-checkbox-wrapper input[type="radio"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
            accent-color: #00ffff;
        }
        .level-checkbox-wrapper input[type="radio"]:checked {
            accent-color: #00ff88;
        }
        .level-checkbox-wrapper label {
            color: #b0b8c8;
            font-size: 0.9em;
            cursor: pointer;
            user-select: none;
            margin: 0;
            font-family: 'Courier New', monospace;
        }
        .level-checkbox-wrapper input[type="radio"]:checked + label {
            color: #00ffff;
            font-weight: 600;
        }
        .wallet-connect-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-top: 15px;
        }
        .connect-wallet-btn {
            padding: 10px 20px;
            background: rgba(0, 255, 255, 0.1);
            color: #00ffff;
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            font-size: 0.95em;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0, 255, 255, 0.1);
        }
        .connect-wallet-btn:hover {
            background: rgba(0, 255, 255, 0.15);
            border-color: rgba(0, 255, 255, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
            transform: translateY(-2px);
        }
        .wallet-dropdown {
            position: relative;
            display: inline-block;
        }
        .wallet-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-top: 8px;
            background: #0f1419;
            border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 6px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 255, 255, 0.1);
            min-width: 200px;
            z-index: 1000;
            overflow: hidden;
        }
        .wallet-menu.show {
            display: block;
        }
        .wallet-option {
            padding: 12px 16px;
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 10px;
            color: #b0b8c8;
        }
        .wallet-option:last-child {
            border-bottom: none;
        }
        .wallet-option:hover {
            background: rgba(0, 255, 255, 0.1);
            color: #00ffff;
        }
        .wallet-option.evm {
            border-left: 3px solid rgba(0, 255, 255, 0.4);
        }
        .wallet-option.polkadot {
            border-left: 3px solid rgba(0, 200, 255, 0.4);
        }
        .wallet-icon {
            font-size: 1.2em;
        }
        .wallet-info {
            margin-top: 10px;
            padding: 8px 12px;
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 255, 0.15);
            border-radius: 4px;
            font-size: 0.85em;
            text-align: center;
            color: #b0b8c8;
            font-family: 'Courier New', monospace;
        }
        .wallet-address {
            font-family: 'Courier New', monospace;
            word-break: break-all;
            margin-top: 4px;
            color: #00ffff;
        }
        .disconnect-btn {
            margin-top: 8px;
            padding: 6px 12px;
            background: rgba(255, 68, 68, 0.1);
            color: #ff4444;
            border: 1px solid rgba(255, 68, 68, 0.3);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8em;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
        }
        .disconnect-btn:hover {
            background: rgba(255, 68, 68, 0.15);
            border-color: rgba(255, 68, 68, 0.5);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 NetWatch</h1>
            <p>Cybersecurity Agent for Blockchain Threat Detection</p>
            <div style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div class="level-checkboxes">
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_2_intel" name="level" value="level_2_intel" onchange="switchLevel()">
                            <label for="level_2_intel">search</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_3_tools" name="level" value="level_3_tools" onchange="switchLevel()">
                            <label for="level_3_tools">MCP</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_4a_a2a" name="level" value="level_4a_a2a" onchange="switchLevel()">
                            <label for="level_4a_a2a">A2A</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_4b_x402" name="level" value="level_4b_x402" onchange="switchLevel()">
                            <label for="level_4b_x402">x402</label>
                        </div>
                </div>
            </div>
            <div id="levelInfo" style="margin-top: 10px; font-size: 0.85em; opacity: 0.9;"></div>
            <div class="wallet-connect-section">
                <div class="wallet-dropdown">
                    <button class="connect-wallet-btn" id="connectWalletBtn" onclick="toggleWalletMenu()">
                        🔗 Connect Wallet
                    </button>
                    <div class="wallet-menu" id="walletMenu">
                        <div class="wallet-option evm" onclick="connectEVMWallet('metamask')">
                            <span class="wallet-icon">🦊</span>
                            <span>MetaMask</span>
                        </div>
                        <div class="wallet-option evm" onclick="connectEVMWallet('walletconnect')">
                            <span class="wallet-icon">🔷</span>
                            <span>WalletConnect</span>
                        </div>
                        <div class="wallet-option evm" onclick="connectEVMWallet('coinbase')">
                            <span class="wallet-icon">🔵</span>
                            <span>Coinbase Wallet</span>
                        </div>
                        <div class="wallet-option evm" onclick="connectEVMWallet('injected')">
                            <span class="wallet-icon">💼</span>
                            <span>Other EVM Wallet</span>
                        </div>
                        <div class="wallet-option polkadot" onclick="connectPolkadotWallet()">
                            <span class="wallet-icon">⚫</span>
                            <span>Polkadot.js</span>
                        </div>
                        <div class="wallet-option polkadot" onclick="connectPolkadotWallet('talisman')">
                            <span class="wallet-icon">🔮</span>
                            <span>Talisman</span>
                        </div>
                    </div>
                </div>
                <div class="wallet-info" id="walletInfo" style="display: none;">
                    <div><strong>Connected:</strong> <span id="walletType"></span></div>
                    <div class="wallet-address" id="walletAddress"></div>
                    <button class="disconnect-btn" onclick="disconnectWallet()">Disconnect</button>
                </div>
            </div>
        </div>
        <div class="content">
            <div class="chat-section">
                <h2>💬 Chat with NetWatch</h2>
                <div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 255, 255, 0.05); border-radius: 6px; border-left: 2px solid rgba(0, 255, 255, 0.3);">
                    <div style="font-size: 0.9em; color: #00d4ff;">
                        <strong>💡 Quick Actions:</strong>
                        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
                            <button onclick="sendQuickMessage('Get security summary')" style="padding: 6px 12px; background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3); color: #00ffff; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-family: 'Courier New', monospace;">Get Security Summary</button>
                            <button onclick="sendQuickMessage('Monitor wallet balance')" style="padding: 6px 12px; background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3); color: #00ffff; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-family: 'Courier New', monospace;">Check Balance</button>
                            <button onclick="sendQuickMessage('Analyze address 0x...')" style="padding: 6px 12px; background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3); color: #00ffff; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-family: 'Courier New', monospace;">Analyze Address</button>
                        </div>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="message agent">
                        <div class="message-label">🔒 NetWatch Agent</div>
                        <div>Welcome! I'm NetWatch, your cybersecurity agent. I can help you:</div>
                        <ul style="margin-top: 10px; margin-left: 20px; line-height: 1.8;">
                            <li>🔍 Analyze blockchain transactions for suspicious patterns</li>
                            <li>🛡️ Check address security and risk assessment</li>
                            <li>💰 Monitor wallet balance and detect anomalies</li>
                            <li>📊 Provide comprehensive security summaries</li>
                            <li>⚠️ Detect threats and security risks</li>
                        </ul>
                        <div style="margin-top: 15px; padding: 10px; background: rgba(0, 200, 255, 0.05); border-radius: 6px; border-left: 2px solid rgba(0, 200, 255, 0.3);">
                            <strong style="color: #00d4ff;">💡 Try asking:</strong>
                            <div style="margin-top: 5px; font-family: 'Courier New', monospace; font-size: 0.9em; color: #a0b8c8;">
                                • "Analyze transaction 0x..."<br>
                                • "Get security summary"<br>
                                • "Monitor my wallet balance"<br>
                                • "Check address 0x... for security risks"
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chat-input">
                    <input type="text" id="messageInput" placeholder="Ask about security analysis, transactions, addresses..." onkeypress="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }">
                    <button type="button" onclick="sendMessage()" id="sendButton" style="cursor: pointer;">Send</button>
                </div>
                <div style="margin-top: 10px; text-align: center; font-size: 0.85em; color: #8a98a8; font-family: 'Courier New', monospace;">
                    <span id="agentStatus">Agent Status: Checking...</span>
                </div>
            </div>
            <div class="analytics-section">
                <h2>📊 Security Analytics</h2>
                <div id="analyticsContent">
                    <div class="loading">Loading analytics...</div>
                </div>
                <button onclick="refreshAnalytics()" style="width: 100%; padding: 10px; margin-top: 10px; background: rgba(0, 255, 255, 0.1); color: #00ffff; border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 4px; cursor: pointer; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Refresh Analytics</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>
    <script>
        let threadId = 'web-' + Date.now();
        let currentSelectedLevel = 'level_2_intel';
        let connectedWallet = null;
        let walletProvider = null;
        
        // Wallet connection functions
        function toggleWalletMenu() {
            const menu = document.getElementById('walletMenu');
            const btn = document.getElementById('connectWalletBtn');
            
            if (connectedWallet) {
                // If connected, show disconnect option or do nothing
                return;
            }
            
            // Toggle menu visibility
            if (menu.classList.contains('show')) {
                menu.classList.remove('show');
            } else {
                menu.classList.add('show');
                // Focus first option for keyboard navigation
                setTimeout(() => {
                    const firstOption = menu.querySelector('.wallet-option');
                    if (firstOption) firstOption.focus();
                }, 100);
            }
        }
        
        // Close wallet menu when clicking outside
        document.addEventListener('click', function(event) {
            const menu = document.getElementById('walletMenu');
            const btn = document.getElementById('connectWalletBtn');
            if (menu && btn && !menu.contains(event.target) && !btn.contains(event.target)) {
                menu.classList.remove('show');
            }
        });
        
        // Close menu on Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const menu = document.getElementById('walletMenu');
                if (menu) menu.classList.remove('show');
            }
        });
        
        async function connectEVMWallet(type) {
            document.getElementById('walletMenu').classList.remove('show');
            
            try {
                let provider;
                let walletName;
                
                // Check for MetaMask
                if (type === 'metamask') {
                    if (typeof window.ethereum === 'undefined') {
                        alert('MetaMask not detected. Please install MetaMask extension from https://metamask.io');
                        window.open('https://metamask.io/download/', '_blank');
                        return;
                    }
                    // Detect MetaMask specifically
                    if (window.ethereum.isMetaMask) {
                        walletName = 'MetaMask';
                    } else {
                        walletName = 'EVM Wallet';
                    }
                    provider = new ethers.providers.Web3Provider(window.ethereum);
                    
                    // Request account access - this will trigger MetaMask popup
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                } 
                // Check for Coinbase Wallet
                else if (type === 'coinbase') {
                    if (typeof window.ethereum === 'undefined') {
                        alert('Coinbase Wallet not detected. Please install Coinbase Wallet extension.');
                        window.open('https://www.coinbase.com/wallet', '_blank');
                        return;
                    }
                    // Coinbase Wallet detection
                    if (window.ethereum.isCoinbaseWallet) {
                        walletName = 'Coinbase Wallet';
                    } else if (window.ethereum.providers) {
                        // Coinbase Wallet might be in providers array
                        const coinbaseProvider = window.ethereum.providers.find(p => p.isCoinbaseWallet);
                        if (coinbaseProvider) {
                            provider = new ethers.providers.Web3Provider(coinbaseProvider);
                            walletName = 'Coinbase Wallet';
                            await coinbaseProvider.request({ method: 'eth_requestAccounts' });
                        } else {
                            alert('Coinbase Wallet not found. Please install Coinbase Wallet extension.');
                            return;
                        }
                    } else {
                        alert('Coinbase Wallet not detected. Please install Coinbase Wallet extension.');
                        return;
                    }
                    if (!provider) {
                        provider = new ethers.providers.Web3Provider(window.ethereum);
                        await window.ethereum.request({ method: 'eth_requestAccounts' });
                    }
                } 
                // Generic injected wallet
                else if (type === 'injected') {
                    if (typeof window.ethereum === 'undefined') {
                        alert('No EVM wallet detected. Please install MetaMask, Coinbase Wallet, or another EVM-compatible wallet.');
                        return;
                    }
                    // Try to detect wallet type
                    if (window.ethereum.isMetaMask) {
                        walletName = 'MetaMask';
                    } else if (window.ethereum.isCoinbaseWallet) {
                        walletName = 'Coinbase Wallet';
                    } else if (window.ethereum.isBraveWallet) {
                        walletName = 'Brave Wallet';
                    } else {
                        walletName = 'EVM Wallet';
                    }
                    provider = new ethers.providers.Web3Provider(window.ethereum);
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                } 
                // WalletConnect (placeholder)
                else if (type === 'walletconnect') {
                    alert('WalletConnect integration coming soon! For now, please use MetaMask or another injected wallet.');
                    return;
                }
                
                if (!provider) {
                    throw new Error('Failed to initialize wallet provider');
                }
                
                const signer = provider.getSigner();
                const address = await signer.getAddress();
                const network = await provider.getNetwork();
                
                connectedWallet = {
                    type: 'EVM',
                    name: walletName,
                    address: address,
                    network: network.name,
                    chainId: network.chainId.toString()
                };
                
                walletProvider = provider;
                updateWalletUI();
                
                // Send wallet info to backend
                try {
                    const response = await fetch('/api/wallet/connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'EVM',
                            address: address,
                            network: network.name,
                            chainId: network.chainId.toString(),
                            name: walletName
                        })
                    });
                    const result = await response.json();
                    console.log('Wallet connection confirmed:', result);
                } catch (error) {
                    console.warn('Failed to send wallet info to backend:', error);
                }
                
                addMessage('agent', \`✅ Connected to \${walletName}: \${address.substring(0, 6)}...\${address.substring(38)}\`);
            } catch (error) {
                console.error('Error connecting EVM wallet:', error);
                if (error.code === 4001) {
                    alert('Connection rejected. Please approve the connection request in your wallet.');
                } else {
                    alert('Failed to connect wallet: ' + (error.message || 'Unknown error'));
                }
            }
        }
        
        async function connectPolkadotWallet(type = 'polkadot') {
            document.getElementById('walletMenu').classList.remove('show');
            
            try {
                // Wait a bit for extension to be available
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Check if Polkadot extension is available
                if (typeof window.injectedWeb3 === 'undefined') {
                    alert('Polkadot wallet extension not detected.\\n\\nPlease install:\\n• Polkadot.js: https://polkadot.js.org/extension/\\n• Talisman: https://talisman.xyz/');
                    return;
                }
                
                let extension;
                let walletName;
                
                // Try Talisman first if requested
                if (type === 'talisman') {
                    if (window.injectedWeb3['talisman']) {
                        extension = window.injectedWeb3['talisman'];
                        walletName = 'Talisman';
                    } else {
                        alert('Talisman wallet not found. Please install Talisman extension from https://talisman.xyz/');
                        window.open('https://talisman.xyz/', '_blank');
                        return;
                    }
                } 
                // Try Polkadot.js
                else if (window.injectedWeb3['polkadot-js']) {
                    extension = window.injectedWeb3['polkadot-js'];
                    walletName = 'Polkadot.js';
                } 
                // Try Talisman as fallback
                else if (window.injectedWeb3['talisman']) {
                    extension = window.injectedWeb3['talisman'];
                    walletName = 'Talisman';
                } 
                // Try any available extension
                else {
                    const available = Object.keys(window.injectedWeb3);
                    if (available.length === 0) {
                        alert('No Polkadot wallet extension found.\\n\\nPlease install:\\n• Polkadot.js: https://polkadot.js.org/extension/\\n• Talisman: https://talisman.xyz/');
                        return;
                    }
                    extension = window.injectedWeb3[available[0]];
                    walletName = available[0].charAt(0).toUpperCase() + available[0].slice(1);
                }
                
                // Enable extension - this will trigger wallet popup
                const injector = await extension.enable('NetWatch');
                
                // Get accounts - wallet popup should have appeared
                const accounts = await injector.accounts.get();
                
                if (accounts.length === 0) {
                    alert('No accounts found. Please create an account in your ' + walletName + ' wallet.');
                    return;
                }
                
                // Use first account (in production, you might want to let user select)
                const account = accounts[0];
                
                connectedWallet = {
                    type: 'Polkadot',
                    name: walletName,
                    address: account.address,
                    accountName: account.name || 'Unnamed'
                };
                
                updateWalletUI();
                
                // Send wallet info to backend
                try {
                    const response = await fetch('/api/wallet/connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'Polkadot',
                            address: account.address,
                            name: account.name || 'Unnamed',
                            walletName: walletName
                        })
                    });
                    const result = await response.json();
                    console.log('Wallet connection confirmed:', result);
                } catch (error) {
                    console.warn('Failed to send wallet info to backend:', error);
                }
                
                addMessage('agent', \`✅ Connected to \${walletName}: \${account.address.substring(0, 6)}...\${account.address.substring(account.address.length - 6)}\`);
            } catch (error) {
                console.error('Error connecting Polkadot wallet:', error);
                if (error.message && error.message.includes('Rejected')) {
                    alert('Connection rejected. Please approve the connection request in your wallet.');
                } else {
                    alert('Failed to connect wallet: ' + (error.message || 'Unknown error'));
                }
            }
        }
        
        function updateWalletUI() {
            const btn = document.getElementById('connectWalletBtn');
            const info = document.getElementById('walletInfo');
            const typeSpan = document.getElementById('walletType');
            const addressSpan = document.getElementById('walletAddress');
            
            if (connectedWallet) {
                btn.textContent = '🔗 Wallet Connected';
                btn.style.background = 'rgba(0, 255, 136, 0.15)';
                btn.style.borderColor = 'rgba(0, 255, 136, 0.4)';
                btn.style.color = '#00ff88';
                btn.style.cursor = 'default';
                info.style.display = 'block';
                typeSpan.textContent = \`\${connectedWallet.name} (\${connectedWallet.type})\`;
                addressSpan.textContent = connectedWallet.address;
                addressSpan.style.fontFamily = "'Courier New', monospace";
                addressSpan.style.wordBreak = 'break-all';
            } else {
                btn.textContent = '🔗 Connect Wallet';
                btn.style.background = 'rgba(0, 255, 255, 0.1)';
                btn.style.borderColor = 'rgba(0, 255, 255, 0.3)';
                btn.style.color = '#00ffff';
                btn.style.cursor = 'pointer';
                info.style.display = 'none';
            }
        }
        
        function disconnectWallet() {
            connectedWallet = null;
            walletProvider = null;
            updateWalletUI();
            addMessage('agent', 'Wallet disconnected');
        }
        
        // Listen for account changes (EVM)
        if (typeof window.ethereum !== 'undefined') {
            window.ethereum.on('accountsChanged', function(accounts) {
                if (accounts.length === 0 && connectedWallet?.type === 'EVM') {
                    disconnectWallet();
                } else if (connectedWallet?.type === 'EVM') {
                    connectEVMWallet('injected');
                }
            });
            
            window.ethereum.on('chainChanged', function(chainId) {
                if (connectedWallet?.type === 'EVM') {
                    connectEVMWallet('injected');
                }
            });
        }

        async function checkStatus() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                // Status indicator removed per user request
                
                // Update level checkboxes
                if (data.currentLevel) {
                    // Uncheck all first
                    document.querySelectorAll('input[name="level"]').forEach(radio => {
                        radio.checked = false;
                    });
                    // Check the current level
                    const currentLevelRadio = document.getElementById(data.currentLevel);
                    if (currentLevelRadio) {
                        currentLevelRadio.checked = true;
                        currentSelectedLevel = data.currentLevel;
                    }
                    
                    // Update level info
                    const levelInfo = document.getElementById('levelInfo');
                    if (levelInfo && data.capabilities) {
                        levelInfo.innerHTML = \`<strong>\${data.currentLevel.replace('level_', '').replace('_', ' ').toUpperCase()}</strong>: \${data.capabilities.description}\`;
                    }
                }
                
                // Update chat section status
                const agentStatus = document.getElementById('agentStatus');
                if (agentStatus) {
                    if (data.agentInitialized) {
                        agentStatus.innerHTML = '<span style="color: #00ff88;">✓ Agent Online - Ready to chat</span>';
                    } else {
                        agentStatus.innerHTML = '<span style="color: #ffaa44;">⚠ Agent Initializing... (Check API keys in .env)</span>';
                    }
                }
            } catch (error) {
                // Status indicator removed per user request
                const agentStatus = document.getElementById('agentStatus');
                if (agentStatus) {
                    agentStatus.innerHTML = '<span style="color: #ff4444;">✗ Connection Error</span>';
                }
            }
        }

        let currentSelectedLevel = 'level_2_intel';
        
        async function switchLevel() {
            const checkedRadio = document.querySelector('input[name="level"]:checked');
            if (!checkedRadio) return;
            
            const level = checkedRadio.value;
            const previousLevel = currentSelectedLevel;
            currentSelectedLevel = level;
            
            try {
                const response = await fetch('/api/level', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ level })
                });
                
                const data = await response.json();
                if (data.success) {
                    addMessage('agent', \`✅ Level switched to \${data.level}. Capabilities: \${data.capabilities.description}\`);
                    checkStatus(); // Refresh status
                } else {
                    // Revert checkbox if failed
                    checkedRadio.checked = false;
                    const prevRadio = document.getElementById(previousLevel);
                    if (prevRadio) prevRadio.checked = true;
                    currentSelectedLevel = previousLevel;
                    alert('Failed to switch level: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                // Revert checkbox on error
                checkedRadio.checked = false;
                const prevRadio = document.getElementById(previousLevel);
                if (prevRadio) prevRadio.checked = true;
                currentSelectedLevel = previousLevel;
                alert('Error switching level: ' + error.message);
            }
        }

        function sendQuickMessage(message) {
            document.getElementById('messageInput').value = message;
            sendMessage();
        }

        async function sendMessage() {
            try {
                const input = document.getElementById('messageInput');
                if (!input) {
                    console.error('Message input not found');
                    return;
                }
                
                const message = input.value.trim();
                if (!message) {
                    console.log('Empty message, ignoring');
                    return;
                }

                const sendButton = document.getElementById('sendButton');
                if (!sendButton) {
                    console.error('Send button not found');
                    return;
                }
                
                sendButton.disabled = true;
                sendButton.textContent = 'Sending...';

                // Add user message to chat
                addMessage('user', message);
                input.value = '';

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, threadId })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || \`HTTP \${response.status}\`);
                }

                const data = await response.json();
                if (data.response) {
                    addMessage('agent', data.response);
                } else {
                    addMessage('agent', 'Error: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error sending message:', error);
                addMessage('agent', 'Error: Failed to send message. ' + (error.message || 'Unknown error'));
            } finally {
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = 'Send';
                }
                refreshAnalytics();
            }
        }
        
        // Make sendMessage available globally
        window.sendMessage = sendMessage;

        function addMessage(type, content) {
            const messagesDiv = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            messageDiv.innerHTML = '<div class="message-label">' + (type === 'user' ? 'You' : 'NetWatch Agent') + '</div><div>' + formatMessage(content) + '</div>';
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function formatMessage(content) {
            // Simple formatting for JSON and code blocks
            if (content.includes('{') && content.includes('}')) {
                try {
                    const jsonMatch = content.match(/\\{[\\s\\S]*\\}/);
                    if (jsonMatch) {
                        const json = JSON.parse(jsonMatch[0]);
                        return content.replace(jsonMatch[0], '<pre>' + JSON.stringify(json, null, 2) + '</pre>');
                    }
                } catch (e) {
                    // Not valid JSON, continue
                }
            }
            return content.replace(/\\n/g, '<br>');
        }

        async function refreshAnalytics() {
            try {
                const response = await fetch('/api/analytics?hours=24');
                const data = await response.json();
                
                const analyticsDiv = document.getElementById('analyticsContent');
                analyticsDiv.innerHTML = \`
                    <div class="analytics-card">
                        <h3>📈 Summary (Last 24 Hours)</h3>
                        <div class="stat">
                            <span class="stat-label">Total Events</span>
                            <span class="stat-value">\${data.totalEvents}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Average Risk Score</span>
                            <span class="stat-value">\${data.averageRiskScore.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="analytics-card">
                        <h3>⚠️ By Severity</h3>
                        <div class="stat">
                            <span class="stat-label">Low</span>
                            <span class="stat-value">\${data.bySeverity.low || 0}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Medium</span>
                            <span class="stat-value">\${data.bySeverity.medium || 0}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">High</span>
                            <span class="stat-value">\${data.bySeverity.high || 0}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Critical</span>
                            <span class="stat-value">\${data.bySeverity.critical || 0}</span>
                        </div>
                    </div>
                    <div class="analytics-card">
                        <h3>📋 By Type</h3>
                        \${Object.entries(data.byType || {}).map(([type, count]) => 
                            \`<div class="stat">
                                <span class="stat-label">\${type}</span>
                                <span class="stat-value">\${count}</span>
                            </div>\`
                        ).join('')}
                    </div>
                \`;
            } catch (error) {
                document.getElementById('analyticsContent').innerHTML = '<div class="loading">Error loading analytics</div>';
            }
        }

        // Initialize
        checkStatus();
        refreshAnalytics();
        setInterval(checkStatus, 5000);
        setInterval(refreshAnalytics, 30000);
    </script>
    
    <footer style="background: rgba(0, 255, 255, 0.05); border-top: 1px solid rgba(0, 255, 255, 0.15); color: #8a98a8; padding: 20px; text-align: center; margin-top: 30px;">
        <div style="font-size: 0.95em; line-height: 1.8; font-family: 'Courier New', monospace;">
            <div style="margin-bottom: 8px;">
                Built with <span style="color: #00ffff;">⚡</span> 
                <a href="https://github.com/coinbase/agentkit" target="_blank" style="color: #00d4ff; text-decoration: none; border-bottom: 1px dotted rgba(0, 212, 255, 0.4); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(0, 212, 255, 0.8)'; this.style.textShadow='0 0 8px rgba(0, 212, 255, 0.3)'" onmouseout="this.style.borderBottomColor='rgba(0, 212, 255, 0.4)'; this.style.textShadow='none'">AgentKit</a>
                and <span style="color: #00ffff;">🔒</span>
                <a href="https://github.com/yourusername/netwatch-agentkit" target="_blank" style="color: #00d4ff; text-decoration: none; border-bottom: 1px dotted rgba(0, 212, 255, 0.4); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(0, 212, 255, 0.8)'; this.style.textShadow='0 0 8px rgba(0, 212, 255, 0.3)'" onmouseout="this.style.borderBottomColor='rgba(0, 212, 255, 0.4)'; this.style.textShadow='none'">NetWatch</a>
            </div>
            <div style="opacity: 0.85; font-size: 0.9em;">
                Made with <span style="color: #00ff88;">❤️</span> by 
                <a href="https://github.com/edwardtay" target="_blank" style="color: #00d4ff; text-decoration: none; border-bottom: 1px dotted rgba(0, 212, 255, 0.4); font-weight: 500; transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(0, 212, 255, 0.8)'; this.style.textShadow='0 0 8px rgba(0, 212, 255, 0.3)'" onmouseout="this.style.borderBottomColor='rgba(0, 212, 255, 0.4)'; this.style.textShadow='none'">Edward</a>
            </div>
        </div>
    </footer>
</body>
</html>
  `);
});

// Start server
async function startServer() {
  // Start server even if agent initialization fails
  app.listen(PORT, () => {
    logger.info(`🚀 NetWatch Server running on http://localhost:${PORT}`);
    logger.info(`📊 Web Interface: http://localhost:${PORT}`);
    logger.info(`🔌 API Endpoints:`);
    logger.info(`   POST /api/chat - Chat with agent`);
    logger.info(`   GET  /api/analytics - Get security analytics`);
    logger.info(`   GET  /api/events - Get security events`);
    logger.info(`   GET  /api/wallet - Get wallet info`);
    logger.info(`   GET  /health - Health check`);
  });

  // Don't pre-initialize agent - let it initialize on first API call
  // This prevents decorator metadata errors from crashing the server
  logger.info("Server started. Agent will initialize on first API call if needed.");
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error("Fatal error starting server", error);
    process.exit(1);
  });
}

