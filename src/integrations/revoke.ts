import fetch from 'node-fetch';

// Revoke.cash uses on-chain data, no API key needed
// We'll use their open-source logic to check approvals

interface TokenApproval {
  spender: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  allowance: string;
  lastUpdated: number;
  chainId: number;
}

interface RevokeAnalysis {
  address: string;
  chainId: number;
  totalApprovals: number;
  riskyApprovals: number;
  approvals: Array<{
    token: string;
    tokenSymbol: string;
    spender: string;
    spenderName?: string;
    allowance: string;
    isUnlimited: boolean;
    riskLevel: 'high' | 'medium' | 'low';
    reason: string;
    revokeUrl: string;
  }>;
  recommendations: string[];
}

// Known risky spenders (exploited contracts, deprecated protocols)
const KNOWN_RISKY_SPENDERS = new Set([
  // Add known exploited contracts here
  '0x0000000000000000000000000000000000000000',
]);

// Known safe protocols (major DEXs, lending protocols)
const KNOWN_SAFE_PROTOCOLS: { [key: string]: string } = {
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap Universal Router',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch V5 Router',
};

export async function getTokenApprovals(address: string, chainId: number = 1): Promise<TokenApproval[]> {
  try {
    // Use Alchemy or other RPC to get approval events
    // For now, we'll use a simplified approach with common patterns
    
    // In production, you would:
    // 1. Query approval events from the blockchain
    // 2. Get current allowances for each spender
    // 3. Filter out revoked (zero) allowances
    
    // Placeholder - in real implementation, query blockchain
    return [];
  } catch (error: any) {
    console.error('❌ Error fetching token approvals:', error);
    throw new Error(`Failed to fetch token approvals: ${error.message}`);
  }
}

export async function analyzeApprovals(address: string, chainId: number = 1): Promise<RevokeAnalysis> {
  try {
    const approvals = await getTokenApprovals(address, chainId);
    
    const analysis: RevokeAnalysis = {
      address,
      chainId,
      totalApprovals: approvals.length,
      riskyApprovals: 0,
      approvals: [],
      recommendations: [],
    };

    // Analyze each approval
    for (const approval of approvals) {
      const isUnlimited = approval.allowance === '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // max uint256
      
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      let reason = 'Standard approval';
      
      // Check if spender is known risky
      if (KNOWN_RISKY_SPENDERS.has(approval.spender.toLowerCase())) {
        riskLevel = 'high';
        reason = '⚠️ Known exploited contract - REVOKE IMMEDIATELY';
        analysis.riskyApprovals++;
      }
      // Check if unlimited approval to unknown contract
      else if (isUnlimited && !KNOWN_SAFE_PROTOCOLS[approval.spender.toLowerCase()]) {
        riskLevel = 'high';
        reason = '⚠️ Unlimited approval to unknown contract';
        analysis.riskyApprovals++;
      }
      // Check if old approval (> 1 year)
      else if (Date.now() - approval.lastUpdated > 365 * 24 * 60 * 60 * 1000) {
        riskLevel = 'medium';
        reason = '⚠️ Old approval (>1 year) - consider revoking';
      }
      // Unlimited approval to known protocol
      else if (isUnlimited) {
        riskLevel = 'medium';
        reason = 'Unlimited approval to known protocol';
      }

      const spenderName = KNOWN_SAFE_PROTOCOLS[approval.spender.toLowerCase()] || 'Unknown Contract';
      
      analysis.approvals.push({
        token: approval.token.address,
        tokenSymbol: approval.token.symbol,
        spender: approval.spender,
        spenderName,
        allowance: approval.allowance,
        isUnlimited,
        riskLevel,
        reason,
        revokeUrl: `https://revoke.cash/address/${address}?chainId=${chainId}`,
      });
    }

    // Generate recommendations
    if (analysis.riskyApprovals > 0) {
      analysis.recommendations.push(`🚨 You have ${analysis.riskyApprovals} high-risk approvals that should be revoked immediately`);
      analysis.recommendations.push('Visit revoke.cash to revoke dangerous approvals');
    }
    
    if (analysis.totalApprovals > 10) {
      analysis.recommendations.push('💡 Consider revoking unused approvals to reduce attack surface');
    }
    
    const unlimitedApprovals = analysis.approvals.filter(a => a.isUnlimited).length;
    if (unlimitedApprovals > 5) {
      analysis.recommendations.push(`⚠️ You have ${unlimitedApprovals} unlimited approvals - consider limiting them`);
    }

    return analysis;
  } catch (error: any) {
    console.error('❌ Error analyzing approvals:', error);
    throw new Error(`Failed to analyze approvals: ${error.message}`);
  }
}

// Simplified version using Revoke.cash's approach
export async function getApprovalSummary(address: string, chainId: number = 1) {
  try {
    // This is a simplified implementation
    // In production, you would query blockchain events and current allowances
    
    const summary = {
      address,
      chainId,
      hasRiskyApprovals: false,
      totalApprovals: 0,
      unlimitedApprovals: 0,
      oldApprovals: 0,
      revokeUrl: `https://revoke.cash/address/${address}?chainId=${chainId}`,
      message: 'Check your token approvals on Revoke.cash to ensure your funds are safe',
      recommendations: [
        '🔍 Review all token approvals regularly',
        '⚠️ Revoke approvals to contracts you no longer use',
        '💡 Avoid unlimited approvals when possible',
        '🛡️ Use Revoke.cash to manage your approvals',
      ],
    };

    return summary;
  } catch (error: any) {
    console.error('❌ Error getting approval summary:', error);
    throw new Error(`Failed to get approval summary: ${error.message}`);
  }
}

// Get critical security recommendations
export function getSecurityRecommendations(address: string, chainId: number = 1) {
  return {
    address,
    chainId,
    revokeUrl: `https://revoke.cash/address/${address}?chainId=${chainId}`,
    criticalActions: [
      {
        priority: 'HIGH',
        action: 'Check Token Approvals',
        description: 'Review and revoke unnecessary token approvals that could drain your funds',
        url: `https://revoke.cash/address/${address}?chainId=${chainId}`,
        icon: '🔐',
      },
      {
        priority: 'HIGH',
        action: 'Revoke Unlimited Approvals',
        description: 'Unlimited approvals give contracts full access to your tokens',
        url: `https://revoke.cash/address/${address}?chainId=${chainId}`,
        icon: '⚠️',
      },
      {
        priority: 'MEDIUM',
        action: 'Remove Old Approvals',
        description: 'Revoke approvals to contracts you no longer use',
        url: `https://revoke.cash/address/${address}?chainId=${chainId}`,
        icon: '🧹',
      },
      {
        priority: 'MEDIUM',
        action: 'Regular Security Audits',
        description: 'Check your approvals monthly to maintain security',
        url: `https://revoke.cash/address/${address}?chainId=${chainId}`,
        icon: '📅',
      },
    ],
    educationalLinks: [
      {
        title: 'What are Token Approvals?',
        url: 'https://revoke.cash/learn/approvals/what-are-token-approvals',
      },
      {
        title: 'How to Revoke Approvals',
        url: 'https://revoke.cash/learn/approvals/how-to-revoke-token-approvals',
      },
      {
        title: 'Staying Safe in Web3',
        url: 'https://revoke.cash/learn/security',
      },
    ],
  };
}
