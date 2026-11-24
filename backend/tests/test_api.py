import pytest
import json
from backend.app import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    rv = client.get("/health")
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["status"] == "healthy"

def test_get_status_endpoint(client):
    rv = client.get("/status")
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["status"] == "online"
    assert "esp32_connected" in data
    assert "battery" in data
    assert "timer" in data
    assert "state" in data
    assert "emotion" in data["state"]

def test_post_talk_endpoint(client):
    payload = {"message": "Hello ROBO PET, how are you today?"}
    rv = client.post("/talk", json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert "response" in data
    assert "emotion" in data
    assert data["emotion"] in ["happy", "sad", "angry", "sleepy", "neutral", "surprised", "confused"]

def test_post_command_valid_movement(client):
    payload = {"command": "dance", "category": "movements"}
    rv = client.post("/command", json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["success"] is True
    assert data["action"] == "dance"

    # Test look movement
    look_payload = {"command": "look", "category": "movements"}
    rv_look = client.post("/command", json=look_payload)
    assert rv_look.status_code == 200
    data_look = json.loads(rv_look.data)
    assert data_look["success"] is True
    assert data_look["action"] == "look"

def test_post_command_valid_emotion(client):
    payload = {"command": "happy", "category": "emotions"}
    rv = client.post("/command", json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["success"] is True
    assert data["emotion"] == "happy"

def test_post_command_invalid(client):
    payload = {"command": "unauthorized_command"}
    rv = client.post("/command", json=payload)
    assert rv.status_code == 400
    data = json.loads(rv.data)
    assert data["success"] is False

def test_post_timer_endpoint(client):
    # Set timer
    payload = {"action": "set", "duration": 45, "label": "Tea Timer"}
    rv = client.post("/timer", json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["success"] is True
    assert data["timer"]["active"] is True

    # Cancel timer
    cancel_payload = {"action": "cancel"}
    rv = client.post("/timer", json=cancel_payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["success"] is True
    assert data["timer"]["active"] is False
