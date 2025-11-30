/**
 * Gitcoin Passport API Integration
 * Provides identity verification and reputation scoring
 * Docs: https://docs.passport.xyz/building-with-passport/stamps/passport-api/introduction
 */

import axios from 'axios';

const PASSPORT_API_KEY = process.env.PASSPORT_API_KEY;
const PASSPORT_BASE_URL = 'https://api.passport.xyz';
const PASSPORT_SCORER_ID = '1'; // Default scorer ID

interface PassportStamp {
  provider: string;
  credential: {
    credentialSubject: {
      id: string;
      provider: string;
      hash: string;
    };
  };
  metadata?: any;
}

interface PassportScore {
  address: string;
  score: string;
  status: string;
  last_score_timestamp: string;
  evidence?: {
    type: string;
    rawScore: string;
    threshold: string;
  };
  stamps?: PassportStamp[];
}

interface PassportAnalysis {
  address: string;
  timestamp: string;
  score: number;
  status: string;
  isHuman: boolean;
  stampCount: number;
  stamps: string[];
  trustLevel: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  verifiedProviders: string[];
}

/**
 * Get Passport score for an address
 */
export async function getPassportScore(address: string, scorerId: string = PASSPORT_SCORER_ID): Promise<PassportScore> {
  try {
    if (!PASSPORT_API_KEY) {
      throw new Error('Passport API key not configured');
    }

    const response = await axios.get(`${PASSPORT_BASE_URL}/registry/score/${scorerId}/${address}`, {
      headers: {
        'X-API-KEY': PASSPORT_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return response.data;
  } catch (error: any) {
    console.error('❌ Passport getPassportScore error:', error.response?.data || error.message);
    
    // Return empty result instead of throwing
    return {
      address,
      score: '0',
      status: 'NONE',
      last_score_timestamp: new Date().toISOString(),
      stamps: [],
    };
  }
}

/**
 * Get Passport stamps for an address
 */
export async function getPassportStamps(address: string): Promise<PassportStamp[]> {
  try {
    if (!PASSPORT_API_KEY) {
      throw new Error('Passport API key not configured');
    }

    const response = await axios.get(`${PASSPORT_BASE_URL}/registry/stamps/${address}`, {
      headers: {
        'X-API-KEY': PASSPORT_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return response.data.items || [];
  } catch (error: any) {
    console.error('❌ Passport getPassportStamps error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get comprehensive Passport analysis
 */
export async function getPassportAnalysis(address: string): Promise<PassportAnalysis> {
  try {
    const [scoreData, stamps] = await Promise.allSettled([
      getPassportScore(address),
      getPassportStamps(address),
    ]);

    const score = scoreData.status === 'fulfilled' ? parseFloat(scoreData.value.score) : 0;
    const stampList = stamps.status === 'fulfilled' ? stamps.value : [];
    const stampCount = stampList.length;

    // Extract provider names from stamps
    const verifiedProviders = stampList.map(stamp => stamp.provider);
    const uniqueProviders = [...new Set(verifiedProviders)];

    // Determine trust level based on score and stamp count
    const trustLevel = determineTrustLevel(score, stampCount);

    // Determine if likely human based on score threshold
    const isHuman = score >= 15; // Gitcoin's typical human threshold

    return {
      address,
      timestamp: new Date().toISOString(),
      score,
      status: scoreData.status === 'fulfilled' ? scoreData.value.status : 'NONE',
      isHuman,
      stampCount,
      stamps: uniqueProviders,
      trustLevel,
      verifiedProviders: uniqueProviders,
    };
  } catch (error: any) {
    console.error('❌ Passport getPassportAnalysis error:', error);
    throw new Error(`Failed to get Passport analysis: ${error.message}`);
  }
}

/**
 * Determine trust level based on score and stamp count
 */
function determineTrustLevel(score: number, stampCount: number): 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' {
  // High score and many stamps = very high trust
  if (score >= 50 && stampCount >= 10) return 'VERY_HIGH';
  if (score >= 30 && stampCount >= 5) return 'HIGH';
  if (score >= 15 && stampCount >= 3) return 'MEDIUM';
  if (score >= 5 && stampCount >= 1) return 'LOW';
  return 'VERY_LOW';
}

/**
 * Get human-readable trust description
 */
export function getTrustDescription(trustLevel: string): string {
  switch (trustLevel) {
    case 'VERY_HIGH':
      return 'Highly verified identity with multiple credentials';
    case 'HIGH':
      return 'Well-verified identity with good credentials';
    case 'MEDIUM':
      return 'Moderately verified identity';
    case 'LOW':
      return 'Limited verification';
    case 'VERY_LOW':
      return 'Minimal or no verification';
    default:
      return 'Unknown verification status';
  }
}

export default {
  getPassportScore,
  getPassportStamps,
  getPassportAnalysis,
  getTrustDescription,
};
