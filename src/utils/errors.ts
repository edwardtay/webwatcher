/**
 * Custom Error Classes
 * Provides structured error handling across the application
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Unauthorized access', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, details?: unknown) {
    super(`${resource} not found`, 'NOT_FOUND', 404, details);
  }
}

export class SecurityAnalysisError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'SECURITY_ANALYSIS_ERROR', 500, details);
  }
}

export class ExternalAPIError extends AppError {
  constructor(
    service: string,
    message: string,
    details?: unknown
  ) {
    super(`${service} API error: ${message}`, 'EXTERNAL_API_ERROR', 502, details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown, context: string): {
  message: string;
  code: string;
  statusCode: number;
  details?: unknown;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      details: { context, stack: error.stack },
    };
  }

  return {
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    details: { context, error: String(error) },
  };
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ExternalAPIError) {
    return true;
  }
  if (error instanceof RateLimitError) {
    return true;
  }
  return false;
}
