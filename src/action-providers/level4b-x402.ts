/**
 * Level 4B - A2A + x402 Payments Action Provider
 * Agent commerce with HTTP 402 payments
 * Uses x402 protocol over HTTP 402 for payments
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
import { level4AA2AActionProvider } from "./level4a-a2a";

export interface PaymentRequest {
  amount: string; // Amount in USDC
  currency: string; // e.g., "USDC"
  network: string; // e.g., "base", "solana"
  recipient: string; // Recipient address
  description: string;
  resourceId?: string; // ID of the resource being paid for
}

export interface X402PaymentResponse {
  status: number; // HTTP status code (402 = Payment Required)
  paymentTerms: {
    amount: string;
    currency: string;
    network: string;
    recipient: string;
    paymentId: string;
    expiresAt: string;
  };
  resource?: any; // Resource that will be returned after payment
}

export class Level4BX402ActionProvider extends ActionProvider<WalletProvider> {
  private a2aProvider: ReturnType<typeof level4AA2AActionProvider>;
  private paymentHistory: Map<string, {
    paymentId: string;
    amount: string;
    currency: string;
    status: "pending" | "completed" | "failed";
    timestamp: string;
    resourceId?: string;
  }> = new Map();

  constructor() {
    super("level4b-x402-action-provider", []);
    this.a2aProvider = level4AA2AActionProvider();
    logger.info("Level 4B x402 Payment Provider initialized");
  }

  supportsNetwork = (network: Network) => {
    return true;
  };

  /**
   * Request a priced resource (triggers HTTP 402)
   */
  @CreateAction({
    name: "x402_request_resource",
    description:
      "Requests a priced resource. Server returns HTTP 402 with x402 payment terms.",
    schema: z.object({
      resourceUrl: z.string().describe("URL of the resource to request"),
      resourceType: z.enum(["threat_intel", "scan", "analysis", "premium_api"]).describe("Type of resource"),
      description: z.string().optional().describe("Description of what the resource provides"),
    }),
  })
  async x402RequestResource(
    walletProvider: WalletProvider,
    args: { resourceUrl: string; resourceType: string; description?: string },
  ): Promise<string> {
    try {
      logger.info("Requesting priced resource", args);

      // In production, this would make HTTP request to resource URL
      // Server would return HTTP 402 with payment terms
      const mockResponse: X402PaymentResponse = {
        status: 402,
        paymentTerms: {
          amount: this.getResourcePrice(args.resourceType),
          currency: "USDC",
          network: "base", // Base network for USDC
          recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Mock recipient
          paymentId: `pay-${Date.now()}`,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        },
        resource: {
          type: args.resourceType,
          description: args.description || `Premium ${args.resourceType} resource`,
          note: "Resource will be returned after payment verification",
        },
      };

      // Record payment request
      this.paymentHistory.set(mockResponse.paymentTerms.paymentId, {
        paymentId: mockResponse.paymentTerms.paymentId,
        amount: mockResponse.paymentTerms.amount,
        currency: mockResponse.paymentTerms.currency,
        status: "pending",
        timestamp: new Date().toISOString(),
        resourceId: args.resourceUrl,
      });

      return JSON.stringify({
        ...mockResponse,
        message: "HTTP 402 Payment Required",
        nextStep: "Use x402_submit_payment to submit payment",
      }, null, 2);
    } catch (error) {
      logger.error("Error requesting resource", error);
      return `Error requesting resource: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Get price for resource type
   */
  private getResourcePrice(resourceType: string): string {
    const prices: Record<string, string> = {
      threat_intel: "10.00", // 10 USDC
      scan: "25.00", // 25 USDC
      analysis: "50.00", // 50 USDC
      premium_api: "100.00", // 100 USDC
    };
    return prices[resourceType] || "10.00";
  }

  /**
   * Submit x402 payment
   */
  @CreateAction({
    name: "x402_submit_payment",
    description:
      "Submits x402 payment payload (USDC on Base/Solana). Upon verification, resource is returned.",
    schema: z.object({
      paymentId: z.string().describe("Payment ID from payment terms"),
      amount: z.string().describe("Amount to pay (must match payment terms)"),
      currency: z.string().describe("Currency (e.g., USDC)"),
      network: z.string().describe("Network (e.g., base, solana)"),
      recipient: z.string().describe("Recipient address"),
    }),
  })
  async x402SubmitPayment(
    walletProvider: WalletProvider,
    args: { paymentId: string; amount: string; currency: string; network: string; recipient: string },
  ): Promise<string> {
    try {
      logger.info("Submitting x402 payment", args);

      const paymentRecord = this.paymentHistory.get(args.paymentId);
      if (!paymentRecord) {
        throw new Error(`Payment ID ${args.paymentId} not found`);
      }

      // Verify payment terms match
      if (paymentRecord.amount !== args.amount) {
        throw new Error(`Amount mismatch: expected ${paymentRecord.amount}, got ${args.amount}`);
      }

      // In production, this would:
      // 1. Construct USDC transfer transaction
      // 2. Sign transaction with wallet
      // 3. Submit to blockchain
      // 4. Wait for confirmation
      // 5. Send payment proof to facilitator
      // 6. Receive resource after verification

      // Get wallet address - WalletProvider interface may vary
      const walletAddress = (walletProvider as any).getAddress?.() || (walletProvider as any).address || "0x0000000000000000000000000000000000000000";
      const walletDetails = { address: walletAddress };
      
      // Mock payment transaction
      const paymentTx = {
        from: walletDetails.address,
        to: args.recipient,
        amount: args.amount,
        currency: args.currency,
        network: args.network,
        txHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock hash
        status: "pending",
      };

      // Simulate payment verification (in production, wait for blockchain confirmation)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update payment record
      paymentRecord.status = "completed";

      // In production, facilitator would verify payment and return resource
      const resourceResponse = {
        paymentId: args.paymentId,
        transactionHash: paymentTx.txHash,
        status: "verified",
        resource: {
          type: paymentRecord.resourceId?.includes("threat_intel") ? "threat_intel" : "unknown",
          data: {
            note: "Resource data would be returned here after payment verification",
            example: "Premium threat intelligence data, scan results, etc.",
          },
        },
        timestamp: new Date().toISOString(),
      };

      // Record event
      securityAnalytics.recordEvent({
        type: "alert",
        severity: "low",
        timestamp: new Date().toISOString(),
        data: {
          paymentId: args.paymentId,
          amount: args.amount,
          currency: args.currency,
          status: "completed",
        },
      });

      return JSON.stringify({
        ...resourceResponse,
        message: "Payment verified. Resource returned.",
      }, null, 2);
    } catch (error) {
      logger.error("Error submitting payment", error);
      const paymentRecord = this.paymentHistory.get(args.paymentId);
      if (paymentRecord) {
        paymentRecord.status = "failed";
      }
      return `Error submitting payment: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Pay bug bounty agent for validated finding
   */
  @CreateAction({
    name: "x402_pay_bug_bounty",
    description:
      "Pays a bug bounty agent when a security finding is validated. Uses x402 protocol.",
    schema: z.object({
      agentId: z.string().describe("Bug bounty agent ID"),
      findingId: z.string().describe("Security finding ID"),
      bountyAmount: z.string().describe("Bounty amount in USDC"),
      network: z.string().optional().describe("Network (default: base)"),
    }),
  })
  async x402PayBugBounty(
    walletProvider: WalletProvider,
    args: { agentId: string; findingId: string; bountyAmount: string; network?: string },
  ): Promise<string> {
    try {
      logger.info("Paying bug bounty", args);

      // Get agent address (in production, from A2A registry)
      const agentAddress = `0x${Math.random().toString(16).substr(2, 40)}`; // Mock address

      // Submit payment
      const paymentId = `bounty-${Date.now()}`;
      const result = await this.x402SubmitPayment(
        walletProvider,
        {
          paymentId,
          amount: args.bountyAmount,
          currency: "USDC",
          network: args.network || "base",
          recipient: agentAddress,
        },
      );

      const paymentResult = JSON.parse(result);

      return JSON.stringify({
        ...paymentResult,
        bountyDetails: {
          agentId: args.agentId,
          findingId: args.findingId,
          amount: args.bountyAmount,
          status: "paid",
        },
        message: "Bug bounty payment completed successfully",
      }, null, 2);
    } catch (error) {
      logger.error("Error paying bug bounty", error);
      return `Error paying bug bounty: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Get payment history
   */
  @CreateAction({
    name: "x402_get_payment_history",
    description:
      "Gets payment history for x402 transactions.",
    schema: z.object({}),
  })
  async x402GetPaymentHistory(
    walletProvider: WalletProvider,
    _args: Record<string, never>,
  ): Promise<string> {
    try {
      const history = Array.from(this.paymentHistory.values());

      return JSON.stringify({
        timestamp: new Date().toISOString(),
        totalPayments: history.length,
        payments: history,
        summary: {
          totalPaid: history
            .filter((p) => p.status === "completed")
            .reduce((sum, p) => sum + parseFloat(p.amount), 0)
            .toFixed(2),
          pendingPayments: history.filter((p) => p.status === "pending").length,
          failedPayments: history.filter((p) => p.status === "failed").length,
        },
      }, null, 2);
    } catch (error) {
      logger.error("Error getting payment history", error);
      return `Error getting payment history: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Handle HTTP 402 response and initiate payment flow
   */
  @CreateAction({
    name: "x402_handle_402_response",
    description:
      "Handles HTTP 402 Payment Required response and initiates payment flow.",
    schema: z.object({
      responseStatus: z.number().describe("HTTP status code (should be 402)"),
      paymentTerms: z.record(z.any()).describe("Payment terms from HTTP 402 response"),
      autoPay: z.boolean().optional().describe("Automatically submit payment if true"),
    }),
  })
  async x402Handle402Response(
    walletProvider: WalletProvider,
    args: { responseStatus: number; paymentTerms: Record<string, any>; autoPay?: boolean },
  ): Promise<string> {
    try {
      if (args.responseStatus !== 402) {
        throw new Error(`Expected HTTP 402, got ${args.responseStatus}`);
      }

      logger.info("Handling HTTP 402 response", args.paymentTerms);

      const paymentTerms = args.paymentTerms as X402PaymentResponse["paymentTerms"];

      // Record payment request
      this.paymentHistory.set(paymentTerms.paymentId, {
        paymentId: paymentTerms.paymentId,
        amount: paymentTerms.amount,
        currency: paymentTerms.currency,
        status: "pending",
        timestamp: new Date().toISOString(),
      });

      if (args.autoPay) {
        // Automatically submit payment
        const result = await this.x402SubmitPayment(walletProvider, {
          paymentId: paymentTerms.paymentId,
          amount: paymentTerms.amount,
          currency: paymentTerms.currency,
          network: paymentTerms.network,
          recipient: paymentTerms.recipient,
        });

        return JSON.stringify({
          ...JSON.parse(result),
          autoPaid: true,
        }, null, 2);
      } else {
        return JSON.stringify({
          status: "payment_required",
          paymentTerms,
          nextStep: "Use x402_submit_payment to complete payment",
        }, null, 2);
      }
    } catch (error) {
      logger.error("Error handling 402 response", error);
      return `Error handling 402 response: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Factory function to create Level 4B action provider
 */
export const level4BX402ActionProvider = () => new Level4BX402ActionProvider();





