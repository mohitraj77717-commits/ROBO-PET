# backend/timer_manager.py — Independent Background Timer Manager

import logging
import threading
import time
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger("RoboPet.TimerManager")

class TimerManager:
    def __init__(self, on_timer_expire: Optional[Callable[[str], None]] = None):
        self.on_timer_expire = on_timer_expire
        self._lock = threading.Lock()
        self.is_active = False
        self.duration = 0
        self.remaining = 0
        self.label = "Timer"
        self._stop_event = threading.Event()
        self._timer_thread: Optional[threading.Thread] = None

    def set_timer(self, duration_sec: int, label: str = "Timer") -> Dict[str, Any]:
        """Set a countdown timer in seconds."""
        if duration_sec <= 0:
            return {"success": False, "message": "Duration must be greater than 0"}

        with self._lock:
            # Stop any existing timer
            self._cancel_internal()

            self.duration = duration_sec
            self.remaining = duration_sec
            self.label = label or "Timer"
            self.is_active = True
            self._stop_event.clear()

            self._timer_thread = threading.Thread(target=self._countdown_loop, daemon=True)
            self._timer_thread.start()

        logger.info(f"Timer set for {duration_sec}s ({label})")
        return {
            "success": True,
            "message": f"Timer set for {duration_sec} seconds ({self.label}).",
            "timer": self.get_status()
        }

    def cancel_timer(self) -> Dict[str, Any]:
        """Cancel any active timer."""
        with self._lock:
            was_active = self.is_active
            self._cancel_internal()

        logger.info("Timer cancelled")
        return {
            "success": True,
            "message": "Timer cancelled." if was_active else "No timer was active.",
            "timer": self.get_status()
        }

    def _cancel_internal(self):
        self.is_active = False
        self.remaining = 0
        self._stop_event.set()

    def _countdown_loop(self):
        """Worker thread that ticks down every second."""
        while self.remaining > 0 and not self._stop_event.is_set():
            time.sleep(1.0)
            with self._lock:
                if self._stop_event.is_set():
                    break
                self.remaining -= 1
                if self.remaining <= 0:
                    self.is_active = False
                    break

        if not self._stop_event.is_set() and self.remaining <= 0:
            logger.info(f"⏱️ Timer expired: {self.label}!")
            if self.on_timer_expire:
                try:
                    self.on_timer_expire(self.label)
                except Exception as e:
                    logger.error(f"Error in timer expire callback: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get current timer snapshot matching frontend expectations."""
        with self._lock:
            return {
                "active": self.is_active,
                "duration": self.duration,
                "remaining": max(0, self.remaining),
                "label": self.label
            }

# Global singleton
timer_manager = TimerManager()
