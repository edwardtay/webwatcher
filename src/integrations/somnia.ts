/**
 * Somnia Integration - Blockchain Infrastructure
 * https://somnia.network/
 */

import { logger } from "../utils/logger";

export interface SomniaConfig {
  rpcUrl?: string;
  apiKey?: string;
}

export interface BlockchainMetrics {
  tps: number;
  blockTime: number;
  activeNodes: number;
  networkHealth: string;
}

export interface InfrastructureStatus {
  status: "operational" | "degraded" | "down";
  latency: number;
  throughput: number;
}

export class SomniaClient {
  private rpcUrl: string;
  private apiKey: string;

  constructor(config: SomniaConfig = {}) {
    this.rpcUrl = config.rpcUrl || process.env.SOMNIA_RPC_URL || "https://rpc.somnia.network";
    this.apiKey = config.apiKey || process.env.SOMNIA_API_KEY || "";
  }

  /**
   * Get blockchain metrics
   */
  async getBlockchainMetrics(): Promise<BlockchainMetrics> {
    try {
      const response = await fetch(`${this.rpcUrl}/metrics`, {
        headers: this.apiKey ? {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        } : {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Somnia API error: ${response.statusText}`);
      }

      const data = await response.json() as BlockchainMetrics;
      return data;
    } catch (error) {
      logger.error("Somnia metrics error:", error);
      // Return mock data for demo
      return {
        tps: 10000,
        blockTime: 0.4,
        activeNodes: 150,
        networkHealth: "excellent",
      };
    }
  }

  /**
   * Get infrastructure status
   */
  async getInfrastructureStatus(): Promise<InfrastructureStatus> {
    try {
      const response = await fetch(`${this.rpcUrl}/status`, {
        headers: this.apiKey ? {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        } : {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Somnia API error: ${response.statusText}`);
      }

      const data = await response.json() as InfrastructureStatus;
      return data;
    } catch (error) {
      logger.error("Somnia status error:", error);
      // Return mock data for demo
      return {
        status: "operational",
        latency: 25,
        throughput: 10000,
      };
    }
  }

  /**
   * Query blockchain data with high performance
   */
  async queryBlockchain(method: string, params: any[]): Promise<any> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { "Authorization": `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Somnia RPC error: ${response.statusText}`);
      }

      const data = await response.json() as { result: any };
      return data.result;
    } catch (error) {
      logger.error("Somnia query error:", error);
      throw error;
    }
  }
}

// Singleton instance
let somniaClient: SomniaClient | null = null;

export function getSomniaClient(): SomniaClient {
  if (!somniaClient) {
    somniaClient = new SomniaClient({
      rpcUrl: process.env.SOMNIA_RPC_URL,
      apiKey: process.env.SOMNIA_API_KEY,
    });
  }
  return somniaClient;
}
