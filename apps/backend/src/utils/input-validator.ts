/**
 * Input validation and sanitization utilities
 * Implements guardrails for agent inputs
 */

import { z } from "zod";

/**
 * Validate and sanitize user input
 */
export function validateInput(input: string): { valid: boolean; sanitized: string; error?: string } {
  if (!input || typeof input !== "string") {
    return { valid: false, sanitized: "", error: "Input must be a non-empty string" };
  }

  // Maximum input length (prevent DoS)
  const MAX_LENGTH = 10000;
  if (input.length > MAX_LENGTH) {
    return { valid: false, sanitized: "", error: `Input exceeds maximum length of ${MAX_LENGTH} characters` };
  }

  // Sanitize: remove potentially dangerous characters
  let sanitized = input.trim();
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  
  // Prevent script injection attempts
  const scriptPattern = /<script|javascript:|on\w+\s*=/gi;
  if (scriptPattern.test(sanitized)) {
    return { valid: false, sanitized: "", error: "Input contains potentially unsafe content" };
  }

  return { valid: true, sanitized };
}

/**
 * Validate CVE ID format
 */
export function validateCVEId(cveId: string): boolean {
  const cvePattern = /^CVE-\d{4}-\d{4,}$/;
  return cvePattern.test(cveId);
}

/**
 * Validate IP address format
 */
export function validateIPAddress(ip: string): boolean {
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) return false;
  
  const parts = ip.split(".").map(Number);
  return parts.every(part => part >= 0 && part <= 255);
}

/**
 * Validate Ethereum address format
 */
export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate domain name format
 */
export function validateDomain(domain: string): boolean {
  const domainPattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainPattern.test(domain);
}

/**
 * Schema for common input types
 */
export const InputSchemas = {
  cveId: z.string().regex(/^CVE-\d{4}-\d{4,}$/, "Invalid CVE ID format"),
  ipAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address format"),
  ethereumAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  domain: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i, "Invalid domain format"),
  searchQuery: z.string().min(1).max(500),
};

