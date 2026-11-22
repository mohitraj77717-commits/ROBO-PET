# 🤖 ROBO PET — AI-Powered Robotic Companion Frontend

> Modern, responsive, single-page web chatbot interface and 2D animated avatar for **ROBO PET**, a personal AI-powered robotic companion driven by ESP32, Python (Flask), and Google Gemini API.

---

## 📖 Table of Contents
1. [Overview & Architecture](#-overview--architecture)
2. [Key Features](#-key-features)
3. [Design Philosophy](#-design-philosophy)
4. [File Structure](#-file-structure)
5. [Getting Started & Running the Frontend](#-getting-started--running-the-frontend)
6. [Backend API Integration Contract](#-backend-api-integration-contract)
7. [Robot Command Registry](#-robot-command-registry)
8. [Voice & Speech Capabilities](#-voice--speech-capabilities)
9. [Demo Mode](#-demo-mode)
10. [Hardware & Architecture Safety Rules](#-hardware--architecture-safety-rules)

---

## 🌟 Overview & Architecture

ROBO PET is a physical robotic companion controlled via a modern web interface. Users interact using voice or text. The Flask backend coordinates with the Google Gemini API to produce conversational responses, emotional expressions, and physical servo commands sent across serial communication to an ESP32 microcontroller.

```
┌────────────────────────────────────────────────────────┐
│               ROBO PET Frontend (Web UI)               │
│  - 2D Animated Avatar (Emotions & Movements)           │
│  - Conversational Chat Interface                       │
│  - Web Speech STT & SpeechSynthesis TTS                │
│  - Telemetry & System Status Panel                     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP JSON API
                            ▼
┌────────────────────────────────────────────────────────┐
│               Python / Flask Backend                   │
│  - Google Gemini API (LLM conversational engine)       │
│  - Validated Command Registry                          │
│  - Serial Communication Manager (USB / UART)           │
└───────────────────────────┬────────────────────────────┘
                            │ Serial / UART Commands
                            ▼
┌────────────────────────────────────────────────────────┐
│               ESP32 Microcontroller Robot              │
│  - OLED Display (Faces, Eyes & Info)                   │
│  - Servo Motors (Head nod, shake, dance, wave)         │
│  - Sensors (Ultrasonic Distance, Temperature DHT)      │
│  - Indicator LEDs & Piezo Speaker                      │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- **Cute 2D Animated Robot Avatar**:
  - Visually responds to emotions: `happy`, `sad`, `angry`, `sleepy`, `neutral`, `surprised`, `confused`.
  - Performs physical movements: `dance`, `nod`, `shake`, `look_left`, `look_right`, `look_center`, `wave`, `wiggle`, `stop`.
  - Natural blinking cycle and breathing idle animation.
  - Interactive tactile reaction: clicking the robot gives a playful chirp and wiggle!
  - Integrated Web Audio API synthesizer for robotic sound effects and bleeps without external dependencies.
- **Conversational Chatbot**:
  - Right-aligned user bubbles with gradient styling.
  - Left-aligned robot responses with avatar badge and structured action execution tags (e.g. `⚡ Action: Dance`).
  - Timestamps, auto-scroll with scroll-lock detection, and 3-dot typing indicator.
  - Session-based temporary memory (no persistent DB required).
- **Voice Interaction**:
  - **Speech-to-Text (STT)**: Microphone button captures browser voice using Web Speech Recognition with live transcript and pulsing ring indicator.
  - **Text-to-Speech (TTS)**: Built-in speech synthesis reads robot responses aloud with custom robot pitch.
- **Telemetry & Hardware Status Drawer**:
  - Live clock & date.
  - Real-time temperature & obstacle distance readings (with explicit `-- (Unavailable)` state when sensors or ESP32 are offline).
  - ESP32 connection badge and battery status.
- **Capabilities & Quick Action Modal**:
  - Browse and trigger all 6 categories of robot capabilities (Emotions, Movements, Conversation, Display, Sensors, Utilities).
  - Clear hardware-pending badges for features requiring physical sensors.
- **Zero-Setup Demo Mode**:
  - Built-in mock simulator to test the complete UI, animations, voice, and commands out of the box without requiring Flask or ESP32 running.

---

## 🎨 Design Philosophy

- **Color Palette**: Dark navy / charcoal background (`#080d1a`, `#0f172a`), soft electric-blue accents (`#38bdf8`), cyan glows, and violet undertones.
- **Typography**: Clean, modern sans-serif (`Outfit`, `Inter`).
- **Look & Feel**: Premium AI chatbot with a friendly robotic companion personality—no cluttered admin dashboards or harsh neon.
- **Mobile First**: Fluidly adapts from mobile screens up to 4K desktops.

---

## 📁 File Structure

```
ROBO-PET/
├── index.html                  # Root launcher redirect to frontend/index.html
├── README.md                   # Complete documentation & API contracts
└── frontend/
    ├── index.html              # Main single-page web app
    ├── css/
    │   ├── style.css           # Base variables, layout, grid & theme
    │   ├── robot.css           # 2D avatar SVG styling, emotions & movement keyframes
    │   ├── chat.css            # Chat bubbles, typing indicator & input dock
    │   └── components.css      # Modals, telemetry drawer, switches & toasts
    └── js/
        ├── state.js            # Centralized reactive state store
        ├── api.js              # Centralized API service & Mock Demo engine
        ├── robot.js            # 2D avatar controller & Web Audio sound synthesizer
        ├── voice.js            # Web Speech STT and SpeechSynthesis TTS controller
        ├── chat.js             # Chat timeline, rendering & suggestion chips
        └── app.js              # Main application initialization & lifecycle
```

---

## 🚀 Getting Started & Running the Frontend

No build step or Node dependencies are required. The frontend runs directly in any modern web browser.

### Option A: Using Python's built-in HTTP server (Recommended)
```bash
# From the project root (c:\Users\ASUS\OneDrive\Documents\ROBO-PET):
python -m http.server 8000
```
Open your browser at:
```
http://localhost:8000
```

### Option B: Using Node.js `serve` / `npx`
```bash
npx serve .
```

### Option C: Direct File Opening
Double-click `frontend/index.html` or `index.html` in your file explorer to open it in Chrome, Edge, Safari, or Firefox.

*(Note: Speech Recognition requires an `http://` or `https://` origin in certain browsers, so running with `python -m http.server` is recommended for full microphone features).*

---

## 🔌 Backend API Integration Contract

The frontend communicates with a Python / Flask backend using a centralized API module in `frontend/js/api.js`. The backend URL can be configured anytime in the **Settings Modal** (defaults to `http://localhost:5000`).

### 1. `POST /talk`
Sends the user's conversational message.
- **Request Body**:
  ```json
  {
    "message": "Can you dance and wave for me?"
  }
  ```
- **Response Format**:
  ```json
  {
    "response": "Watch my moves! (*grooving happily*)",
    "emotion": "happy",
    "action": "dance",
    "metadata": {}
  }
  ```

### 2. `GET /status`
Checks the health of the Flask server, ESP32 link, and available hardware sensors.
- **Response Format**:
  ```json
  {
    "status": "online",
    "esp32_connected": true,
    "battery": 92,
    "sensors": {
      "temperature": 24.5,
      "distance": 42
    },
    "timer": {
      "active": false
    }
  }
  ```

### 3. `POST /command`
Sends a validated manual command to the robot.
- **Request Body**:
  ```json
  {
    "command": "dance",
    "category": "movements"
  }
  ```
- **Response Format**:
  ```json
  {
    "success": true,
    "message": "Performing movement: dance!",
    "emotion": "happy",
    "action": "dance"
  }
  ```

### 4. `POST /timer`
Manages timer countdowns displayed on the robot.
- **Request Body**:
  ```json
  {
    "action": "set",
    "duration": 300,
    "label": "Focus Timer"
  }
  ```

---

## 📋 Robot Command Registry

The backend maintains a validated command registry. The frontend supports:

| Category | Commands |
|---|---|
| **Emotions** | `happy`, `sad`, `angry`, `sleepy`, `neutral`, `surprised`, `confused` |
| **Movements** | `dance`, `nod`, `shake`, `look_left`, `look_right`, `look_center`, `stop`, `wave`, `wiggle` |
| **Conversation** | `chat`, `greet`, `tell_joke`, `encourage`, `goodbye`, `compliment`, `tell_fact`, `roast_playfully`, `quiet_mode` |
| **Display** | `show_time`, `show_date`, `show_datetime`, `show_temperature`, `show_distance`, `show_sensor_status` |
| **Sensors** | `read_temperature`, `read_distance`, `check_environment` *(flagged as hardware-pending if ESP32 offline)* |
| **Utilities** | `status`, `reset_expression`, `show_battery` |

---

## 🎙️ Voice & Speech Capabilities

1. **Microphone (Speech Recognition)**:
   - Click the microphone icon to begin speech recognition.
   - The microphone pulses with concentric glowing rings while listening.
   - Live speech transcript is inserted directly into the chat input bar.
   - Handles permissions and unsupported browser environments gracefully.
2. **Voice Output (Speech Synthesis)**:
   - Toggle on/off via the speaker button in the chat input bar or in Settings.
   - Automatically reads incoming robot responses aloud.
   - Configurable voice selection, rate, and pitch in the Settings modal.
   - Synchronizes robot avatar visor/ear waveform glow while speaking.

---

## 🧪 Demo Mode

To allow rapid frontend development and user demonstrations before the hardware ESP32 is wired up, **Demo Mode** is enabled by default:
- Simulates realistic AI responses to common prompts (greetings, jokes, dance requests, roasts, facts, sensor queries).
- Simulates realistic network latency (300ms–800ms) to test typing indicators.
- Emits realistic sensor telemetry.
- Can be toggled on/off at any time in **Settings** or by clicking the status pill in the header.

---

## 🛡️ Hardware & Architecture Safety Rules

1. **No Frontend API Keys**: Google Gemini API keys are never stored in or accessed by client-side code.
2. **No Direct ESP32 Access**: The browser never attempts direct serial communication with the microcontroller. All communication passes through the validated Python Flask backend.
3. **No Arbitrary Commands**: Gemini cannot execute unvalidated commands. The Python backend validates every command against the Command Registry before forwarding to the ESP32.
4. **Temporary Session History**: Chat logs and interaction states remain in transient browser memory without persisting unauthorized data.
