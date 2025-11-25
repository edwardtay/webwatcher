import express from "express";
import { HumanMessage } from "@langchain/core/messages";
import { initializeAgent } from "./index";
import { logger } from "./utils/logger";
import { securityAnalytics } from "./utils/security-analytics";
import * as dotenv from "dotenv";

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
let agentInstance: Awaited<ReturnType<typeof initializeAgent>> | null = null;
let agentInitialized = false;

async function getAgent() {
  if (!agentInstance) {
    agentInstance = await initializeAgent();
    agentInitialized = true;
  }
  return agentInstance;
}

// API Routes

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    agentInitialized,
    timestamp: new Date().toISOString(),
  });
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

    const { agent, config } = await getAgent();
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

// Serve HTML interface
app.get("/", (req, res) => {
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
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 30px;
        }
        @media (max-width: 768px) {
            .content {
                grid-template-columns: 1fr;
            }
        }
        .chat-section, .analytics-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }
        .chat-section h2, .analytics-section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        .chat-messages {
            background: white;
            border-radius: 8px;
            padding: 15px;
            height: 400px;
            overflow-y: auto;
            margin-bottom: 15px;
            border: 1px solid #e0e0e0;
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
        }
        .chat-input input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 1em;
        }
        .chat-input button {
            padding: 12px 24px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: background 0.3s;
        }
        .chat-input button:hover {
            background: #5568d3;
        }
        .chat-input button:disabled {
            background: #ccc;
            cursor: not-allowed;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 VeriSense</h1>
            <p>Cybersecurity Agent for Blockchain Threat Detection</p>
            <div style="margin-top: 15px;">
                <span class="status-indicator" id="statusIndicator"></span>
                <span id="statusText">Checking status...</span>
            </div>
        </div>
        <div class="content">
            <div class="chat-section">
                <h2>💬 Security Analysis</h2>
                <div class="chat-messages" id="chatMessages">
                    <div class="message agent">
                        <div class="message-label">VeriSense Agent</div>
                        <div>Welcome! I'm VeriSense, your cybersecurity agent. I can help you:</div>
                        <ul style="margin-top: 10px; margin-left: 20px;">
                            <li>Analyze blockchain transactions</li>
                            <li>Check address security</li>
                            <li>Monitor wallet balance</li>
                            <li>Provide security summaries</li>
                        </ul>
                        <div style="margin-top: 10px;">Try asking: "Analyze transaction 0x..." or "Get security summary"</div>
                    </div>
                </div>
                <div class="chat-input">
                    <input type="text" id="messageInput" placeholder="Ask about security analysis..." onkeypress="if(event.key==='Enter') sendMessage()">
                    <button onclick="sendMessage()" id="sendButton">Send</button>
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

    <script>
        let threadId = 'web-' + Date.now();

        async function checkStatus() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                document.getElementById('statusIndicator').className = 'status-indicator ' + (data.agentInitialized ? 'status-online' : 'status-offline');
                document.getElementById('statusText').textContent = data.agentInitialized ? 'Agent Online' : 'Agent Initializing...';
            } catch (error) {
                document.getElementById('statusIndicator').className = 'status-indicator status-offline';
                document.getElementById('statusText').textContent = 'Connection Error';
            }
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
            messageDiv.innerHTML = '<div class="message-label">' + (type === 'user' ? 'You' : 'VeriSense Agent') + '</div><div>' + formatMessage(content) + '</div>';
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
</body>
</html>
  `);
});

// Start server
async function startServer() {
  try {
    // Pre-initialize agent
    logger.info("Pre-initializing agent...");
    await getAgent();
    logger.info("Agent initialized successfully");

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
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error("Fatal error starting server", error);
    process.exit(1);
  });
}

