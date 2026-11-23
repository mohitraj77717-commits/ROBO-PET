# backend/sensor_manager.py — Sensor Reading & Telemetry Processing

import logging
import random
import threading
import time
from datetime import datetime
from typing import Dict, Any, Optional
from backend.config import Config

logger = logging.getLogger("RoboPet.SensorManager")

class SensorManager:
    def __init__(self):
        self._lock = threading.Lock()
        self.temperature: Optional[float] = None
        self.distance: Optional[int] = None
        self.battery: int = Config.SIMULATED_BATTERY
        self.last_updated: Optional[datetime] = None
        self.is_hardware_source = False

    def process_incoming_telemetry(self, telemetry_data: Dict[str, Any]):
        """Callback to handle telemetry JSON packet from ESP32."""
        with self._lock:
            if "temperature" in telemetry_data or "temp" in telemetry_data:
                val = telemetry_data.get("temperature", telemetry_data.get("temp"))
                if val is not None:
                    try:
                        self.temperature = round(float(val), 1)
                    except ValueError:
                        pass

            if "distance" in telemetry_data or "dist" in telemetry_data:
                val = telemetry_data.get("distance", telemetry_data.get("dist"))
                if val is not None:
                    try:
                        self.distance = int(val)
                    except ValueError:
                        pass

            if "battery" in telemetry_data or "batt" in telemetry_data:
                val = telemetry_data.get("battery", telemetry_data.get("batt"))
                if val is not None:
                    try:
                        self.battery = max(0, min(100, int(val)))
                    except ValueError:
                        pass

            self.last_updated = datetime.now()
            self.is_hardware_source = True

    def get_readings(self, simulate_if_missing: bool = True) -> Dict[str, Any]:
        """
        Return the current sensor readings.
        If real hardware telemetry is not available and simulation is permitted, returns realistic values.
        """
        with self._lock:
            if self.is_hardware_source and self.temperature is not None:
                return {
                    "temperature": self.temperature,
                    "distance": self.distance,
                    "battery": self.battery,
                    "source": "esp32",
                    "last_updated": self.last_updated.isoformat() if self.last_updated else None
                }

            if simulate_if_missing:
                # Slight organic micro-variation for realistic simulation
                sim_temp = round(Config.SIMULATED_TEMP_BASE + random.uniform(-0.4, 0.4), 1)
                sim_dist = max(5, int(Config.SIMULATED_DIST_BASE + random.randint(-4, 6)))
                return {
                    "temperature": sim_temp,
                    "distance": sim_dist,
                    "battery": self.battery,
                    "source": "simulated",
                    "last_updated": datetime.now().isoformat()
                }

            return {
                "temperature": None,
                "distance": None,
                "battery": self.battery,
                "source": "unavailable",
                "last_updated": None
            }

# Global singleton
sensor_manager = SensorManager()
