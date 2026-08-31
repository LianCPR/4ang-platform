# 4ANG Supabase Integration — Private Beta Setup Guide

## Prerequisites

1. A Supabase project (free tier works for beta)
2. Node.js 18+ installed
3. npm or pnpm

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to your users
3. Set a strong database password (save it!)
4. Note your:
   - Project URL (e.g., `https://xyz.supabase.co`)
   - Anon Key (public, safe for frontend)
   - Service Role Key (SECRET — never commit to git)

## Step 2: Run Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `server/supabase/migration.sql`
3. Paste and run the entire SQL
4. Verify all tables created in Table Editor

## Step 3: Configure Environment Variables

### Server (.env)

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
CORS_ORIGINS=http://localhost:5173
```

### Client (.env.local)

```bash
cd client
cp .env.example .env.local
```

Edit `client/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 4: Configure Auth Providers

### Email/Password (enabled by default)

No additional config needed. Users can sign up with email + password.

### Google OAuth

1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Enter your Google OAuth Client ID and Secret
4. Add `http://localhost:5173` to authorized redirect URIs in Google Console

### Apple Sign In

1. Go to Supabase Dashboard → Authentication → Providers → Apple
2. Enable Apple provider
3. Enter your Apple Service ID, Team ID, and Key

### Phone/SMS OTP

1. Go to Supabase Dashboard → Authentication → Providers → Phone
2. Enable Phone provider
3. Configure Twilio or your preferred SMS provider

## Step 5: Configure Auth Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/**`

For production, add your production domain.

## Step 6: Create Admin User

After first signup, promote a user to admin:

1. Sign up normally through the app
2. Go to Supabase Dashboard → Table Editor → profiles
3. Find the user and change their `role` from `user` to `admin`

Or use SQL:

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your-username';
```

## Step 7: Start Development

```bash
# Terminal 1: Server
cd server
npm install
npm run dev

# Terminal 2: Client
cd client
npm install
npm run dev
```

Open http://localhost:5173

## Step 8: Verify Everything Works

### Auth Flow
- [ ] Sign up with email/password
- [ ] Login
- [ ] Logout
- [ ] Session persists on refresh
- [ ] Profile loads correctly

### Music Flow
- [ ] Browse tracks on Home/Discover
- [ ] Play a song
- [ ] Like/unlike a track
- [ ] Search for tracks/artists
- [ ] Recently played updates

### Artist Flow
- [ ] Apply to become artist
- [ ] Upload a track (if approved)
- [ ] View artist profile

### Playlist Flow
- [ ] Create playlist
- [ ] Add track to playlist
- [ ] Remove track from playlist
- [ ] Play playlist

## Storage Buckets

The migration creates these buckets:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | Yes | User profile pictures |
| `artwork` | Yes | Track/album artwork |
| `music` | No | Audio files |
| `videos` | No | Music videos |
| `artist-images` | Yes | Artist avatars and covers |
| `playlist-covers` | Yes | Playlist cover images |
| `submission-covers` | No | Draft submission covers |

## Security Notes

- **Never** commit `.env` files to git
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- RLS policies ensure users can only modify their own data
- Artists can only manage their own tracks and submissions
- Admin actions require server-side verification
- Storage policies restrict uploads to authenticated users

## Production Deployment

### Vercel (Frontend)

Add environment variables:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-api-domain.com
```

### Backend Deployment

Add environment variables:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-production-jwt-secret
PORT=3001
CORS_ORIGINS=https://your-frontend-domain.com
```

## Troubleshooting

### "Supabase not configured" warning
→ Check that `.env` files exist and contain correct values

### Auth not working
→ Check redirect URLs in Supabase Dashboard → Auth → URL Configuration

### RLS errors
→ Check RLS policies in Supabase Dashboard → Authentication → Policies

### Upload failing
→ Check storage bucket policies and file size limits

### Data not persisting
→ Verify you're logged in and the session is active
→ Check browser console for errors
