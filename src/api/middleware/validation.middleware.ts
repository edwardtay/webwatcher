/**
 * Validation Middleware
 * Validates request body, query, and params using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validation';

/**
 * Validate request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = validate(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = validate(schema, req.query) as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request params
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = validate(schema, req.params) as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}
