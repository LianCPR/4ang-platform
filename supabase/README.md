# 4ANG Supabase Setup

## Quick Start

### 1. Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `4ang-music-platform`
4. Database password: (save this securely)
5. Region: Choose closest to your users

### 2. Get API Keys
1. Go to Project Settings → API
2. Copy:
   - `Project URL` → `VITE_SUPABASE_URL` (client) and `SUPABASE_URL` (server)
   - `anon public` key → `VITE_SUPABASE_ANON_KEY` (client) and `SUPABASE_ANON_KEY` (server)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server ONLY)

### 3. Run Migrations
In Supabase Dashboard → SQL Editor, run each migration in order:

```sql
-- Run each file in order:
-- 1. supabase/migrations/001_profiles.sql
-- 2. supabase/migrations/002_artists.sql
-- 3. supabase/migrations/003_music.sql
-- 4. supabase/migrations/004_playlists.sql
-- 5. supabase/migrations/005_submissions.sql
-- 6. supabase/migrations/006_social.sql
-- 7. supabase/migrations/009_rls.sql
-- 8. supabase/migrations/010_admin_seed.sql
```

### 4. Configure Auth Providers
In Supabase Dashboard → Authentication → Providers:

#### Email (already enabled)
- Enable signup: ✅
- Confirm email: ❌ (for development)

#### Google (optional)
1. Go to https://console.cloud.google.com
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

#### Apple (optional)
1. Go to https://developer.apple.com
2. Create App ID with Sign In with Apple
3. Configure in Supabase Dashboard

#### Phone (optional)
1. Configure Twilio or MessageBird in Supabase Dashboard
2. Enable Phone provider

### 5. Configure Storage Buckets
Storage buckets are created by the config.toml. If not auto-created:
1. Go to Storage in Supabase Dashboard
2. Create buckets manually:
   - `avatars` (public)
   - `artist-images` (public)
   - `track-covers` (public)
   - `track-audio` (private)
   - `track-videos` (private)
   - `submission-files` (private)
   - `playlist-covers` (public)

### 6. Set Environment Variables

#### Client (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Server (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 7. Set Admin User
After the user `haidang280611@gmail.com` signs up:
```sql
SELECT public.promote_to_admin('haidang280611@gmail.com');
```

## Architecture

### Auth Flow
```
User → Supabase Auth → JWT Token → Frontend → API (verify JWT)
```

### Database Access
```
Frontend → Supabase Client (with user JWT) → RLS policies → Tables
Server → Supabase Admin Client (service role) → Bypasses RLS
```

### File Storage
```
Frontend → Supabase Storage (signed URLs) → Private buckets
Server → Supabase Admin Client → Generate signed URLs
```

## Security Notes

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- **Always** use RLS policies for table access
- **Always** verify JWT tokens on the server
- **Never** trust client-side role checks for admin operations
- Use Edge Functions for sensitive operations (admin, publishing)
