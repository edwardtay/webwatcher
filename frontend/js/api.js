/**
 * API Communication Module
 * Handles all API requests with error handling and retries
 */

const API = {
  /**
   * Send chat message to API
   */
  async sendMessage(message) {
    const config = window.WebWatcherConfig;
    
    try {
      const response = await fetch(`${config.API_BASE}${config.ENDPOINTS.CHAT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  /**
   * Check health status
   */
  async checkHealth() {
    const config = window.WebWatcherConfig;
    
    try {
      const response = await fetch(`${config.API_BASE}${config.ENDPOINTS.HEALTH}`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  },

  /**
   * Validate message before sending
   */
  validateMessage(message) {
    const config = window.WebWatcherConfig;
    
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message must be a string' };
    }

    const trimmed = message.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    if (trimmed.length > config.UI.MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message too long (max ${config.UI.MAX_MESSAGE_LENGTH} characters)` };
    }

    return { valid: true, message: trimmed };
  },
};

// Make API globally available
window.WebWatcherAPI = API;
