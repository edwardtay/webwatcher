/**
 * Nansen API Integration
 * Provides wallet intelligence, labels, and on-chain analytics
 * Docs: https://docs.nansen.ai/
 */

import axios from 'axios';

const NANSEN_API_KEY = process.env.NANSEN_API_KEY;
const NANSEN_BASE_URL = 'https://api.nansen.ai/v1';

interface NansenWalletLabel {
  address: string;
  labels: string[];
  entity?: string;
  category?: string;
}

interface NansenTokenHoldings {
  address: string;
  tokens: Array<{
    contractAddress: string;
    symbol: string;
    name: string;
    balance: string;
    valueUSD: number;
    price: number;
  }>;
  totalValueUSD: number;
}

interface NansenWalletProfile {
  address: string;
  labels: string[];
  entity?: string;
  category?: string;
  firstSeen?: string;
  lastSeen?: string;
  transactionCount?: number;
  smartMoneyScore?: number;
}

/**
 * Get wallet labels and entity information
 */
export async function getWalletLabels(address: string): Promise<NansenWalletLabel> {
  try {
    if (!NANSEN_API_KEY) {
      throw new Error('Nansen API key not configured');
    }

    const response = await axios.get(`${NANSEN_BASE_URL}/wallet/${address}/labels`, {
      headers: {
        'X-API-KEY': NANSEN_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return {
      address,
      labels: response.data.labels || [],
      entity: response.data.entity,
      category: response.data.category,
    };
  } catch (error: any) {
    console.error('❌ Nansen getWalletLabels error:', error.response?.data || error.message);
    throw new Error(`Failed to get wallet labels: ${error.message}`);
  }
}

/**
 * Get wallet token holdings with USD values
 */
export async function getWalletTokenHoldings(address: string, chain: string = 'ethereum'): Promise<NansenTokenHoldings> {
  try {
    if (!NANSEN_API_KEY) {
      throw new Error('Nansen API key not configured');
    }

    const response = await axios.get(`${NANSEN_BASE_URL}/wallet/${address}/tokens`, {
      headers: {
        'X-API-KEY': NANSEN_API_KEY,
        'Accept': 'application/json',
      },
      params: {
        chain,
      },
      timeout: 10000,
    });

    const tokens = response.data.tokens || [];
    const totalValueUSD = tokens.reduce((sum: number, token: any) => sum + (token.valueUSD || 0), 0);

    return {
      address,
      tokens: tokens.map((token: any) => ({
        contractAddress: token.contractAddress,
        symbol: token.symbol,
        name: token.name,
        balance: token.balance,
        valueUSD: token.valueUSD || 0,
        price: token.price || 0,
      })),
      totalValueUSD,
    };
  } catch (error: any) {
    console.error('❌ Nansen getWalletTokenHoldings error:', error.response?.data || error.message);
    throw new Error(`Failed to get token holdings: ${error.message}`);
  }
}

/**
 * Get comprehensive wallet profile with intelligence
 */
export async function getWalletProfile(address: string): Promise<NansenWalletProfile> {
  try {
    if (!NANSEN_API_KEY) {
      throw new Error('Nansen API key not configured');
    }

    const response = await axios.get(`${NANSEN_BASE_URL}/wallet/${address}/profile`, {
      headers: {
        'X-API-KEY': NANSEN_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return {
      address,
      labels: response.data.labels || [],
      entity: response.data.entity,
      category: response.data.category,
      firstSeen: response.data.firstSeen,
      lastSeen: response.data.lastSeen,
      transactionCount: response.data.transactionCount,
      smartMoneyScore: response.data.smartMoneyScore,
    };
  } catch (error: any) {
    console.error('❌ Nansen getWalletProfile error:', error.response?.data || error.message);
    throw new Error(`Failed to get wallet profile: ${error.message}`);
  }
}

/**
 * Get wallet intelligence summary (combines multiple endpoints)
 */
export async function getWalletIntelligence(address: string) {
  try {
    const [labels, profile] = await Promise.allSettled([
      getWalletLabels(address),
      getWalletProfile(address),
    ]);

    const result: any = {
      address,
      timestamp: new Date().toISOString(),
    };

    if (labels.status === 'fulfilled') {
      result.labels = labels.value.labels;
      result.entity = labels.value.entity;
      result.category = labels.value.category;
    }

    if (profile.status === 'fulfilled') {
      result.profile = {
        firstSeen: profile.value.firstSeen,
        lastSeen: profile.value.lastSeen,
        transactionCount: profile.value.transactionCount,
        smartMoneyScore: profile.value.smartMoneyScore,
      };
    }

    // Determine wallet type based on labels
    result.walletType = determineWalletType(result.labels || []);
    result.riskLevel = assessRiskLevel(result.labels || [], result.category);

    return result;
  } catch (error: any) {
    console.error('❌ Nansen getWalletIntelligence error:', error);
    throw new Error(`Failed to get wallet intelligence: ${error.message}`);
  }
}

/**
 * Determine wallet type from labels
 */
function determineWalletType(labels: string[]): string {
  const labelLower = labels.map(l => l.toLowerCase());
  
  if (labelLower.some(l => l.includes('exchange'))) return 'Exchange';
  if (labelLower.some(l => l.includes('smart money'))) return 'Smart Money';
  if (labelLower.some(l => l.includes('whale'))) return 'Whale';
  if (labelLower.some(l => l.includes('fund'))) return 'Fund';
  if (labelLower.some(l => l.includes('mev'))) return 'MEV Bot';
  if (labelLower.some(l => l.includes('bridge'))) return 'Bridge';
  if (labelLower.some(l => l.includes('defi'))) return 'DeFi Protocol';
  
  return 'Regular User';
}

/**
 * Assess risk level based on labels and category
 */
function assessRiskLevel(labels: string[], category?: string): string {
  const labelLower = labels.map(l => l.toLowerCase());
  
  // High risk indicators
  if (labelLower.some(l => l.includes('scam') || l.includes('phish') || l.includes('hack'))) {
    return 'HIGH';
  }
  
  // Low risk indicators
  if (labelLower.some(l => l.includes('exchange') || l.includes('verified'))) {
    return 'LOW';
  }
  
  // Medium risk for unknown
  return 'MEDIUM';
}

export default {
  getWalletLabels,
  getWalletTokenHoldings,
  getWalletProfile,
  getWalletIntelligence,
};
