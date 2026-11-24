// state.js — Centralized Reactive State Store for ROBO PET

class RobotState {
  constructor() {
    this._listeners = new Map();

    // Compute dynamic default backend URL (works on both laptop and mobile)
    let defaultBackend = 'http://localhost:5000';
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      const port = window.location.port === '5000' || !window.location.port ? '5000' : window.location.port;
      defaultBackend = `${window.location.protocol}//${window.location.hostname}:${port}`;
    }
    let savedBackendUrl = localStorage.getItem('robopet_backend_url') || defaultBackend;
    // Adapt saved URL if user was previously on localhost but is now accessing from mobile via LAN IP
    if (savedBackendUrl.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      savedBackendUrl = savedBackendUrl.replace('localhost', window.location.hostname);
    }

    const savedDemoMode = localStorage.getItem('robopet_demo_mode');
    const savedVoiceOutput = localStorage.getItem('robopet_voice_output');
    const savedSoundEffects = localStorage.getItem('robopet_sound_effects');

    this._state = {
      // Connection & Backend
      backendUrl: savedBackendUrl,
      demoMode: savedDemoMode === null ? true : savedDemoMode === 'true', // Defaults to demo mode for initial preview
      connectionStatus: 'disconnected', // 'online' | 'offline' | 'connecting' | 'demo'
      esp32Connected: false,
      lastPingTime: null,

      // Robot Companion
      currentEmotion: 'neutral', // 'happy' | 'sad' | 'angry' | 'sleepy' | 'neutral' | 'surprised' | 'confused'
      currentAction: null,       // e.g. 'dance', 'wave', 'nod', 'look'
      isAvatarSpeaking: false,
      isAvatarInteracting: false,

      // Voice & Audio
      voiceOutputEnabled: savedVoiceOutput === null ? true : savedVoiceOutput === 'true',
      soundEffectsEnabled: savedSoundEffects === null ? true : savedSoundEffects === 'true',
      isListening: false,
      isSpeaking: false,
      availableVoices: [],
      selectedVoiceURI: localStorage.getItem('robopet_voice_uri') || '',
      speechRate: 1.0,
      speechPitch: 1.1,

      // Chat
      messages: [],
      isTyping: false,
      autoScroll: true,

      // Hardware Telemetry & Timers
      telemetry: {
        battery: 88,       // percentage
        timerActive: false,
        timerRemaining: 0,
        timerLabel: '',
        lastUpdated: null
      },

      // UI States
      capabilitiesOpen: false,
      settingsOpen: false,
      infoPanelOpen: false,
      activeTab: 'all' // for capabilities drawer
    };
  }

  // Get current snapshot of state
  get state() {
    return this._state;
  }

  get(key) {
    return this._state[key];
  }

  // Update one or more keys and notify listeners
  set(updates) {
    const changedKeys = [];
    for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        if (this._state[key] !== updates[key]) {
          this._state[key] = updates[key];
          changedKeys.push(key);
        }
      }
    }

    // Persist specific settings
    if (updates.backendUrl !== undefined) {
      localStorage.setItem('robopet_backend_url', updates.backendUrl);
    }
    if (updates.demoMode !== undefined) {
      localStorage.setItem('robopet_demo_mode', updates.demoMode);
    }
    if (updates.voiceOutputEnabled !== undefined) {
      localStorage.setItem('robopet_voice_output', updates.voiceOutputEnabled);
    }
    if (updates.soundEffectsEnabled !== undefined) {
      localStorage.setItem('robopet_sound_effects', updates.soundEffectsEnabled);
    }
    if (updates.selectedVoiceURI !== undefined) {
      localStorage.setItem('robopet_voice_uri', updates.selectedVoiceURI);
    }

    if (changedKeys.length > 0) {
      this._notify(changedKeys);
    }
  }

  // Update telemetry partially
  updateTelemetry(telemetryUpdates) {
    this._state.telemetry = {
      ...this._state.telemetry,
      ...telemetryUpdates,
      lastUpdated: new Date()
    };
    this._notify(['telemetry']);
  }

  // Add a new message to temporary session
  addMessage(message) {
    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      sender: message.sender, // 'user' | 'robot' | 'system'
      text: message.text,
      timestamp: message.timestamp || new Date(),
      emotion: message.emotion || null,
      action: message.action || null,
      isError: !!message.isError
    };

    this._state.messages = [...this._state.messages, newMsg];
    this._notify(['messages']);
    return newMsg;
  }

  // Clear messages (session only)
  clearMessages() {
    this._state.messages = [];
    this._notify(['messages']);
  }

  // Event listener pattern
  subscribe(keyOrKeys, callback) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    keys.forEach(k => {
      if (!this._listeners.has(k)) {
        this._listeners.set(k, new Set());
      }
      this._listeners.get(k).add(callback);
    });

    // Return unsubscribe function
    return () => {
      keys.forEach(k => {
        if (this._listeners.has(k)) {
          this._listeners.get(k).delete(callback);
        }
      });
    };
  }

  _notify(changedKeys) {
    const notifiedCallbacks = new Set();
    changedKeys.forEach(key => {
      if (this._listeners.has(key)) {
        this._listeners.get(key).forEach(cb => notifiedCallbacks.add(cb));
      }
    });

    // Also notify wildcard '*' listeners
    if (this._listeners.has('*')) {
      this._listeners.get('*').forEach(cb => notifiedCallbacks.add(cb));
    }

    notifiedCallbacks.forEach(cb => {
      try {
        cb(this._state, changedKeys);
      } catch (err) {
        console.error('[RobotState] Error in subscriber callback:', err);
      }
    });
  }
}

// Global state singleton
window.robotState = new RobotState();
