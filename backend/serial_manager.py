# backend/serial_manager.py — ESP32 Serial Communication & Virtual Hardware Simulation

import json
import logging
import threading
import time
from typing import Optional, Dict, Any
from backend.config import Config

logger = logging.getLogger("RoboPet.SerialManager")

class SerialManager:
    def __init__(self):
        self.port_name = Config.SERIAL_PORT
        self.baud_rate = Config.BAUD_RATE
        self.timeout = Config.SERIAL_TIMEOUT

        self.serial_conn = None
        self.is_connected = False
        self.is_simulated = False
        self._running = False
        self._write_lock = threading.Lock()
        self._read_thread: Optional[threading.Thread] = None

        # Virtual state for simulation
        self.virtual_expression = "neutral"
        self.virtual_action = None

        self.connect()

    def connect(self) -> bool:
        """Attempt connection to real ESP32 serial port or fallback to simulation."""
        try:
            import serial
            import serial.tools.list_ports
        except ImportError:
            logger.warning("pyserial is not available. Falling back to simulated serial.")
            self._start_simulation()
            return False

        target_port = self._resolve_port(serial.tools.list_ports.comports())

        if target_port:
            try:
                logger.info(f"Connecting to ESP32 on {target_port} at {self.baud_rate} baud...")
                self.serial_conn = serial.Serial(
                    port=target_port,
                    baudrate=self.baud_rate,
                    timeout=self.timeout
                )
                time.sleep(2.0)  # ESP32 reset settling time
                self.is_connected = True
                self.is_simulated = False
                self._running = True
                self._start_reader_thread()
                logger.info(f"Successfully connected to ESP32 on {target_port}")
                return True
            except Exception as e:
                logger.warning(f"Failed to open port {target_port}: {e}")

        # Check simulation fallback policy
        sim_pref = Config.SIMULATE_SERIAL.lower()
        if sim_pref in ("true", "1", "auto"):
            logger.info("No active ESP32 device found. Enabling virtual hardware simulation.")
            self._start_simulation()
            return True
        else:
            self.is_connected = False
            self.is_simulated = False
            return False

    def _resolve_port(self, available_ports) -> Optional[str]:
        """Find the target COM/tty port."""
        if self.port_name and self.port_name.upper() != "AUTO":
            return self.port_name

        # Auto-detect common USB-Serial identifiers for ESP32
        esp_keywords = ["CP210", "CH340", "USB Serial", "CH9102", "FTDI", "UART"]
        for port in available_ports:
            desc = f"{port.description} {port.manufacturer or ''}".upper()
            if any(k.upper() in desc for k in esp_keywords):
                logger.info(f"Auto-detected ESP32 device: {port.device} ({desc})")
                return port.device

        # If only one serial port exists, use it
        if len(available_ports) == 1:
            return available_ports[0].device

        return None

    def _start_reader_thread(self):
        self._read_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._read_thread.start()

    def _reader_loop(self):
        """Continuously read incoming logs or status lines from the ESP32."""
        while self._running and self.serial_conn and self.serial_conn.is_open:
            try:
                line = self.serial_conn.readline().decode("utf-8", errors="replace").strip()
                if line:
                    logger.debug(f"[ESP32 -> RX]: {line}")
            except Exception as e:
                logger.error(f"Error reading from serial: {e}")
                time.sleep(1.0)

    def _start_simulation(self):
        self.is_connected = False
        self.is_simulated = True
        self._running = True

    def send_command(self, command_payload: Dict[str, Any]) -> bool:
        """
        Send structured JSON command to ESP32 over serial.
        Format: {"type": "cmd", "emotion": "happy", "action": "dance"}\n
        """
        raw_msg = json.dumps(command_payload) + "\n"

        if self.is_connected and self.serial_conn and self.serial_conn.is_open:
            try:
                with self._write_lock:
                    self.serial_conn.write(raw_msg.encode("utf-8"))
                    self.serial_conn.flush()
                logger.info(f"[SERIAL TX -> ESP32]: {raw_msg.strip()}")
                return True
            except Exception as e:
                logger.error(f"Failed to transmit to ESP32: {e}")
                self.is_connected = False
                return False

        if self.is_simulated:
            logger.info(f"[VIRTUAL HARDWARE SIMULATION]: {raw_msg.strip()}")
            if "emotion" in command_payload:
                self.virtual_expression = command_payload["emotion"]
            if "action" in command_payload:
                self.virtual_action = command_payload["action"]
            return True

        return False

    def close(self):
        self._running = False
        if self.serial_conn and self.serial_conn.is_open:
            try:
                self.serial_conn.close()
            except Exception:
                pass
        self.is_connected = False
