import pytest
from backend.validator import validator

def test_valid_emotions():
    assert validator.validate_emotion("happy") == "happy"
    assert validator.validate_emotion("sad") == "sad"
    assert validator.validate_emotion("angry") == "angry"
    assert validator.validate_emotion("sleepy") == "sleepy"
    assert validator.validate_emotion("neutral") == "neutral"
    assert validator.validate_emotion("surprised") == "surprised"
    assert validator.validate_emotion("confused") == "confused"

def test_invalid_emotion_defaults_to_neutral():
    assert validator.validate_emotion("ecstatic") == "neutral"
    assert validator.validate_emotion("") == "neutral"
    assert validator.validate_emotion(None) == "neutral"
    assert validator.validate_emotion("malicious_code_injection") == "neutral"

def test_valid_movements():
    valid_moves = ["dance", "nod", "shake", "look", "wave", "wiggle"]
    for move in valid_moves:
        assert validator.validate_action(move) == move

    # Directional aliases normalize to "look"
    assert validator.validate_action("look_left") == "look"
    assert validator.validate_action("look_right") == "look"
    assert validator.validate_action("look_center") == "look"

def test_invalid_movement_returns_none():
    assert validator.validate_action("fly") is None
    assert validator.validate_action("destroy_world") is None
    assert validator.validate_action("") is None
    assert validator.validate_action(None) is None

def test_manual_command_validation():
    # Valid command
    is_valid, cat, meta = validator.validate_manual_command("dance", "movements")
    assert is_valid is True
    assert cat == "movements"

    # Valid command without category specified
    is_valid, cat, meta = validator.validate_manual_command("wave")
    assert is_valid is True
    assert cat == "movements"

    # Invalid command
    is_valid, cat, meta = validator.validate_manual_command("hack_system")
    assert is_valid is False

def test_sanitize_ai_output():
    raw_ai = {
        "response": "Hello world! I am excited to meet you.",
        "emotion": "happy",
        "action": "dance",
        "display_action": "show_time",
        "metadata": {"test": 123}
    }
    sanitized = validator.sanitize_ai_output(raw_ai)
    assert sanitized["response"] == "Hello world! I am excited to meet you."
    assert sanitized["emotion"] == "happy"
    assert sanitized["action"] == "dance"
    assert sanitized["display_action"] == "show_time"
    assert sanitized["metadata"] == {"test": 123}

def test_sanitize_malformed_ai_output():
    sanitized = validator.sanitize_ai_output("not a dict")
    assert sanitized["emotion"] == "neutral"
    assert sanitized["action"] is None
    assert isinstance(sanitized["response"], str)
