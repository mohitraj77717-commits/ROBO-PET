# 🤖 ROBO PET — ESP32 Firmware Documentation

This directory contains the production-ready Arduino C++ firmware (`robo_pet_esp32.ino`) for the physical **ROBO PET** robotic companion.

---

## 🔌 Hardware Pinout & Wiring Guide

The final hardware configuration consists of an **ESP32 Dev Module (30-pin WROOM-32)**, an **SSD1306 128x64 I2C OLED display**, **two SG90 servo motors**, **six discrete LEDs** (2 Red, 2 Blue, 2 Green), and a **piezo buzzer**.

> [!IMPORTANT]
> There are **no sensors** (no ultrasonic HC-SR04, no temperature DHT/thermistor). All physical behavior is coordinated internally by the ESP32 upon receiving validated JSON commands from the Python backend.

### Complete Pinout Table

| Component | ESP32 GPIO | Pin Role | Wiring & Electrical Details |
|---|---|---|---|
| **SG90 Pan Servo (Yaw / Turn)** | **GPIO 18** | PWM Out | Signal (Orange/Yellow). Red to 5V (external or VIN), Brown to GND. |
| **SG90 Tilt Servo (Pitch / Up-Down)** | **GPIO 19** | PWM Out | Signal (Orange/Yellow). Red to 5V (external or VIN), Brown to GND. |
| **SSD1306 OLED SDA** | **GPIO 21** | I2C Data | Connect to OLED SDA pin (3.3V logic). VCC to 3.3V, GND to GND. |
| **SSD1306 OLED SCL** | **GPIO 22** | I2C Clock | Connect to OLED SCL pin (3.3V logic). |
| **Piezo Buzzer** | **GPIO 23** | PWM Audio | Positive (+) to GPIO 23, Negative (-) to GND. |
| **Red LED 1** | **GPIO 25** | Digital Out | Anode (+) to GPIO 25, Cathode (-) through 220Ω–330Ω resistor to GND. |
| **Red LED 2** | **GPIO 26** | Digital Out | Anode (+) to GPIO 26, Cathode (-) through 220Ω–330Ω resistor to GND. |
| **Blue LED 1** | **GPIO 27** | Digital Out | Anode (+) to GPIO 27, Cathode (-) through 220Ω–330Ω resistor to GND. |
| **Blue LED 2** | **GPIO 14** | Digital Out | Anode (+) to GPIO 14, Cathode (-) through 220Ω–330Ω resistor to GND. |
| **Green LED 1** | **GPIO 32** | Digital Out | Anode (+) to GPIO 32, Cathode (-) through 220Ω–330Ω resistor to GND. |
| **Green LED 2** | **GPIO 33** | Digital Out | Anode (+) to GPIO 33, Cathode (-) through 220Ω–330Ω resistor to GND. |

> [!TIP]
> **GPIO Selection Safety**: The pins above avoid strapping pins (`GPIO 0, 2, 12, 15`) and input-only pins (`GPIO 34–39`), ensuring safe and reliable booting over USB serial.

---

## 💡 Emotion-Driven LED Patterns

The six individual discrete LEDs operate in non-blocking time-sliced patterns matching the robot's emotional state:

| Emotion | Active LEDs | Light Pattern |
|---|---|---|
| **Happy** | Green 1, Green 2 | Steady ON (cheerful, energetic glow) |
| **Sad** | Blue 1, Blue 2 | Slow synchronized blinking (500ms ON / 500ms OFF) |
| **Angry** | Red 1, Red 2 | Fast warning strobe (120ms ON / 120ms OFF) |
| **Sleepy** | Blue 1, Blue 2 | Gentle alternating breathing pulse (600ms cycle) |
| **Neutral** | Green 1, Green 2 | Steady calm ON |
| **Surprised** | Red + Green (4 LEDs) | Simultaneous alert illumination |
| **Confused** | Blue + Green (4 LEDs) | Curious dual-color illumination |

---

## 🔊 Buzzer Sound Effects

The piezo buzzer generates distinct, non-blocking frequency sequences for events and emotions:
- `playHappySound()`: Rising 2-tone melodic chirp (1046 Hz -> 1318 Hz).
- `playSadSound()`: Descending 2-tone low melody (440 Hz -> 330 Hz).
- `playAngrySound()`: Rapid alert buzz (220 Hz low frequency).
- `playSurpriseAlert()`: High-frequency double-pip (1760 Hz).
- `playConfusedSound()`: Inquisitive upward slide (659 Hz -> 880 Hz).
- `playDanceSequence()`: Four-beat rhythmic arpeggio (C6 - E6 - G6 - C7).

---

## 🛡️ Servo Safe Limits & Non-Blocking Easing

To protect the SG90 nylon gear trains:
- **Pan Angle**: Safely clamped between `15°` (far right) and `165°` (far left). Rest position: `90°`.
- **Tilt Angle**: Safely clamped between `45°` (look up) and `135°` (look down). Rest position: `90°`.
- **Easing**: Servos smoothly interpolate step-by-step (`updateServoEasing()`) rather than snapping, preventing high peak current draw and gear stripping.
- **Auto-Return**: Servos return gently to neutral resting position (`90°, 90°`) upon movement completion.

---

## 📦 Required Arduino Libraries

Install these via the **Arduino IDE Library Manager** (`Ctrl+Shift+I`):

1. **`ESP32Servo`** by Kevin Harrington
2. **`Adafruit SSD1306`** by Adafruit
3. **`Adafruit GFX Library`** by Adafruit
4. **`ArduinoJson`** (v6 or v7) by Benoît Blanchon

---

## ⚡ Flashing Instructions

1. Connect your ESP32 board to your computer via micro-USB or USB-C.
2. In Arduino IDE:
   - **Board**: `ESP32 Dev Module` (or `NodeMCU-32S`)
   - **Upload Speed**: `921600` (or `115200`)
   - **Port**: Select your detected COM port (e.g. `COM3` on Windows or `/dev/ttyUSB0` on Linux)
3. Click **Upload** (`Ctrl+U`).
4. Once flashed, open the Serial Monitor at **115200 baud**. You will receive:
   ```json
   {"type":"boot","status":"ready","device":"ROBO-PET-ESP32"}
   ```

---

## 📡 Serial Protocol (115200 Baud)

Incoming commands from the Python backend are newline-delimited JSON objects:

```json
{"type": "cmd", "emotion": "happy", "action": "dance"}
{"type": "cmd", "emotion": "neutral", "action": "look"}
{"type": "cmd", "emotion": "sad", "action": "nod"}
{"type": "cmd", "emotion": "confused", "action": "shake"}
{"type": "cmd", "emotion": "happy", "action": "wave"}
{"type": "cmd", "emotion": "happy", "action": "wiggle"}
```
