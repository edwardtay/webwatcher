/**
 * Frontend Configuration
 */

const Config = {
  // Use Cloud Run backend URL for production, or local origin for development
  API_BASE: window.location.hostname === 'localhost' 
    ? window.location.origin 
    : 'https://webwatcher-ucxwlmpe3q-uc.a.run.app',
  
  ENDPOINTS: {
    CHAT: '/api/chat',
    HEALTH: '/health',
    SECURITY: '/api/security',
  },
  
  UI: {
    MAX_MESSAGE_LENGTH: 5000,
    TYPING_INDICATOR_DELAY: 500,
    ERROR_DISPLAY_DURATION: 5000,
    AUTO_SCROLL_THRESHOLD: 100,
  },
  
  QUICK_ACTIONS: {
    scan_url: 'Scan https://example.com for threats',
    check_domain: 'Check domain reputation for example.com',
    analyze_email: 'Analyze email from suspicious@example.com',
    breach_check: 'Check if user@example.com has been breached',
  },
};

// Make config globally available
window.WebWatcherConfig = Config;
