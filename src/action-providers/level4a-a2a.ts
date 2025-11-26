/**
 * Level 4A - A2A Coordination Action Provider
 * Multi-agent coordination without payments
 * Uses A2A/AP2 style messaging for discovery and task routing
 */

import {
  ActionProvider,
  WalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { z } from "zod";
import { logger } from "../utils/logger";
import { securityAnalytics } from "../utils/security-analytics";

export interface AgentMessage {
  from: string;
  to?: string; // undefined = broadcast
  type: "discovery" | "task_request" | "task_response" | "status";
  payload: Record<string, any>;
  timestamp: string;
  messageId: string;
}

export class Level4AA2AActionProvider extends ActionProvider<WalletProvider> {
  private agentId: string;
  private agentRegistry: Map<string, {
    id: string;
    type: string;
    capabilities: string[];
    status: "available" | "busy" | "offline";
    lastSeen: string;
  }> = new Map();
  private messageQueue: AgentMessage[] = [];

  constructor() {
    super("level4a-a2a-action-provider", []);
    this.agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.registerSelf();
    logger.info(`A2A Agent initialized with ID: ${this.agentId}`);
  }

  supportsNetwork = (network: Network) => {
    return true;
  };

  /**
   * Register this agent in the registry
   */
  private registerSelf(): void {
    this.agentRegistry.set(this.agentId, {
      id: this.agentId,
      type: "security_analyst",
      capabilities: [
        "incident_classification",
        "threat_analysis",
        "remediation_proposal",
        "security_monitoring",
      ],
      status: "available",
      lastSeen: new Date().toISOString(),
    });
  }

  /**
   * Discover other agents in the network
   */
  @CreateAction({
    name: "a2a_discover_agents",
    description:
      "Discovers other agents in the A2A network. Uses A2A messaging protocol.",
    schema: z.object({
      agentType: z.string().optional().describe("Filter by agent type (e.g., 'scanner', 'triage', 'fix')"),
      capability: z.string().optional().describe("Filter by capability"),
    }),
  })
  async a2aDiscoverAgents(
    walletProvider: WalletProvider,
    args: { agentType?: string; capability?: string },
  ): Promise<string> {
    try {
      logger.info("Discovering agents via A2A", args);

      // Broadcast discovery message
      const discoveryMessage: AgentMessage = {
        from: this.agentId,
        type: "discovery",
        payload: {
          agentType: "security_analyst",
          capabilities: this.agentRegistry.get(this.agentId)?.capabilities || [],
        },
        timestamp: new Date().toISOString(),
        messageId: `msg-${Date.now()}`,
      };

      this.messageQueue.push(discoveryMessage);

      // In production, this would broadcast to A2A network
      // For now, return mock discovered agents
      const discoveredAgents = [
        {
          id: "scanner-agent-001",
          type: "scanner",
          capabilities: ["vulnerability_scanning", "network_scanning", "code_analysis"],
          status: "available",
          lastSeen: new Date().toISOString(),
        },
        {
          id: "triage-agent-001",
          type: "triage",
          capabilities: ["incident_classification", "priority_assignment", "routing"],
          status: "available",
          lastSeen: new Date().toISOString(),
        },
        {
          id: "fix-agent-001",
          type: "fix",
          capabilities: ["remediation", "patch_generation", "pr_creation"],
          status: "busy",
          lastSeen: new Date().toISOString(),
        },
        {
          id: "governance-agent-001",
          type: "governance",
          capabilities: ["compliance_checking", "policy_enforcement", "audit"],
          status: "available",
          lastSeen: new Date().toISOString(),
        },
      ];

      // Filter by criteria
      let filtered = discoveredAgents;
      if (args.agentType) {
        filtered = filtered.filter((a) => a.type === args.agentType);
      }
      if (args.capability) {
        filtered = filtered.filter((a) => a.capabilities.includes(args.capability!));
      }

      // Register discovered agents
      filtered.forEach((agent) => {
        this.agentRegistry.set(agent.id, {
          ...agent,
          status: agent.status as "available" | "busy" | "offline",
        });
      });

      return JSON.stringify({
        timestamp: new Date().toISOString(),
        myAgentId: this.agentId,
        discoveredCount: filtered.length,
        agents: filtered,
        note: "In production, this would use A2A messaging protocol for real-time discovery.",
      }, null, 2);
    } catch (error) {
      logger.error("Error discovering agents", error);
      return `Error discovering agents: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Request task from another agent
   */
  @CreateAction({
    name: "a2a_request_task",
    description:
      "Requests a task from another agent using A2A messaging protocol.",
    schema: z.object({
      targetAgentId: z.string().describe("Target agent ID"),
      taskType: z.string().describe("Type of task to request"),
      taskDescription: z.string().describe("Description of the task"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Task priority"),
    }),
  })
  async a2aRequestTask(
    walletProvider: WalletProvider,
    args: { targetAgentId: string; taskType: string; taskDescription: string; priority?: string },
  ): Promise<string> {
    try {
      logger.info("Requesting task via A2A", args);

      const targetAgent = this.agentRegistry.get(args.targetAgentId);
      if (!targetAgent) {
        throw new Error(`Agent ${args.targetAgentId} not found`);
      }

      if (targetAgent.status === "offline") {
        throw new Error(`Agent ${args.targetAgentId} is offline`);
      }

      // Create task request message
      const taskRequest: AgentMessage = {
        from: this.agentId,
        to: args.targetAgentId,
        type: "task_request",
        payload: {
          taskType: args.taskType,
          taskDescription: args.taskDescription,
          priority: args.priority || "medium",
          requestedBy: this.agentId,
        },
        timestamp: new Date().toISOString(),
        messageId: `task-${Date.now()}`,
      };

      this.messageQueue.push(taskRequest);

      // In production, this would send via A2A network
      // Mock response
      const response = {
        messageId: taskRequest.messageId,
        timestamp: new Date().toISOString(),
        status: targetAgent.status === "busy" ? "queued" : "accepted",
        targetAgent: {
          id: args.targetAgentId,
          type: targetAgent.type,
          status: targetAgent.status,
        },
        estimatedCompletion: targetAgent.status === "busy" 
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
          : new Date(Date.now() + 1 * 60 * 1000).toISOString(), // 1 minute
        note: "In production, this would receive real-time response from target agent.",
      };

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: (args.priority || "medium") as "low" | "medium" | "high" | "critical",
        timestamp: new Date().toISOString(),
        data: {
          taskType: args.taskType,
          targetAgent: args.targetAgentId,
          status: response.status,
        },
      });

      return JSON.stringify(response, null, 2);
    } catch (error) {
      logger.error("Error requesting task", error);
      return `Error requesting task: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Route task to appropriate agent
   */
  @CreateAction({
    name: "a2a_route_task",
    description:
      "Routes a task to the most appropriate agent based on capabilities and availability.",
    schema: z.object({
      taskType: z.string().describe("Type of task"),
      taskDescription: z.string().describe("Description of the task"),
      requiredCapability: z.string().describe("Required capability"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Task priority"),
    }),
  })
  async a2aRouteTask(
    walletProvider: WalletProvider,
    args: { taskType: string; taskDescription: string; requiredCapability: string; priority?: string },
  ): Promise<string> {
    try {
      logger.info("Routing task via A2A", args);

      // Find agents with required capability
      const availableAgents = Array.from(this.agentRegistry.values())
        .filter((agent) => 
          agent.capabilities.includes(args.requiredCapability) &&
          agent.status === "available" &&
          agent.id !== this.agentId
        );

      if (availableAgents.length === 0) {
        return JSON.stringify({
          timestamp: new Date().toISOString(),
          status: "no_agents_available",
          message: `No available agents found with capability: ${args.requiredCapability}`,
          suggestion: "Try discovering more agents or wait for agents to become available",
        }, null, 2);
      }

      // Select best agent (simple: first available, in production use more sophisticated routing)
      const selectedAgent = availableAgents[0];

      // Route task
      const routingResult = await this.a2aRequestTask(
        walletProvider,
        {
          targetAgentId: selectedAgent.id,
          taskType: args.taskType,
          taskDescription: args.taskDescription,
          priority: args.priority,
        },
      );

      return JSON.stringify({
        timestamp: new Date().toISOString(),
        routingDecision: {
          selectedAgent: selectedAgent.id,
          agentType: selectedAgent.type,
          reason: `Has capability: ${args.requiredCapability}`,
        },
        taskRequest: JSON.parse(routingResult),
      }, null, 2);
    } catch (error) {
      logger.error("Error routing task", error);
      return `Error routing task: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Get agent status and message queue
   */
  @CreateAction({
    name: "a2a_get_status",
    description:
      "Gets A2A network status and message queue.",
    schema: z.object({}),
  })
  async a2aGetStatus(
    walletProvider: WalletProvider,
    _args: Record<string, never>,
  ): Promise<string> {
    try {
      const status = {
        myAgentId: this.agentId,
        timestamp: new Date().toISOString(),
        registeredAgents: Array.from(this.agentRegistry.values()),
        messageQueueLength: this.messageQueue.length,
        recentMessages: this.messageQueue.slice(-10),
        networkStatus: "connected", // In production, check actual network status
      };

      return JSON.stringify(status, null, 2);
    } catch (error) {
      logger.error("Error getting A2A status", error);
      return `Error getting status: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Factory function to create Level 4A action provider
 */
export const level4AA2AActionProvider = () => new Level4AA2AActionProvider();





