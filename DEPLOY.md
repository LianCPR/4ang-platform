# 4ANG — Private Beta Deployment Guide

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Vercel                              │
│  ┌────────────────┐   ┌─────────────────────────┐    │
│  │  Static Client  │   │  Serverless API          │    │
│  │  (Vite build)   │   │  (Express → Node)        │    │
│  │                 │   │                          │    │
│  │  React SPA      │──▶│  /api/* routes            │    │
│  │  code-split     │   │  Auth (dual-mode)         │    │
│  │  17 chunks      │   │  Music, Upload, Search    │    │
│  └────────────────┘   └──────────┬───────────────┘    │
│                                   │                    │
│                    ┌──────────────▼───────────────┐    │
│                    │         Supabase              │    │
│                    │  • Auth (JWT)                 │    │
│                    │  • PostgreSQL (data)           │    │
│                    │  • Storage (audio/artwork)     │    │
│                    │  • RLS (security)              │    │
│                    └──────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## Prerequisites

- [ ] Supabase account (free tier works) — [supabase.com](https://supabase.com)
- [ ] Vercel account (free tier works) — [vercel.com](https://vercel.com)
- [ ] Node.js 22+ installed locally
- [ ] Git repository pushed to GitHub

---

## Step 1: Supabase Setup

1. [ ] Create a new Supabase project
2. [ ] Go to **SQL Editor**
3. [ ] Paste contents of `server/supabase-migration.sql`
4. [ ] Click **Run** — creates all tables, indexes, RLS policies
5. [ ] Go to **Settings → API** — note these values:
   - Project URL (`https://xxxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key
6. [ ] Go to **Authentication → Settings**:
   - Enable **Email** provider
   - Optionally enable **Phone** (requires Twilio)
   - Optionally enable **Google** OAuth (requires Google Cloud Console)
   - Optionally enable **Apple** OAuth (requires Apple Developer)

---

## Step 2: Environment Variables

### Server (local: `server/.env`, Vercel: set in dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001, Vercel ignores this) |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `JWT_SECRET` | **Yes** | Random secret — generate with `openssl rand -hex 32` |
| `SUPABASE_URL` | **Yes** | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | **Yes** | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Your Supabase service role key (NEVER expose to client) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `APPLE_CLIENT_ID` | No | Apple OAuth service ID |
| `APP_URL` | Yes | Your deployed app URL (e.g. `https://4ang.vercel.app`) |

### Client (Vercel: set in dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend URL — leave empty if API is co-located on same domain |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID (same as server) |
| `VITE_APPLE_CLIENT_ID` | No | Apple OAuth service ID |
| `VITE_SUPABASE_URL` | No | Supabase URL for direct client operations |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon key for direct client operations |

---

## Step 3: Deploy to Vercel

### Option A: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel          # First deploy (preview)
vercel --prod   # Production deploy
```

### Option B: GitHub Integration
1. [ ] Push code to GitHub
2. [ ] Go to vercel.com → Import Project
3. [ ] Select repository
4. [ ] Set **Root Directory** to `.` (root)
5. [ ] Set **Framework Preset** to `Other`
6. [ ] Add environment variables in Project Settings
7. [ ] Deploy

### Vercel Project Settings
- **Root Directory**: `.` (project root)
- **Build Command**: `cd client && npm install && npm run build`
- **Output Directory**: `client/dist`
- **Install Command**: `cd client && npm install`

---

## Step 4: Post-Deployment Verification

### Authentication
- [ ] Open deployed URL
- [ ] See auth page (beautiful botanical design)
- [ ] Enter email → receive OTP (check server console in dev)
- [ ] Enter OTP → logged in with success animation
- [ ] Profile page loads correctly
- [ ] Can edit profile (display name, bio)
- [ ] Logout → back to auth page

### Music
- [ ] Home page loads with featured track
- [ ] Discover page shows all sections (greeting, mood, genres, trending)
- [ ] Play a track → mini player appears
- [ ] Full player opens with lyrics
- [ ] Previous/Next/Seek/Volume all work
- [ ] Shuffle and Repeat toggle correctly

### Search
- [ ] Search input works
- [ ] Vietnamese diacritics normalized ("me" → "Mẹ")
- [ ] Results show songs, artists, playlists
- [ ] Click result → plays track

### Library
- [ ] Liked Songs tab shows liked tracks
- [ ] Recently Played shows history
- [ ] Can like/unlike tracks
- [ ] Can save/unsave tracks

### Artist
- [ ] Artist Profile page loads with tracks
- [ ] Follow/unfollow artist works
- [ ] Artist Dashboard accessible for artists
- [ ] Music submission flow works

### Admin
- [ ] First user is auto-admin
- [ ] Admin Dashboard accessible at `/admin`
- [ ] Can review submissions
- [ ] Can approve/reject

---

## Security Checklist

- [ ] `JWT_SECRET` is a strong random value (not default)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NEVER in client code
- [ ] `.env` files are in `.gitignore`
- [ ] RLS enabled on all Supabase tables
- [ ] File uploads validated (type + size)
- [ ] CORS configured for production domain only
- [ ] Admin authorization enforced server-side
- [ ] No secrets committed to git

---

## Build Stats

| Metric | Value |
|--------|-------|
| Main bundle | 349 KB (105 KB gzip) |
| Admin bundle | 416 KB (117 KB gzip) |
| Code-split chunks | 17 (loaded on demand) |
| Icon library | 130 KB (42 KB gzip) |
| Total pages | 16 |
| Build time | ~850ms |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 on all requests | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| OTP not received | Check server console logs for OTP codes (dev mode) |
| CORS error | Add your Vercel domain to `CORS_ORIGINS` |
| Upload fails | Check Supabase Storage buckets exist |
| Auth page blank | Check `VITE_API_URL` is correct or empty for same-domain |
| Build fails | Run `npm install` in both `client/` and `server/` |
| "Cannot find module" | Ensure Node.js 22+ is used |
| Google login fails | Check `GOOGLE_CLIENT_ID` matches Google Cloud Console |
| Dark mode broken | Clear localStorage and reload |

---

## File Structure

```
4ang/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── pages/            # 16 page components (lazy-loaded)
│   │   ├── components/       # Shared UI components
│   │   ├── styles/           # CSS (tokens, layout, components)
│   │   ├── api.js            # API wrapper
│   │   └── lib/              # Utilities
│   └── dist/                 # Production build output
├── server/                    # Express API backend
│   ├── src/
│   │   ├── routes/           # API routes
│   │   ├── db.js             # SQLite + Supabase dual-mode
│   │   ├── auth.js           # JWT auth middleware
│   │   ├── supabase.js       # Supabase client
│   │   └── index.js          # Express server entry
│   ├── supabase-migration.sql # Database schema
│   └── .env                  # Server environment
├── vercel.json               # Vercel deployment config
├── package.json              # Root build script
└── DEPLOY.md                 # This file
```
