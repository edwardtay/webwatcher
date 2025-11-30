/**
 * MetaSleuth API Integration
 * Provides address labels and risk scoring for blockchain addresses
 * Docs: https://metasleuth.io/
 */

import axios from 'axios';

const METASLEUTH_LABEL_API_KEY = process.env.METASLEUTH_LABEL_API_KEY;
const METASLEUTH_RISK_API_KEY = process.env.METASLEUTH_RISK_API_KEY;
const METASLEUTH_BASE_URL = 'https://api.metasleuth.io';

interface MetaSleuthLabel {
  address: string;
  labels: string[];
  entity?: string;
  category?: string;
  tags?: string[];
}

interface MetaSleuthRiskScore {
  address: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  details?: {
    mixerInteraction?: boolean;
    sanctionedEntity?: boolean;
    phishingRelated?: boolean;
    scamRelated?: boolean;
    stolenFunds?: boolean;
  };
}

interface MetaSleuthAnalysis {
  address: string;
  timestamp: string;
  labels: string[];
  entity?: string;
  category?: string;
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
  tags?: string[];
}

/**
 * Get address labels from MetaSleuth
 */
export async function getAddressLabels(address: string, chain: string = 'ethereum'): Promise<MetaSleuthLabel> {
  try {
    if (!METASLEUTH_LABEL_API_KEY) {
      throw new Error('MetaSleuth Label API key not configured');
    }

    const response = await axios.get(`${METASLEUTH_BASE_URL}/v1/address/labels`, {
      headers: {
        'X-API-KEY': METASLEUTH_LABEL_API_KEY,
        'Accept': 'application/json',
      },
      params: {
        address,
        chain,
      },
      timeout: 10000,
    });

    return {
      address,
      labels: response.data.labels || [],
      entity: response.data.entity,
      category: response.data.category,
      tags: response.data.tags || [],
    };
  } catch (error: any) {
    console.error('❌ MetaSleuth getAddressLabels error:', error.response?.data || error.message);
    
    // Return empty result instead of throwing
    return {
      address,
      labels: [],
      tags: [],
    };
  }
}

/**
 * Get risk score for an address
 */
export async function getRiskScore(address: string, chain: string = 'ethereum'): Promise<MetaSleuthRiskScore> {
  try {
    if (!METASLEUTH_RISK_API_KEY) {
      throw new Error('MetaSleuth Risk API key not configured');
    }

    const response = await axios.get(`${METASLEUTH_BASE_URL}/v1/address/risk`, {
      headers: {
        'X-API-KEY': METASLEUTH_RISK_API_KEY,
        'Accept': 'application/json',
      },
      params: {
        address,
        chain,
      },
      timeout: 10000,
    });

    const riskScore = response.data.riskScore || 0;
    const riskLevel = determineRiskLevel(riskScore);
    const riskFactors = extractRiskFactors(response.data);

    return {
      address,
      riskScore,
      riskLevel,
      riskFactors,
      details: {
        mixerInteraction: response.data.mixerInteraction || false,
        sanctionedEntity: response.data.sanctionedEntity || false,
        phishingRelated: response.data.phishingRelated || false,
        scamRelated: response.data.scamRelated || false,
        stolenFunds: response.data.stolenFunds || false,
      },
    };
  } catch (error: any) {
    console.error('❌ MetaSleuth getRiskScore error:', error.response?.data || error.message);
    
    // Return safe default instead of throwing
    return {
      address,
      riskScore: 0,
      riskLevel: 'LOW',
      riskFactors: [],
    };
  }
}

/**
 * Get comprehensive analysis combining labels and risk score
 */
export async function getComprehensiveAnalysis(address: string, chain: string = 'ethereum'): Promise<MetaSleuthAnalysis> {
  try {
    const [labels, riskScore] = await Promise.allSettled([
      getAddressLabels(address, chain),
      getRiskScore(address, chain),
    ]);

    const result: MetaSleuthAnalysis = {
      address,
      timestamp: new Date().toISOString(),
      labels: [],
      riskScore: 0,
      riskLevel: 'LOW',
      riskFactors: [],
    };

    if (labels.status === 'fulfilled') {
      result.labels = labels.value.labels;
      result.entity = labels.value.entity;
      result.category = labels.value.category;
      result.tags = labels.value.tags;
    }

    if (riskScore.status === 'fulfilled') {
      result.riskScore = riskScore.value.riskScore;
      result.riskLevel = riskScore.value.riskLevel;
      result.riskFactors = riskScore.value.riskFactors;
    }

    return result;
  } catch (error: any) {
    console.error('❌ MetaSleuth getComprehensiveAnalysis error:', error);
    throw new Error(`Failed to get comprehensive analysis: ${error.message}`);
  }
}

/**
 * Determine risk level from score (0-100)
 */
function determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Extract risk factors from API response
 */
function extractRiskFactors(data: any): string[] {
  const factors: string[] = [];

  if (data.mixerInteraction) factors.push('Mixer Interaction Detected');
  if (data.sanctionedEntity) factors.push('Sanctioned Entity');
  if (data.phishingRelated) factors.push('Phishing Related');
  if (data.scamRelated) factors.push('Scam Related');
  if (data.stolenFunds) factors.push('Stolen Funds');
  if (data.highRiskCounterparties) factors.push('High Risk Counterparties');
  if (data.suspiciousActivity) factors.push('Suspicious Activity');

  return factors;
}

export default {
  getAddressLabels,
  getRiskScore,
  getComprehensiveAnalysis,
};
