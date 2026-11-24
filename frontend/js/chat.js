// chat.js — Conversational Chat Interface Controller

class ChatController {
  constructor(state, api, voice) {
    this.state = state;
    this.api = api;
    this.voice = voice;

    this.messagesContainer = null;
    this.messagesList = null;
    this.chatForm = null;
    this.inputField = null;
    this.sendBtn = null;
    this.typingIndicator = null;
    this.clearBtn = null;
    this.suggestionsContainer = null;

    this.userScrolledUp = false;

    this.init();
  }

  init() {
    this.messagesContainer = document.getElementById('chat-messages-container');
    this.messagesList = document.getElementById('chat-messages-list');
    this.chatForm = document.getElementById('chat-input-form');
    this.inputField = document.getElementById('chat-input-field');
    this.sendBtn = document.getElementById('btn-send');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.clearBtn = document.getElementById('btn-clear-chat');
    this.suggestionsContainer = document.getElementById('chat-suggestions');

    this.bindEvents();
    this.subscribeState();
    this.renderWelcomeMessage();
  }

  bindEvents() {
    // Form submit / Send message
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleUserSend();
      });
    }

    // Enter to submit, Shift+Enter for newline
    if (this.inputField) {
      this.inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleUserSend();
        }
      });

      this.inputField.addEventListener('input', () => {
        this.adjustInputHeight();
      });
    }

    // Scroll listener to toggle auto-scroll lock
    if (this.messagesContainer) {
      this.messagesContainer.addEventListener('scroll', () => {
        const threshold = 60;
        const isNearBottom =
          this.messagesContainer.scrollHeight -
          this.messagesContainer.scrollTop -
          this.messagesContainer.clientHeight <= threshold;
        this.userScrolledUp = !isNearBottom;
      });
    }

    // Clear chat button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.confirmClearChat();
      });
    }

    // Suggestion chips click delegation
    if (this.suggestionsContainer) {
      this.suggestionsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.suggestion-chip');
        if (chip && chip.dataset.prompt) {
          if (this.inputField) {
            this.inputField.value = chip.dataset.prompt;
            this.handleUserSend();
          }
        }
      });
    }
  }

  subscribeState() {
    this.state.subscribe('messages', () => {
      this.renderMessages();
    });

    this.state.subscribe('isTyping', (state) => {
      this.toggleTypingIndicator(state.isTyping);
    });
  }

  adjustInputHeight() {
    if (!this.inputField) return;
    this.inputField.style.height = 'auto';
    const newHeight = Math.min(this.inputField.scrollHeight, 120);
    this.inputField.style.height = `${newHeight}px`;
  }

  // Handle user submitting message
  async handleUserSend() {
    if (!this.inputField) return;
    const text = this.inputField.value.trim();
    if (!text) return;

    if (this.state.get('isTyping')) return;

    // Reset input
    this.inputField.value = '';
    this.adjustInputHeight();
    this.userScrolledUp = false;

    // Add user message to session
    this.state.addMessage({
      sender: 'user',
      text: text,
      timestamp: new Date()
    });

    // Start typing indicator
    this.state.set({ isTyping: true });

    try {
      // Send talk request to backend API (or mock demo)
      const result = await this.api.sendTalk(text);

      // Backend response received!
      const robotEmotion = result.emotion || 'neutral';
      const robotAction = result.action || null;

      // Update robot companion visual state
      this.state.set({
        currentEmotion: robotEmotion,
        currentAction: robotAction
      });

      // Add robot message to session
      const robotMsg = this.state.addMessage({
        sender: 'robot',
        text: result.response,
        emotion: robotEmotion,
        action: robotAction,
        timestamp: new Date()
      });

      // Speak aloud if enabled
      if (this.voice) {
        this.voice.speak(result.response);
      }
    } catch (err) {
      // Backend or network error - friendly message with retry
      console.warn('[Chat] Message failed:', err);
      const isTimeout = err.name === 'TimeoutError' || err.message.includes('timeout') || err.message.includes('aborted');
      const errorMsg = isTimeout 
        ? "AI response took longer than expected! Please try again or click Retry."
        : "I couldn't reach my brain server! Please verify your Flask backend is running on " +
          this.state.get('backendUrl') + ", or switch to Demo Mode in Settings.";

      this.state.addMessage({
        sender: 'robot',
        text: errorMsg,
        isError: true,
        timestamp: new Date()
      });
    } finally {
      this.state.set({ isTyping: false });
    }
  }

  // Render all messages from temporary session
  renderMessages() {
    if (!this.messagesList) return;
    const messages = this.state.get('messages');

    this.messagesList.innerHTML = messages.map(msg => this.createMessageHTML(msg)).join('');

    // Attach retry button listeners if any error messages
    const retryButtons = this.messagesList.querySelectorAll('.btn-retry-msg');
    retryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lastUser = [...messages].reverse().find(m => m.sender === 'user');
        if (lastUser && this.inputField) {
          this.inputField.value = lastUser.text;
          this.handleUserSend();
        }
      });
    });

    if (!this.userScrolledUp) {
      this.scrollToBottom();
    }
  }

  createMessageHTML(msg) {
    const isUser = msg.sender === 'user';
    const isError = msg.isError;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let actionBadge = '';
    if (msg.action) {
      const formattedAction = msg.action.replace('_', ' ').toUpperCase();
      actionBadge = `
        <div class="msg-action-pill">
          <span class="action-icon">⚡</span> Action: <strong>${formattedAction}</strong>
        </div>
      `;
    }

    let emotionBadge = '';
    if (msg.emotion && msg.emotion !== 'neutral') {
      emotionBadge = `<span class="msg-emotion-tag">${msg.emotion}</span>`;
    }

    if (isUser) {
      return `
        <div class="chat-message-row user-row" id="${msg.id}">
          <div class="chat-bubble user-bubble">
            <div class="bubble-content">${this.escapeHTML(msg.text)}</div>
            <div class="bubble-meta">
              <span class="bubble-time">${timeStr}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="chat-message-row robot-row ${isError ? 'error-row' : ''}" id="${msg.id}">
          <div class="robot-avatar-mini" title="ROBO PET">
            <span class="mini-bot-icon">🤖</span>
          </div>
          <div class="chat-bubble robot-bubble ${isError ? 'bubble-error' : ''}">
            <div class="bubble-header">
              <span class="robot-name">ROBO PET</span>
              ${emotionBadge}
            </div>
            <div class="bubble-content">${this.formatRobotText(msg.text)}</div>
            ${actionBadge}
            <div class="bubble-meta">
              <span class="bubble-time">${timeStr}</span>
              ${isError ? '<button class="btn-retry-msg" type="button">↻ Retry</button>' : ''}
            </div>
          </div>
        </div>
      `;
    }
  }

  formatRobotText(text) {
    // Format bold markdown **text** and bullet points safely
    let formatted = this.escapeHTML(text);
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return formatted;
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }

  toggleTypingIndicator(isTyping) {
    if (!this.typingIndicator) return;
    if (isTyping) {
      this.typingIndicator.classList.remove('hidden');
      if (!this.userScrolledUp) {
        this.scrollToBottom();
      }
    } else {
      this.typingIndicator.classList.add('hidden');
    }
  }

  scrollToBottom(smooth = true) {
    if (!this.messagesContainer) return;
    this.messagesContainer.scrollTo({
      top: this.messagesContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  renderWelcomeMessage() {
    if (this.state.get('messages').length === 0) {
      this.state.addMessage({
        sender: 'robot',
        text: "Beep boop! 🤖 Hello, I'm **ROBO PET**, your AI-powered companion! You can chat with me, ask me to dance, look around, or wave, and talk to me using your voice. How can I help you today?",
        emotion: 'happy',
        timestamp: new Date()
      });
    }
  }

  confirmClearChat() {
    if (confirm("Are you sure you want to clear the conversation?")) {
      this.state.clearMessages();
      this.renderWelcomeMessage();
      if (window.showToast) {
        window.showToast("Chat history cleared", "info");
      }
    }
  }
}

// Global chat controller singleton
window.chatController = null;
