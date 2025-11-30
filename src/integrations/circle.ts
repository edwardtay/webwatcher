/**
 * Circle Integration - USDC Stablecoin & Payments
 * https://developers.circle.com/
 */

import { logger } from "../utils/logger";

export interface CircleConfig {
  apiKey: string;
  environment?: "sandbox" | "production";
}

export interface USDCBalance {
  currency: string;
  amount: string;
}

export interface CirclePayment {
  id: string;
  status: string;
  amount: { amount: string; currency: string };
  source: any;
  destination: any;
}

export class CircleClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: CircleConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.environment === "production"
      ? "https://api.circle.com"
      : "https://api-sandbox.circle.com";
  }

  /**
   * Get USDC balance for a wallet address
   */
  async getUSDCBalance(address: string): Promise<USDCBalance> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/wallets/${address}/balance`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Circle API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: USDCBalance };
      return data.data;
    } catch (error) {
      logger.error("Circle API error:", error);
      throw error;
    }
  }

  /**
   * Create a USDC payment
   */
  async createPayment(params: {
    amount: string;
    currency: string;
    destination: string;
    source: string;
  }): Promise<CirclePayment> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Circle API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: CirclePayment };
      return data.data;
    } catch (error) {
      logger.error("Circle payment error:", error);
      throw error;
    }
  }

  /**
   * Verify wallet address for security
   */
  async verifyAddress(address: string): Promise<{ valid: boolean; risk: string }> {
    try {
      // Circle's address verification endpoint
      const response = await fetch(`${this.baseUrl}/v1/addresses/verify`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error(`Circle API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: { valid: boolean; riskLevel?: string } };
      return {
        valid: data.data.valid,
        risk: data.data.riskLevel || "unknown",
      };
    } catch (error) {
      logger.error("Circle address verification error:", error);
      throw error;
    }
  }
}

// Singleton instance
let circleClient: CircleClient | null = null;

export function getCircleClient(): CircleClient {
  if (!circleClient) {
    const apiKey = process.env.CIRCLE_API_KEY;
    if (!apiKey) {
      throw new Error("CIRCLE_API_KEY not configured");
    }
    circleClient = new CircleClient({
      apiKey,
      environment: process.env.CIRCLE_ENV as "sandbox" | "production" || "sandbox",
    });
  }
  return circleClient;
}
