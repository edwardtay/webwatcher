/**
 * Input Validation Utilities
 * Zod-based validation schemas for API requests
 */

import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Chat request validation
 */
export const chatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long (max 5000 characters)'),
  threadId: z.string().optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

/**
 * URL validation
 */
export const urlSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL too long');

/**
 * Security scan request validation
 */
export const securityScanRequestSchema = z.object({
  url: urlSchema,
});

/**
 * Domain validation
 */
export const domainSchema = z.string()
  .min(1, 'Domain cannot be empty')
  .max(255, 'Domain too long')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/, 'Invalid domain format');

/**
 * Email validation
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(320, 'Email too long');

/**
 * Breach check request validation
 */
export const breachCheckRequestSchema = z.object({
  email: emailSchema,
});

/**
 * WHOIS check request validation
 */
export const whoisCheckRequestSchema = z.object({
  domain: domainSchema,
});

/**
 * Generic validation helper
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join('.'),
        error.errors
      );
    }
    throw error;
  }
}

/**
 * Safe validation (returns result object instead of throwing)
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
