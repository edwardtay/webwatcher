/**
 * Pattern Learning System
 * Learns from wallet behavior to detect anomalies
 */

interface WalletPattern {
  address: string;
  avgTransactionValue: number;
  avgTransactionsPerDay: number;
  commonRecipients: string[];
  commonTokens: string[];
  typicalGasPrice: number;
  activeHours: number[]; // Hours of day (0-23)
  lastUpdated: Date;
}

interface AnomalyDetection {
  isAnomaly: boolean;
  anomalyType: string[];
  confidence: number;
  explanation: string;
}

// In-memory storage (would use database in production)
const walletPatterns = new Map<string, WalletPattern>();

/**
 * Learn patterns from wallet transactions
 */
export function learnFromTransactions(address: string, transactions: any[]): WalletPattern {
  if (transactions.length === 0) {
    return {
      address,
      avgTransactionValue: 0,
      avgTransactionsPerDay: 0,
      commonRecipients: [],
      commonTokens: [],
      typicalGasPrice: 0,
      activeHours: [],
      lastUpdated: new Date()
    };
  }
  
  // Calculate average transaction value
  const values = transactions
    .map(tx => parseInt(tx.value || '0', 16) / 1e18)
    .filter(v => v > 0);
  const avgTransactionValue = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : 0;
  
  // Calculate transactions per day
  const timestamps = transactions
    .map(tx => new Date(tx.timestamp || Date.now()))
    .sort((a, b) => a.getTime() - b.getTime());
  
  let avgTransactionsPerDay = 0;
  if (timestamps.length > 1) {
    const daysDiff = (timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()) / (1000 * 60 * 60 * 24);
    avgTransactionsPerDay = daysDiff > 0 ? transactions.length / daysDiff : 0;
  }
  
  // Find common recipients
  const recipientCounts = new Map<string, number>();
  transactions.forEach(tx => {
    if (tx.to) {
      recipientCounts.set(tx.to, (recipientCounts.get(tx.to) || 0) + 1);
    }
  });
  const commonRecipients = Array.from(recipientCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([addr]) => addr);
  
  // Extract active hours
  const hourCounts = new Array(24).fill(0);
  timestamps.forEach(ts => {
    hourCounts[ts.getHours()]++;
  });
  const activeHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(h => h.hour);
  
  const pattern: WalletPattern = {
    address,
    avgTransactionValue,
    avgTransactionsPerDay,
    commonRecipients,
    commonTokens: [],
    typicalGasPrice: 0,
    activeHours,
    lastUpdated: new Date()
  };
  
  walletPatterns.set(address.toLowerCase(), pattern);
  return pattern;
}

/**
 * Detect anomalies in new transaction
 */
export function detectAnomaly(address: string, newTransaction: any): AnomalyDetection {
  const pattern = walletPatterns.get(address.toLowerCase());
  
  if (!pattern) {
    return {
      isAnomaly: false,
      anomalyType: [],
      confidence: 0,
      explanation: 'No historical pattern available for comparison'
    };
  }
  
  const anomalies: string[] = [];
  let anomalyScore = 0;
  
  // Check transaction value
  const txValue = parseInt(newTransaction.value || '0', 16) / 1e18;
  if (txValue > pattern.avgTransactionValue * 5 && pattern.avgTransactionValue > 0) {
    anomalies.push('Unusually large transaction value');
    anomalyScore += 30;
  }
  
  // Check recipient
  if (newTransaction.to && !pattern.commonRecipients.includes(newTransaction.to.toLowerCase())) {
    anomalies.push('New recipient address');
    anomalyScore += 15;
  }
  
  // Check time of day
  const hour = new Date().getHours();
  if (pattern.activeHours.length > 0 && !pattern.activeHours.includes(hour)) {
    anomalies.push('Unusual time of activity');
    anomalyScore += 10;
  }
  
  const isAnomaly = anomalyScore >= 25;
  const confidence = Math.min(anomalyScore / 100, 1);
  
  let explanation = '';
  if (isAnomaly) {
    explanation = `⚠️ This transaction differs from your typical behavior: ${anomalies.join(', ')}. `;
    explanation += 'If you did not initiate this, your wallet may be compromised.';
  } else if (anomalies.length > 0) {
    explanation = `ℹ️ Minor differences detected: ${anomalies.join(', ')}. This is likely normal but worth noting.`;
  } else {
    explanation = '✅ This transaction matches your typical behavior patterns.';
  }
  
  return {
    isAnomaly,
    anomalyType: anomalies,
    confidence,
    explanation
  };
}

/**
 * Get wallet pattern summary
 */
export function getPatternSummary(address: string): string | null {
  const pattern = walletPatterns.get(address.toLowerCase());
  if (!pattern) return null;
  
  const parts: string[] = [];
  parts.push(`**Typical Behavior:**`);
  parts.push(`• Average transaction: ${pattern.avgTransactionValue.toFixed(4)} ETH`);
  parts.push(`• Activity: ${pattern.avgTransactionsPerDay.toFixed(1)} transactions/day`);
  
  if (pattern.commonRecipients.length > 0) {
    parts.push(`• Common recipients: ${pattern.commonRecipients.length} addresses`);
  }
  
  if (pattern.activeHours.length > 0) {
    const hours = pattern.activeHours.sort((a, b) => a - b);
    parts.push(`• Active hours: ${hours[0]}:00 - ${hours[hours.length - 1]}:00`);
  }
  
  return parts.join('\n');
}

export default {
  learnFromTransactions,
  detectAnomaly,
  getPatternSummary
};
