import fetch from 'node-fetch';

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || 'Pf49YFlEcKmm9ny7Uysut5fj9WPRZmoC9LKwFPOkvnu3OZuQBCQVoVF5e0vGbQkBjcLeN0DMVeRmRPlDNpgq4A';
const THIRDWEB_BASE_URL = 'https://api.thirdweb.com/v1';

interface ThirdwebToken {
  chainId: number;
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceUSD: string;
  priceUSD: string;
  logo?: string;
  thumbnail?: string;
  type: 'native' | 'erc20';
}

interface ThirdwebNFT {
  chainId: number;
  tokenAddress: string;
  tokenId: string;
  owner: string;
  type: 'ERC721' | 'ERC1155';
  supply: string;
  metadata: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: any }>;
  };
}

export async function getWalletTokens(address: string, chainId: number = 1) {
  try {
    const params = new URLSearchParams();
    params.append('chainId', chainId.toString());
    
    const url = `${THIRDWEB_BASE_URL}/wallets/${address}/tokens?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-secret-key': THIRDWEB_SECRET_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Thirdweb API error response:', errorText);
      throw new Error(`Thirdweb API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    // Thirdweb returns: { result: { tokens: [...], pagination: {...} } }
    return data.result?.tokens || data.tokens || [];
  } catch (error: any) {
    console.error('❌ Thirdweb getWalletTokens error:', error);
    throw new Error(`Failed to fetch wallet tokens: ${error.message}`);
  }
}

export async function getWalletNFTs(address: string, chainId: number = 1, limit: number = 50) {
  try {
    const params = new URLSearchParams();
    params.append('chainId', chainId.toString());
    params.append('limit', limit.toString());
    
    const url = `${THIRDWEB_BASE_URL}/wallets/${address}/nfts?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-secret-key': THIRDWEB_SECRET_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Thirdweb API error: ${response.status}`);
    }

    const data: any = await response.json();
    // Thirdweb returns: { result: { nfts: [...], pagination: {...} } }
    return data.result?.nfts || data.nfts || [];
  } catch (error: any) {
    console.error('❌ Thirdweb getWalletNFTs error:', error);
    throw new Error(`Failed to fetch wallet NFTs: ${error.message}`);
  }
}

export async function getWalletPortfolio(address: string) {
  try {
    // Fetch tokens and NFTs in parallel
    const [tokens, nfts] = await Promise.allSettled([
      getWalletTokens(address),
      getWalletNFTs(address),
    ]);

    const result: any = {
      address,
      timestamp: new Date().toISOString(),
    };

    // Process tokens
    if (tokens.status === 'fulfilled') {
      const tokenList = Array.isArray(tokens.value) ? tokens.value : [];
      result.tokens = tokenList;
      result.tokenCount = tokenList.length;

      // Calculate total portfolio value
      // Thirdweb returns price_data.usd_value for the total USD value of the balance
      const totalValueUSD = tokenList.reduce((sum, token: any) => {
        const usdValue = token.price_data?.usd_value || 0;
        return sum + parseFloat(usdValue.toString());
      }, 0);
      result.totalValueUSD = totalValueUSD.toFixed(2);

      // Group by chain
      const chainBreakdown = tokenList.reduce((acc: any, token) => {
        const chainId = token.chainId;
        if (!acc[chainId]) {
          acc[chainId] = {
            chainId,
            tokens: [],
            totalValueUSD: 0,
          };
        }
        acc[chainId].tokens.push(token);
        const usdValue = token.price_data?.usd_value || 0;
        acc[chainId].totalValueUSD += parseFloat(usdValue.toString());
        return acc;
      }, {});
      result.chainBreakdown = Object.values(chainBreakdown);

      // Top tokens by value
      result.topTokens = tokenList
        .sort((a: any, b: any) => {
          const aValue = a.price_data?.usd_value || 0;
          const bValue = b.price_data?.usd_value || 0;
          return parseFloat(bValue.toString()) - parseFloat(aValue.toString());
        })
        .slice(0, 10);

      // Native vs ERC20 breakdown
      // Thirdweb uses token_address 0xeeee... for native tokens
      const nativeTokens = tokenList.filter((t: any) => t.token_address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      const erc20Tokens = tokenList.filter((t: any) => t.token_address?.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      result.tokenTypeBreakdown = {
        native: {
          count: nativeTokens.length,
          totalValueUSD: nativeTokens.reduce((sum: number, t: any) => sum + parseFloat(t.price_data?.usd_value || '0'), 0).toFixed(2),
        },
        erc20: {
          count: erc20Tokens.length,
          totalValueUSD: erc20Tokens.reduce((sum: number, t: any) => sum + parseFloat(t.price_data?.usd_value || '0'), 0).toFixed(2),
        },
      };
    }

    // Process NFTs
    if (nfts.status === 'fulfilled') {
      const nftList = Array.isArray(nfts.value) ? nfts.value : [];
      result.nfts = nftList;
      result.nftCount = nftList.length;

      // Group by collection
      const collections = nftList.reduce((acc: any, nft) => {
        const key = `${nft.chainId}-${nft.tokenAddress}`;
        if (!acc[key]) {
          acc[key] = {
            chainId: nft.chainId,
            tokenAddress: nft.tokenAddress,
            type: nft.type,
            count: 0,
            nfts: [],
          };
        }
        acc[key].count++;
        acc[key].nfts.push(nft);
        return acc;
      }, {});
      result.nftCollections = Object.values(collections);

      // NFT type breakdown
      const erc721Count = nftList.filter(n => n.type === 'ERC721').length;
      const erc1155Count = nftList.filter(n => n.type === 'ERC1155').length;
      result.nftTypeBreakdown = {
        ERC721: erc721Count,
        ERC1155: erc1155Count,
      };
    }

    // Calculate portfolio diversity score
    result.diversityScore = calculateDiversityScore(result);

    return result;
  } catch (error: any) {
    console.error('❌ Thirdweb getWalletPortfolio error:', error);
    throw new Error(`Failed to fetch wallet portfolio: ${error.message}`);
  }
}

function calculateDiversityScore(portfolio: any): number {
  let score = 0;

  // Token diversity (max 40 points)
  const tokenCount = portfolio.tokenCount || 0;
  score += Math.min(tokenCount * 2, 40);

  // Chain diversity (max 30 points)
  const chainCount = portfolio.chainBreakdown?.length || 0;
  score += Math.min(chainCount * 10, 30);

  // NFT diversity (max 20 points)
  const nftCollectionCount = portfolio.nftCollections?.length || 0;
  score += Math.min(nftCollectionCount * 4, 20);

  // Balance distribution (max 10 points)
  if (portfolio.topTokens && portfolio.topTokens.length > 0) {
    const topTokenValue = parseFloat(portfolio.topTokens[0]?.balanceUSD || '0');
    const totalValue = parseFloat(portfolio.totalValueUSD || '0');
    if (totalValue > 0) {
      const concentration = topTokenValue / totalValue;
      // Lower concentration = better diversity
      score += Math.round((1 - concentration) * 10);
    }
  }

  return Math.min(Math.round(score), 100);
}

export async function getMultiChainPortfolio(address: string, chainIds: number[] = [1, 137, 56, 42161, 10]) {
  try {
    // Fetch portfolio for each chain in parallel
    const results = await Promise.allSettled(
      chainIds.map(chainId => 
        Promise.all([
          getWalletTokens(address, chainId),
          getWalletNFTs(address, chainId),
        ])
      )
    );

    const aggregated: any = {
      address,
      timestamp: new Date().toISOString(),
      chains: [],
      totalValueUSD: 0,
      totalTokens: 0,
      totalNFTs: 0,
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const [tokens, nfts] = result.value;
        const chainId = chainIds[index];
        
        const chainValue = tokens.reduce((sum: number, token: any) => 
          sum + parseFloat(token.balanceUSD || '0'), 0
        );

        aggregated.chains.push({
          chainId,
          tokens: tokens.length,
          nfts: nfts.length,
          valueUSD: chainValue.toFixed(2),
        });

        aggregated.totalValueUSD += chainValue;
        aggregated.totalTokens += tokens.length;
        aggregated.totalNFTs += nfts.length;
      }
    });

    aggregated.totalValueUSD = aggregated.totalValueUSD.toFixed(2);

    return aggregated;
  } catch (error: any) {
    console.error('❌ Thirdweb getMultiChainPortfolio error:', error);
    throw new Error(`Failed to fetch multi-chain portfolio: ${error.message}`);
  }
}
