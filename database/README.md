# 4ang Database

## Overview

4ang uses Supabase (managed PostgreSQL) as the primary database with Row Level Security (RLS) for data protection.

## Migration History

| Migration | Description |
|-----------|-------------|
| 001 | Initial schema — tracks, profiles, playlists |
| 002-005 | Feature additions — likes, saves, follows |
| 006-010 | Social features — activity, comments, rooms |
| 011-015 | Artist system — profiles, releases, studio |
| 016 | Social features — user follows, feed |
| 017 | AI service — requests, cache, feedback |
| 018 | Assistant — conversations, messages |

## Running Migrations

Migrations should be run through the Supabase Dashboard SQL Editor.

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Paste migration SQL
5. Click Run

## Schema Conventions

- Primary keys: UUID
- Timestamps: `created_at`, `updated_at` (TIMESTAMPTZ)
- User references: `username` (TEXT)
- Status fields: TEXT with CHECK constraints
- Soft deletes: `is_deleted` or `status = 'archived'`

## RLS Policy Patterns

### User-scoped data
```sql
CREATE POLICY "Users see own data"
  ON table FOR SELECT
  USING (username = auth.uid()::text);
```

### Public read, owner write
```sql
CREATE POLICY "Public read"
  ON table FOR SELECT USING (is_public = true);

CREATE POLICY "Owner write"
  ON table FOR ALL USING (owner_username = auth.uid()::text);
```

### Service role bypass
```sql
CREATE POLICY "Service role manages"
  ON table FOR ALL USING (true);
```

## Performance Indexes

Key indexes for hot paths:
- `tracks(status)` — approved track queries
- `track_likes(username, track_id)` — like lookups
- `play_history(username, played_at)` — history queries
- `activity_events(username, created_at)` — feed queries
- `artist_follows(username)` — follow lookups
