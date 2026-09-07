# 4ang Deployment Architecture

## Overview

```
Developer → Git → GitHub → CI → Deploy → Production
```

## Deployment Stack

| Component | Platform | Domain | Trigger |
|-----------|----------|--------|---------|
| Web Frontend | Cloudflare Pages | 4ang.xyz | Push to main |
| API Backend | Render | fourang-api.onrender.com | Push to main |
| Python Intelligence | Self-hosted | [configured URL] | Manual |
| C++ Audio Engine | Native binary / WASM | N/A (build-time) | Build |
| Database | Supabase | managed | Manual migration |
| Storage | Supabase Storage | managed | N/A |
| Authentication | Supabase Auth | managed | N/A |

## Data Flow

```
Browser
   ↓ HTTPS
Cloudflare (CDN + SPA)
   ↓ HTTPS
Render (Node.js API)
   ↓ Internal
Supabase (PostgreSQL + Auth + Storage + Realtime)
   ↓ Internal
Python Intelligence (optional)
```

## Web Deployment

### Build
```bash
cd client
pnpm install
VITE_SUPABASE_URL=$SUPABASE_URL \
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
pnpm build
```

### Deploy
Cloudflare Pages auto-deploys on push to main.

### SPA Routing
Cloudflare Pages handles SPA routing via `_redirects` or Pages configuration.
All non-API routes return `index.html`.

### Caching Strategy
- HTML: `Cache-Control: public, max-age=0, must-revalidate`
- Assets (hashed): `Cache-Control: public, max-age=31536000, immutable`
- API: No cache (`Cache-Control: no-store`)

## API Deployment

### Build
```bash
cd server
npm ci
node --check src/index.js
```

### Start
```bash
node src/index.js
```

### Health Check
```
GET /api/health
→ { "ok": true, "service": "song-backend", "time": "..." }
```

### Auto-Deploy
Render auto-deploys on push to main when `render.yaml` is configured.

## Python Deployment

### Build
```bash
cd services/intelligence
pip install -e ".[dev]"
```

### Start
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Health Check
```
GET /health
→ { "status": "healthy", "service": "intelligence" }
```

### Security
Python service should NOT be publicly exposed unless required.
Internal service-to-service communication preferred.

## C++ Deployment

C++ audio engine is a build-time component:
- Library: linked into API or worker processes
- CLI: standalone binary for audio analysis
- WASM: future browser integration (Phase 4.3)

C++ does NOT have a deployment lifecycle like web/API.

## Database Deployment

### Migration Workflow
1. Write migration SQL in `database/migrations/`
2. Version migration file (e.g., `022_feature_name.sql`)
3. Review migration for:
   - RLS policies
   - Indexes
   - Foreign keys
   - Backwards compatibility
4. Apply in Supabase SQL Editor (development)
5. Test against staging if available
6. Apply in production Supabase SQL Editor

### Safety Rules
- Never drop columns still in use
- Never disable RLS without restoring it
- Always add columns as nullable first
- Backfill data before adding NOT NULL constraints
- Test migrations on a copy of production data

## Rollback

### Web
Rollback to previous Cloudflare Pages deployment.

### API
Rollback to previous Render deployment.

### Database
Forward-fix preferred. Restore from Supabase backup for emergencies.

## Monitoring

### Health Checks
| Service | Endpoint | Interval |
|---------|----------|----------|
| API | /api/health | Render native |
| Cloudflare | Automatic | Continuous |

### Key Metrics
- API response time
- API error rate (5xx)
- Web build success
- Database connection health

## Security

### Production Requirements
- HTTPS on all endpoints
- CORS restricted to known origins
- Rate limiting on sensitive endpoints
- No secrets in client bundle
- Service-role keys server-side only
- Input validation at API boundaries
