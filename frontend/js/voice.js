// voice.js — Speech Recognition (STT) and Speech Synthesis (TTS) Engine

class VoiceController {
  constructor(state) {
    this.state = state;
    this.recognition = null;
    this.synth = window.speechSynthesis || null;
    this.currentUtterance = null;
    this.isSupported = {
      stt: false,
      tts: false
    };

    this.micBtn = null;
    this.voiceToggleBtn = null;
    this.textInput = null;

    this.init();
  }

  init() {
    this.micBtn = document.getElementById('btn-mic');
    this.voiceToggleBtn = document.getElementById('btn-voice-toggle');
    this.textInput = document.getElementById('chat-input-field');

    this.setupSpeechRecognition();
    this.setupSpeechSynthesis();
    this.bindEvents();
  }

  // Setup Browser Speech Recognition (STT)
  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.isSupported.stt = true;
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.state.set({ isListening: true });
          this.updateMicUI(true);
        };

        this.recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          const currentText = finalTranscript || interimTranscript;
          if (this.textInput && currentText) {
            this.textInput.value = currentText;
            this.textInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };

        this.recognition.onerror = (event) => {
          console.warn('[Voice STT] Recognition error:', event.error);
          this.state.set({ isListening: false });
          this.updateMicUI(false);

          let errorMsg = 'Voice recognition error.';
          if (event.error === 'not-allowed') {
            errorMsg = 'Microphone access was denied. Please allow microphone permissions in your browser.';
          } else if (event.error === 'no-speech') {
            errorMsg = 'No speech was detected. Try speaking closer to the microphone.';
          } else if (event.error === 'network') {
            errorMsg = 'Network error during speech recognition.';
          }

          if (window.showToast) {
            window.showToast(errorMsg, 'warning');
          }
        };

        this.recognition.onend = () => {
          this.state.set({ isListening: false });
          this.updateMicUI(false);
        };
      } catch (err) {
        console.warn('[Voice STT] Initialization failed:', err);
        this.isSupported.stt = false;
      }
    } else {
      this.isSupported.stt = false;
    }

    if (!this.isSupported.stt && this.micBtn) {
      this.micBtn.title = 'Speech recognition not supported in this browser';
      this.micBtn.classList.add('unsupported');
    }
  }

  // Setup Browser Speech Synthesis (TTS)
  setupSpeechSynthesis() {
    if (this.synth) {
      this.isSupported.tts = true;
      const loadVoices = () => {
        const voices = this.synth.getVoices();
        if (voices && voices.length > 0) {
          this.state.set({ availableVoices: voices });
        }
      };

      loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = loadVoices;
      }
    }
  }

  bindEvents() {
    // Mic Button Click
    if (this.micBtn) {
      this.micBtn.addEventListener('click', () => {
        if (!this.isSupported.stt) {
          if (window.showToast) {
            window.showToast('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.', 'info');
          }
          return;
        }

        if (this.state.get('isListening')) {
          this.stopListening();
        } else {
          this.startListening();
        }
      });
    }

    // Voice Output Toggle Button Click
    if (this.voiceToggleBtn) {
      this.voiceToggleBtn.addEventListener('click', () => {
        const nextState = !this.state.get('voiceOutputEnabled');
        this.state.set({ voiceOutputEnabled: nextState });
        this.updateVoiceToggleUI(nextState);

        if (!nextState) {
          this.stopSpeaking();
        } else {
          // Play a small sample or toast
          if (window.showToast) {
            window.showToast('Voice read-aloud enabled', 'info');
          }
        }
      });

      // Initialize UI based on saved state
      this.updateVoiceToggleUI(this.state.get('voiceOutputEnabled'));
    }
  }

  startListening() {
    if (!this.recognition || !this.isSupported.stt) return;
    try {
      this.stopSpeaking(); // don't talk while listening
      this.recognition.start();
    } catch (err) {
      console.warn('[Voice STT] Start failed:', err);
    }
  }

  stopListening() {
    if (this.recognition && this.state.get('isListening')) {
      try {
        this.recognition.stop();
      } catch (err) {
        // Safe catch
      }
    }
  }

  updateMicUI(isListening) {
    if (!this.micBtn) return;
    if (isListening) {
      this.micBtn.classList.add('is-listening');
      this.micBtn.setAttribute('aria-pressed', 'true');
      this.micBtn.title = 'Listening... click to stop';
    } else {
      this.micBtn.classList.remove('is-listening');
      this.micBtn.setAttribute('aria-pressed', 'false');
      this.micBtn.title = 'Click to speak';
    }
  }

  updateVoiceToggleUI(isEnabled) {
    if (!this.voiceToggleBtn) return;
    if (isEnabled) {
      this.voiceToggleBtn.classList.add('active');
      this.voiceToggleBtn.setAttribute('aria-checked', 'true');
      this.voiceToggleBtn.title = 'Voice read-aloud: ON';
    } else {
      this.voiceToggleBtn.classList.remove('active');
      this.voiceToggleBtn.setAttribute('aria-checked', 'false');
      this.voiceToggleBtn.title = 'Voice read-aloud: OFF';
    }
  }

  // Speak text aloud using SpeechSynthesis
  speak(text) {
    if (!this.isSupported.tts || !this.synth) return;
    if (!this.state.get('voiceOutputEnabled')) return;

    // Clean text of parenthetical stage directions or emojis for natural speech
    const cleanText = text
      .replace(/\([^*)]+\)/g, '') // remove parentheticals like (*beeps merrily*)
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // remove emojis
      .trim();

    if (!cleanText) return;

    // Cancel any previous utterance
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.state.get('speechRate') || 1.0;
    utterance.pitch = this.state.get('speechPitch') || 1.15; // slightly higher pitch for friendly robot character

    // Pick selected voice or natural English voice
    const voices = this.synth.getVoices();
    const selectedURI = this.state.get('selectedVoiceURI');
    if (selectedURI) {
      const match = voices.find(v => v.voiceURI === selectedURI);
      if (match) utterance.voice = match;
    } else {
      // Find a clean English voice if possible
      const preferred = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Jenny')) && v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      this.state.set({ isSpeaking: true });
    };

    utterance.onend = () => {
      this.state.set({ isSpeaking: false });
      this.currentUtterance = null;
    };

    utterance.onerror = (e) => {
      console.warn('[Voice TTS] Speech error:', e);
      this.state.set({ isSpeaking: false });
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      this.state.set({ isSpeaking: false });
    }
  }
}

// Global voice controller singleton
window.voiceController = null;
