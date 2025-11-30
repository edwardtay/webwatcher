/**
 * ENS (Ethereum Name Service) Resolver
 * Resolves .eth domains to wallet addresses using public APIs
 */

import { logger } from "./logger";

export async function resolveENS(ensDomain: string): Promise<string | null> {
  try {
    logger.info(`[ENS] Resolving ${ensDomain}...`);
    
    const normalizedName = ensDomain.toLowerCase().trim();
    
    // Method 1: Alchemy (if API key available)
    const alchemyKey = process.env.ALCHEMY_API_KEY;
    if (alchemyKey) {
      try {
        const response = await fetch(
          `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
                data: '0x0178b8bf' + normalizedName.split('.')[0].padEnd(64, '0'),
              }, 'latest'],
              id: 1,
            }),
          }
        );
        
        if (response.ok) {
          const data = await response.json() as { result?: string };
          if (data.result?.startsWith('0x') && data.result.length === 42) {
            logger.info(`[ENS] Resolved ${ensDomain} -> ${data.result} (via Alchemy)`);
            return data.result;
          }
        }
      } catch (error) {
        logger.debug(`[ENS] Alchemy resolution failed:`, error);
      }
    }
    
    // Method 2: ENS.domains API (public)
    try {
      const response = await fetch(`https://api.ensideas.com/ens/resolve/${normalizedName}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as { address?: string };
        if (data.address?.startsWith('0x') && data.address.length === 42) {
          logger.info(`[ENS] Resolved ${ensDomain} -> ${data.address} (via ENS API)`);
          return data.address;
        }
      }
    } catch (error) {
      logger.debug(`[ENS] ENS API resolution failed:`, error);
    }
    
    // Method 3: Web3.bio API (public)
    try {
      const response = await fetch(`https://api.web3.bio/profile/ens/${normalizedName}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as { address?: string; ethereum?: { address?: string } };
        const address = data.address || data.ethereum?.address;
        if (address?.startsWith('0x') && address.length === 42) {
          logger.info(`[ENS] Resolved ${ensDomain} -> ${address} (via Web3.bio)`);
          return address;
        }
      }
    } catch (error) {
      logger.debug(`[ENS] Web3.bio resolution failed:`, error);
    }
    
    logger.warn(`[ENS] Could not resolve ${ensDomain} using any method`);
    return null;
  } catch (error) {
    logger.error(`[ENS] Error resolving ${ensDomain}:`, error);
    return null;
  }
}

export function isValidENS(domain: string): boolean {
  return /^[a-zA-Z0-9-]+\.eth$/i.test(domain);
}

