import Moralis from 'moralis';

const MORALIS_API_KEY = process.env.MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNhOTk0ZjA3LTFkZTQtNGY3MS1iNWYzLTI4ODgxNjM3MzUzOCIsIm9yZ0lkIjoiODY0NDAiLCJ1c2VySWQiOiI4NjA4MiIsInR5cGVJZCI6ImUxZjAxNzExLThhOWYtNGQ4MC1iYjQwLTk5MDgxN2JmY2M2YSIsInR5cGUiOiJQUk9KRUNUIiwiaWF0IjoxNjgxOTAyNzAyLCJleHAiOjQ4Mzc2NjI3MDJ9.ZinRBaL7YiYJKljRFDOFdq001UJwx2tTt0QpYLsOobo';

let isInitialized = false;

async function initializeMoralis() {
  if (!isInitialized) {
    await Moralis.start({
      apiKey: MORALIS_API_KEY,
    });
    isInitialized = true;
    console.log('✅ Moralis initialized');
  }
}

export interface MoralisTransaction {
  hash: string;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  block_timestamp: string;
  block_number: string;
  receipt_status?: string;
}

export async function getWalletTransactions(
  address: string,
  chain: string = '0x1',
  limit: number = 10
): Promise<MoralisTransaction[]> {
  try {
    await initializeMoralis();

    const response = await Moralis.EvmApi.transaction.getWalletTransactions({
      address,
      chain,
      limit,
    });

    return response.raw.result || [];
  } catch (error: any) {
    console.error('❌ Moralis getWalletTransactions error:', error);
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }
}

export async function getWalletTokenBalances(
  address: string,
  chain: string = '0x1'
) {
  try {
    await initializeMoralis();

    const response = await Moralis.EvmApi.token.getWalletTokenBalances({
      address,
      chain,
    });

    return response.raw;
  } catch (error: any) {
    console.error('❌ Moralis getWalletTokenBalances error:', error);
    throw new Error(`Failed to fetch token balances: ${error.message}`);
  }
}

export async function getWalletNFTs(
  address: string,
  chain: string = '0x1',
  limit: number = 10
) {
  try {
    await initializeMoralis();

    const response = await Moralis.EvmApi.nft.getWalletNFTs({
      address,
      chain,
      limit,
    });

    return response.raw.result || [];
  } catch (error: any) {
    console.error('❌ Moralis getWalletNFTs error:', error);
    throw new Error(`Failed to fetch NFTs: ${error.message}`);
  }
}

export async function getWalletNetWorth(
  address: string,
  chains: string[] = ['0x1', '0x89', '0x38']
) {
  try {
    await initializeMoralis();

    const response = await Moralis.EvmApi.wallets.getWalletNetWorth({
      address,
      chains,
    });

    return response.raw;
  } catch (error: any) {
    console.error('❌ Moralis getWalletNetWorth error:', error);
    throw new Error(`Failed to fetch net worth: ${error.message}`);
  }
}

export async function analyzeWalletSecurity(address: string) {
  try {
    await initializeMoralis();

    // Fetch comprehensive wallet data
    const [transactions, tokens, nfts, netWorth] = await Promise.allSettled([
      getWalletTransactions(address, '0x1', 20),
      getWalletTokenBalances(address, '0x1'),
      getWalletNFTs(address, '0x1', 10),
      getWalletNetWorth(address, ['0x1', '0x89', '0x38']),
    ]);

    const txData = transactions.status === 'fulfilled' ? transactions.value : [];
    const tokenData = tokens.status === 'fulfilled' ? tokens.value : null;
    const nftData = nfts.status === 'fulfilled' ? nfts.value : [];
    const netWorthData = netWorth.status === 'fulfilled' ? netWorth.value : null;

    // Analyze security patterns
    const analysis = {
      address,
      transactionCount: txData.length,
      recentActivity: txData.slice(0, 5),
      tokenCount: tokenData?.length || 0,
      nftCount: nftData.length,
      netWorth: netWorthData?.total_networth_usd || 0,
      riskFactors: [] as string[],
      securityScore: 100,
    };

    // Check for suspicious patterns
    if (txData.length > 0) {
      const recentTxs = txData.slice(0, 10);
      const failedTxs = recentTxs.filter((tx: any) => tx.receipt_status === '0');
      
      if (failedTxs.length > 3) {
        analysis.riskFactors.push('High number of failed transactions detected');
        analysis.securityScore -= 15;
      }

      // Check for high-frequency trading (potential bot)
      const timestamps = recentTxs.map((tx: any) => new Date(tx.block_timestamp).getTime());
      const avgTimeDiff = timestamps.length > 1 
        ? timestamps.slice(1).reduce((sum, ts, i) => sum + (timestamps[i] - ts), 0) / (timestamps.length - 1)
        : 0;
      
      if (avgTimeDiff < 60000 && recentTxs.length > 5) { // Less than 1 minute between txs
        analysis.riskFactors.push('High-frequency trading pattern detected');
        analysis.securityScore -= 10;
      }
    }

    return analysis;
  } catch (error: any) {
    console.error('❌ Moralis analyzeWalletSecurity error:', error);
    throw new Error(`Failed to analyze wallet: ${error.message}`);
  }
}
