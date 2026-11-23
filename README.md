# 🤖 ROBO PET — AI-Powered Robotic Companion (Full Stack)

> Modern, responsive, single-page web interface, Python Flask backend with Google Gemini AI integration, and ESP32 dual-servo microcontroller firmware for **ROBO PET**, your personal AI-powered robotic companion.

---

## 📖 Table of Contents
1. [Overview & Architecture](#-overview--architecture)
2. [Full System Structure](#-full-system-structure)
3. [Quick Start & Running the Project](#-quick-start--running-the-project)
4. [Backend Architecture & Modules](#-backend-architecture--modules)
5. [Gemini AI Integration & Safety](#-gemini-ai-integration--safety)
6. [Hardware & ESP32 Firmware](#-hardware--esp32-firmware)
7. [REST API Contract](#-rest-api-contract)
8. [Automated Testing](#-automated-testing)
9. [Command Registry](#-command-registry)

---

## 🌟 Overview & Architecture

ROBO PET is a physical robotic companion controlled via a modern web interface with voice and text. The Python Flask backend coordinates with Google's Gemini API to produce conversational responses, emotional expressions, and physical servo commands sent across serial communication to an ESP32 microcontroller.

```
┌────────────────────────────────────────────────────────┐
│               ROBO PET Frontend (Web UI)               │
│  - 2D Animated Avatar (7 Emotions & 9 Movements)       │
│  - Conversational Chat Interface & Speech STT / TTS    │
│  - Telemetry & System Status Panel                     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP JSON API (Port 5000)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Python / Flask Backend                   │
│  - Google Gemini API (Structured JSON Generation)      │
│  - Strict Command Validator (Prevent Arbitrary Exec)   │
│  - Serial Communication & Virtual Hardware Simulation  │
│  - Sensor Telemetry Cache & Independent Timer Manager  │
└───────────────────────────┬────────────────────────────┘
                            │ Serial JSON Protocol (115200 Baud)
                            ▼
┌────────────────────────────────────────────────────────┐
│               ESP32 Microcontroller Robot              │
│  - Dual SG90 Servos (Pan / Tilt with Easing & Limits)  │
│  - SSD1306 OLED (Facial Expressions & Info Screen)     │
│  - HC-SR04 Ultrasonic Sensor & Ambient Temperature     │
│  - Piezo Buzzer Synthesizer                            │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Full System Structure

```
ROBO-PET/
├── backend/
│   ├── app.py                  # Flask server, CORS, API routes & frontend serving
│   ├── config.py               # Centralized configuration & environment loader
│   ├── commands.json           # Validated registry of emotions, movements & commands
│   ├── validator.py            # Strict validator for manual & AI-generated commands
│   ├── gemini_service.py       # Google Gemini AI client & fallback companion engine
│   ├── robot_controller.py     # Robot state, command dispatcher & alert coordinator
│   ├── serial_manager.py       # ESP32 USB serial connection & virtual simulation
│   ├── sensor_manager.py       # Sensor telemetry parser & cache
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
│   ├── index.html              # Main single-page web app
│   ├── css/                    # Styles (style.css, robot.css, chat.css, components.css)
│   └── js/                     # Client scripts (state.js, api.js, robot.js, voice.js, chat.js, app.js)
├── index.html                  # Root launcher redirect
└── README.md                   # Complete system documentation
```

---

## 🚀 Quick Start & Running the Project

### 1. Configure Environment (Optional for Gemini)
```bash
# In the project directory:
cp backend/.env.example .env
```
Edit `.env` and set your Google Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
FLASK_PORT=5000
SERIAL_PORT=AUTO
```
*(Note: If no API key is provided, ROBO PET automatically runs in intelligent companion fallback mode with full conversation, jokes, dances, and emotions!)*

### 2. Start the Backend Server
```bash
python backend/app.py
```
This starts the Flask server on **`http://localhost:5000`**. Because the backend automatically serves the frontend, you can simply open:
👉 **[http://localhost:5000](http://localhost:5000)** in your browser!

### 3. Connect to Backend from Frontend
- The frontend connects automatically to `http://localhost:5000`.
- To toggle between **Demo Mode** (local browser mock) and **Live Backend Mode**, click the status pill in the top-right header or open the **Settings (⚙️)** modal.

---

## 🧠 Gemini AI Integration & Safety

1. **System Persona**: ROBO PET acts as a loyal, curious, cheerful, and expressive desktop companion.
2. **Structured JSON Output**: Gemini is instructed to output strictly typed JSON:
   ```json
   {
     "response": "Watch my signature dance groove!",
     "emotion": "happy",
     "action": "dance",
     "display_action": null,
     "utility_action": null
   }
   ```
3. **Strict Validation Barrier**:
   - The AI **cannot** execute arbitrary shell commands, raw code, or unvalidated hardware actions.
   - All AI output passes through `backend/validator.py`. Only pre-registered emotions and servo movements are accepted.
   - Unknown actions are discarded and emotions default to `neutral`.
4. **API Key Protection**: The Gemini API key is stored strictly on the backend in environment variables and is never transmitted to client-side JavaScript.

---

## 🤖 Hardware & ESP32 Firmware

ROBO PET uses an ESP32 microcontroller with:
- **Dual SG90 Servos**:
  - **Pan Servo (Yaw)**: Pin GPIO 18 (safe limits: 10°–170°, center 90°)
  - **Tilt Servo (Pitch)**: Pin GPIO 19 (safe limits: 40°–140°, center 90°)
  - Smooth software easing prevents gear stripping.
- **SSD1306 128x64 OLED Display**:
  - Connected via I2C (SDA: GPIO 21, SCL: GPIO 22).
  - Displays expressive digital eyes matching the 7 emotions (`happy`, `sad`, `angry`, `sleepy`, `neutral`, `surprised`, `confused`) and information screens.
- **Sensors**:
  - Ultrasonic Distance Sensor HC-SR04 (Trig: GPIO 5, Echo: GPIO 4).
  - Temperature sensing and battery telemetry.
- **Piezo Buzzer**: Pin GPIO 23 for synthesized melodic chirps.

See [firmware/README.md](file:///c:/Users/ASUS/OneDrive/Documents/ROBO-PET/firmware/README.md) for complete pinout and flashing instructions.

---

## 🔌 REST API Contract

The Python Flask backend preserves the exact contract required by the existing frontend:

### `POST /talk`
- **Request Body**: `{"message": "Can you dance and wave?"}`
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
    "sensors": {
      "temperature": 24.5,
      "distance": 42
    },
    "timer": {
      "active": false,
      "remaining": 0
    }
  }
  ```

### `POST /command`
- **Request Body**: `{"command": "dance", "category": "movements"}`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Performing movement: dance!",
    "emotion": "happy",
    "action": "dance"
  }
  ```

### `POST /timer`
- **Request Body**: `{"action": "set", "duration": 300, "label": "Pomodoro"}`
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

The backend includes a comprehensive automated test suite in `backend/tests/`:

```bash
# Run all tests:
python -m pytest backend/tests
```

**Test Coverage**:
- `test_validator.py`: Command registry lookup, emotion sanitization, safety restrictions.
- `test_gemini.py`: Prompt generation, fallback companion engine, context history.
- `test_timer.py`: Timer start, countdown ticker, expiration alert callback, cancellation.
- `test_api.py`: Full Flask test client coverage for `/health`, `/status`, `/talk`, `/command`, `/timer`.

---

## 📋 Command Registry

| Category | Registered Commands |
|---|---|
| **Emotions** | `happy`, `sad`, `angry`, `sleepy`, `neutral`, `surprised`, `confused` |
| **Movements** | `dance`, `nod`, `shake`, `look_left`, `look_right`, `look_center`, `wave`, `wiggle`, `stop` |
| **Conversation** | `chat`, `greet`, `tell_joke`, `encourage`, `goodbye`, `compliment`, `tell_fact`, `roast_playfully`, `quiet_mode` |
| **Display** | `show_time`, `show_date`, `show_datetime`, `show_temperature`, `show_distance`, `show_sensor_status` |
| **Sensors** | `read_temperature`, `read_distance`, `check_environment` |
| **Utilities** | `status`, `reset_expression`, `show_battery` |
