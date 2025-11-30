/**
 * ZetaChain Integration - Universal Blockchain
 * https://www.zetachain.com/docs/
 */

import { logger } from "../utils/logger";

export interface ZetaChainConfig {
  rpcUrl?: string;
  network?: "mainnet" | "testnet";
}

export interface CrossChainTransaction {
  txHash: string;
  sourceChain: string;
  destinationChain: string;
  status: string;
  amount: string;
}

export class ZetaChainClient {
  private rpcUrl: string;
  private network: string;

  constructor(config: ZetaChainConfig = {}) {
    this.network = config.network || "testnet";
    this.rpcUrl = config.rpcUrl || 
      (this.network === "mainnet" 
        ? "https://zetachain-evm.blockpi.network/v1/rpc/public"
        : "https://zetachain-athens-evm.blockpi.network/v1/rpc/public");
  }

  /**
   * Get cross-chain transaction status
   */
  async getCrossChainTx(txHash: string): Promise<CrossChainTransaction> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`ZetaChain RPC error: ${response.statusText}`);
      }

      const data = await response.json() as { result: { hash: string; blockNumber?: string; value: string } };
      
      return {
        txHash: data.result.hash,
        sourceChain: "zeta",
        destinationChain: "unknown",
        status: data.result.blockNumber ? "confirmed" : "pending",
        amount: data.result.value,
      };
    } catch (error) {
      logger.error("ZetaChain API error:", error);
      throw error;
    }
  }

  /**
   * Verify cross-chain message
   */
  async verifyCrossChainMessage(messageId: string): Promise<{
    verified: boolean;
    sourceChain: string;
    destinationChain: string;
  }> {
    try {
      // ZetaChain cross-chain verification
      const response = await fetch(`${this.rpcUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "zeta_getCrossChainMessage",
          params: [messageId],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`ZetaChain verification error: ${response.statusText}`);
      }

      const data = await response.json() as { result?: { verified?: boolean; sourceChain?: string; destinationChain?: string } };
      
      return {
        verified: data.result?.verified || false,
        sourceChain: data.result?.sourceChain || "unknown",
        destinationChain: data.result?.destinationChain || "unknown",
      };
    } catch (error) {
      logger.error("ZetaChain verification error:", error);
      throw error;
    }
  }

  /**
   * Get chain status for security monitoring
   */
  async getChainStatus(): Promise<{
    blockNumber: number;
    chainId: string;
    healthy: boolean;
  }> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`ZetaChain RPC error: ${response.statusText}`);
      }

      const data = await response.json() as { result: string };
      const blockNumber = parseInt(data.result, 16);

      return {
        blockNumber,
        chainId: this.network === "mainnet" ? "7000" : "7001",
        healthy: blockNumber > 0,
      };
    } catch (error) {
      logger.error("ZetaChain status error:", error);
      throw error;
    }
  }
}

// Singleton instance
let zetaChainClient: ZetaChainClient | null = null;

export function getZetaChainClient(): ZetaChainClient {
  if (!zetaChainClient) {
    zetaChainClient = new ZetaChainClient({
      network: process.env.ZETACHAIN_NETWORK as "mainnet" | "testnet" || "testnet",
      rpcUrl: process.env.ZETACHAIN_RPC_URL,
    });
  }
  return zetaChainClient;
}
