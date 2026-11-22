// api.js — Centralized API Integration Service & Mock Demo Simulator

class RobotAPI {
  constructor(state) {
    this.state = state;
    this.pollInterval = null;
    this.isRequestInProgress = false;
  }

  // Helper to get current backend URL
  get baseUrl() {
    return this.state.get('backendUrl').replace(/\/+$/, '');
  }

  get isDemoMode() {
    return this.state.get('demoMode');
  }

  /**
   * Send a user message to the backend
   * Route: POST /talk
   * Body: { message: string }
   * Returns: { response: string, emotion: string, action?: string, metadata?: any }
   */
  async sendTalk(message) {
    if (this.isDemoMode) {
      return this._mockTalkResponse(message);
    }

    try {
      const response = await fetch(`${this.baseUrl}/talk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ message: message.trim() }),
        signal: AbortSignal.timeout(12000) // 12 second timeout
      });

      if (!response.ok) {
        throw new Error(`Backend error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      return {
        response: data.response || "Beep boop! I received your message.",
        emotion: data.emotion || "neutral",
        action: data.action || null,
        metadata: data.metadata || null
      };
    } catch (err) {
      console.warn('[API] POST /talk failed:', err.message);
      throw err;
    }
  }

  /**
   * Check backend and ESP32 status
   * Route: GET /status
   * Returns: { status: "online"|"offline", esp32_connected: boolean, sensors?: {...}, battery?: number }
   */
  async getStatus() {
    if (this.isDemoMode) {
      return this._mockStatusResponse();
    }

    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        status: data.status || 'online',
        esp32_connected: !!data.esp32_connected,
        sensors: data.sensors || {},
        battery: typeof data.battery === 'number' ? data.battery : null,
        timer: data.timer || null
      };
    } catch (err) {
      return {
        status: 'offline',
        esp32_connected: false,
        error: err.message
      };
    }
  }

  /**
   * Send a validated manual command
   * Route: POST /command
   * Body: { command: string, category?: string }
   * Returns: { success: boolean, message: string, emotion?: string, action?: string }
   */
  async sendCommand(commandName, category = '') {
    if (this.isDemoMode) {
      return this._mockCommandResponse(commandName, category);
    }

    try {
      const response = await fetch(`${this.baseUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandName, category: category }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`Command failed with status ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('[API] POST /command failed:', err.message);
      throw err;
    }
  }

  /**
   * Handle timer operations
   * Route: POST /timer
   * Body: { action: "set"|"cancel"|"status", duration?: number, label?: string }
   */
  async sendTimer(action, duration = 0, label = 'Timer') {
    if (this.isDemoMode) {
      return this._mockTimerResponse(action, duration, label);
    }

    try {
      const response = await fetch(`${this.baseUrl}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, duration, label }),
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        throw new Error(`Timer error status ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('[API] POST /timer failed:', err.message);
      throw err;
    }
  }

  // Start periodic status polling
  startStatusPolling(intervalMs = 6000) {
    if (this.pollInterval) clearInterval(this.pollInterval);

    const check = async () => {
      const res = await this.getStatus();
      const currentDemo = this.state.get('demoMode');

      if (currentDemo) {
        this.state.set({
          connectionStatus: 'demo',
          esp32Connected: true,
          lastPingTime: new Date()
        });
        if (res.sensors) {
          this.state.updateTelemetry({
            temperature: res.sensors.temperature ?? 24.5,
            distance: res.sensors.distance ?? 42,
            battery: res.battery ?? 92
          });
        }
      } else {
        const isOnline = res.status === 'online';
        this.state.set({
          connectionStatus: isOnline ? 'online' : 'offline',
          esp32Connected: isOnline && !!res.esp32_connected,
          lastPingTime: new Date()
        });

        if (isOnline && res.sensors) {
          this.state.updateTelemetry({
            temperature: res.sensors.temperature !== undefined ? res.sensors.temperature : null,
            distance: res.sensors.distance !== undefined ? res.sensors.distance : null,
            battery: res.battery !== undefined ? res.battery : null
          });
        } else if (!isOnline) {
          // Reset sensors to null (unavailable) when offline
          this.state.updateTelemetry({
            temperature: null,
            distance: null
          });
        }
      }
    };

    check();
    this.pollInterval = setInterval(check, intervalMs);
  }

  stopStatusPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ==========================================
  // DEMO MODE MOCK ENGINE
  // Simulated responses for local testing without Flask/ESP32
  // ==========================================

  async _mockDelay(min = 350, max = 850) {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async _mockStatusResponse() {
    return {
      status: 'online',
      esp32_connected: true,
      sensors: {
        temperature: +(24 + Math.random() * 2).toFixed(1),
        distance: Math.floor(30 + Math.random() * 35)
      },
      battery: 92,
      mode: 'demo'
    };
  }

  async _mockTimerResponse(action, duration, label) {
    await this._mockDelay(200, 400);
    if (action === 'set') {
      return {
        success: true,
        message: `Timer set for ${duration} seconds (${label}).`,
        timer: { active: true, duration, remaining: duration, label }
      };
    } else if (action === 'cancel') {
      return {
        success: true,
        message: `Timer cancelled.`,
        timer: { active: false, remaining: 0 }
      };
    }
    return {
      success: true,
      timer: { active: false }
    };
  }

  async _mockCommandResponse(commandName, category) {
    await this._mockDelay(300, 600);
    const validEmotions = ['happy', 'sad', 'angry', 'sleepy', 'neutral', 'surprised', 'confused'];
    const validMovements = ['dance', 'nod', 'shake', 'look_left', 'look_right', 'look_center', 'stop', 'wave', 'wiggle'];

    let emotion = 'neutral';
    let action = null;
    let message = `Executed command: ${commandName}`;

    if (validEmotions.includes(commandName)) {
      emotion = commandName;
      message = `Expression set to ${commandName}!`;
    } else if (validMovements.includes(commandName)) {
      action = commandName;
      emotion = commandName === 'dance' || commandName === 'wave' ? 'happy' : 'neutral';
      message = `Performing movement: ${commandName.replace('_', ' ')}!`;
    } else if (commandName === 'reset_expression') {
      emotion = 'neutral';
      message = 'Expression reset to neutral.';
    } else if (commandName.startsWith('show_') || commandName.startsWith('read_')) {
      const type = commandName.replace(/^(show_|read_)/, '');
      if (type === 'temperature') {
        message = `Current sensor temperature: 24.8°C`;
        emotion = 'happy';
      } else if (type === 'distance') {
        message = `Ultrasonic distance sensor reading: 45 cm`;
        emotion = 'surprised';
      } else if (type === 'time' || type === 'date' || type === 'datetime') {
        message = `ESP32 OLED Display updated: ${new Date().toLocaleTimeString()}`;
        emotion = 'neutral';
      } else {
        message = `Displaying ${type} on the robot's OLED screen.`;
      }
    }

    return {
      success: true,
      message,
      emotion,
      action,
      command: commandName
    };
  }

  async _mockTalkResponse(userText) {
    await this._mockDelay(500, 1100);
    const text = userText.toLowerCase().trim();

    // Emotion matchers
    if (text.includes('happy') || text.includes('smile') || text.includes('cheer')) {
      return {
        response: "Yay! Seeing you happy fills my circuits with joyful energy! (*beeps merrily*)",
        emotion: "happy",
        action: "wiggle"
      };
    }
    if (text.includes('sad') || text.includes('cry') || text.includes('down') || text.includes('lonely')) {
      return {
        response: "I'm right here with you! Even robots have soft spots for their friends. Let me give you a virtual robotic hug. 💙",
        emotion: "sad",
        action: "nod"
      };
    }
    if (text.includes('angry') || text.includes('mad') || text.includes('furious')) {
      return {
        response: "Whoa, calibrating cooling fans! Let's take a deep breath together. Inhale 1s... exhale 0s...",
        emotion: "angry",
        action: "shake"
      };
    }
    if (text.includes('sleep') || text.includes('tired') || text.includes('goodnight') || text.includes('bed')) {
      return {
        response: "Power-saving standby mode engaged... Sweet dreams! I'll keep watch until morning. Zzz...",
        emotion: "sleepy",
        action: "stop"
      };
    }
    if (text.includes('surprised') || text.includes('wow') || text.includes('omg') || text.includes('unbelievable')) {
      return {
        response: "Whoa! My sensor readings just spiked! Did not see that coming at all!",
        emotion: "surprised",
        action: "look_left"
      };
    }
    if (text.includes('confused') || text.includes('what?') || text.includes('huh') || text.includes('puzzled')) {
      return {
        response: "Does not compute! My logic subroutines are scratching their robotic heads.",
        emotion: "confused",
        action: "look_right"
      };
    }

    // Movement matchers
    if (text.includes('dance')) {
      return {
        response: "Watch my signature Robo-Groove! Activating servo motors and rhythm matrix!",
        emotion: "happy",
        action: "dance"
      };
    }
    if (text.includes('wave') || text.includes('hi') || text.includes('hello') || text.includes('hey')) {
      return {
        response: "Hello there! I'm ROBO PET, your personal AI robotic companion. How are you feeling today?",
        emotion: "happy",
        action: "wave"
      };
    }
    if (text.includes('nod') || text.includes('agree')) {
      return {
        response: "Affirmative! I completely agree with you on that one.",
        emotion: "happy",
        action: "nod"
      };
    }
    if (text.includes('shake') || text.includes('no')) {
      return {
        response: "Negative! My sensors say otherwise, friend.",
        emotion: "confused",
        action: "shake"
      };
    }
    if (text.includes('wiggle')) {
      return {
        response: "Wiggle mode activated! Servos oscillation at 100% cute capacity!",
        emotion: "happy",
        action: "wiggle"
      };
    }

    // Joke matcher
    if (text.includes('joke')) {
      const jokes = [
        "Why was the robot angry? Because someone kept pushing its buttons!",
        "How do robots eat salsa? With microchips!",
        "Why did the robot go on vacation? To recharge its batteries!",
        "What is a robot's favorite musical genre? Heavy metal!",
        "Why did the robot cross the road? It was programmed by the chicken!"
      ];
      return {
        response: jokes[Math.floor(Math.random() * jokes.length)],
        emotion: "happy",
        action: "nod"
      };
    }

    // Compliment matcher
    if (text.includes('compliment') || text.includes('praise') || text.includes('cute')) {
      return {
        response: "Aww, thank you! Your cognitive processing parameters are simply exquisite today!",
        emotion: "happy",
        action: "wiggle"
      };
    }

    // Roast matcher
    if (text.includes('roast')) {
      return {
        response: "I would roast you, but my thermal safety sensors warn me you couldn't handle the heat! Just kidding, you're awesome.",
        emotion: "surprised",
        action: "wiggle"
      };
    }

    // Fact matcher
    if (text.includes('fact')) {
      const facts = [
        "Did you know? The term 'robot' comes from the Czech word 'robota', which means forced labor or drudgery!",
        "The first modern programmable humanoid robot was built in 1939 and was named Elektro!",
        "Honeybees have inspired autonomous navigation algorithms in micro-drones due to their optical flow sensing."
      ];
      return {
        response: facts[Math.floor(Math.random() * facts.length)],
        emotion: "neutral",
        action: "nod"
      };
    }

    // Sensor / Hardware queries
    if (text.includes('temp') || text.includes('temperature') || text.includes('hot') || text.includes('cold')) {
      return {
        response: "Checking ambient temperature sensor... It's currently a pleasant 24.6°C around us!",
        emotion: "neutral",
        action: "look_center"
      };
    }
    if (text.includes('distance') || text.includes('obstacle') || text.includes('sensor')) {
      return {
        response: "Ultrasonic sensor ping: Nearest obstacle detected at 42 centimeters. Path clear!",
        emotion: "surprised",
        action: "look_left"
      };
    }
    if (text.includes('time') || text.includes('date')) {
      const now = new Date();
      return {
        response: `The current time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`,
        emotion: "neutral",
        action: "nod"
      };
    }
    if (text.includes('timer')) {
      return {
        response: "I can help with timers! You can set countdowns using the timer command or asking me to set one.",
        emotion: "happy",
        action: "nod"
      };
    }

    // Default conversational responses
    const defaultGreetings = [
      "I'm listening! What shall we explore together next?",
      "Interesting thought! My AI neural layers are analyzing that right now.",
      "Got it! Let me know if you want me to perform a trick, dance, or check our sensors.",
      "Beep boop! Ready for your next command or friendly chat."
    ];

    return {
      response: defaultGreetings[Math.floor(Math.random() * defaultGreetings.length)],
      emotion: "neutral",
      action: "nod"
    };
  }
}

// Global API service singleton
window.robotAPI = new RobotAPI(window.robotState);
