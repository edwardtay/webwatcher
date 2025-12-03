/**
 * Centralized Configuration
 * Type-safe configuration management
 */

import * as dotenv from 'dotenv';
import { AppConfig } from '../types/config.types';
import { ConfigurationError } from '../utils/errors';

dotenv.config();

/**
 * Get environment variable as string
 */
function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

/**
 * Get environment variable as number
 */
function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue === undefined) {
      throw new ConfigurationError(`Missing required environment variable: ${key}`);
    }
    return defaultValue;
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new ConfigurationError(`Invalid number for ${key}: ${value}`);
  }
  return num;
}

/**
 * Get environment variable as boolean
 */
function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Application configuration
 */
export const config: AppConfig = {
  server: {
    port: getEnvNumber('PORT', 8080),
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    isVercel: !!process.env.VERCEL,
    serveFrontend: getEnvBoolean('SERVE_FRONTEND', true),
    agentBaseUrl: getEnvString('AGENT_BASE_URL', 'https://webwatcher.lever-labs.com'),
  },

  openai: {
    apiKey: getEnvString('OPENAI_API_KEY'),
    model: getEnvString('OPENAI_MODEL', 'gpt-4o-mini'),
    temperature: getEnvNumber('OPENAI_TEMPERATURE', 0.3),
  },

  letta: {
    apiKey: getEnvString('LETTA_API_KEY', ''),
    baseUrl: getEnvString('LETTA_BASE_URL', 'https://api.letta.ai'),
    project: getEnvString('LETTA_PROJECT', 'webwatcher-cybersecurity'),
    model: getEnvString('LETTA_MODEL', 'openai/gpt-4o-mini'),
    embedding: getEnvString('LETTA_EMBEDDING', 'openai/text-embedding-3-small'),
    agentId: process.env.LETTA_AGENT_ID,
    enabled: !!process.env.LETTA_API_KEY,
  },

  exa: {
    apiKey: getEnvString('EXA_API_KEY', ''),
    useMcp: getEnvBoolean('EXA_USE_MCP', false),
    mcpServerUrl: process.env.EXA_MCP_SERVER_URL,
  },

  security: {
    virustotal: process.env.VIRUSTOTAL_API_KEY
      ? { apiKey: process.env.VIRUSTOTAL_API_KEY }
      : undefined,
    googleSafeBrowsing: process.env.GOOGLE_SAFE_BROWSING_API_KEY
      ? { apiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY }
      : undefined,
    urlscan: process.env.URLSCAN_API_KEY
      ? { apiKey: process.env.URLSCAN_API_KEY }
      : undefined,
    hibp: process.env.HIBP_API_KEY
      ? { apiKey: process.env.HIBP_API_KEY }
      : undefined,
    abuseipdb: process.env.ABUSEIPDB_API_KEY
      ? { apiKey: process.env.ABUSEIPDB_API_KEY }
      : undefined,
  },
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required');
  }

  if (errors.length > 0) {
    throw new ConfigurationError(
      `Configuration validation failed:\n${errors.join('\n')}`
    );
  }
}

/**
 * Get configuration summary (safe for logging)
 */
export function getConfigSummary(): Record<string, unknown> {
  return {
    server: {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv,
      isVercel: config.server.isVercel,
    },
    openai: {
      model: config.openai.model,
      hasApiKey: !!config.openai.apiKey,
    },
    letta: {
      enabled: config.letta.enabled,
      hasApiKey: !!config.letta.apiKey,
    },
    exa: {
      hasApiKey: !!config.exa.apiKey,
      useMcp: config.exa.useMcp,
    },
    security: {
      virustotal: !!config.security.virustotal,
      googleSafeBrowsing: !!config.security.googleSafeBrowsing,
      urlscan: !!config.security.urlscan,
      hibp: !!config.security.hibp,
      abuseipdb: !!config.security.abuseipdb,
    },
  };
}
