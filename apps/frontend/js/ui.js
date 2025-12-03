/**
 * UI Management Module
 * Handles all UI updates and interactions
 */

const UI = {
  elements: {},

  /**
   * Initialize UI elements
   */
  init() {
    this.elements = {
      chatMessages: document.getElementById('chatMessages'),
      chatInput: document.getElementById('chatInput'),
      sendButton: document.querySelector('.send-btn'),
    };

    // Focus input on load
    this.elements.chatInput?.focus();
  },

  /**
   * Add message to chat
   */
  addMessage(content, type = 'agent', isMarkdown = false) {
    if (!this.elements.chatMessages) return;

    const messageId = `msg-${Date.now()}`;
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `message message-${type}`;

    const label = type === 'user' ? 'You' : 'WebWatcher';

    // Parse markdown if needed
    let processedContent = content;
    if (isMarkdown && typeof marked !== 'undefined') {
      try {
        processedContent = marked.parse(content);
      } catch (error) {
        console.error('Markdown parsing error:', error);
      }
    }

    messageDiv.innerHTML = `
      <div class="message-label">${this.escapeHtml(label)}</div>
      <div class="message-content">${processedContent}</div>
    `;

    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();

    return messageId;
  },

  /**
   * Remove message by ID
   */
  removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
      message.remove();
    }
  },

  /**
   * Show loading indicator
   */
  showLoading() {
    return this.addMessage('<span class="loading">Analyzing</span>', 'agent');
  },

  /**
   * Show error message
   */
  showError(error) {
    const errorMessage = error.message || 'An error occurred. Please try again.';
    this.addMessage(`❌ Error: ${errorMessage}`, 'agent');
  },

  /**
   * Clear input field
   */
  clearInput() {
    if (this.elements.chatInput) {
      this.elements.chatInput.value = '';
    }
  },

  /**
   * Get input value
   */
  getInputValue() {
    return this.elements.chatInput?.value || '';
  },

  /**
   * Set input value
   */
  setInputValue(value) {
    if (this.elements.chatInput) {
      this.elements.chatInput.value = value;
    }
  },

  /**
   * Disable/enable input
   */
  setInputEnabled(enabled) {
    if (this.elements.chatInput) {
      this.elements.chatInput.disabled = !enabled;
    }
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !enabled;
    }
  },

  /**
   * Scroll to bottom of chat
   */
  scrollToBottom() {
    if (this.elements.chatMessages) {
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Simple notification (can be enhanced with a toast library)
    console.log(`[${type.toUpperCase()}] ${message}`);
  },
};

// Make UI globally available
window.WebWatcherUI = UI;
