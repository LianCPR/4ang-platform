"""
4ang Intelligence Service — Unit Tests
"""

import pytest
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_track():
    response = client.post("/analyze", json={
        "title": "Rainy Day Sad Song",
        "artist": "Test Artist",
        "genre": "indie",
    })
    assert response.status_code == 200
    data = response.json()
    assert "mood" in data
    assert "energy" in data
    assert data["energy"] == "low"


def test_analyze_happy_track():
    response = client.post("/analyze", json={
        "title": "Happy Sunshine Day",
        "artist": "Test Artist",
        "genre": "pop",
    })
    assert response.status_code == 200
    data = response.json()
    assert "happy" in data["mood"]


def test_extract_features():
    response = client.post("/features", json={
        "title": "Test Track",
        "artist": "Test Artist",
    })
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert "feature_names" in data
    assert len(data["features"]) == len(data["feature_names"])
