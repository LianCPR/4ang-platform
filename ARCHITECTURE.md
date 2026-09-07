# 4ang Architecture

## Overview

4ang is a modern music streaming and social music platform built with a multi-language architecture optimized for performance, modularity, and scalability.

## Technology Stack

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Frontend** | TypeScript, React, Vite | UI, routing, state, player controller |
| **Backend** | TypeScript, Node.js, Express | API, business logic, auth, realtime |
| **Native** | C++, CMake | Audio DSP, waveform analysis, feature extraction |
| **AI/ML** | Python, FastAPI, NumPy | Intelligence, recommendations, semantic analysis |
| **Database** | PostgreSQL, Supabase | Data storage, RLS, realtime |
| **Infrastructure** | Cloudflare Pages, Render | CDN, hosting, edge functions |

## Directory Structure

```
4ang/
├── apps/
│   ├── web/                    # React frontend (client/)
│   └── admin/                  # Admin dashboard
│
├── services/
│   ├── api/                    # Express backend (server/)
│   └── intelligence/           # Python AI/ML service
│
├── native/
│   └── audio-engine/           # C++ audio processing
│
├── packages/
│   ├── shared-types/           # TypeScript type definitions
│   ├── api-client/             # API client library
│   ├── config/                 # Shared configuration
│   ├── validation/             # Input validation schemas
│   └── design-system/          # CSS tokens + components
│
├── database/
│   ├── migrations/             # Supabase migrations
│   └── functions/              # Database functions
│
├── scripts/                    # Developer tooling
├── tests/                      # Test suites
├── docs/                       # Documentation
└── infrastructure/             # Deployment configs
```

## Language Responsibilities

### TypeScript (Primary)
- React frontend application
- UI components and pages
- Client-side routing and state
- API client and data fetching
- Authentication integration
- Music player controller
- Queue management
- Application-level business logic
- Request validation
- WebSocket orchestration

### C++ (Native Performance)
- Audio DSP (signal processing)
- Waveform analysis and generation
- Loudness analysis (LUFS)
- Beat/onset detection
- Audio feature extraction
- High-performance signal operations

### Python (AI/ML Intelligence)
- Semantic music analysis
- Recommendation enhancement
- Feature processing
- Model inference
- Ranking experiments
- Evaluation pipelines

### SQL (Data)
- Schema definitions
- RLS policies
- Database functions
- Query optimization

## Core Architecture Principles

### 1. Single Source of Truth
Each domain has ONE canonical implementation:
- ONE music player (Player 3.0)
- ONE recommendation engine
- ONE authentication system
- ONE social system

### 2. Clean Boundaries
- Frontend never accesses database directly
- AI services never execute arbitrary SQL
- Native code exposed through clean TypeScript bindings
- Shared types ensure contract consistency

### 3. Graceful Degradation
- AI features optional (keyword fallbacks)
- Native features optional (pure JS fallbacks)
- Network failures handled gracefully
- Offline support where possible

### 4. Security First
- RLS enforced at database level
- API keys server-side only
- Input validation at boundaries
- Rate limiting on all endpoints
- No secrets in frontend code

## Data Flow

### Music Playback
```
User → Player UI → Playback Controller → Audio Element → Speaker
                        ↓
                   Queue Manager
                        ↓
                   Recommendation Engine
```

### AI Recommendation
```
User Behavior → Taste Profile → Candidate Generation → Scoring → Diversity → Results
                                          ↓
                                    AI Enhancement
                                          ↓
                                    Natural Language Explanation
```

### Social Activity
```
User Action → Activity Event → Social Feed → Notifications
                ↓
           Recommendation Signal
```

## API Structure

```
/api/v1/auth          — Authentication
/api/v1/tracks        — Track management
/api/v1/artists       — Artist profiles
/api/v1/playlists     — Playlist operations
/api/v1/search        — Search functionality
/api/v1/discover      — Discovery and recommendations
/api/v1/social        — Social features
/api/v1/rooms         — Listening rooms
/api/v1/notifications — Notifications
/api/v1/studio        — Artist studio
/api/v1/assistant     — AI assistant
/api/v1/intelligence  — AI/ML services
```

## Database Schema

### Core Tables
- `tracks` — Music tracks
- `artist_profiles` — Artist information
- `profiles` — User profiles
- `playlists` — User playlists
- `track_likes` — Liked songs
- `track_saves` — Saved tracks
- `artist_follows` — Artist follows
- `user_follows` — User follows
- `activity_events` — Social activity
- `play_history` — Listening history

### AI/Intelligence Tables
- `ai_requests` — AI request logging
- `ai_analysis_cache` — Cached analysis results
- `ai_feedback` — User feedback on AI
- `assistant_conversations` — Chat history
- `assistant_messages` — Chat messages

## Security Model

### Authentication
- Supabase Auth (magic link, Google, Apple)
- JWT tokens for API access
- Server-side token verification

### Authorization
- Row Level Security (RLS) on all tables
- User-only access to private data
- Artist-only access to studio features
- Admin-only access to admin endpoints

### Data Protection
- Private playlists not exposed
- Private listening history protected
- AI services cannot bypass RLS
- No service-role keys in frontend

## Performance

### Frontend
- Lazy-loaded routes
- Code splitting
- Image optimization
- CSS containment
- Virtual scrolling for large lists

### Backend
- Database indexes on hot paths
- Connection pooling
- Response caching
- Rate limiting
- Query optimization

### Native
- SIMD where available
- Efficient memory allocation
- Thread pool for parallel processing

## Development

### Prerequisites
- Node.js >= 22.5.0
- pnpm
- CMake (for native build)
- Python 3.11+ (for intelligence service)

### Quick Start
```bash
# Setup
pnpm install
pnpm dev

# Build
pnpm build

# Test
pnpm test
```

### Native Build
```bash
cd native/audio-engine
cmake -B build
cmake --build build
ctest
```

### Python Service
```bash
cd services/intelligence
pip install -e ".[dev]"
pytest
uvicorn app.main:app --port 8001
```

## Deployment

### Frontend (Cloudflare Pages)
- Auto-deploys from `main` branch
- Global CDN
- Edge caching

### Backend (Render)
- Auto-deploys from `main` branch
- Node.js runtime
- Environment variables for secrets

### Database (Supabase)
- Managed PostgreSQL
- Real-time subscriptions
- Row Level Security

## Future Phases

### Phase 4.1
- TypeScript strict mode migration
- Unit test coverage
- Integration test suite
- E2E test framework

### Phase 4.2
- WebSocket realtime
- Event-driven architecture
- Performance monitoring
- Load testing

### Phase 4.3
- Advanced ML models
- Embedding-based recommendations
- A/B testing framework
- Analytics dashboard
