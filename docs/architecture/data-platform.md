# 4ang Data Platform Architecture

## Overview

PostgreSQL/Supabase is the canonical data source. The data platform organizes data into domains with typed access.

## Data Domains

```
                    PostgreSQL
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
     Identity         Content           Social
        │                │                │
        ▼                ▼                ▼
    profiles          tracks           events
    settings          artists          posts
    events            albums           comments
                      playlists        follows
                      audio_analysis   notifications
```

## Event System

### Architecture

```
Application
    ↓
EventService.record()
    ↓
PostgreSQL (user_events)
    ↓
[Future: Event Bus]
```

### Event Types

| Category | Events |
|----------|--------|
| Playback | played, completed, skipped, seeked |
| Library | liked, unliked, saved, unsaved |
| Playlist | created, updated, track_added, track_removed |
| Artist | followed, unfollowed, release.published |
| Social | followed, post.created, comment.created |
| Search | executed |
| Recommendation | impression, clicked, played, skipped |

### Event Flow

```
Player 3.0
    ↓
Event Buffer (client)
    ↓
Batch API (/api/v1/events)
    ↓
EventService (server)
    ↓
PostgreSQL (user_events)
```

## Audio Analysis

C++ Audio Engine → AudioAnalysis table

Stores: duration, loudness, BPM, spectral features, energy, etc.

## Recommendation History

Tracks what was recommended, when, and user feedback (impression/click/play/skip).

## Database Tables

| Table | Purpose |
|-------|---------|
| `user_events` | Application events |
| `audio_analysis` | C++ engine results |
| `ai_jobs` | AI processing jobs |
| `recommendation_history` | Recommendation tracking |

## RLS Policies

- Users can only see their own events
- Users can only see their own recommendation history
- Audio analysis is public read
- AI jobs are service-role only
