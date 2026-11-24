# 🤖 ROBO PET — AI-Powered Robotic Companion (Full Stack)

> Modern, responsive, mobile-ready web interface, Python Flask backend with Google Gemini AI integration, and ESP32 microcontroller firmware for **ROBO PET**, your personal AI-powered desktop robotic companion.

---

## 📖 Table of Contents
1. [Overview & Architecture](#-overview--architecture)
2. [Full System Structure](#-full-system-structure)
3. [Hardware & Wiring Configuration](#-hardware--wiring-configuration)
4. [Quick Start & Running the Project](#-quick-start--running-the-project)
5. [Laptop & Mobile LAN Connectivity](#-laptop--mobile-lan-connectivity)
6. [Gemini AI Integration & Safety Architecture](#-gemini-ai-integration--safety-architecture)
7. [ESP32 Firmware Architecture](#-esp32-firmware-architecture)
8. [REST API Contract](#-rest-api-contract)
9. [Automated Testing](#-automated-testing)
10. [Command Registry](#-command-registry)

---

## 🌟 Overview & Architecture

ROBO PET is a physical robotic companion controlled via a responsive web interface with voice, text, and manual controls. The Python Flask backend coordinates with Google's Gemini API to produce conversational responses, emotional expressions, and physical servo commands sent across serial communication to an ESP32 microcontroller.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ROBO PET Frontend (Web UI)                        │
│   • Runs identically on Laptop & Mobile (Auto-detected LAN host)       │
│   • 2D Animated Avatar (7 Emotions & 6 Physical Movements)             │
│   • Conversational Chat Interface & Speech STT / TTS                   │
│   • Real-Time Battery, State & Countdown Timer Monitoring              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP JSON API (Port 5000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Python / Flask Backend                           │
│   • Google Gemini API (Structured JSON Decision Engine)                │
│   • Strict Command Validator (Allowlist verification against schema)   │
│   • Serial Communication Manager (USB Serial & Virtual Simulation)     │
│   • Independent Background Countdown Timer Manager                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Serial JSON Protocol (115200 Baud)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      ESP32 Microcontroller Robot                       │
│   • Dual SG90 Servos (Pan / Tilt with Non-Blocking Easing & Limits)   │
│   • SSD1306 128x64 OLED Display (7 Facial Expressions)                 │
│   • 6 Discrete LEDs (2 Red, 2 Blue, 2 Green with Emotion Patterns)     │
│   • Piezo Buzzer Synthesizer (Chirps, Arpeggios & Emotion Sound FX)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Full System Structure

```
ROBO-PET/
├── backend/
│   ├── app.py                  # Flask server, CORS, API routes & LAN host display
│   ├── config.py               # Centralized configuration & environment loader
│   ├── commands.json           # Validated registry of emotions & movements (allowlist)
│   ├── validator.py            # Strict validator for manual & AI-generated commands
│   ├── gemini_service.py       # Google Gemini AI client & fallback companion engine
│   ├── robot_controller.py     # Robot state coordinator & command dispatcher
│   ├── serial_manager.py       # ESP32 USB serial connection & virtual simulation
│   ├── timer_manager.py        # Independent background countdown timer manager
│   ├── requirements.txt        # Python package dependencies
│   ├── .env.example            # Environment variables template
│   └── tests/                  # Automated pytest suite (21 unit & integration tests)
│       ├── test_api.py         # Tests Flask HTTP endpoints
│       ├── test_gemini.py      # Tests Gemini prompt & fallback engine
│       ├── test_timer.py       # Tests countdown timer lifecycle
│       └── test_validator.py   # Tests command, emotion & schema validation
├── firmware/
│   ├── README.md               # ESP32 pinout diagram, libraries & flashing guide
│   └── robo_pet_esp32/
│       └── robo_pet_esp32.ino  # Production-ready Arduino/ESP32 C++ firmware
├── frontend/
│   ├── index.html              # Main single-page web app (responsive layout)
│   ├── css/                    # Styles (style.css, robot.css, chat.css, components.css)
│   └── js/                     # Client scripts (state.js, api.js, robot.js, voice.js, chat.js, app.js)
├── index.html                  # Root launcher redirect
└── README.md                   # Complete system documentation
```

---

## 🔌 Hardware & Wiring Configuration

The final hardware configuration uses **no external sensors**:

| Component | ESP32 GPIO | Logic / Power | Wiring & Current-Limiting Details |
|---|---|---|---|
| **SG90 Pan Servo (Yaw / Turn)** | **GPIO 18** | 5V / PWM | Signal to GPIO 18, 5V power, GND |
| **SG90 Tilt Servo (Pitch / Up-Down)** | **GPIO 19** | 5V / PWM | Signal to GPIO 19, 5V power, GND |
| **SSD1306 OLED SDA** | **GPIO 21** | 3.3V / I2C | I2C Data line |
| **SSD1306 OLED SCL** | **GPIO 22** | 3.3V / I2C | I2C Clock line |
| **Piezo Buzzer** | **GPIO 23** | 3.3V PWM | Positive to GPIO 23, Negative to GND |
| **Red LED 1** | **GPIO 25** | 3.3V Digital | Anode to GPIO 25, Cathode through 220Ω–330Ω resistor to GND |
| **Red LED 2** | **GPIO 26** | 3.3V Digital | Anode to GPIO 26, Cathode through 220Ω–330Ω resistor to GND |
| **Blue LED 1** | **GPIO 27** | 3.3V Digital | Anode to GPIO 27, Cathode through 220Ω resistor to GND |
| **Blue LED 2** | **GPIO 14** | 3.3V Digital | Anode to GPIO 14, Cathode through 220Ω resistor to GND |
| **Green LED 1** | **GPIO 32** | 3.3V Digital | Anode to GPIO 32, Cathode through 220Ω–330Ω resistor to GND |
| **Green LED 2** | **GPIO 33** | 3.3V Digital | Anode to GPIO 33, Cathode through 220Ω–330Ω resistor to GND |

---

## 🚀 Quick Start & Running the Project

### 1. Configure Environment
```bash
cp backend/.env.example .env
```
Edit `.env` and set your Google Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
FLASK_PORT=5000
SERIAL_PORT=AUTO
```
*(If no API key is set, ROBO PET seamlessly uses its built-in offline intelligent companion fallback engine!)*

### 2. Start the Backend Server
```bash
python backend/app.py
```
Upon startup, the server automatically displays:
```
============================================================
🤖 ROBO PET Backend Server Running!
📡 Local Access:   http://localhost:5000
📱 Mobile / LAN:   http://192.168.x.x:5000
============================================================
```

### 3. Open in Browser
- **On Laptop**: Open [http://localhost:5000](http://localhost:5000).
- **On Mobile Phone**: Connect your phone to the same Wi-Fi network and open `http://<laptop-lan-ip>:5000`.

---

## 📱 Laptop & Mobile LAN Connectivity

- **Unified Backend**: Both laptop and smartphone communicate with the same single Flask instance running on the laptop.
- **Dynamic Host Discovery**: The frontend (`frontend/js/state.js`) dynamically detects `window.location.hostname`. When loaded on a phone, it automatically targets `http://<laptop-lan-ip>:5000` rather than defaulting to `localhost`.
- **Shared State**: Changes triggered from either device (chat, movements, timers) update the robot's state across all active sessions.

---

## 🧠 Gemini AI Integration & Safety Architecture

1. **Strict Separation of Concerns**:
   - **Gemini**: Acts purely as a cognitive language engine. Decides appropriate dialogue, emotion (`happy`, `sad`, `angry`, `sleepy`, `neutral`, `surprised`, `confused`), and physical movement (`dance`, `nod`, `shake`, `look`, `wave`, `wiggle`).
   - **Validator**: Enforces a strict allowlist. Rejects unauthorized, hallucinated, or malformed commands.
   - **ESP32 Firmware**: Retains exclusive authority over physical motor angles, LED patterns, and buzzer audio.
2. **Safety Allowlist (`backend/commands.json`)**:
   - Only 7 canonical emotions and 6 physical movements can pass validation.
   - Directional look aliases (`look_left`, `look_right`, `look_center`) are automatically normalized to `look`.
3. **No Direct Hardware Execution**: Gemini cannot issue raw pin signals, arbitrary shell commands, or unvalidated parameters.

---

## 🤖 ESP32 Firmware Architecture

The Arduino C++ firmware (`firmware/robo_pet_esp32/robo_pet_esp32.ino`) implements:

- **7 Dedicated OLED Face Functions**:
  `showHappyFace()`, `showSadFace()`, `showAngryFace()`, `showSleepyFace()`, `showNeutralFace()`, `showSurprisedFace()`, `showConfusedFace()`.
- **6 Emotion-Driven LED Patterns**:
  - `happy`: Green LEDs steady ON
  - `sad`: Blue LEDs slow blinking (500ms cycle)
  - `angry`: Red LEDs rapid alert strobe (120ms cycle)
  - `sleepy`: Blue LEDs alternating slow breathing
  - `neutral`: Green LEDs steady ON
  - `surprised`: Red + Green combination
  - `confused`: Blue + Green combination
- **Buzzer Melodies**:
  Dedicated, non-blocking frequency sequences for greetings, alerts, dance arpeggios, and emotions.
- **Non-Blocking Servo Movement Routines**:
  `performDance()`, `performNod()`, `performShake()`, `performLook()`, `performWave()`, `performWiggle()`.
- **Safe Motion Boundaries**:
  - Pan Servo: `15°` to `165°` (Rest: `90°`)
  - Tilt Servo: `45°` to `135°` (Rest: `90°`)
  - Smooth sinusoidal easing prevents mechanical stress.

---

## 🔌 REST API Contract

### `POST /talk`
- **Request**: `{"message": "Can you dance and look around?"}`
- **Response (200 OK)**:
  ```json
  {
    "response": "Watch my moves! (*grooving happily*)",
    "emotion": "happy",
    "action": "dance",
    "metadata": {}
  }
  ```

### `GET /status`
- **Response (200 OK)**:
  ```json
  {
    "status": "online",
    "esp32_connected": true,
    "hardware_mode": "physical",
    "battery": 88,
    "timer": {
      "active": false,
      "remaining": 0,
      "duration": 0,
      "label": null
    },
    "state": {
      "emotion": "neutral",
      "action": "look",
      "display": "time"
    }
  }
  ```

### `POST /command`
- **Request**: `{"command": "dance", "category": "movements"}`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Performing movement: dance!",
    "emotion": "happy",
    "action": "dance",
    "command": "dance",
    "category": "movements"
  }
  ```

### `POST /timer`
- **Request**: `{"action": "set", "duration": 300, "label": "Pomodoro"}`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Timer set for 300 seconds (Pomodoro).",
    "timer": {
      "active": true,
      "duration": 300,
      "remaining": 300,
      "label": "Pomodoro"
    }
  }
  ```

---

## 🧪 Automated Testing

The project maintains a 100% passing test suite across all subsystems:

```bash
python -m pytest backend/tests
```

**Results**: `21 passed` (test coverage across validator, Gemini fallback & prompt generation, countdown timer manager, and Flask API endpoints).

---

## 📋 Command Registry

| Category | Registered Allowed Commands | Description |
|---|---|---|
| **Emotions** | `happy`, `sad`, `angry`, `sleepy`, `neutral`, `surprised`, `confused` | Updates OLED expression, LED pattern, and mood |
| **Movements** | `dance`, `nod`, `shake`, `look`, `wave`, `wiggle` | Dispatches dual-servo routines with non-blocking easing |
| **Conversation** | `chat`, `greet`, `tell_joke`, `encourage`, `goodbye`, `compliment`, `tell_fact`, `roast_playfully`, `quiet_mode` | Natural language companion triggers |
| **Display** | `show_time`, `show_date`, `show_datetime` | Updates OLED info screen |
| **Utilities** | `status`, `reset_expression`, `show_battery` | System diagnostics & posture reset |
