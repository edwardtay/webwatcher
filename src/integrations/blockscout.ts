import fetch from 'node-fetch';

const BLOCKSCOUT_API_KEY = process.env.BLOCKSCOUT_API_KEY || '08a283b8-bcb6-43f8-a2bd-62cc9cdc4ca4';
const BLOCKSCOUT_BASE_URL = 'https://eth.blockscout.com/api/v2';

interface BlockscoutTransaction {
  hash: string;
  from: { hash: string };
  to: { hash: string } | null;
  value: string;
  fee: { value: string };
  gas_used: string;
  timestamp: string;
  status: string;
  method: string;
  type: number;
}

interface BlockscoutTokenBalance {
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: string;
  };
  value: string;
  token_id: string | null;
}

export async function getWalletInfo(address: string) {
  try {
    const response = await fetch(`${BLOCKSCOUT_BASE_URL}/addresses/${address}`, {
      headers: {
        'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('❌ Blockscout getWalletInfo error:', error);
    throw new Error(`Failed to fetch wallet info: ${error.message}`);
  }
}

export async function getWalletTransactions(address: string, limit: number = 50) {
  try {
    const response = await fetch(
      `${BLOCKSCOUT_BASE_URL}/addresses/${address}/transactions?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('❌ Blockscout getWalletTransactions error:', error);
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }
}

export async function getWalletTokenBalances(address: string) {
  try {
    const response = await fetch(
      `${BLOCKSCOUT_BASE_URL}/addresses/${address}/token-balances`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data || [];
  } catch (error: any) {
    console.error('❌ Blockscout getWalletTokenBalances error:', error);
    throw new Error(`Failed to fetch token balances: ${error.message}`);
  }
}

export async function getWalletTokenTransfers(address: string, limit: number = 50) {
  try {
    const response = await fetch(
      `${BLOCKSCOUT_BASE_URL}/addresses/${address}/token-transfers?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('❌ Blockscout getWalletTokenTransfers error:', error);
    throw new Error(`Failed to fetch token transfers: ${error.message}`);
  }
}

export async function getWalletInternalTransactions(address: string, limit: number = 50) {
  try {
    const response = await fetch(
      `${BLOCKSCOUT_BASE_URL}/addresses/${address}/internal-transactions?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('❌ Blockscout getWalletInternalTransactions error:', error);
    throw new Error(`Failed to fetch internal transactions: ${error.message}`);
  }
}

export async function getWalletNFTs(address: string) {
  try {
    const response = await fetch(
      `${BLOCKSCOUT_BASE_URL}/addresses/${address}/nft?type=ERC-721,ERC-1155`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('❌ Blockscout getWalletNFTs error:', error);
    throw new Error(`Failed to fetch NFTs: ${error.message}`);
  }
}

export async function getWalletLogs(address: string, limit: number = 50) {
  try {
    const response = await fetch(
      `${BLOCKSCOUT_BASE_URL}/addresses/${address}/logs?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${BLOCKSCOUT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('❌ Blockscout getWalletLogs error:', error);
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }
}

export async function getComprehensiveWalletData(address: string) {
  try {
    // Fetch all data in parallel
    const [
      walletInfo,
      transactions,
      tokenBalances,
      tokenTransfers,
      internalTxs,
      nfts,
      logs,
    ] = await Promise.allSettled([
      getWalletInfo(address),
      getWalletTransactions(address, 20),
      getWalletTokenBalances(address),
      getWalletTokenTransfers(address, 20),
      getWalletInternalTransactions(address, 20),
      getWalletNFTs(address),
      getWalletLogs(address, 20),
    ]);

    const result: any = {
      address,
      timestamp: new Date().toISOString(),
    };

    // Process wallet info
    if (walletInfo.status === 'fulfilled') {
      const info = walletInfo.value as any;
      result.balance = info.coin_balance || '0';
      result.transactionCount = info.transactions_count || 0;
      result.gasUsed = info.gas_usage_count || 0;
      result.isContract = info.is_contract || false;
      result.isVerified = info.is_verified || false;
      result.creator = info.creator_address_hash || null;
      result.creationTx = info.creation_tx_hash || null;
    }

    // Process transactions
    if (transactions.status === 'fulfilled') {
      result.transactions = transactions.value;
      result.transactionsCount = transactions.value.length;
    }

    // Process token balances
    if (tokenBalances.status === 'fulfilled') {
      result.tokenBalances = tokenBalances.value;
      result.tokenCount = tokenBalances.value.length;
    }

    // Process token transfers
    if (tokenTransfers.status === 'fulfilled') {
      result.tokenTransfers = tokenTransfers.value;
      result.tokenTransfersCount = tokenTransfers.value.length;
    }

    // Process internal transactions
    if (internalTxs.status === 'fulfilled') {
      result.internalTransactions = internalTxs.value;
      result.internalTxCount = internalTxs.value.length;
    }

    // Process NFTs
    if (nfts.status === 'fulfilled') {
      result.nfts = nfts.value;
      result.nftCount = nfts.value.length;
    }

    // Process logs
    if (logs.status === 'fulfilled') {
      result.logs = logs.value;
      result.logsCount = logs.value.length;
    }

    return result;
  } catch (error: any) {
    console.error('❌ Blockscout getComprehensiveWalletData error:', error);
    throw new Error(`Failed to fetch comprehensive wallet data: ${error.message}`);
  }
}
