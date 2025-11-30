import fetch from 'node-fetch';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'YW5BmhSi06qeoylw_QkK8KT4js_gs4Cg';
const ALCHEMY_BASE_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error?: string;
}

interface AlchemyNFT {
  contract: {
    address: string;
    name?: string;
    symbol?: string;
    totalSupply?: string;
    tokenType: string;
  };
  tokenId: string;
  tokenType: string;
  title?: string;
  description?: string;
  media?: Array<{ gateway: string }>;
  metadata?: any;
}

export async function getTokenBalances(address: string) {
  try {
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [address],
        id: 1,
      }),
    });

    const data: any = await response.json();
    return data.result || { tokenBalances: [] };
  } catch (error: any) {
    console.error('❌ Alchemy getTokenBalances error:', error);
    throw new Error(`Failed to fetch token balances: ${error.message}`);
  }
}

export async function getTokenMetadata(contractAddress: string) {
  try {
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [contractAddress],
        id: 1,
      }),
    });

    const data: any = await response.json();
    return data.result || {};
  } catch (error: any) {
    console.error('❌ Alchemy getTokenMetadata error:', error);
    return {};
  }
}

export async function getNFTs(address: string) {
  try {
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getNFTs',
        params: [address],
        id: 1,
      }),
    });

    const data: any = await response.json();
    return data.result || { ownedNfts: [], totalCount: 0 };
  } catch (error: any) {
    console.error('❌ Alchemy getNFTs error:', error);
    throw new Error(`Failed to fetch NFTs: ${error.message}`);
  }
}

export async function getAssetTransfers(address: string, category: string[] = ['external', 'internal', 'erc20', 'erc721', 'erc1155']) {
  try {
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x0',
          toAddress: address,
          category,
          maxCount: '0x14', // 20 transfers
          excludeZeroValue: true,
        }],
        id: 1,
      }),
    });

    const data: any = await response.json();
    return data.result?.transfers || [];
  } catch (error: any) {
    console.error('❌ Alchemy getAssetTransfers error:', error);
    throw new Error(`Failed to fetch asset transfers: ${error.message}`);
  }
}

export async function getTransactionReceipts(txHashes: string[]) {
  try {
    const receipts = await Promise.all(
      txHashes.map(async (hash) => {
        const response = await fetch(ALCHEMY_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [hash],
            id: 1,
          }),
        });
        const data: any = await response.json();
        return data.result;
      })
    );
    return receipts.filter(r => r !== null);
  } catch (error: any) {
    console.error('❌ Alchemy getTransactionReceipts error:', error);
    return [];
  }
}

export async function getBalance(address: string) {
  try {
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    });

    const data: any = await response.json();
    return data.result || '0x0';
  } catch (error: any) {
    console.error('❌ Alchemy getBalance error:', error);
    throw new Error(`Failed to fetch balance: ${error.message}`);
  }
}

export async function getTransactionCount(address: string) {
  try {
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: [address, 'latest'],
        id: 1,
      }),
    });

    const data: any = await response.json();
    return parseInt(data.result || '0x0', 16);
  } catch (error: any) {
    console.error('❌ Alchemy getTransactionCount error:', error);
    return 0;
  }
}

export async function getComprehensiveWalletMetrics(address: string) {
  try {
    // Fetch all data in parallel
    const [
      balance,
      txCount,
      tokenBalances,
      nfts,
      assetTransfers,
    ] = await Promise.allSettled([
      getBalance(address),
      getTransactionCount(address),
      getTokenBalances(address),
      getNFTs(address),
      getAssetTransfers(address),
    ]);

    const result: any = {
      address,
      timestamp: new Date().toISOString(),
    };

    // Process balance
    if (balance.status === 'fulfilled') {
      const balanceWei = parseInt(balance.value, 16);
      result.ethBalance = (balanceWei / 1e18).toFixed(6);
      result.ethBalanceWei = balanceWei.toString();
    }

    // Process transaction count
    if (txCount.status === 'fulfilled') {
      result.transactionCount = txCount.value;
    }

    // Process token balances with metadata
    if (tokenBalances.status === 'fulfilled') {
      const tokens = tokenBalances.value.tokenBalances || [];
      const nonZeroTokens = tokens.filter((t: any) => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000');
      
      // Fetch metadata for top tokens
      const tokensWithMetadata = await Promise.all(
        nonZeroTokens.slice(0, 10).map(async (token: any) => {
          const metadata = await getTokenMetadata(token.contractAddress);
          return {
            ...token,
            metadata,
          };
        })
      );

      result.tokens = tokensWithMetadata;
      result.tokenCount = nonZeroTokens.length;
    }

    // Process NFTs
    if (nfts.status === 'fulfilled') {
      result.nfts = nfts.value.ownedNfts || [];
      result.nftCount = nfts.value.totalCount || 0;
      
      // Group by collection
      const collections = new Map();
      result.nfts.forEach((nft: AlchemyNFT) => {
        const collectionName = nft.contract.name || nft.contract.address;
        if (!collections.has(collectionName)) {
          collections.set(collectionName, {
            name: collectionName,
            address: nft.contract.address,
            count: 0,
            tokenType: nft.contract.tokenType,
          });
        }
        collections.get(collectionName).count++;
      });
      result.nftCollections = Array.from(collections.values());
    }

    // Process asset transfers
    if (assetTransfers.status === 'fulfilled') {
      result.recentTransfers = assetTransfers.value;
      result.transferCount = assetTransfers.value.length;
      
      // Analyze transfer patterns
      const transferTypes = assetTransfers.value.reduce((acc: any, transfer: any) => {
        acc[transfer.category] = (acc[transfer.category] || 0) + 1;
        return acc;
      }, {});
      result.transferTypeBreakdown = transferTypes;
    }

    // Calculate activity score
    result.activityScore = calculateActivityScore(result);

    return result;
  } catch (error: any) {
    console.error('❌ Alchemy getComprehensiveWalletMetrics error:', error);
    throw new Error(`Failed to fetch comprehensive wallet metrics: ${error.message}`);
  }
}

function calculateActivityScore(metrics: any): number {
  let score = 0;
  
  // Transaction count (max 30 points)
  score += Math.min((metrics.transactionCount || 0) / 10, 30);
  
  // Token diversity (max 25 points)
  score += Math.min((metrics.tokenCount || 0) * 2.5, 25);
  
  // NFT holdings (max 25 points)
  score += Math.min((metrics.nftCount || 0) * 2.5, 25);
  
  // Recent activity (max 20 points)
  score += Math.min((metrics.transferCount || 0) * 2, 20);
  
  return Math.round(score);
}
