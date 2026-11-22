// app.js — Main Application Lifecycle & UI Coordination

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Subsystems
  const state = window.robotState;
  const api = window.robotAPI;
  
  // Robot companion controller
  const robot = new RobotCompanion(state);
  window.robotCompanion = robot;

  // Voice STT/TTS controller
  const voice = new VoiceController(state);
  window.voiceController = voice;

  // Chat controller
  const chat = new ChatController(state, api, voice);
  window.chatController = chat;

  // 2. Setup Header & Connection Indicator
  setupConnectionIndicator(state, api);

  // 3. Setup Info Panel (Telemetry & Hardware Details)
  setupInfoPanel(state, api);

  // 4. Setup Capabilities Drawer / Modal
  setupCapabilitiesModal(state, api, chat);

  // 5. Setup Settings Modal
  setupSettingsModal(state, api);

  // 6. Setup Toast System
  setupToastSystem();

  // 7. Start Polling
  api.startStatusPolling(5000);

  // 8. Clock updater for Info Panel
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  console.log('🤖 ROBO PET Frontend initialized successfully.');
});

// Toast notification helper
function setupToastSystem() {
  const container = document.getElementById('toast-container');
  window.showToast = (msg, type = 'info') => {
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${msg}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };
}

// Connection Indicator & Live Status
function setupConnectionIndicator(state, api) {
  const statusPill = document.getElementById('connection-status-pill');
  const statusDot = statusPill?.querySelector('.status-dot');
  const statusText = statusPill?.querySelector('.status-text');

  function updateUI() {
    if (!statusPill) return;
    const conn = state.get('connectionStatus');
    const isDemo = state.get('demoMode');

    statusPill.classList.remove('status-online', 'status-offline', 'status-demo');

    if (isDemo || conn === 'demo') {
      statusPill.classList.add('status-demo');
      if (statusText) statusText.textContent = 'Demo Mode';
      statusPill.title = 'Running in Mock/Demo Mode (Click to open Settings)';
    } else if (conn === 'online') {
      statusPill.classList.add('status-online');
      if (statusText) statusText.textContent = 'Backend Online';
      statusPill.title = `Connected to ${state.get('backendUrl')}`;
    } else {
      statusPill.classList.add('status-offline');
      if (statusText) statusText.textContent = 'Backend Offline';
      statusPill.title = 'Cannot reach Flask backend. Click to configure or toggle Demo Mode.';
    }
  }

  state.subscribe(['connectionStatus', 'demoMode'], updateUI);
  updateUI();

  if (statusPill) {
    statusPill.addEventListener('click', () => {
      openModal('settings-modal');
    });
  }
}

// Info Panel / Telemetry
function setupInfoPanel(state, api) {
  const infoToggleBtn = document.getElementById('btn-info-toggle');
  const infoPanel = document.getElementById('info-panel');
  const infoCloseBtn = document.getElementById('btn-info-close');

  const tempVal = document.getElementById('info-temp-val');
  const distVal = document.getElementById('info-dist-val');
  const batteryVal = document.getElementById('info-battery-val');
  const esp32Status = document.getElementById('info-esp32-status');
  const timerVal = document.getElementById('info-timer-val');

  if (infoToggleBtn && infoPanel) {
    infoToggleBtn.addEventListener('click', () => {
      infoPanel.classList.toggle('open');
      infoToggleBtn.classList.toggle('active', infoPanel.classList.contains('open'));
    });
  }

  if (infoCloseBtn && infoPanel) {
    infoCloseBtn.addEventListener('click', () => {
      infoPanel.classList.remove('open');
      if (infoToggleBtn) infoToggleBtn.classList.remove('active');
    });
  }

  // Update telemetry displays
  state.subscribe(['telemetry', 'esp32Connected', 'connectionStatus', 'demoMode'], () => {
    const tele = state.get('telemetry');
    const esp32 = state.get('esp32Connected');
    const isOnline = state.get('connectionStatus') === 'online' || state.get('demoMode');

    // Temperature
    if (tempVal) {
      if (isOnline && tele.temperature !== null) {
        tempVal.textContent = `${tele.temperature} °C`;
        tempVal.classList.remove('val-unavailable');
      } else {
        tempVal.textContent = '-- °C (Unavailable)';
        tempVal.classList.add('val-unavailable');
      }
    }

    // Distance
    if (distVal) {
      if (isOnline && tele.distance !== null) {
        distVal.textContent = `${tele.distance} cm`;
        distVal.classList.remove('val-unavailable');
      } else {
        distVal.textContent = '-- cm (Unavailable)';
        distVal.classList.add('val-unavailable');
      }
    }

    // Battery
    if (batteryVal) {
      if (tele.battery !== null) {
        batteryVal.textContent = `${tele.battery}%`;
        batteryVal.classList.remove('val-unavailable');
      } else {
        batteryVal.textContent = '--%';
        batteryVal.classList.add('val-unavailable');
      }
    }

    // ESP32 Status
    if (esp32Status) {
      if (esp32) {
        esp32Status.innerHTML = '<span class="status-chip success">ESP32 Linked</span>';
      } else {
        esp32Status.innerHTML = '<span class="status-chip danger">ESP32 Offline</span>';
      }
    }

    // Timer
    if (timerVal) {
      if (tele.timerActive) {
        timerVal.textContent = `${tele.timerRemaining}s remaining`;
      } else {
        timerVal.textContent = 'None active';
      }
    }
  });
}

// Live Time & Date updater
function updateLiveClock() {
  const clockEl = document.getElementById('info-time-val');
  const dateEl = document.getElementById('info-date-val');

  if (clockEl || dateEl) {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
}

// Capabilities Modal & Quick Commands
function setupCapabilitiesModal(state, api, chat) {
  const openBtn = document.getElementById('btn-capabilities');
  const modal = document.getElementById('capabilities-modal');
  const closeBtn = document.getElementById('btn-capabilities-close');
  const categoryTabs = document.querySelectorAll('.cap-tab-btn');
  const commandCards = document.querySelectorAll('.capability-card');

  if (openBtn) {
    openBtn.addEventListener('click', () => openModal('capabilities-modal'));
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal('capabilities-modal'));
  }

  // Filter tabs
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.category;

      commandCards.forEach(card => {
        if (cat === 'all' || card.dataset.category === cat) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // Clicking a capability card triggers execution
  commandCards.forEach(card => {
    card.addEventListener('click', async () => {
      const command = card.dataset.command;
      const category = card.dataset.category;
      const isPendingHardware = card.dataset.hardwarePending === 'true';

      if (isPendingHardware && !state.get('demoMode') && !state.get('esp32Connected')) {
        window.showToast(`Hardware for '${command}' is currently offline/pending.`, 'warning');
        return;
      }

      window.showToast(`Dispatching command: ${command}...`, 'info');
      closeModal('capabilities-modal');

      try {
        state.set({ isTyping: true });
        const res = await api.sendCommand(command, category);

        if (res.emotion) state.set({ currentEmotion: res.emotion });
        if (res.action) state.set({ currentAction: res.action });

        state.addMessage({
          sender: 'robot',
          text: res.message || `Executed: **${command}**`,
          emotion: res.emotion || 'neutral',
          action: res.action || null,
          timestamp: new Date()
        });

        if (window.voiceController && res.message) {
          window.voiceController.speak(res.message);
        }
      } catch (err) {
        state.addMessage({
          sender: 'robot',
          text: `Failed to execute ${command}: ${err.message}`,
          isError: true,
          timestamp: new Date()
        });
      } finally {
        state.set({ isTyping: false });
      }
    });
  });
}

// Settings Modal
function setupSettingsModal(state, api) {
  const openBtn = document.getElementById('btn-settings');
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('btn-settings-close');
  const saveBtn = document.getElementById('btn-save-settings');

  const backendInput = document.getElementById('settings-backend-url');
  const demoToggle = document.getElementById('settings-demo-mode-toggle');
  const voiceToggle = document.getElementById('settings-voice-output-toggle');
  const soundToggle = document.getElementById('settings-sound-effects-toggle');
  const voiceSelect = document.getElementById('settings-voice-select');
  const testVoiceBtn = document.getElementById('btn-test-voice');
  const testConnBtn = document.getElementById('btn-test-backend-conn');
  const connStatusMsg = document.getElementById('backend-test-status');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      // Sync form with current state
      if (backendInput) backendInput.value = state.get('backendUrl');
      if (demoToggle) demoToggle.checked = state.get('demoMode');
      if (voiceToggle) voiceToggle.checked = state.get('voiceOutputEnabled');
      if (soundToggle) soundToggle.checked = state.get('soundEffectsEnabled');
      if (connStatusMsg) connStatusMsg.textContent = '';
      populateVoiceSelect();
      openModal('settings-modal');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal('settings-modal'));
  }

  function populateVoiceSelect() {
    if (!voiceSelect || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const currentURI = state.get('selectedVoiceURI');
    
    voiceSelect.innerHTML = '<option value="">Default (Natural Robot Voice)</option>';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.voiceURI === currentURI) opt.selected = true;
      voiceSelect.appendChild(opt);
    });
  }

  // Populate voices when available
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoiceSelect;
  }

  // Test voice button
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', () => {
      if (window.voiceController) {
        window.voiceController.speak("Hello! This is how I will sound when speaking to you.");
      }
    });
  }

  // Test backend connection button
  if (testConnBtn) {
    testConnBtn.addEventListener('click', async () => {
      const url = backendInput ? backendInput.value.trim() : state.get('backendUrl');
      if (connStatusMsg) connStatusMsg.textContent = 'Testing connection...';
      
      try {
        const res = await fetch(`${url.replace(/\/+$/, '')}/status`, {
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          if (connStatusMsg) {
            connStatusMsg.innerHTML = '<span class="status-chip success">✓ Connected to Flask backend!</span>';
          }
        } else {
          if (connStatusMsg) {
            connStatusMsg.innerHTML = `<span class="status-chip danger">Server returned HTTP ${res.status}</span>`;
          }
        }
      } catch (err) {
        if (connStatusMsg) {
          connStatusMsg.innerHTML = '<span class="status-chip danger">✗ Failed: ' + err.message + '</span>';
        }
      }
    });
  }

  // Save settings
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newUrl = backendInput ? backendInput.value.trim() : state.get('backendUrl');
      const newDemo = demoToggle ? demoToggle.checked : state.get('demoMode');
      const newVoice = voiceToggle ? voiceToggle.checked : state.get('voiceOutputEnabled');
      const newSound = soundToggle ? soundToggle.checked : state.get('soundEffectsEnabled');
      const newVoiceURI = voiceSelect ? voiceSelect.value : state.get('selectedVoiceURI');

      state.set({
        backendUrl: newUrl,
        demoMode: newDemo,
        voiceOutputEnabled: newVoice,
        soundEffectsEnabled: newSound,
        selectedVoiceURI: newVoiceURI
      });

      // Update voice toggle button on chat bar
      if (window.voiceController) {
        window.voiceController.updateVoiceToggleUI(newVoice);
      }

      window.showToast('Settings saved successfully', 'success');
      closeModal('settings-modal');
    });
  }
}

// Modal management utilities
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.closest('.modal-container')?.classList.remove('open');
  }
});
