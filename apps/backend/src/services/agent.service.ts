/**
 * Agent service - Web2 only (removed AgentKit/Web3)
 */
import { logger } from '../utils/logger';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage as LangChainHumanMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getSystemPrompt } from '../utils/system-prompt';

let agentInstance: any = null;
let agentInitialized = false;
let agentInitPromise: Promise<any> | null = null;

export async function preInitializeAgent() {
  if (!agentInitPromise && !agentInitialized) {
    agentInitPromise = (async () => {
      try {
        logger.info('Pre-initializing agent in background...');
        agentInstance = await initializeAgent();
        agentInitialized = true;
        logger.info('✓ Agent pre-initialized successfully');
      } catch (error) {
        logger.warn('Agent pre-initialization failed:', error);
        agentInitPromise = null;
      }
    })();
  }
  return agentInitPromise;
}

async function initializeAgent() {
  try {
    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    logger.info('Initializing Web2 Security Agent...');

    // Initialize LLM
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    // Create manual tools for Web2 security
    const { createManualTools } = await import('../utils/manual-tools');
    const tools = createManualTools();
    
    logger.info(`Loaded ${tools.length} Web2 security tools`);

    // Store conversation history
    const memory = new MemorySaver();
    // Note: thread_id will be set per request to avoid state corruption
    const agentConfig = {
      configurable: { thread_id: `webwatcher-${Date.now()}` },
    };

    // Create React Agent
    const systemPrompt = getSystemPrompt();
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: systemPrompt,
    });

    logger.info('Web2 Security Agent initialized successfully');
    return { agent, config: agentConfig };
  } catch (error) {
    logger.error('Failed to initialize agent', error);
    throw error;
  }
}

export async function getAgent() {
  if (!agentInstance) {
    try {
      logger.info('Initializing agent...');
      agentInstance = await initializeAgent();
      agentInitialized = true;
      logger.info('Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize agent', error);
      agentInitialized = false;
      throw error;
    }
  }
  
  return agentInstance;
}

export function getHumanMessage() {
  return LangChainHumanMessage;
}

export function isAgentInitialized() {
  return agentInitialized;
}
