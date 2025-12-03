/**
 * Main Application Module
 * Coordinates between API and UI
 */

const App = {
  /**
   * Initialize application
   */
  init() {
    console.log('🛡️ WebWatcher initializing...');

    // Initialize UI
    window.WebWatcherUI.init();

    // Setup event listeners
    this.setupEventListeners();

    // Check health
    this.checkHealth();

    console.log('✅ WebWatcher ready');
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.querySelector('.send-btn');

    // Enter key to send
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    // Send button click
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        this.handleSendMessage();
      });
    }
  },

  /**
   * Handle send message
   */
  async handleSendMessage() {
    const UI = window.WebWatcherUI;
    const API = window.WebWatcherAPI;

    const message = UI.getInputValue();

    // Validate message
    const validation = API.validateMessage(message);
    if (!validation.valid) {
      UI.showError(new Error(validation.error));
      return;
    }

    // Add user message
    UI.addMessage(validation.message, 'user');
    UI.clearInput();
    UI.setInputEnabled(false);

    // Show loading
    const loadingId = UI.showLoading();

    try {
      // Send to API
      const response = await API.sendMessage(validation.message);

      // Remove loading
      UI.removeMessage(loadingId);

      // Show response
      if (response.response) {
        UI.addMessage(response.response, 'agent', true);
      } else {
        throw new Error('No response from server');
      }
    } catch (error) {
      // Remove loading
      UI.removeMessage(loadingId);

      // Show error
      UI.showError(error);
    } finally {
      // Re-enable input
      UI.setInputEnabled(true);
      document.getElementById('chatInput')?.focus();
    }
  },

  /**
   * Handle quick action
   */
  handleQuickAction(action) {
    const config = window.WebWatcherConfig;
    const UI = window.WebWatcherUI;

    const example = config.QUICK_ACTIONS[action];
    if (example) {
      UI.setInputValue(example);
      document.getElementById('chatInput')?.focus();
    }
  },

  /**
   * Check health status
   */
  async checkHealth() {
    const API = window.WebWatcherAPI;
    const healthy = await API.checkHealth();

    if (!healthy) {
      console.warn('⚠️ Server health check failed');
    }
  },
};

// Make App globally available
window.WebWatcherApp = App;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
