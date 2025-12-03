/**
 * API Type Definitions
 * Shared types for API requests and responses
 */

export interface ChatRequest {
  message: string;
  threadId?: string;
}

export interface ChatResponse {
  response: string;
  chunks: string[];
  threadId: string;
  lettaEnabled: boolean;
  metadata: ChatMetadata;
}

export interface ChatMetadata {
  a2aCoordinated: boolean;
  realTimeDataUsed: boolean;
  autonomousAction: boolean;
  toolsUsed: string[];
  riskScore?: number;
  threatDetected?: boolean;
}

export interface SecurityScanRequest {
  url: string;
}

export interface SecurityScanResponse {
  success: boolean;
  data: SecurityScanData;
}

export interface SecurityScanData {
  url: string;
  riskScore: {
    overallScore: number;
    verdict: string;
    breakdown: Record<string, number>;
  };
  details: {
    reputation?: ReputationData;
    whoisData?: WhoisData;
    tlsAudit?: TLSAuditData;
  };
  timestamp: string;
}

export interface ReputationData {
  ip: string;
  riskScore: number;
  sources: Array<{
    name: string;
    status: 'clean' | 'suspicious' | 'malicious' | 'unknown';
    details?: string;
  }>;
}

export interface WhoisData {
  domain: string;
  registrar: string;
  createdDate: string;
  updatedDate: string;
  expiryDate: string;
  ageInDays: number;
  registrant: string;
  flags: string[];
  riskScore: number;
}

export interface TLSAuditData {
  isHttps: boolean;
  certificate?: {
    valid: boolean;
    issuer: string;
    expiryDate: string;
  };
}

export interface BreachCheckRequest {
  email: string;
}

export interface BreachCheckResponse {
  success: boolean;
  data: BreachCheckData;
}

export interface BreachCheckData {
  email: string;
  totalBreaches: number;
  totalPwnCount: number;
  riskScore: number;
  flags: string[];
  breaches: Array<{
    title: string;
    domain: string;
    breachDate: string;
    pwnCount: number;
    dataClasses: string[];
    isSensitive: boolean;
  }>;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  capabilities: {
    a2a: string;
    mcp: string;
    letta: string;
  };
}
