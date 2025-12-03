/**
 * Rate limiter utility for API calls
 * Prevents excessive API usage and ensures fair resource usage
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   * @param key Unique identifier for the rate limit (e.g., API endpoint, user ID)
   * @returns true if request is allowed, false if rate limit exceeded
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );
    
    if (validRequests.length >= this.config.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );
    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }
}

// Default rate limiters for different API types
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests
  windowMs: 60000, // per minute
});

export const cveRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 requests
  windowMs: 6000, // per 6 seconds (NVD API rate limit)
});

export const searchRateLimiter = new RateLimiter({
  maxRequests: 20, // 20 requests
  windowMs: 60000, // per minute
});

