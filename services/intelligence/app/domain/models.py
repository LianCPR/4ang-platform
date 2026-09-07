"""
4ang Intelligence Domain Models

Typed domain models for the Python intelligence service.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class EventType(str, Enum):
    TRACK_PLAYED = "track.played"
    TRACK_COMPLETED = "track.completed"
    TRACK_SKIPPED = "track.skipped"
    TRACK_LIKED = "track.liked"
    TRACK_UNLIKED = "track.unliked"
    TRACK_SAVED = "track.saved"
    ARTIST_FOLLOWED = "artist.followed"
    SEARCH_EXECUTED = "search.executed"
    RECOMMENDATION_CLICKED = "recommendation.clicked"
    RECOMMENDATION_SKIPPED = "recommendation.skipped"


@dataclass
class UserEvent:
    user_id: str
    event_type: EventType
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    occurred_at: str = ""


@dataclass
class AudioFeatures:
    duration_seconds: float = 0.0
    sample_rate: float = 44100.0
    channels: int = 1
    rms: float = 0.0
    peak: float = 0.0
    loudness_lufs: float = 0.0
    true_peak_dbtp: float = 0.0
    dynamic_range_db: float = 0.0
    bpm: float = 0.0
    bpm_confidence: float = 0.0
    spectral_centroid: float = 0.0
    spectral_bandwidth: float = 0.0
    spectral_rolloff: float = 0.0
    spectral_flatness: float = 0.0
    brightness: float = 0.0
    energy: float = 0.0
    danceability: float = 0.0
    silence_ratio: float = 0.0


@dataclass
class TasteProfile:
    user_id: str
    top_artists: list = field(default_factory=list)  # [(username, name, score)]
    top_genres: list = field(default_factory=list)    # [(genre, score)]
    top_tracks: list = field(default_factory=list)    # [(track_id, title, score)]
    listening_frequency: str = "unknown"
    personalization_level: str = "cold_start"
    last_updated: str = ""


@dataclass
class RecommendationCandidate:
    track_id: str
    score: float = 0.0
    reason: str = ""
    source: str = ""
    artist_affinity: float = 0.0
    genre_affinity: float = 0.0
    recency: float = 0.0
    freshness: float = 0.0


@dataclass
class RecommendationResult:
    track_id: str
    score: float
    reason: str
    context: str = "home"
    position: int = 0
    source: str = ""


@dataclass
class SearchIntent:
    query_type: str = "keyword"
    keywords: list = field(default_factory=list)
    moods: list = field(default_factory=list)
    genres: list = field(default_factory=list)
    artists: list = field(default_factory=list)
    energy: str = "medium"
    activity: str = ""
    duration_minutes: Optional[int] = None
    confidence: float = 0.0
