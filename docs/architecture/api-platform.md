# 4ang API Platform Architecture

## Overview

The 4ang API platform is a TypeScript/Express backend serving the music streaming application. It follows a layered architecture with clear separation of concerns.

## Architecture

```
HTTP Request
    ↓
Request ID Middleware
    ↓
CORS / Body Parsing
    ↓
Route Handler
    ↓
Validation Middleware
    ↓
Controller (thin)
    ↓
Service (business logic)
    ↓
Repository (data access)
    ↓
Supabase / Database
    ↓
Typed Response
    ↓
API Client
    ↓
Web Application
```

## Directory Structure

```
server/src/
├── app.ts              # Express application setup
├── server.ts           # Server entry point
├── config/
│   └── env.ts          # Environment configuration
├── errors/
│   ├── AppError.ts     # Typed application errors
│   └── error-response.ts  # Error response formatter
├── middleware/
│   ├── request-id.ts   # Request ID generation
│   ├── error-handler.ts # Global error handler
│   └── validate.ts     # Input validation
├── utils/
│   ├── async-handler.ts # Async route wrapper
│   ├── response.ts     # Success response helpers
│   └── pagination.ts   # Pagination utilities
├── routes/
│   ├── v1/
│   │   └── index.ts    # v1 route registry
│   ├── auth.js         # Auth routes (legacy)
│   ├── tracks.js       # Track routes (legacy)
│   ├── artists.js      # Artist routes (legacy)
│   └── ...             # Other legacy routes
├── ai.js               # AI service layer
├── assistant.js        # Assistant service
├── recommendation.js   # Recommendation engine
├── auth.js             # Authentication
├── db.js               # Database utilities
├── supabase.js         # Supabase client
└── rateLimit.js        # Rate limiting
```

## API Versioning

### v1 API (New)

```
/api/v1/health          GET     Health check
/api/v1/health/live     GET     Liveness probe
/api/v1/health/ready    GET     Readiness probe
/api/v1/auth/*          POST    Authentication
/api/v1/tracks/*        GET     Track operations
/api/v1/artists/*       GET     Artist operations
/api/v1/playlists/*     CRUD    Playlist operations
/api/v1/library/*       GET     Library operations
/api/v1/discover/*      GET     Discovery
/api/v1/search          GET     Search
/api/v1/recommendations GET     Recommendations
/api/v1/social/*        Social  Social features
/api/v1/rooms/*         CRUD    Listening rooms
/api/v1/notifications/* GET     Notifications
/api/v1/assistant/*     POST    AI assistant
/api/v1/admin/*         Admin   Admin operations
```

### Legacy API (Backward Compatible)

```
/api/health             GET     Health check
/api/auth/*             POST    Authentication
/api/tracks/*           GET     Track operations
/api/artists/*          GET     Artist operations
/api/playlists/*        CRUD    Playlist operations
...etc
```

Both API versions are mounted simultaneously. The legacy API ensures existing frontend calls continue working.

## Middleware Stack

1. **Request ID** — Generates or preserves `X-Request-ID`
2. **CORS** — Handles cross-origin requests
3. **Body Parsing** — JSON parsing with 1MB limit
4. **Validation** — Input validation at route level
5. **Error Handler** — Catches and formats errors

## Error System

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service failure |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "requestId": "uuid"
  }
}
```

## Success Response Format

### Single Resource

```json
{
  "success": true,
  "data": { ... }
}
```

### Paginated List

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNextPage": true
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment |
| `PORT` | No | `3001` | Server port |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role key |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `INTELLIGENCE_URL` | No | `http://localhost:8001` | Python service URL |

## Security

- Service role key never exposed to frontend
- RLS enforced at database level
- Input validation at API boundaries
- Rate limiting on sensitive endpoints
- Request IDs for tracing
- Error messages don't leak internals

## Development

```bash
# Start server
cd server && pnpm dev

# Type check
cd server && pnpm typecheck

# The server runs on http://localhost:3001
# API v1: http://localhost:3001/api/v1
# Legacy: http://localhost:3001/api
```
