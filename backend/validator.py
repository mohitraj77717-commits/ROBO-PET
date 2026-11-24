# backend/validator.py — Strict Command & Emotion Allowlist Validator

import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

COMMANDS_FILE = Path(__file__).resolve().parent / "commands.json"

class CommandValidator:
    def __init__(self, commands_path: Path = COMMANDS_FILE):
        self.commands_path = commands_path
        self._load_registry()

    def _load_registry(self):
        try:
            with open(self.commands_path, "r", encoding="utf-8") as f:
                self.registry = json.load(f)
        except Exception:
            # Fallback hardcoded defaults if file reading fails
            self.registry = {
                "emotions": {
                    "happy": {}, "sad": {}, "angry": {}, "sleepy": {},
                    "neutral": {}, "surprised": {}, "confused": {}
                },
                "movements": {
                    "dance": {}, "nod": {}, "shake": {}, "look": {},
                    "wave": {}, "wiggle": {}
                },
                "conversation": {
                    "chat": {}, "greet": {}, "tell_joke": {}, "encourage": {},
                    "goodbye": {}, "compliment": {}, "tell_fact": {},
                    "roast_playfully": {}, "quiet_mode": {}
                },
                "display": {
                    "show_time": {}, "show_date": {}, "show_datetime": {}
                },
                "utilities": {
                    "status": {}, "reset_expression": {}, "show_battery": {}
                }
            }

    @property
    def valid_emotions(self) -> set:
        return set(self.registry.get("emotions", {}).keys())

    @property
    def valid_movements(self) -> set:
        return set(self.registry.get("movements", {}).keys())

    @property
    def valid_conversations(self) -> set:
        return set(self.registry.get("conversation", {}).keys())

    @property
    def valid_display(self) -> set:
        return set(self.registry.get("display", {}).keys())

    @property
    def valid_utilities(self) -> set:
        return set(self.registry.get("utilities", {}).keys())

    def validate_emotion(self, emotion: Optional[str]) -> str:
        """Validate and return a safe emotion string from allowlist. Defaults to 'neutral'."""
        if not emotion or not isinstance(emotion, str):
            return "neutral"
        clean = emotion.strip().lower()
        return clean if clean in self.valid_emotions else "neutral"

    def validate_action(self, action: Optional[str]) -> Optional[str]:
        """Validate and return a safe movement action string or None."""
        if not action or not isinstance(action, str):
            return None
        clean = action.strip().lower()

        # Direct match in movements allowlist (dance, nod, shake, look, wave, wiggle)
        if clean in self.valid_movements:
            return clean

        # Safe aliases for directional looking
        if clean in ("look_left", "look_right", "look_center"):
            return "look"

        return None

    def validate_display_action(self, display_action: Optional[str]) -> Optional[str]:
        """Validate display-related actions."""
        if not display_action or not isinstance(display_action, str):
            return None
        clean = display_action.strip().lower()
        return clean if clean in self.valid_display else None

    def validate_manual_command(self, command_name: str, category: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validates a manual command from the frontend.
        Returns: (is_valid, resolved_category, command_metadata)
        """
        if not command_name or not isinstance(command_name, str):
            return False, "", {}

        clean_cmd = command_name.strip().lower()
        clean_cat = category.strip().lower() if category else ""

        # Normalize directional look aliases
        if clean_cmd in ("look_left", "look_right", "look_center"):
            clean_cmd = "look"

        # Check explicitly requested category
        if clean_cat and clean_cat in self.registry:
            if clean_cmd in self.registry[clean_cat]:
                return True, clean_cat, self.registry[clean_cat][clean_cmd]

        # Search across all allowed categories
        for cat, items in self.registry.items():
            if clean_cmd in items:
                return True, cat, items[clean_cmd]

        return False, "", {}

    def sanitize_ai_output(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize and strictly validate AI-generated output from Gemini.
        Ensures response, emotion, and actions strictly meet allowlist requirements.
        """
        if not isinstance(raw_data, dict):
            return {
                "response": "Beep boop! My circuits are ready.",
                "emotion": "neutral",
                "action": None,
                "display_action": None,
                "metadata": {}
            }

        response_text = str(raw_data.get("response", "")).strip()
        if not response_text:
            response_text = "Beep boop! I'm here and ready to help."

        emotion = self.validate_emotion(raw_data.get("emotion"))
        action = self.validate_action(raw_data.get("action"))
        display_action = self.validate_display_action(raw_data.get("display_action"))

        return {
            "response": response_text,
            "emotion": emotion,
            "action": action,
            "display_action": display_action,
            "metadata": raw_data.get("metadata", {})
        }

# Global singleton
validator = CommandValidator()
