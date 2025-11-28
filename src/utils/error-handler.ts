/**
 * Centralized error handling utilities
 * Best practice: Consistent error handling across the application
 */

import { logger } from "./logger";

export interface ErrorContext {
  action?: string;
  level?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Error codes for different error types
 */
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  AGENT_INITIALIZATION_FAILED = "AGENT_INITIALIZATION_FAILED",
  API_ERROR = "API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: Error | string,
  code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  context?: ErrorContext,
): ErrorResponse {
  const message = error instanceof Error ? error.message : String(error);
  
  const response: ErrorResponse = {
    error: code,
    message,
    timestamp: new Date().toISOString(),
  };

  // Add context if provided
  if (context) {
    response.details = {
      action: context.action,
      level: context.level,
      metadata: context.metadata,
    };
  }

  // Log error with context
  logger.error(`[${code}] ${message}`, context);

  return response;
}

/**
 * Handle agent initialization errors gracefully
 */
export function handleAgentInitError(error: unknown): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes("CDP_API_KEY") || errorMessage.includes("OPENAI_API_KEY")) {
    return createErrorResponse(
      "Missing required API keys. Please check your .env file.",
      ErrorCode.AGENT_INITIALIZATION_FAILED,
      {
        action: "agent_initialization",
        metadata: {
          hint: "For Level 1 (local), only OPENAI_API_KEY is required. For other levels, CDP keys are needed.",
        },
      },
    );
  }
  
  return createErrorResponse(
    errorMessage,
    ErrorCode.AGENT_INITIALIZATION_FAILED,
    {
      action: "agent_initialization",
    },
  );
}

/**
 * Handle API errors with retry information
 */
export function handleAPIError(
  error: unknown,
  endpoint: string,
  retryable: boolean = false,
): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return createErrorResponse(
    `API error: ${errorMessage}`,
    ErrorCode.API_ERROR,
    {
      action: "api_call",
      metadata: {
        endpoint,
        retryable,
      },
    },
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /503/i,
    /502/i,
    /429/i, // Rate limit
  ];
  
  return retryablePatterns.some(pattern => pattern.test(error.message));
}









