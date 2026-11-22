// robot.js — 2D Animated Robot Avatar Controller & Synthesized Sound Effects

class RobotCompanion {
  constructor(state) {
    this.state = state;
    this.avatarElement = null;
    this.visorEyes = null;
    this.emotionBadge = null;
    this.audioCtx = null;
    this.blinkTimer = null;
    this.actionTimeout = null;

    // Emotion definitions for visual styling & labels
    this.emotions = {
      happy: { label: 'Happy', emoji: '😊', glow: '#38bdf8' },
      sad: { label: 'Melancholy', emoji: '🥺', glow: '#60a5fa' },
      angry: { label: 'Grumpy', emoji: '😤', glow: '#f87171' },
      sleepy: { label: 'Sleepy', emoji: '😴', glow: '#a78bfa' },
      neutral: { label: 'Attentive', emoji: '🤖', glow: '#38bdf8' },
      surprised: { label: 'Surprised', emoji: '😲', glow: '#facc15' },
      confused: { label: 'Curious', emoji: '🤔', glow: '#c084fc' }
    };

    this.init();
  }

  init() {
    this.avatarElement = document.getElementById('robot-avatar-stage');
    this.visorEyes = document.getElementById('robot-eyes');
    this.emotionBadge = document.getElementById('robot-emotion-pill');

    // Subscribe to state changes
    this.state.subscribe('currentEmotion', (state) => {
      this.updateEmotion(state.currentEmotion);
    });

    this.state.subscribe('currentAction', (state) => {
      if (state.currentAction) {
        this.performAction(state.currentAction);
      }
    });

    this.state.subscribe('isSpeaking', (state) => {
      this.toggleSpeakingAnimation(state.isSpeaking);
    });

    // Start natural blinking cycle
    this.startBlinkingCycle();

    // Setup interactive avatar click (boop!)
    if (this.avatarElement) {
      this.avatarElement.addEventListener('click', () => this.handleAvatarClick());
    }

    // Set initial emotion
    this.updateEmotion(this.state.get('currentEmotion') || 'neutral');
  }

  // Update visual presentation of emotion
  updateEmotion(emotionName) {
    const validEmotion = this.emotions[emotionName] ? emotionName : 'neutral';
    const config = this.emotions[validEmotion];

    if (!this.avatarElement) return;

    // Remove all previous emotion classes
    Object.keys(this.emotions).forEach(em => {
      this.avatarElement.classList.remove(`emotion-${em}`);
    });

    // Add current emotion class
    this.avatarElement.classList.add(`emotion-${validEmotion}`);

    // Update emotion indicator badge
    if (this.emotionBadge) {
      this.emotionBadge.innerHTML = `
        <span class="emotion-dot"></span>
        <span class="emotion-text">${config.emoji} ${config.label}</span>
      `;
      this.emotionBadge.style.setProperty('--emotion-glow', config.glow);
    }

    // Update SVG eyes geometry based on emotion
    this.renderEyesGeometry(validEmotion);

    // Play subtle emotion sound effect
    this.playChirp(validEmotion);
  }

  // Render the SVG eye shapes dynamically for crisp rendering
  renderEyesGeometry(emotion) {
    if (!this.visorEyes) return;

    let leftEyeMarkup = '';
    let rightEyeMarkup = '';
    let extraElements = '';

    switch (emotion) {
      case 'happy':
        // Upward curved smiling arcs
        leftEyeMarkup = `<path d="M 18 36 Q 30 20 42 36" class="eye-path happy-path" />`;
        rightEyeMarkup = `<path d="M 58 36 Q 70 20 82 36" class="eye-path happy-path" />`;
        extraElements = `
          <circle cx="16" cy="42" r="4" class="blush" />
          <circle cx="84" cy="42" r="4" class="blush" />
        `;
        break;

      case 'sad':
        // Downward curved droopy eyes
        leftEyeMarkup = `<path d="M 18 28 Q 30 40 42 32" class="eye-path sad-path" />`;
        rightEyeMarkup = `<path d="M 58 32 Q 70 40 82 28" class="eye-path sad-path" />`;
        extraElements = `<circle cx="50" cy="48" r="2" class="sad-tear" />`;
        break;

      case 'angry':
        // Sharp diagonal aggressive brows & slits
        leftEyeMarkup = `<path d="M 18 24 L 42 34 L 18 36 Z" class="eye-path angry-path" />`;
        rightEyeMarkup = `<path d="M 82 24 L 58 34 L 82 36 Z" class="eye-path angry-path" />`;
        break;

      case 'sleepy':
        // Horizontal closed calm slits with Zzz
        leftEyeMarkup = `<line x1="20" y1="32" x2="40" y2="32" class="eye-path sleepy-path" />`;
        rightEyeMarkup = `<line x1="60" y1="32" x2="80" y2="32" class="eye-path sleepy-path" />`;
        extraElements = `
          <g class="sleep-zzz">
            <text x="76" y="20" class="zzz-text z1">Z</text>
            <text x="86" y="14" class="zzz-text z2">z</text>
            <text x="94" y="8" class="zzz-text z3">z</text>
          </g>
        `;
        break;

      case 'surprised':
        // Wide glowing circular eyes & small O mouth
        leftEyeMarkup = `<circle cx="30" cy="30" r="10" class="eye-path surprised-path" />`;
        rightEyeMarkup = `<circle cx="70" cy="30" r="10" class="eye-path surprised-path" />`;
        extraElements = `<circle cx="50" cy="42" r="3.5" class="surprised-mouth" />`;
        break;

      case 'confused':
        // Asymmetric: one high arched eye, one squinted eye
        leftEyeMarkup = `<circle cx="30" cy="27" r="9" class="eye-path" />`;
        rightEyeMarkup = `<path d="M 60 34 Q 70 28 80 34" class="eye-path confused-squint" />`;
        extraElements = `<text x="84" y="20" class="confused-mark">?</text>`;
        break;

      case 'neutral':
      default:
        // Friendly rounded pill/capsule eyes
        leftEyeMarkup = `<rect x="20" y="22" width="18" height="18" rx="8" class="eye-path neutral-path" />`;
        rightEyeMarkup = `<rect x="62" y="22" width="18" height="18" rx="8" class="eye-path neutral-path" />`;
        break;
    }

    this.visorEyes.innerHTML = `
      ${leftEyeMarkup}
      ${rightEyeMarkup}
      ${extraElements}
    `;
  }

  // Trigger movement animation on the avatar
  performAction(actionName) {
    if (!this.avatarElement) return;

    // Clear previous action classes
    const movementClasses = [
      'action-dance', 'action-nod', 'action-shake',
      'action-look_left', 'action-look_right', 'action-look_center',
      'action-wave', 'action-wiggle', 'action-stop'
    ];
    this.avatarElement.classList.remove(...movementClasses);

    if (actionName === 'stop') return;

    const actionClass = `action-${actionName}`;
    this.avatarElement.classList.add(actionClass);

    // Audio chime for movement
    this.playActionChime(actionName);

    // Auto-remove movement after completion
    clearTimeout(this.actionTimeout);
    this.actionTimeout = setTimeout(() => {
      this.avatarElement.classList.remove(actionClass);
      this.state.set({ currentAction: null });
    }, 2800);
  }

  // Toggle speaking waveform visual pulse
  toggleSpeakingAnimation(isSpeaking) {
    if (!this.avatarElement) return;
    if (isSpeaking) {
      this.avatarElement.classList.add('is-speaking');
    } else {
      this.avatarElement.classList.remove('is-speaking');
    }
  }

  // Automatic natural blinking for awake states
  startBlinkingCycle() {
    const scheduleNextBlink = () => {
      const delay = Math.floor(Math.random() * 3500) + 2500; // 2.5s to 6s
      this.blinkTimer = setTimeout(() => {
        const currentEm = this.state.get('currentEmotion');
        if (currentEm !== 'sleepy' && this.avatarElement) {
          this.avatarElement.classList.add('is-blinking');
          setTimeout(() => {
            if (this.avatarElement) {
              this.avatarElement.classList.remove('is-blinking');
            }
            scheduleNextBlink();
          }, 180);
        } else {
          scheduleNextBlink();
        }
      }, delay);
    };

    scheduleNextBlink();
  }

  // Interactive Boop handler
  handleAvatarClick() {
    // Play sound and trigger joyful wiggle
    this.playBoopSound();
    this.performAction('wiggle');
    this.state.updateEmotion('happy');

    // Visual pulse
    this.avatarElement.classList.add('avatar-booped');
    setTimeout(() => {
      if (this.avatarElement) {
        this.avatarElement.classList.remove('avatar-booped');
      }
    }, 400);
  }

  // ==========================================
  // WEB AUDIO API SYNTHESIZER (Robotic Sounds)
  // Self-contained sound engine without external MP3 files
  // ==========================================

  _initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBoopSound() {
    if (!this.state.get('soundEffectsEnabled')) return;
    try {
      this._initAudioContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      const now = this.audioCtx.currentTime;
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  playChirp(emotion) {
    if (!this.state.get('soundEffectsEnabled')) return;
    try {
      this._initAudioContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      let startFreq = 440;
      let endFreq = 660;

      if (emotion === 'happy') {
        startFreq = 520;
        endFreq = 980;
      } else if (emotion === 'sad') {
        startFreq = 400;
        endFreq = 260;
      } else if (emotion === 'angry') {
        startFreq = 220;
        endFreq = 160;
        osc.type = 'sawtooth';
      } else if (emotion === 'sleepy') {
        startFreq = 300;
        endFreq = 220;
      } else if (emotion === 'surprised') {
        startFreq = 350;
        endFreq = 880;
      }

      osc.type = osc.type || 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {
      // Audio fallback
    }
  }

  playActionChime(action) {
    if (!this.state.get('soundEffectsEnabled')) return;
    try {
      this._initAudioContext();
      if (!this.audioCtx) return;

      const notes = action === 'dance' ? [440, 554, 659, 880] : [520, 650];
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const start = this.audioCtx.currentTime + (idx * 0.08);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(start);
        osc.stop(start + 0.12);
      });
    } catch (e) {
      // Audio fallback
    }
  }
}

// Global companion singleton
window.robotCompanion = null;
