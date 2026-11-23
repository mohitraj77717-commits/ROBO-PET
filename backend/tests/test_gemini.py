import pytest
from backend.gemini_service import gemini_service

def test_fallback_greeting():
    res = gemini_service.generate_chat_response("Hello ROBO PET!")
    assert isinstance(res["response"], str)
    assert len(res["response"]) > 0
    assert res["emotion"] in ("happy", "neutral")
    assert res["action"] in ("wave", "nod", "wiggle", "look_center", None)

def test_fallback_dance():
    res = gemini_service.generate_chat_response("Can you dance for me?")
    assert res["action"] == "dance"
    assert res["emotion"] == "happy"

def test_fallback_joke():
    res = gemini_service.generate_chat_response("Tell me a funny joke")
    assert isinstance(res["response"], str)
    assert len(res["response"]) > 10

def test_fallback_sensors():
    res = gemini_service.generate_chat_response("What is the temperature?")
    assert res["display_action"] == "show_temperature"

def test_chat_history_recording():
    gemini_service.clear_history()
    gemini_service.generate_chat_response("Hi there!")
    assert len(gemini_service.chat_history) == 2
    assert gemini_service.chat_history[0]["role"] == "user"
    assert gemini_service.chat_history[1]["role"] == "assistant"
    gemini_service.clear_history()
