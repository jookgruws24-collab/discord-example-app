/**
 * Rate Limiter
 * 
 * Simple in-memory rate limiter using sliding window algorithm.
 * Prevents abuse by limiting the number of requests per user within a time window.
 */

class RateLimiter {
  constructor(maxRequests = 5, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // userId -> array of timestamps
    this.cleanupCounter = 0;
  }

  /**
   * Check if user is rate limited
   * @param {string} userId - Discord user ID
   * @returns {Object} - { limited: boolean, retryAfter?: number }
   */
  check(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      const oldestRequest = validRequests[0];
      const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
      return { limited: true, retryAfter };
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    
    // Cleanup old users periodically (every 1000 requests)
    this.cleanupCounter++;
    if (this.cleanupCounter > 1000) {
      this.cleanup();
      this.cleanupCounter = 0;
    }
    
    return { limited: false };
  }

  /**
   * Clean up expired entries from memory
   */
  cleanup() {
    const now = Date.now();
    for (const [userId, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, validRequests);
      }
    }
  }

  /**
   * Reset rate limit for a specific user (for testing or admin override)
   * @param {string} userId - Discord user ID
   */
  reset(userId) {
    this.requests.delete(userId);
  }

  /**
   * Get current request count for a user
   * @param {string} userId - Discord user ID
   * @returns {number} - Number of requests in current window
   */
  getRequestCount(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    return userRequests.filter(time => now - time < this.windowMs).length;
  }
}

// Create rate limiters for different command types
export const commandRateLimiter = new RateLimiter(5, 60000); // 5 commands per minute
export const buttonRateLimiter = new RateLimiter(10, 60000); // 10 button clicks per minute
export const adminCommandRateLimiter = new RateLimiter(10, 60000); // 10 admin commands per minute

export default RateLimiter;
