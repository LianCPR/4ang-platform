# 4ANG — Deployment Guide

## Architecture Options

### Option A: Vercel (Frontend) + Render (Backend) ⭐ Recommended

```
┌─────────────────────┐          ┌──────────────────────┐
│     Vercel           │          │     Render            │
│  ┌───────────────┐  │  /api/*  │  ┌────────────────┐  │
│  │  React + Vite  │──┼─────────▶│  Express + Node  │  │
│  │  Static SPA    │  │  proxy   │  SQLite on disk   │  │
│  └───────────────┘  │          │  File uploads     │  │
└─────────────────────┘          └──────────────────────┘
```

### Option B: All-in-One on Render

```
┌──────────────────────────────────┐
│          Render                   │
│  ┌───────────────┐               │
│  │  Express      │               │
│  │  + serves     │               │
│  │  client build │               │
│  │  SQLite       │               │
│  └───────────────┘               │
└──────────────────────────────────┘
```

---

## Option A: Vercel + Render (Recommended)

### Prerequisites
- [ ] GitHub account with repo pushed
- [ ] [Vercel account](https://vercel.com) (free tier)
- [ ] [Render account](https://render.com) (free tier)
- [ ] Node.js 22+ locally

---

### Step 1: Deploy Backend to Render

1. **Go to [render.com](https://render.com) → New → Web Service**
2. **Connect your GitHub repo**
3. **Configure:**
   - **Name:** `4ang-backend`
   - **Region:** Singapore (or nearest)
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `node src/index.js`
4. **Add Environment Variables:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(click Generate)* |
| `DB_PATH` | `/var/data/4ang.sqlite` |
| `UPLOAD_DIR` | `/var/data/uploads` |
| `CORS_ORIGINS` | `https://YOUR-PROJECT.vercel.app` |
| `APP_URL` | `https://YOUR-PROJECT.vercel.app` |

5. **Add Persistent Disk:**
   - **Name:** `4ang-data`
   - **Mount Path:** `/var/data`
   - **Size:** 1 GB

6. **Click Create Web Service** → Wait for deploy

7. **Verify:** Visit `https://YOUR-PROJECT.onrender.com/api/health`
   - Should return: `{"ok":true,"service":"song-backend"}`

---

### Step 2: Deploy Frontend to Vercel

1. **Go to [vercel.com](https://vercel.com) → New Project**
2. **Import your GitHub repo**
3. **Configure:**
   - **Framework Preset:** Vite
   - **Root Directory:** `./client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Add Environment Variables:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://YOUR-PROJECT.onrender.com` |

5. **Click Deploy** → Wait for build

6. **Update Render CORS:**
   - Go to Render → Environment → Edit
   - Set `CORS_ORIGINS` to `https://YOUR-PROJECT.vercel.app`
   - Redeploy

---

### Step 3: Verify

- [ ] Open `https://YOUR-PROJECT.vercel.app`
- [ ] Auth page loads
- [ ] Can register / login
- [ ] Home page loads with tracks
- [ ] Can play music
- [ ] Search works
- [ ] Can upload as artist
- [ ] Admin dashboard works

---

## Option B: All-in-One on Render

If you want simpler deployment (one service):

1. **Go to Render → New → Web Service**
2. **Configure:**
   - **Root Directory:** `.` (project root)
   - **Build Command:** `npm install && cd client && npm install && npm run build`
   - **Start Command:** `NODE_ENV=production node server/src/index.js`
3. **Add Environment Variables:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(click Generate)* |
| `DB_PATH` | `/var/data/4ang.sqlite` |
| `UPLOAD_DIR` | `/var/data/uploads` |
| `CORS_ORIGINS` | `https://YOUR-PROJECT.onrender.com` |
| `SERVE_CLIENT` | `true` |

4. **Add Persistent Disk:** `/var/data` (1 GB)

5. **Deploy** → Visit `https://YOUR-PROJECT.onrender.com`

---

## Environment Variables Reference

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port (Render sets automatically) |
| `NODE_ENV` | No | `development` | Set to `production` for prod |
| `JWT_SECRET` | **Yes** | *(default — unsafe)* | Random secret. Generate: `openssl rand -hex 32` |
| `CORS_ORIGINS` | Yes | `*` | Comma-separated allowed origins |
| `DB_PATH` | No | `./data/app.sqlite` | SQLite database path |
| `UPLOAD_DIR` | No | `./uploads` | Local file uploads directory |
| `APP_URL` | No | `http://localhost:5173` | Frontend URL for auth redirects |
| `SERVE_CLIENT` | No | `false` | Set `true` to serve client build from Express |
| `SUPABASE_URL` | No | — | Supabase project URL (for future migration) |
| `SUPABASE_ANON_KEY` | No | — | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Supabase service role key (NEVER expose to client) |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `APPLE_CLIENT_ID` | No | — | Apple OAuth service ID |

### Client

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `""` (same origin) | Backend URL. Leave empty if served from same domain |
| `VITE_SUPABASE_URL` | No | — | Supabase URL for direct client ops |
| `VITE_SUPABASE_ANON_KEY` | No | — | Supabase anon key |
| `VITE_GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `VITE_APPLE_CLIENT_ID` | No | — | Apple OAuth service ID |

---

## Custom Domain Setup

### Vercel
1. Go to Project → Settings → Domains
2. Add your domain (e.g., `4ang.app`)
3. Update DNS as instructed
4. SSL is automatic

### Render
1. Go to Service → Settings → Custom Domains
2. Add domain
3. Update DNS CNAME to `YOUR-PROJECT.onrender.com`
4. SSL is automatic

**After adding custom domain:**
- Update `CORS_ORIGINS` in Render to include new domain
- Update `APP_URL` in Render to new domain
- Update `VITE_API_URL` in Vercel if backend domain changed

---

## Quick Deploy Commands

```bash
# Local development
cd server && npm run dev     # Backend on :3001
cd client && npm run dev     # Frontend on :5173

# Production build test
cd client && npm run build   # Builds to client/dist/

# Deploy via CLI (if using Vercel)
npm i -g vercel
vercel --prod

# Deploy via CLI (if using Render)
# Connect GitHub repo → auto-deploy on push
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 on all requests | Check `JWT_SECRET` is set and strong |
| CORS error | Add frontend domain to `CORS_ORIGINS` |
| "Cannot find module" | Ensure Node.js 22+ (check `engines` in package.json) |
| Upload fails | Check `UPLOAD_DIR` path exists and is writable |
| Database locked | Only one process should access SQLite file |
| Build fails | Run `npm install` in both `client/` and `server/` |
| Blank page | Check `VITE_API_URL` is correct |
| Auth redirect wrong | Update `APP_URL` in server env |
| Slow first load | Render free tier spins down — first request takes ~30s |

---

## Security Checklist

- [ ] `JWT_SECRET` is a strong random value (not the default)
- [ ] `.env` files are in `.gitignore`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NEVER in client code
- [ ] CORS configured for production domain only
- [ ] File uploads validated (type + size)
- [ ] Admin authorization enforced server-side
- [ ] No secrets committed to git
