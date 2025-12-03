/**
 * Improved Global Error Handler Middleware
 * Handles all errors with proper logging and response formatting
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { AppError, handleError } from '../../utils/errors';
import { ErrorResponse } from '../../types/api.types';

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Handle the error and get structured response
  const errorResponse = handleError(error, req.path);

  // Log the error with context
  logger.error('Request error', error, {
    path: req.path,
    method: req.method,
    statusCode: errorResponse.statusCode,
    code: errorResponse.code,
  });

  // Send error response
  const response: ErrorResponse = {
    error: errorResponse.message,
    code: errorResponse.code,
    ...(process.env.NODE_ENV === 'development' && {
      details: errorResponse.details,
    }),
  };

  res.status(errorResponse.statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
