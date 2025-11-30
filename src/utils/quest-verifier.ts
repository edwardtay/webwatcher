/**
 * Quest Verification System
 * Verifies user interaction with partner protocols and awards passes
 */

import { logger } from "./logger";

export interface QuestResult {
  protocol: string;
  completed: boolean;
  proof?: string;
  timestamp?: number;
  details?: string;
}

export interface QuestPass {
  address: string;
  quests: QuestResult[];
  totalCompleted: number;
  passAwarded: boolean;
}

/**
 * Verify Circle USDC holdings on any chain
 */
export async function verifyCircleQuest(address: string): Promise<QuestResult> {
  try {
    // Check USDC balance using Alchemy (supports multiple chains)
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
    if (!ALCHEMY_API_KEY) {
      throw new Error("ALCHEMY_API_KEY not configured");
    }

    // Check multiple chains for USDC
    const chains = [
      { name: "Ethereum", url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` },
      { name: "Polygon", url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` },
      { name: "Base", url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` },
    ];

    // USDC contract addresses
    const USDC_CONTRACTS: Record<string, string> = {
      Ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      Polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      Base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    for (const chain of chains) {
      const response = await fetch(chain.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "alchemy_getTokenBalances",
          params: [address, [USDC_CONTRACTS[chain.name]]],
          id: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const balances = data.result?.tokenBalances || [];
        
        for (const balance of balances) {
          if (balance.tokenBalance && balance.tokenBalance !== "0x0") {
            const balanceNum = parseInt(balance.tokenBalance, 16);
            if (balanceNum > 0) {
              return {
                protocol: "Circle",
                completed: true,
                proof: `Holds USDC on ${chain.name}`,
                timestamp: Date.now(),
                details: `Balance: ${(balanceNum / 1e6).toFixed(2)} USDC`,
              };
            }
          }
        }
      }
    }

    return {
      protocol: "Circle",
      completed: false,
      details: "No USDC holdings found on any chain",
    };
  } catch (error) {
    logger.error("Circle quest verification error:", error);
    return {
      protocol: "Circle",
      completed: false,
      details: "Verification failed",
    };
  }
}

/**
 * Verify ZetaChain transactions (mainnet or testnet)
 */
export async function verifyZetaChainQuest(address: string): Promise<QuestResult> {
  try {
    // Check both mainnet and testnet
    const networks = [
      { name: "Mainnet", rpc: "https://zetachain-evm.blockpi.network/v1/rpc/public" },
      { name: "Testnet", rpc: "https://zetachain-athens-evm.blockpi.network/v1/rpc/public" },
      { name: "Testnet (dRPC)", rpc: "https://zeta-chain-testnet.drpc.org" },
    ];

    for (const network of networks) {
      try {
        logger.info(`Checking ZetaChain ${network.name} for address: ${address}`);
        
        const response = await fetch(network.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionCount",
            params: [address, "latest"],
            id: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          const txCount = parseInt(data.result || "0x0", 16);
          logger.info(`ZetaChain ${network.name} - Transaction count: ${txCount}`);
          
          if (txCount > 0) {
            return {
              protocol: "ZetaChain",
              completed: true,
              proof: `${txCount} transactions on ${network.name}`,
              timestamp: Date.now(),
              details: `${txCount} transaction${txCount === 1 ? '' : 's'} on ZetaChain ${network.name}`,
            };
          }
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          logger.warn(`ZetaChain ${network.name} - Transaction count check failed: ${response.status} - ${errorText}`);
        }
      } catch (err: any) {
        logger.error(`ZetaChain ${network.name} verification error:`, err);
        logger.error(`Error details: ${err.message || err.toString()}`);
        // Try next network
        continue;
      }
    }

    logger.info(`No ZetaChain activity found for address: ${address}`);
    return {
      protocol: "ZetaChain",
      completed: false,
      details: "No transactions found on ZetaChain",
    };
  } catch (error) {
    logger.error("ZetaChain quest verification error:", error);
    return {
      protocol: "ZetaChain",
      completed: false,
      details: "Verification failed",
    };
  }
}

/**
 * Verify Somnia transactions (mainnet or testnet)
 * Uses multiple methods to detect any transaction activity
 */
export async function verifySomniaQuest(address: string): Promise<QuestResult> {
  try {
    // Somnia RPC endpoints
    const networks = [
      { name: "Mainnet", rpc: "https://rpc.somnia.network" },
      { name: "Testnet", rpc: "https://testnet-rpc.somnia.network" },
      { name: "Testnet (Dream)", rpc: "https://dream-rpc.somnia.network" },
    ];

    for (const network of networks) {
      try {
        logger.info(`Checking Somnia ${network.name} for address: ${address}`);
        
        // Method 1: Check transaction count (outbound transactions)
        const txCountResponse = await fetch(network.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionCount",
            params: [address, "latest"],
            id: 1,
          }),
        });

        if (txCountResponse.ok) {
          const txCountData = await txCountResponse.json() as any;
          const txCount = parseInt(txCountData.result || "0x0", 16);
          logger.info(`Somnia ${network.name} - Transaction count: ${txCount}`);
          
          if (txCount > 0) {
            return {
              protocol: "Somnia",
              completed: true,
              proof: `${txCount} outbound transactions on ${network.name}`,
              timestamp: Date.now(),
              details: `Active on Somnia ${network.name}`,
            };
          }
        } else {
          const errorText = await txCountResponse.text().catch(() => 'Unknown error');
          logger.warn(`Somnia ${network.name} - Transaction count check failed: ${txCountResponse.status} - ${errorText}`);
        }

        // Method 2: Check balance (indicates any activity/receipts)
        const balanceResponse = await fetch(network.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 2,
          }),
        });

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json() as any;
          const balance = BigInt(balanceData.result || "0x0");
          logger.info(`Somnia ${network.name} - Balance: ${balance.toString()}`);
          
          // If there's a balance, the address has received transactions
          if (balance > 0n) {
            return {
              protocol: "Somnia",
              completed: true,
              proof: `Has balance on ${network.name}`,
              timestamp: Date.now(),
              details: `Active on Somnia ${network.name} (balance detected)`,
            };
          }
        } else {
          const errorText = await balanceResponse.text().catch(() => 'Unknown error');
          logger.warn(`Somnia ${network.name} - Balance check failed: ${balanceResponse.status} - ${errorText}`);
        }

        // Method 3: Check for any transaction history by getting code (if contract) or checking recent blocks
        // For EOA (Externally Owned Accounts), we can check if address has ever been involved in transactions
        // by checking recent blocks for transactions to/from this address
        
        // Get recent block number
        const blockResponse = await fetch(network.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 3,
          }),
        });

        if (blockResponse.ok) {
          const blockData = await blockResponse.json() as any;
          const currentBlock = parseInt(blockData.result || "0x0", 16);
          // Check last 50,000 blocks (reasonable range for activity detection)
          const fromBlock = Math.max(0, currentBlock - 50000);
          
          // Check for Transfer events (ERC20/ERC721) where address is involved
          // Transfer(address indexed from, address indexed to, uint256 value)
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer event signature
          
          // Check as sender (topic[1])
          const logsFromResponse = await fetch(network.rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getLogs",
              params: [{
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: "latest",
                topics: [
                  transferTopic,
                  `0x000000000000000000000000${address.slice(2).toLowerCase()}`,
                  null,
                ],
              }],
              id: 4,
            }),
          });

          if (logsFromResponse.ok) {
            const logsFromData = await logsFromResponse.json() as any;
            const logsFrom = logsFromData.result || [];
            logger.info(`Somnia ${network.name} - Found ${logsFrom.length} transfer events from address`);
            
            if (logsFrom.length > 0) {
              return {
                protocol: "Somnia",
                completed: true,
                proof: `${logsFrom.length} transfer events on ${network.name}`,
                timestamp: Date.now(),
                details: `Active on Somnia ${network.name}`,
              };
            }
          }

          // Check as recipient (topic[2])
          const logsToResponse = await fetch(network.rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getLogs",
              params: [{
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: "latest",
                topics: [
                  transferTopic,
                  null,
                  `0x000000000000000000000000${address.slice(2).toLowerCase()}`,
                ],
              }],
              id: 5,
            }),
          });

          if (logsToResponse.ok) {
            const logsToData = await logsToResponse.json() as any;
            const logsTo = logsToData.result || [];
            logger.info(`Somnia ${network.name} - Found ${logsTo.length} transfer events to address`);
            
            if (logsTo.length > 0) {
              return {
                protocol: "Somnia",
                completed: true,
                proof: `${logsTo.length} transfer events on ${network.name}`,
                timestamp: Date.now(),
                details: `Active on Somnia ${network.name}`,
              };
            }
          }
        }

      } catch (err: any) {
        logger.error(`Somnia ${network.name} verification error:`, err);
        logger.error(`Error details: ${err.message || err.toString()}`);
        // Try next network
        continue;
      }
    }

    logger.info(`No Somnia activity found for address: ${address}`);
    return {
      protocol: "Somnia",
      completed: false,
      details: "No transactions found on Somnia",
    };
  } catch (error) {
    logger.error("Somnia quest verification error:", error);
    return {
      protocol: "Somnia",
      completed: false,
      details: "Verification failed",
    };
  }
}

/**
 * Verify Seedify user (via API if available)
 */
export async function verifySeedifyQuest(address: string): Promise<QuestResult> {
  try {
    // Check if user has interacted with Seedify contracts
    // Seedify token contract on BSC: 0x477bC8d23c634C154061869478bce96BE6045D12
    const BSC_RPC = "https://bsc-dataseed.binance.org/";
    const SEEDIFY_TOKEN = "0x477bC8d23c634C154061869478bce96BE6045D12";

    const response = await fetch(BSC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: SEEDIFY_TOKEN,
            data: `0x70a08231000000000000000000000000${address.slice(2)}`, // balanceOf
          },
          "latest",
        ],
        id: 1,
      }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const balance = parseInt(data.result, 16);
      
      if (balance > 0) {
        return {
          protocol: "Seedify",
          completed: true,
          proof: "Holds SFUND tokens",
          timestamp: Date.now(),
          details: `Balance: ${(balance / 1e18).toFixed(2)} SFUND`,
        };
      }
    }

    return {
      protocol: "Seedify",
      completed: false,
      details: "No SFUND tokens found",
    };
  } catch (error) {
    logger.error("Seedify quest verification error:", error);
    return {
      protocol: "Seedify",
      completed: false,
      details: "Verification failed",
    };
  }
}

/**
 * Verify NodeOps user (check for NODE token holdings)
 * NODE token is the native token of NodeOps Network
 */
export async function verifyNodeOpsQuest(address: string): Promise<QuestResult> {
  try {
    logger.info(`Checking NodeOps NODE token for address: ${address}`);
    
    // NODE token contract addresses (check multiple chains)
    // NODE token was launched on BSC (Binance Smart Chain)
    // To find the contract address:
    // 1. Check NodeOps official documentation
    // 2. Search BSCScan for "NodeOps" or "NODE token"
    // 3. Check CoinMarketCap/CoinGecko for contract addresses
    // 4. Set environment variables: NODEOPS_NODE_TOKEN_BSC and/or NODEOPS_NODE_TOKEN_ETH
    const networks = [
      {
        name: "BSC",
        rpc: "https://bsc-dataseed.binance.org/",
        // NODE token on BSC - configure via NODEOPS_NODE_TOKEN_BSC env var
        // Example: NODEOPS_NODE_TOKEN_BSC=0x1234... (actual contract address)
        tokenAddress: process.env.NODEOPS_NODE_TOKEN_BSC || "",
      },
      {
        name: "Ethereum",
        rpc: process.env.ALCHEMY_API_KEY 
          ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
          : "",
        // NODE token on Ethereum (if exists) - configure via NODEOPS_NODE_TOKEN_ETH env var
        tokenAddress: process.env.NODEOPS_NODE_TOKEN_ETH || "",
      },
    ].filter(network => network.tokenAddress && network.rpc); // Only include configured networks

    // Try to find NODE token balance on any chain
    if (networks.length === 0) {
      logger.warn("No NODE token addresses configured. Set NODEOPS_NODE_TOKEN_BSC or NODEOPS_NODE_TOKEN_ETH environment variables.");
    }
    
    for (const network of networks) {

      try {
        logger.info(`Checking NODE token on ${network.name} at ${network.tokenAddress}`);
        
        const response = await fetch(network.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [
              {
                to: network.tokenAddress,
                // balanceOf(address) function signature: 0x70a08231
                data: `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`,
              },
              "latest",
            ],
            id: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          
          if (data.result && data.result !== "0x") {
            const balance = BigInt(data.result || "0x0");
            logger.info(`NodeOps ${network.name} - NODE balance: ${balance.toString()}`);
            
            if (balance > 0n) {
              // Assume 18 decimals (standard for most tokens)
              const decimals = 18;
              const formattedBalance = Number(balance) / Math.pow(10, decimals);
              
              return {
                protocol: "NodeOps",
                completed: true,
                proof: `Holds NODE tokens on ${network.name}`,
                timestamp: Date.now(),
                details: `Balance: ${formattedBalance.toFixed(4)} NODE on ${network.name}`,
              };
            }
          }
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          logger.warn(`NodeOps ${network.name} - Balance check failed: ${response.status} - ${errorText}`);
        }
      } catch (err: any) {
        logger.error(`NodeOps ${network.name} verification error:`, err);
        // Try next network
        continue;
      }
    }

    // Fallback: Check Ethereum validator deposits (original method)
    logger.info("Checking Ethereum validator deposits as fallback");
    const BEACON_DEPOSIT_CONTRACT = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
    const ETH_RPC = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

    if (process.env.ALCHEMY_API_KEY) {
      try {
        const validatorResponse = await fetch(ETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getLogs",
            params: [
              {
                fromBlock: "0x0",
                toBlock: "latest",
                address: BEACON_DEPOSIT_CONTRACT,
                topics: [
                  "0x649bbc62d0e31342afea4e5cd82d4049e7e1ee912fc0889aa790803be39038c5", // DepositEvent
                  null,
                  null,
                  `0x000000000000000000000000${address.slice(2).toLowerCase()}`,
                ],
              },
            ],
            id: 1,
          }),
        });

        if (validatorResponse.ok) {
          const validatorData: any = await validatorResponse.json();
          if (validatorData.result && Array.isArray(validatorData.result) && validatorData.result.length > 0) {
            logger.info(`Found ${validatorData.result.length} validator deposits`);
            return {
              protocol: "NodeOps",
              completed: true,
              proof: "Ethereum validator detected",
              timestamp: Date.now(),
              details: `${validatorData.result.length} validator deposit(s)`,
            };
          }
        }
      } catch (err) {
        logger.error("Validator deposit check error:", err);
      }
    }

    logger.info(`No NodeOps activity found for address: ${address}`);
    return {
      protocol: "NodeOps",
      completed: false,
      details: "No NODE tokens or validator activity found",
    };
  } catch (error) {
    logger.error("NodeOps quest verification error:", error);
    return {
      protocol: "NodeOps",
      completed: false,
      details: "Verification failed",
    };
  }
}

/**
 * Verify all quests for an address
 */
export async function verifyAllQuests(address: string): Promise<QuestPass> {
  logger.info(`Verifying quests for address: ${address}`);

  const quests = await Promise.all([
    verifyCircleQuest(address),
    verifyZetaChainQuest(address),
    verifySomniaQuest(address),
    verifySeedifyQuest(address),
    verifyNodeOpsQuest(address),
  ]);

  const totalCompleted = quests.filter((q) => q.completed).length;
  const passAwarded = totalCompleted >= 3; // Need at least 3 quests completed

  return {
    address,
    quests,
    totalCompleted,
    passAwarded,
  };
}
