/**
 * Tenderly Transaction Simulation
 * Simulates transactions to show exact outcomes before signing
 * Docs: https://docs.tenderly.co/simulations-and-forks/simulation-api
 */

import axios from 'axios';

const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY || '';
const TENDERLY_ACCOUNT = process.env.TENDERLY_ACCOUNT || 'web3base';
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT || 'security';
const TENDERLY_API_URL = 'https://api.tenderly.co/api/v1';

interface SimulationRequest {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gas?: number;
  gasPrice?: string;
  chainId?: number;
}

interface TokenTransfer {
  from: string;
  to: string;
  token: string;
  amount: string;
  symbol?: string;
  decimals?: number;
}

interface SimulationResult {
  success: boolean;
  gasUsed: number;
  gasPrice: string;
  totalCost: string;
  balanceChanges: Array<{
    address: string;
    before: string;
    after: string;
    delta: string;
    token?: string;
  }>;
  tokenTransfers: TokenTransfer[];
  logs: any[];
  error?: string;
  revertReason?: string;
  warnings: string[];
  explanation: string;
}

/**
 * Simulate transaction using Tenderly
 */
export async function simulateTransaction(tx: SimulationRequest): Promise<SimulationResult> {
  try {
    if (!TENDERLY_ACCESS_KEY) {
      // Fallback to basic analysis if Tenderly not configured
      return simulateBasic(tx);
    }

    const response = await axios.post(
      `${TENDERLY_API_URL}/account/${TENDERLY_ACCOUNT}/project/${TENDERLY_PROJECT}/simulate`,
      {
        network_id: tx.chainId?.toString() || '1',
        from: tx.from,
        to: tx.to,
        input: tx.data || '0x',
        value: tx.value || '0',
        gas: tx.gas || 21000,
        gas_price: tx.gasPrice || '0',
        save: false,
        save_if_fails: false,
        simulation_type: 'quick'
      },
      {
        headers: {
          'X-Access-Key': TENDERLY_ACCESS_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const simulation = response.data.transaction;
    
    // Parse balance changes
    const balanceChanges = parseBalanceChanges(simulation);
    
    // Parse token transfers
    const tokenTransfers = parseTokenTransfers(simulation);
    
    // Generate warnings
    const warnings = generateWarnings(simulation, balanceChanges, tokenTransfers);
    
    // Generate explanation
    const explanation = generateExplanation(tx, simulation, balanceChanges, tokenTransfers);
    
    // Calculate total cost
    const gasUsed = simulation.gas_used || 0;
    const gasPrice = simulation.gas_price || '0';
    const totalCost = (BigInt(gasUsed) * BigInt(gasPrice) / BigInt(1e18)).toString();

    return {
      success: simulation.status,
      gasUsed,
      gasPrice,
      totalCost,
      balanceChanges,
      tokenTransfers,
      logs: simulation.logs || [],
      error: simulation.error_message,
      revertReason: simulation.error_info?.error_message,
      warnings,
      explanation
    };
  } catch (error: any) {
    console.error('❌ Tenderly simulation error:', error.response?.data || error.message);
    
    // Fallback to basic analysis
    return simulateBasic(tx);
  }
}

/**
 * Basic simulation fallback (when Tenderly unavailable)
 */
function simulateBasic(tx: SimulationRequest): SimulationResult {
  const warnings: string[] = [];
  
  // Check value
  const value = tx.value ? BigInt(tx.value) : BigInt(0);
  if (value > BigInt(1e18)) {
    warnings.push('⚠️ Large ETH transfer detected');
  }
  
  // Check if contract interaction
  if (tx.data && tx.data !== '0x') {
    warnings.push('📜 Smart contract interaction');
    
    // Check for approval
    if (tx.data.startsWith('0x095ea7b3')) {
      warnings.push('🔐 Token approval - grants spending permission');
    }
  }
  
  const explanation = generateBasicExplanation(tx, warnings);
  
  return {
    success: true,
    gasUsed: 21000,
    gasPrice: '0',
    totalCost: '0',
    balanceChanges: [],
    tokenTransfers: [],
    logs: [],
    warnings,
    explanation
  };
}

/**
 * Parse balance changes from simulation
 */
function parseBalanceChanges(simulation: any): any[] {
  const changes: any[] = [];
  
  if (simulation.balance_diff) {
    for (const [address, diff] of Object.entries(simulation.balance_diff)) {
      if (diff && typeof diff === 'object' && 'original' in diff && 'dirty' in diff) {
        const diffObj = diff as { original?: string | number; dirty?: string | number };
        const original = BigInt(diffObj.original || 0);
        const dirty = BigInt(diffObj.dirty || 0);
        const delta = dirty - original;
        
        if (delta !== BigInt(0)) {
          changes.push({
            address,
            before: original.toString(),
            after: dirty.toString(),
            delta: delta.toString()
          });
        }
      }
    }
  }
  
  return changes;
}

/**
 * Parse token transfers from logs
 */
function parseTokenTransfers(simulation: any): TokenTransfer[] {
  const transfers: TokenTransfer[] = [];
  
  if (simulation.logs) {
    for (const log of simulation.logs) {
      // ERC20 Transfer event signature
      if (log.topics && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        transfers.push({
          from: '0x' + log.topics[1]?.slice(-40),
          to: '0x' + log.topics[2]?.slice(-40),
          token: log.address,
          amount: log.data
        });
      }
    }
  }
  
  return transfers;
}

/**
 * Generate warnings from simulation
 */
function generateWarnings(simulation: any, balanceChanges: any[], tokenTransfers: TokenTransfer[]): string[] {
  const warnings: string[] = [];
  
  // Check if transaction will fail
  if (!simulation.status) {
    warnings.push('🚨 CRITICAL: Transaction will FAIL');
    if (simulation.error_message) {
      warnings.push(`Error: ${simulation.error_message}`);
    }
  }
  
  // Check for large balance changes
  for (const change of balanceChanges) {
    const delta = BigInt(change.delta);
    if (delta < BigInt(0) && delta < BigInt(-1e18)) {
      const ethAmount = (Number(delta) / 1e18).toFixed(4);
      warnings.push(`⚠️ You will lose ${Math.abs(Number(ethAmount))} ETH`);
    }
  }
  
  // Check for token transfers
  if (tokenTransfers.length > 0) {
    warnings.push(`🔄 ${tokenTransfers.length} token transfer(s) will occur`);
  }
  
  // Check gas cost
  if (simulation.gas_used > 500000) {
    warnings.push('⛽ High gas usage - transaction is expensive');
  }
  
  return warnings;
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(
  tx: SimulationRequest,
  simulation: any,
  balanceChanges: any[],
  tokenTransfers: TokenTransfer[]
): string {
  const parts: string[] = [];
  
  // Transaction outcome
  if (simulation.status) {
    parts.push('✅ **Transaction will succeed**');
  } else {
    parts.push('🚨 **Transaction will FAIL** - Do not sign!');
    if (simulation.error_message) {
      parts.push(`**Reason:** ${simulation.error_message}`);
    }
    return parts.join('\n');
  }
  
  // What will happen
  parts.push('\n**What will happen:**');
  
  // ETH transfers
  const userChange = balanceChanges.find(c => c.address.toLowerCase() === tx.from.toLowerCase());
  if (userChange) {
    const delta = BigInt(userChange.delta);
    if (delta < BigInt(0)) {
      const ethAmount = (Number(delta) / -1e18).toFixed(6);
      parts.push(`• You will send ${ethAmount} ETH`);
    } else if (delta > BigInt(0)) {
      const ethAmount = (Number(delta) / 1e18).toFixed(6);
      parts.push(`• You will receive ${ethAmount} ETH`);
    }
  }
  
  // Token transfers
  if (tokenTransfers.length > 0) {
    parts.push(`• ${tokenTransfers.length} token(s) will be transferred`);
    tokenTransfers.slice(0, 3).forEach(transfer => {
      const fromYou = transfer.from.toLowerCase() === tx.from.toLowerCase();
      const toYou = transfer.to.toLowerCase() === tx.from.toLowerCase();
      
      if (fromYou) {
        parts.push(`  - You will send tokens to ${transfer.to.slice(0, 6)}...`);
      } else if (toYou) {
        parts.push(`  - You will receive tokens from ${transfer.from.slice(0, 6)}...`);
      }
    });
  }
  
  // Gas cost
  const gasUsed = simulation.gas_used || 0;
  const gasPrice = BigInt(simulation.gas_price || '0');
  const gasCost = (Number(BigInt(gasUsed) * gasPrice) / 1e18).toFixed(6);
  parts.push(`• Gas cost: ~${gasCost} ETH`);
  
  return parts.join('\n');
}

/**
 * Generate basic explanation (fallback)
 */
function generateBasicExplanation(tx: SimulationRequest, warnings: string[]): string {
  const parts: string[] = [];
  
  parts.push('**Transaction Preview:**');
  parts.push(`• From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`);
  parts.push(`• To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`);
  
  if (tx.value && BigInt(tx.value) > BigInt(0)) {
    const ethValue = (Number(BigInt(tx.value)) / 1e18).toFixed(6);
    parts.push(`• Value: ${ethValue} ETH`);
  }
  
  if (tx.data && tx.data !== '0x') {
    parts.push(`• Type: Smart contract interaction`);
  } else {
    parts.push(`• Type: Simple ETH transfer`);
  }
  
  if (warnings.length > 0) {
    parts.push('\n**Warnings:**');
    warnings.forEach(w => parts.push(`• ${w}`));
  }
  
  return parts.join('\n');
}

export default {
  simulateTransaction
};
