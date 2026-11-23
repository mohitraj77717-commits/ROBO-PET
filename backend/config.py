# backend/config.py — Centralized Configuration for ROBO PET Backend

import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# Load .env file from project root or backend folder
env_path = PROJECT_ROOT / ".env"
if not env_path.exists():
    env_path = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=env_path)

class Config:
    # Flask Settings
    HOST = os.getenv("FLASK_HOST", "0.0.0.0")
    PORT = int(os.getenv("FLASK_PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1", "yes")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # Static Frontend Serving
    SERVE_FRONTEND = os.getenv("SERVE_FRONTEND", "true").lower() in ("true", "1", "yes")
    FRONTEND_FOLDER = str(FRONTEND_DIR)

    # Gemini AI Settings
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    GEMINI_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.7"))
    GEMINI_TIMEOUT_SEC = int(os.getenv("GEMINI_TIMEOUT_SEC", "10"))

    # ESP32 Serial Settings
    SERIAL_PORT = os.getenv("SERIAL_PORT", "AUTO")  # "AUTO" for auto-detection or e.g. "COM3", "/dev/ttyUSB0"
    BAUD_RATE = int(os.getenv("BAUD_RATE", 115200))
    SERIAL_TIMEOUT = float(os.getenv("SERIAL_TIMEOUT", "1.0"))
    SIMULATE_SERIAL = os.getenv("SIMULATE_SERIAL", "auto").lower()  # "true", "false", or "auto" (fallback if hardware absent)

    # SG90 Servo Movement Calibration Limits
    SERVO_PAN_MIN = int(os.getenv("SERVO_PAN_MIN", 10))
    SERVO_PAN_MAX = int(os.getenv("SERVO_PAN_MAX", 170))
    SERVO_PAN_CENTER = int(os.getenv("SERVO_PAN_CENTER", 90))

    SERVO_TILT_MIN = int(os.getenv("SERVO_TILT_MIN", 40))
    SERVO_TILT_MAX = int(os.getenv("SERVO_TILT_MAX", 140))
    SERVO_TILT_CENTER = int(os.getenv("SERVO_TILT_CENTER", 90))

    # Sensor Telemetry Defaults (for simulated/fallback mode)
    SIMULATED_TEMP_BASE = float(os.getenv("SIMULATED_TEMP_BASE", "24.5"))
    SIMULATED_DIST_BASE = int(os.getenv("SIMULATED_DIST_BASE", "42"))
    SIMULATED_BATTERY = int(os.getenv("SIMULATED_BATTERY", "88"))
