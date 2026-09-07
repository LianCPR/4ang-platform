# 4ang RLS (Row Level Security) Audit

## Overview

RLS is enforced at the Supabase PostgreSQL database level.
Service-role access bypasses RLS — this is by design for server operations.

## Table Audit

### Identity Tables

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `profiles` | Public read | Owner only | Owner only | Owner only | RLS on user_id |

### Music Tables

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `tracks` | Public (approved) | Artist only | Owner only | Owner only | Status-based access |
| `artists` | Public | Authenticated | Owner only | Owner only | |
| `albums` | Public | Artist only | Owner only | Owner only | |
| `track_likes` | Owner only | Owner only | N/A | Owner only | |
| `lyrics` | Public | Owner only | Owner only | Owner only | |

### Library Tables

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `playlists` | Owner + public | Owner only | Owner only | Owner only | |
| `playlist_tracks` | Owner only | Owner only | Owner | Owner only | |
| `listening_history` | Owner only | Owner only | N/A | Owner only | |

### Social Tables

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `follows` | Public | Owner only | N/A | Owner only | |
| `user_events` | Owner only | Owner only | N/A | Owner only | |
| `notifications` | Owner only | System | Owner only | Owner only | |

### Artist Verification

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `artist_applications` | Owner + admin | Owner | Admin | N/A | |
| `artist_verification` | Owner + admin | Owner | Admin | N/A | |

### AI / Intelligence

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `assistant_conversations` | Owner only | Owner only | Owner only | Owner only | |
| `assistant_messages` | Owner only | Owner only | N/A | Owner only | |
| `audio_analysis` | Public read | Service | Service | N/A | Analysis results |
| `ai_jobs` | Service only | Service | Service | Service | Internal only |

### Recommendation

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `recommendation_history` | Owner only | Service | Service | N/A | Internal tracking |

## Service-Role Usage

Service-role (bypasses RLS) is used for:
1. Admin operations (user management, content moderation)
2. Cross-user operations (notifications, recommendation generation)
3. Event ingestion (recording user events)
4. Audio analysis results storage
5. AI job management

**All service-role usage is server-side only.**

## RLS Integrity

✅ RLS enabled on all user-facing tables
✅ Service-role access limited to server-side code
✅ No client-side service-role usage detected
✅ Owner-based access for private resources
✅ Public read for published content

## Recommendations

1. **P1**: Verify RLS policies match current table schema
2. **P2**: Add RLS tests to CI pipeline
3. **P2**: Document any tables that rely on service-role access
4. **P3**: Consider adding RLS policy tests for critical tables
