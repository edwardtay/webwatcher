/**
 * Agent configuration
 */

export const agentConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.3,
  
  // Network config
  defaultNetwork: process.env.NETWORK_ID || 'base-sepolia',
  
  // CDP Wallet config
  cdp: {
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
    address: process.env.ADDRESS as `0x${string}` | undefined,
    rpcUrl: process.env.RPC_URL,
  },
  
  // Monitoring config
  monitoringIntervalSeconds: parseInt(process.env.MONITORING_INTERVAL_SECONDS || '30', 10) || 30,
};
