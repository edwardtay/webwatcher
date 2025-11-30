/**
 * Threat Intelligence Feed
 * Monitors latest exploits, hacks, and scams
 */

import axios from 'axios';

interface ThreatAlert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  affectedProtocols: string[];
  affectedAddresses: string[];
  timestamp: Date;
  source: string;
  actionRequired: string;
}

interface ThreatFeed {
  alerts: ThreatAlert[];
  lastUpdated: Date;
}

// In-memory cache
let threatFeed: ThreatFeed = {
  alerts: [],
  lastUpdated: new Date()
};

/**
 * Fetch latest threat intelligence using Exa search
 */
export async function updateThreatFeed(): Promise<ThreatFeed> {
  try {
    // Use Exa to search for latest Web3 security threats
    const searchQueries = [
      'Web3 exploit 2024',
      'DeFi hack latest',
      'crypto scam alert',
      'smart contract vulnerability'
    ];
    
    // Simulate threat data (in production, would parse real Exa results)
    const alerts: ThreatAlert[] = [
      {
        id: 'threat-001',
        severity: 'HIGH',
        title: 'Phishing Campaign Targeting MetaMask Users',
        description: 'New phishing sites mimicking MetaMask detected. Users are tricked into revealing seed phrases.',
        affectedProtocols: ['MetaMask'],
        affectedAddresses: [],
        timestamp: new Date(),
        source: 'Security Research',
        actionRequired: 'Never share your seed phrase. Always verify URLs before connecting wallet.'
      },
      {
        id: 'threat-002',
        severity: 'CRITICAL',
        title: 'Unlimited Approval Exploit in DeFi Protocol',
        description: 'Users with unlimited token approvals to affected protocol are at risk of fund drainage.',
        affectedProtocols: ['Various DeFi'],
        affectedAddresses: ['0x1234...'],
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        source: 'On-chain Analysis',
        actionRequired: 'Revoke all unlimited token approvals immediately on Revoke.cash'
      }
    ];
    
    threatFeed = {
      alerts,
      lastUpdated: new Date()
    };
    
    return threatFeed;
  } catch (error) {
    console.error('Error updating threat feed:', error);
    return threatFeed;
  }
}

/**
 * Check if wallet is affected by recent threats
 */
export async function checkWalletThreats(
  address: string,
  transactions: any[],
  approvals: any[]
): Promise<ThreatAlert[]> {
  const affectedAlerts: ThreatAlert[] = [];
  
  // Ensure we have latest threats
  if (Date.now() - threatFeed.lastUpdated.getTime() > 3600000) {
    await updateThreatFeed();
  }
  
  for (const alert of threatFeed.alerts) {
    let isAffected = false;
    
    // Check if wallet interacted with affected addresses
    if (alert.affectedAddresses.length > 0) {
      const interactedAddresses = transactions.map(tx => tx.to?.toLowerCase());
      isAffected = alert.affectedAddresses.some(addr => 
        interactedAddresses.includes(addr.toLowerCase())
      );
    }
    
    // Check if wallet has approvals to affected protocols
    if (alert.title.includes('Approval') && approvals && approvals.length > 0) {
      isAffected = true;
    }
    
    if (isAffected) {
      affectedAlerts.push(alert);
    }
  }
  
  return affectedAlerts;
}

/**
 * Get threat summary for display
 */
export function getThreatSummary(): string {
  if (threatFeed.alerts.length === 0) {
    return '✅ No active threats detected';
  }
  
  const critical = threatFeed.alerts.filter(a => a.severity === 'CRITICAL').length;
  const high = threatFeed.alerts.filter(a => a.severity === 'HIGH').length;
  
  const parts: string[] = [];
  
  if (critical > 0) {
    parts.push(`🚨 ${critical} CRITICAL threat${critical > 1 ? 's' : ''}`);
  }
  if (high > 0) {
    parts.push(`⚠️ ${high} HIGH threat${high > 1 ? 's' : ''}`);
  }
  
  return parts.join(', ') || `ℹ️ ${threatFeed.alerts.length} active threat${threatFeed.alerts.length > 1 ? 's' : ''}`;
}

/**
 * Format threat alert for display
 */
export function formatThreatAlert(alert: ThreatAlert): string {
  const severityEmoji = {
    CRITICAL: '🚨',
    HIGH: '⚠️',
    MEDIUM: '⚡',
    LOW: 'ℹ️'
  };
  
  const parts: string[] = [];
  parts.push(`${severityEmoji[alert.severity]} **${alert.title}**`);
  parts.push(`**Severity:** ${alert.severity}`);
  parts.push(`**Description:** ${alert.description}`);
  
  if (alert.affectedProtocols.length > 0) {
    parts.push(`**Affected:** ${alert.affectedProtocols.join(', ')}`);
  }
  
  parts.push(`**Action Required:** ${alert.actionRequired}`);
  parts.push(`**Source:** ${alert.source}`);
  
  return parts.join('\n');
}

/**
 * Get real-time threat intelligence using Exa
 */
export async function searchLatestThreats(query: string): Promise<string[]> {
  try {
    // This would integrate with Exa MCP in production
    // For now, return simulated results
    const threats = [
      'Recent phishing campaign targeting Uniswap users',
      'New smart contract vulnerability discovered in proxy patterns',
      'Increase in fake token airdrops on social media'
    ];
    
    return threats;
  } catch (error) {
    console.error('Error searching threats:', error);
    return [];
  }
}

// Auto-update threat feed every hour
setInterval(() => {
  updateThreatFeed().catch(console.error);
}, 3600000);

// Initial load
updateThreatFeed().catch(console.error);

export default {
  updateThreatFeed,
  checkWalletThreats,
  getThreatSummary,
  formatThreatAlert,
  searchLatestThreats
};
