/**
 * Configuration Type Definitions
 */

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  isVercel: boolean;
  serveFrontend: boolean;
  agentBaseUrl: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  temperature: number;
}

export interface LettaConfig {
  apiKey: string;
  baseUrl: string;
  project: string;
  model: string;
  embedding: string;
  agentId?: string;
  enabled: boolean;
}

export interface ExaConfig {
  apiKey: string;
  useMcp: boolean;
  mcpServerUrl?: string;
}

export interface SecurityAPIConfig {
  virustotal?: {
    apiKey: string;
  };
  googleSafeBrowsing?: {
    apiKey: string;
  };
  urlscan?: {
    apiKey: string;
  };
  hibp?: {
    apiKey: string;
  };
  abuseipdb?: {
    apiKey: string;
  };
}

export interface AppConfig {
  server: ServerConfig;
  openai: OpenAIConfig;
  letta: LettaConfig;
  exa: ExaConfig;
  security: SecurityAPIConfig;
}
