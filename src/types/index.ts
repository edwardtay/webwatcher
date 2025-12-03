/**
 * Shared TypeScript types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChatRequest {
  message: string;
  threadId?: string;
}

export interface ChatResponse {
  response: string;
  chunks: string[];
  threadId: string;
  lettaEnabled: boolean;
  metadata: {
    a2aCoordinated: boolean;
    realTimeDataUsed: boolean;
    autonomousAction: boolean;
    toolsUsed: string[];
    riskScore?: number;
    threatDetected: boolean;
  };
}

export interface WalletAnalysisRequest {
  address: string;
}

export interface QuestVerificationRequest {
  address: string;
}

export interface UrlCheckRequest {
  url: string;
}

export interface UrlFeatures {
  fullUrl: string;
  domain: string;
  path: string;
  isIp: boolean;
  hasAt: boolean;
  numDots: number;
  urlLength: number;
  keywordHits: string[];
  tld: string;
  tldSuspicious: boolean;
  brandImpersonation: string | null;
}

export interface PhishingAnalysisResult {
  verdict: string;
  redFlags: string[];
  explanation: string;
}
