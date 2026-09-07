"""
4ang Intelligence Service — FastAPI Entry Point

Provides AI/ML capabilities:
- Semantic music analysis
- Recommendation enhancement
- Feature extraction
- Ranking experiments
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import numpy as np

app = FastAPI(
    title="4ang Intelligence Service",
    version="0.1.0",
    description="AI/ML intelligence layer for 4ang music platform",
)


class AnalysisRequest(BaseModel):
    title: str
    artist: str
    genre: Optional[str] = None
    description: Optional[str] = None


class AnalysisResult(BaseModel):
    mood: list[str]
    energy: str
    contexts: list[str]
    themes: list[str]
    confidence: float


class FeatureVector(BaseModel):
    features: list[float]
    feature_names: list[str]


@app.get("/health")
async def health():
    return {"status": "ok", "service": "4ang-intelligence"}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze_track(request: AnalysisRequest):
    """
    Analyze a track's semantic properties.
    Uses metadata-based inference (no audio processing yet).
    """
    # Simple keyword-based analysis (foundation for ML)
    mood = []
    energy = "medium"
    contexts = []
    themes = []

    title_lower = request.title.lower()
    genre_lower = (request.genre or "").lower()

    # Mood detection
    if any(w in title_lower for w in ["sad", "buồn", "rain", "mưa"]):
        mood.append("sad")
        energy = "low"
    if any(w in title_lower for w in ["happy", "vui", "sun", "nắng"]):
        mood.append("happy")
        energy = "high"
    if any(w in title_lower for w in ["chill", "relax", "thư"]):
        mood.append("calm")
        energy = "low"
    if any(w in title_lower for w in ["love", "tình", "heart"]):
        mood.append("romantic")
    if any(w in title_lower for w in ["night", "đêm", "dark"]):
        mood.append("dreamy")
        contexts.append("night")

    if not mood:
        mood = ["neutral"]

    # Context detection
    if any(w in title_lower for w in ["study", "học", "focus"]):
        contexts.extend(["study", "focus"])
    if any(w in title_lower for w in ["workout", "tập", "gym"]):
        contexts.append("workout")
        energy = "high"

    # Genre-based energy
    if "rock" in genre_lower or "metal" in genre_lower:
        energy = "high"
    if "ambient" in genre_lower or "classical" in genre_lower:
        energy = "low"

    return AnalysisResult(
        mood=mood[:3],
        energy=energy,
        contexts=contexts[:3],
        themes=themes[:3],
        confidence=0.6,
    )


@app.post("/features", response_model=FeatureVector)
async def extract_features(request: AnalysisRequest):
    """
    Extract feature vector for recommendation engine.
    """
    features = []
    names = []

    # Title length (normalized)
    features.append(len(request.title) / 100.0)
    names.append("title_length")

    # Genre encoding (simple)
    genre_map = {"pop": 0, "rock": 1, "hip-hop": 2, "jazz": 3, "electronic": 4, "indie": 5}
    genre_val = genre_map.get((request.genre or "").lower(), -1)
    features.append(genre_val / max(len(genre_map), 1))
    names.append("genre_encoded")

    # Mood features (placeholder)
    features.extend([0.0] * 5)
    names.extend(["mood_sad", "mood_happy", "mood_calm", "mood_energetic", "mood_romantic"])

    return FeatureVector(features=features, feature_names=names)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
