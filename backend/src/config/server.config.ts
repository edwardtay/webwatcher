/**
 * Server configuration
 */

export const serverConfig = {
  port: Number(process.env.PORT) || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  isVercel: process.env.VERCEL === '1',
  
  // API URLs
  agentBaseUrl: 'https://webwatcher.lever-labs.com',
  
  // ZetaChain config
  zetachain: {
    testnetRpc: 'https://zeta-chain-testnet.drpc.org',
    testnetChainId: 7001,
    faucetUrl: 'https://zetachain.faucetme.pro/',
  },
  
  // NFT config
  nftContractAddress: process.env.WEB3BASE_NFT_CONTRACT || '',
};
