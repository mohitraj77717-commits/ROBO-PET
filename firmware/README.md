# 🤖 ROBO PET — ESP32 Firmware Documentation

This directory contains the production-ready Arduino C++ firmware for the physical **ROBO PET** companion.

---

## 🔌 Hardware Pinout Wiring Guide

| Component | ESP32 Pin | Details |
|---|---|---|
| **SG90 Pan Servo (Yaw / Turn)** | **GPIO 18** | PWM signal (Orange/Yellow). Red to 5V, Brown to GND. |
| **SG90 Tilt Servo (Pitch / Up-Down)** | **GPIO 19** | PWM signal (Orange/Yellow). Red to 5V, Brown to GND. |
| **SSD1306 OLED SDA** | **GPIO 21** | I2C Data (3.3V / 5V) |
| **SSD1306 OLED SCL** | **GPIO 22** | I2C Clock |
| **HC-SR04 Ultrasonic Trigger** | **GPIO 5** | Trigger digital output |
| **HC-SR04 Ultrasonic Echo** | **GPIO 4** | Echo digital input (use 1k/2k resistor voltage divider to 3.3V) |
| **Piezo Buzzer / Speaker** | **GPIO 23** | Audio chirp generator |

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
4. Once flashed, open the Serial Monitor at **115200 baud**. You will see:
   ```json
   {"type":"boot","status":"ready","device":"ROBO-PET-ESP32"}
   ```

---

## 📡 Serial Communication Protocol (115200 Baud)

### Commands Sent from Python Backend to ESP32:
```json
{"type": "cmd", "action": "dance", "emotion": "happy"}
{"type": "cmd", "action": "nod", "emotion": "happy"}
{"type": "cmd", "action": "look_left"}
{"type": "cmd", "emotion": "sleepy"}
{"type": "display", "mode": "temperature"}
{"type": "alert", "reason": "timer_expired"}
```

### Telemetry Sent from ESP32 to Python Backend:
```json
{"type": "telemetry", "temp": 24.6, "dist": 42, "battery": 88, "emotion": "neutral"}
```

---

## 🛡️ Servo Safe Limits

To prevent physical stripping of the SG90 nylon gears:
- **Pan Angle**: Restricted between `10°` (far right) and `170°` (far left). Neutral center is `90°`.
- **Tilt Angle**: Restricted between `40°` (look up) and `140°` (look down). Neutral center is `90°`.
- Non-blocking smooth easing interpolates angles step-by-step rather than snapping.
