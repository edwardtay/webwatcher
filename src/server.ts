import express from "express";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import * as dotenv from "dotenv";

// Lazy import to avoid decorator metadata issues during module load
let initializeAgent: any;
let AnalystLevel: any;
let levelManager: any;
let HumanMessage: any;

function loadAgentModules() {
  if (!initializeAgent) {
    try {
      const indexModule = require("./index");
      initializeAgent = indexModule.initializeAgent;
      const langchainModule = require("@langchain/core/messages");
      HumanMessage = langchainModule.HumanMessage;
      const levelManagerModule = require("./utils/level-manager");
      AnalystLevel = levelManagerModule.AnalystLevel;
      levelManager = levelManagerModule.levelManager;
    } catch (error) {
      logger.warn("Failed to load agent modules (this is expected with decorator issues):", error);
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
let currentLevel: string = "level_1_local";

async function getAgent(level?: string) {
  // Try to load modules if not already loaded
  if (!initializeAgent) {
    if (!loadAgentModules()) {
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
      agentInstance = await initializeAgent(currentLevel);
      agentInitialized = true;
      logger.info(`Agent initialized/reinitialized at level: ${currentLevel}`);
    } catch (error) {
      logger.error("Failed to initialize agent", error);
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

    if (!agentInitialized) {
      // Try to load and initialize agent
      try {
        await getAgent();
      } catch (error) {
        return res.status(503).json({
          error: "Agent not initialized",
          message: "Agent initialization failed. This may be due to decorator metadata issues with tsx. Please check server logs.",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const { agent, config } = await getAgent();
    if (!HumanMessage) {
      loadAgentModules();
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
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
            background: #f1f1f1;
            border-radius: 4px;
        }
        .chat-messages::-webkit-scrollbar-thumb {
            background: #667eea;
            border-radius: 4px;
        }
        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: #5568d3;
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
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 1em;
            transition: border-color 0.3s;
        }
        .chat-input input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .chat-input button {
            padding: 14px 28px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        .chat-input button:hover:not(:disabled) {
            background: linear-gradient(135deg, #5568d3 0%, #6a3d8f 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid #e0e0e0;
        }
        .analytics-card h3 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .stat {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .stat:last-child {
            border-bottom: none;
        }
        .stat-label {
            color: #666;
        }
        .stat-value {
            font-weight: bold;
            color: #333;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-online {
            background: #4caf50;
        }
        .status-offline {
            background: #f44336;
        }
        .loading {
            text-align: center;
            color: #666;
            padding: 20px;
        }
        pre {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9em;
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
            background: rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            cursor: pointer;
            transition: all 0.3s;
        }
        .level-checkbox-wrapper:hover {
            background: rgba(255, 255, 255, 0.25);
            border-color: rgba(255, 255, 255, 0.5);
        }
        .level-checkbox-wrapper input[type="radio"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
            accent-color: #FFD700;
        }
        .level-checkbox-wrapper input[type="radio"]:checked {
            accent-color: #4caf50;
        }
        .level-checkbox-wrapper label {
            color: white;
            font-size: 0.9em;
            cursor: pointer;
            user-select: none;
            margin: 0;
        }
        .level-checkbox-wrapper input[type="radio"]:checked + label {
            color: #FFD700;
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
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            color: #333;
            border: none;
            border-radius: 8px;
            font-size: 0.95em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
        }
        .connect-wallet-btn:hover {
            background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 215, 0, 0.5);
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
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
            transition: background 0.2s;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .wallet-option:last-child {
            border-bottom: none;
        }
        .wallet-option:hover {
            background: #f8f9fa;
        }
        .wallet-option.evm {
            border-left: 3px solid #627EEA;
        }
        .wallet-option.polkadot {
            border-left: 3px solid #E6007A;
        }
        .wallet-icon {
            font-size: 1.2em;
        }
        .wallet-info {
            margin-top: 10px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            font-size: 0.85em;
            text-align: center;
        }
        .wallet-address {
            font-family: monospace;
            word-break: break-all;
            margin-top: 4px;
        }
        .disconnect-btn {
            margin-top: 8px;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8em;
        }
        .disconnect-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 NetWatch</h1>
            <p>Cybersecurity Agent for Blockchain Threat Detection</p>
            <div style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div>
                    <span class="status-indicator" id="statusIndicator"></span>
                    <span id="statusText">Checking status...</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <label style="color: white; font-size: 0.9em; font-weight: 500;">Level:</label>
                    <div class="level-checkboxes">
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_1_local" name="level" value="level_1_local" onchange="switchLevel()">
                            <label for="level_1_local">Level 1 - Local</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_2_intel" name="level" value="level_2_intel" onchange="switchLevel()">
                            <label for="level_2_intel">Level 2 - Intel</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_3_tools" name="level" value="level_3_tools" onchange="switchLevel()">
                            <label for="level_3_tools">Level 3 - Tools</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_4a_a2a" name="level" value="level_4a_a2a" onchange="switchLevel()">
                            <label for="level_4a_a2a">Level 4A - A2A</label>
                        </div>
                        <div class="level-checkbox-wrapper">
                            <input type="radio" id="level_4b_x402" name="level" value="level_4b_x402" onchange="switchLevel()">
                            <label for="level_4b_x402">Level 4B - x402</label>
                        </div>
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
                <div style="margin-bottom: 15px; padding: 12px; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #667eea;">
                    <div style="font-size: 0.9em; color: #1976d2;">
                        <strong>💡 Quick Actions:</strong>
                        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
                            <button onclick="sendQuickMessage('Get security summary')" style="padding: 6px 12px; background: white; border: 1px solid #667eea; color: #667eea; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Get Security Summary</button>
                            <button onclick="sendQuickMessage('Monitor wallet balance')" style="padding: 6px 12px; background: white; border: 1px solid #667eea; color: #667eea; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Check Balance</button>
                            <button onclick="sendQuickMessage('Analyze address 0x...')" style="padding: 6px 12px; background: white; border: 1px solid #667eea; color: #667eea; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Analyze Address</button>
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
                        <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                            <strong>💡 Try asking:</strong>
                            <div style="margin-top: 5px; font-family: monospace; font-size: 0.9em;">
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
                    <button onclick="sendMessage()" id="sendButton">Send</button>
                </div>
                <div style="margin-top: 10px; text-align: center; font-size: 0.85em; color: #666;">
                    <span id="agentStatus">Agent Status: Checking...</span>
                </div>
            </div>
            <div class="analytics-section">
                <h2>📊 Security Analytics</h2>
                <div id="analyticsContent">
                    <div class="loading">Loading analytics...</div>
                </div>
                <button onclick="refreshAnalytics()" style="width: 100%; padding: 10px; margin-top: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">Refresh Analytics</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>
    <script>
        let threadId = 'web-' + Date.now();
        let currentSelectedLevel = 'level_1_local';
        let connectedWallet = null;
        let walletProvider = null;
        
        // Wallet connection functions
        function toggleWalletMenu() {
            const menu = document.getElementById('walletMenu');
            if (connectedWallet) {
                return; // Don't show menu if already connected
            }
            menu.classList.toggle('show');
        }
        
        // Close wallet menu when clicking outside
        document.addEventListener('click', function(event) {
            const menu = document.getElementById('walletMenu');
            const btn = document.getElementById('connectWalletBtn');
            if (menu && btn && !menu.contains(event.target) && !btn.contains(event.target)) {
                menu.classList.remove('show');
            }
        });
        
        async function connectEVMWallet(type) {
            document.getElementById('walletMenu').classList.remove('show');
            
            try {
                let provider;
                let walletName;
                
                if (type === 'metamask' || type === 'injected') {
                    if (typeof window.ethereum === 'undefined') {
                        alert('Please install MetaMask or another EVM wallet extension');
                        return;
                    }
                    provider = new ethers.providers.Web3Provider(window.ethereum);
                    walletName = type === 'metamask' ? 'MetaMask' : 'EVM Wallet';
                    
                    // Request account access
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                } else if (type === 'coinbase') {
                    if (typeof window.ethereum === 'undefined' || !window.ethereum.isCoinbaseWallet) {
                        alert('Please install Coinbase Wallet extension');
                        return;
                    }
                    provider = new ethers.providers.Web3Provider(window.ethereum);
                    walletName = 'Coinbase Wallet';
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                } else if (type === 'walletconnect') {
                    alert('WalletConnect integration coming soon! For now, please use MetaMask or another injected wallet.');
                    return;
                }
                
                const signer = provider.getSigner();
                const address = await signer.getAddress();
                const network = await provider.getNetwork();
                
                connectedWallet = {
                    type: 'EVM',
                    name: walletName,
                    address: address,
                    network: network.name,
                    chainId: network.chainId
                };
                
                walletProvider = provider;
                updateWalletUI();
                
                // Send wallet info to backend
                try {
                    await fetch('/api/wallet/connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'EVM',
                            address: address,
                            network: network.name,
                            chainId: network.chainId.toString()
                        })
                    });
                } catch (error) {
                    console.warn('Failed to send wallet info to backend:', error);
                }
                
                addMessage('agent', \`✅ Connected to \${walletName}: \${address.substring(0, 6)}...\${address.substring(38)}\`);
            } catch (error) {
                console.error('Error connecting EVM wallet:', error);
                alert('Failed to connect wallet: ' + (error.message || 'Unknown error'));
            }
        }
        
        async function connectPolkadotWallet(type = 'polkadot') {
            document.getElementById('walletMenu').classList.remove('show');
            
            try {
                // Check if Polkadot extension is available
                if (typeof window.injectedWeb3 === 'undefined') {
                    alert('Please install Polkadot.js extension or Talisman wallet');
                    return;
                }
                
                let extension;
                let walletName;
                
                if (type === 'talisman' && window.injectedWeb3['talisman']) {
                    extension = window.injectedWeb3['talisman'];
                    walletName = 'Talisman';
                } else if (window.injectedWeb3['polkadot-js']) {
                    extension = window.injectedWeb3['polkadot-js'];
                    walletName = 'Polkadot.js';
                } else {
                    // Try to use any available extension
                    const available = Object.keys(window.injectedWeb3);
                    if (available.length === 0) {
                        alert('No Polkadot wallet extension found');
                        return;
                    }
                    extension = window.injectedWeb3[available[0]];
                    walletName = available[0];
                }
                
                const injector = await extension.enable('VeriSense');
                const accounts = await injector.accounts.get();
                
                if (accounts.length === 0) {
                    alert('No accounts found. Please create an account in your wallet.');
                    return;
                }
                
                // Use first account
                const account = accounts[0];
                
                connectedWallet = {
                    type: 'Polkadot',
                    name: walletName,
                    address: account.address,
                    name: account.name || 'Unnamed'
                };
                
                updateWalletUI();
                
                // Send wallet info to backend
                try {
                    await fetch('/api/wallet/connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'Polkadot',
                            address: account.address,
                            name: account.name
                        })
                    });
                } catch (error) {
                    console.warn('Failed to send wallet info to backend:', error);
                }
                
                addMessage('agent', \`✅ Connected to \${walletName}: \${account.address.substring(0, 6)}...\${account.address.substring(account.address.length - 6)}\`);
            } catch (error) {
                console.error('Error connecting Polkadot wallet:', error);
                alert('Failed to connect wallet: ' + (error.message || 'Unknown error'));
            }
        }
        
        function updateWalletUI() {
            const btn = document.getElementById('connectWalletBtn');
            const info = document.getElementById('walletInfo');
            const typeSpan = document.getElementById('walletType');
            const addressSpan = document.getElementById('walletAddress');
            
            if (connectedWallet) {
                btn.textContent = '🔗 Wallet Connected';
                btn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
                btn.style.cursor = 'default';
                info.style.display = 'block';
                typeSpan.textContent = \`\${connectedWallet.name} (\${connectedWallet.type})\`;
                addressSpan.textContent = connectedWallet.address;
            } else {
                btn.textContent = '🔗 Connect Wallet';
                btn.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
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
                document.getElementById('statusIndicator').className = 'status-indicator ' + (data.agentInitialized ? 'status-online' : 'status-offline');
                document.getElementById('statusText').textContent = data.agentInitialized ? 'Agent Online' : 'Agent Initializing...';
                
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
                        agentStatus.innerHTML = '<span style="color: #4caf50;">✓ Agent Online - Ready to chat</span>';
                    } else {
                        agentStatus.innerHTML = '<span style="color: #ff9800;">⚠ Agent Initializing... (Check API keys in .env)</span>';
                    }
                }
            } catch (error) {
                document.getElementById('statusIndicator').className = 'status-indicator status-offline';
                document.getElementById('statusText').textContent = 'Connection Error';
                const agentStatus = document.getElementById('agentStatus');
                if (agentStatus) {
                    agentStatus.innerHTML = '<span style="color: #f44336;">✗ Connection Error</span>';
                }
            }
        }

        let currentSelectedLevel = 'level_1_local';
        
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
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (!message) return;

            const sendButton = document.getElementById('sendButton');
            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';

            // Add user message to chat
            addMessage('user', message);
            input.value = '';

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, threadId })
                });

                const data = await response.json();
                if (data.response) {
                    addMessage('agent', data.response);
                } else {
                    addMessage('agent', 'Error: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                addMessage('agent', 'Error: Failed to send message. ' + error.message);
            } finally {
                sendButton.disabled = false;
                sendButton.textContent = 'Send';
                refreshAnalytics();
            }
        }

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
    
    <footer style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; margin-top: 30px; border-top: 2px solid rgba(255,255,255,0.2);">
        <div style="font-size: 0.95em; line-height: 1.8;">
            <div style="margin-bottom: 8px;">
                Built with <span style="color: #FFD700;">⚡</span> 
                <a href="https://github.com/coinbase/agentkit" target="_blank" style="color: #FFD700; text-decoration: none; border-bottom: 1px dotted rgba(255,215,0,0.5); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(255,215,0,1)'; this.style.textShadow='0 0 8px rgba(255,215,0,0.5)'" onmouseout="this.style.borderBottomColor='rgba(255,215,0,0.5)'; this.style.textShadow='none'">AgentKit</a>
                and <span style="color: #FFD700;">🔒</span>
                <a href="https://verisense.network" target="_blank" style="color: #FFD700; text-decoration: none; border-bottom: 1px dotted rgba(255,215,0,0.5); transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(255,215,0,1)'; this.style.textShadow='0 0 8px rgba(255,215,0,0.5)'" onmouseout="this.style.borderBottomColor='rgba(255,215,0,0.5)'; this.style.textShadow='none'">VeriSense</a>
            </div>
            <div style="opacity: 0.9; font-size: 0.9em;">
                Made with <span style="color: #ff6b9d;">❤️</span> by 
                <a href="https://github.com/edwardtay" target="_blank" style="color: #FFD700; text-decoration: none; border-bottom: 1px dotted rgba(255,215,0,0.5); font-weight: 500; transition: all 0.3s;" onmouseover="this.style.borderBottomColor='rgba(255,215,0,1)'; this.style.textShadow='0 0 8px rgba(255,215,0,0.5)'" onmouseout="this.style.borderBottomColor='rgba(255,215,0,0.5)'; this.style.textShadow='none'">Edward</a>
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
    logger.info(`🚀 VeriSense Server running on http://localhost:${PORT}`);
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

