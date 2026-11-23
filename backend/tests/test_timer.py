import pytest
import time
from backend.timer_manager import TimerManager

def test_timer_lifecycle():
    expired_labels = []
    tm = TimerManager(on_timer_expire=lambda label: expired_labels.append(label))

    # Set timer
    res = tm.set_timer(1, "Quick Test")
    assert res["success"] is True
    status = tm.get_status()
    assert status["active"] is True
    assert status["remaining"] <= 1
    assert status["label"] == "Quick Test"

    # Wait for expiration
    time.sleep(1.2)
    status = tm.get_status()
    assert status["active"] is False
    assert "Quick Test" in expired_labels

def test_timer_cancel():
    tm = TimerManager()
    tm.set_timer(60, "Long Timer")
    assert tm.get_status()["active"] is True

    cancel_res = tm.cancel_timer()
    assert cancel_res["success"] is True
    assert tm.get_status()["active"] is False
