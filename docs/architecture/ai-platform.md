# 4ang AI Platform Architecture

## Overview

AI intelligence is provided by the Python service (`services/intelligence/`). TypeScript orchestrates, Python executes ML/ranking.

## Architecture

```
TypeScript API
      │
      │ typed request
      ▼
Python Intelligence Service
      │
      ├── Feature extraction
      ├── Ranking
      ├── Recommendation
      ├── Semantic analysis
      └── AI assistant support
```

## Components

### 1. Recommendation Engine (TypeScript)
- `server/src/recommendation.js` — Core recommendation logic
- Candidate generation, scoring, diversity
- Taste profile building
- Daily mix, smart radio, similar songs

### 2. AI Intelligence (Python)
- `services/intelligence/` — FastAPI service
- Semantic analysis
- Feature extraction
- Ranking experiments

### 3. AI Assistant (TypeScript)
- `server/src/assistant.js` — Tool-based assistant
- Intent parsing
- Tool registry
- Response generation

### 4. C++ Audio Engine
- `native/audio-engine/` — DSP + analysis
- Waveform, loudness, BPM, spectral features
- Feeds into Python intelligence

## Data Flow

```
User Interaction
    ↓
Event System
    ↓
Feature Extraction
    ↓
Taste Profile
    ↓
Recommendation Engine
    ↓
Results
    ↓
Feedback Loop
```

## Security Rules

1. AI never executes arbitrary SQL
2. AI never accesses passwords/tokens
3. AI tools are validated server-side
4. AI output is sanitized
5. Python service is independent of Node.js

## API Integration

```
GET /api/v1/recommendations/for-you
    → RecommendationService.getForYou()

POST /api/v1/assistant/message
    → AssistantService.processMessage()

POST /api/v1/ai/analyze-track
    → AIService.analyzeTrack()
```
