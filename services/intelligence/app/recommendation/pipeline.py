"""
4ang Recommendation Pipeline

Structured recommendation pipeline with configurable weights.
Extends the existing TypeScript recommendation engine.
"""

from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class PipelineWeights:
    """Configurable ranking weights."""
    artist_affinity: float = 0.30
    genre_affinity: float = 0.20
    recent_activity: float = 0.15
    popularity: float = 0.10
    freshness: float = 0.10
    diversity: float = 0.05
    exploration: float = 0.10

    # Constraints
    max_per_artist: int = 3
    max_per_album: int = 2
    exploration_ratio: float = 0.20  # 20% discovery


DEFAULT_WEIGHTS = PipelineWeights()


def score_candidate(candidate: dict, user_taste: dict, weights: PipelineWeights = DEFAULT_WEIGHTS) -> float:
    """
    Score a recommendation candidate based on user taste and configurable weights.
    
    Args:
        candidate: dict with artist_affinity, genre_affinity, recency, popularity, freshness
        user_taste: dict with user taste signals
        weights: configurable scoring weights
    
    Returns:
        Score between 0 and 1
    """
    score = 0.0

    # Artist affinity
    score += candidate.get("artist_affinity", 0.0) * weights.artist_affinity

    # Genre affinity
    score += candidate.get("genre_affinity", 0.0) * weights.genre_affinity

    # Recent activity signal
    score += candidate.get("recency", 0.0) * weights.recent_activity

    # Popularity
    score += candidate.get("popularity", 0.0) * weights.popularity

    # Freshness (newer content gets a boost)
    score += candidate.get("freshness", 0.0) * weights.freshness

    # Exploration bonus (for tracks outside user's usual taste)
    exploration = candidate.get("exploration", 0.0)
    score += exploration * weights.exploration

    return min(max(score, 0.0), 1.0)


def apply_diversity(candidates: list, weights: PipelineWeights = DEFAULT_WEIGHTS) -> list:
    """
    Apply diversity constraints to avoid artist/album domination.
    
    Args:
        candidates: sorted list of scored candidates
        weights: diversity constraints
    
    Returns:
        Filtered and reordered candidates
    """
    result = []
    artist_count = {}
    album_count = {}

    for c in candidates:
        artist = c.get("artist_username", "")
        album = c.get("album", "")

        if artist and artist_count.get(artist, 0) >= weights.max_per_artist:
            continue
        if album and album_count.get(album, 0) >= weights.max_per_album:
            continue

        result.append(c)
        if artist:
            artist_count[artist] = artist_count.get(artist, 0) + 1
        if album:
            album_count[album] = album_count.get(album, 0) + 1

    return result


def split_exploitation_exploration(candidates: list, weights: PipelineWeights = DEFAULT_WEIGHTS) -> tuple:
    """
    Split candidates into exploitation (known preferences) and exploration (discovery).
    
    Returns:
        (exploitation_list, exploration_list)
    """
    exploitation = []
    exploration = []

    for c in candidates:
        if c.get("exploration", 0.0) > 0.5:
            exploration.append(c)
        else:
            exploitation.append(c)

    return exploitation, exploration


def merge_recommendations(exploitation: list, exploration: list, weights: PipelineWeights = DEFAULT_WEIGHTS, limit: int = 20) -> list:
    """
    Merge exploitation and exploration recommendations with configured ratio.
    """
    exploration_budget = int(limit * weights.exploration_ratio)
    exploitation_budget = limit - exploration_budget

    result = exploitation[:exploitation_budget]
    result.extend(exploration[:exploration_budget])

    # Fill remaining slots if one list is shorter
    remaining = limit - len(result)
    if remaining > 0:
        overflow = exploitation[exploitation_budget:] + exploration[exploration_budget:]
        result.extend(overflow[:remaining])

    return result[:limit]
