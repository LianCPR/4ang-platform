# 4ang Threat Model

## Overview

This document identifies realistic security threats and mitigations for the 4ang music platform.

## System Boundaries

```
Internet
   ↓ HTTPS
Cloudflare (CDN)
   ↓ HTTPS
Render (Node.js API)
   ↓ HTTPS
Supabase (Auth + DB + Storage + Realtime)
   ↓ Internal
Python Intelligence (optional)
```

## Threat Categories

### P0 — Critical

| Threat | Surface | Mitigation |
|--------|---------|------------|
| **Service-role key exposure** | Environment variables | Server-only, never in frontend bundle |
| **Authentication bypass** | API endpoints | JWT validation via Supabase Auth middleware |
| **SQL injection** | Database queries | Supabase query builder (parameterized) |
| **Authorization bypass** | API endpoints | `requireAuth`, `requireAdmin`, `requireArtist` middleware |

### P1 — High

| Threat | Surface | Mitigation |
|--------|---------|------------|
| **IDOR (Insecure Direct Object Reference)** | User resources | Server-side ownership checks before mutations |
| **Privilege escalation** | Admin/artist routes | Server-side role verification, client role never trusted |
| **Malicious file uploads** | Studio uploads | File size limits, MIME validation, server-side verification |
| **Token leakage** | Client storage | Supabase managed tokens, `VITE_` prefix for public vars only |
| **JWT secret compromise** | Server config | Strong random secret, rotation procedure documented |

### P2 — Important

| Threat | Surface | Mitigation |
|--------|---------|------------|
| **XSS via user content** | Bio, posts, comments | React auto-escaping, text sanitization middleware |
| **CSRF** | State-changing requests | Bearer token auth (not cookie-based for API) |
| **Rate limit abuse** | Auth, AI, uploads | Per-endpoint rate limiting with key prefix |
| **Oversized payloads** | API endpoints | 1MB JSON limit, event batch max 50 |
| **Information leakage** | Error responses | Structured errors, no stack traces in production |
| **Dependency vulnerabilities** | npm/pnpm packages | CI dependency audit, pnpm audit |

### P3 — Future

| Threat | Surface | Mitigation |
|--------|---------|------------|
| **Prompt injection** | AI assistant | Input sanitization, tool authorization, no arbitrary SQL |
| **SSRF** | External URL fetching | URL validation, protocol restriction |
| **Supply chain attack** | GitHub Actions | Pinned action versions, least-privilege permissions |
| **Memory safety** | C++ audio engine | Modern C++, bounds checking, fuzzer testing |

## Asset Classification

### Critical Assets
- User authentication tokens
- Supabase service-role key
- JWT secret
- User PII (email, phone)
- Music files (copyright)

### Sensitive Assets
- User profiles
- Playlists
- Library data
- Recommendation data
- AI conversations

### Public Assets
- Published tracks metadata
- Artist profiles (public)
- Trending/discovery data
- Banners

## Security Controls

### Authentication
- Supabase Auth (canonical Identity Provider)
- JWT token verification
- Session validation
- Expired session rejection

### Authorization
- `requireAuth` — all protected endpoints
- `requireAdmin` — admin-only operations
- `requireArtist` — artist-only operations
- Server-side ownership checks for mutations

### Data Protection
- RLS on all user tables
- Storage bucket policies
- Service-role key server-side only
- Input sanitization

### Network Security
- HTTPS everywhere (Cloudflare + Render + Supabase)
- CORS restricted to known origins
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Request timeout (30s)

### Monitoring
- Structured request logging
- Request ID correlation
- Error tracking
- Health checks
