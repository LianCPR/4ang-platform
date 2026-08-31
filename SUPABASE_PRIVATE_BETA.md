# 4ANG — Supabase Private Beta Setup Guide

> Biến source code 4ANG thành một **Private Beta** với Supabase backend để nhóm bạn dùng thử.

---

## 📋 Tổng quan kiến trúc

```
┌─────────────────────────────────────────────┐
│              4ANG Frontend                   │
│   React + Vite + Supabase Client            │
└───────────────┬─────────────────────────────┘
                │ API calls
┌───────────────▼─────────────────────────────┐
│              4ANG Backend                    │
│   Express.js + Supabase Admin Client        │
│   Handles: Auth, Music CRUD, Uploads, etc.  │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│              Supabase                        │
│   Auth + Database (PostgreSQL) + Storage     │
│   RLS Policies for Security                 │
└─────────────────────────────────────────────┘
```

---

## 🔧 Bước 1: Tạo Supabase Project

1. Vào [supabase.com](https://supabase.com) → Sign In
2. Click **"New Project"**
3. Chọn organization và tạo project:
   - **Name**: `4ang` hoặc `4ang-beta`
   - **Database Password**: Chọn password mạnh (lưu lại!)
   - **Region**: Chọn region gần nhất (Singapore hoặc Oregon)
4. Wait ~2 phút cho project được tạo

---

## 🔧 Bước 2: Lấy credentials

Vào **Project Settings** → **API**:

- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: `eyJhbGci...`
- **Service Role Key**: `eyJhbGci...` (⚠️ KHÔNG BAO GIỜ expose key này ở frontend)

---

## 🔧 Bước 3: Chạy SQL Migration

Vào **Supabase Dashboard** → **SQL Editor**:

1. Click **"New Query"**
2. Paste toàn bộ nội dung file `server/supabase/migration.sql`
3. Click **"Run"** (hoặc Ctrl+Enter)

File migration tạo:
- ✅ `profiles` — User profiles
- ✅ `artists` — Artist profiles  
- ✅ `tracks` — Music tracks
- ✅ `albums` + `album_songs` — Albums
- ✅ `playlists` + `playlist_songs` — Playlists
- ✅ `likes` + `saves` — Favorites
- ✅ `comments` — Track comments
- ✅ `play_events` — Listening history
- ✅ `recently_played` — Recently played
- ✅ `notifications` — User notifications
- ✅ `artist_follows` — Follow relationships
- ✅ `submissions` — Music submissions
- ✅ `admin_audit_log` — Admin audit trail
- ✅ `activity_events` — Activity tracking
- ✅ All indexes for performance
- ✅ All RLS policies for security
- ✅ `increment_play_count` RPC function
- ✅ Storage buckets (music, artwork, avatars)

---

## 🔧 Bước 4: Tạo Storage Buckets

Trong SQL Editor, chạy thêm nếu migration chưa tạo:

```sql
-- Music audio bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('music', 'music', false)
ON CONFLICT (id) DO NOTHING;

-- Artwork bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('artwork', 'artwork', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
```

---

## 🔧 Bước 5: Cấu hình Environment Variables

### Backend (`server/.env`)

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...  (from Step 2)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  (⚠️ SECRET!)

# Server
PORT=3001
CORS_ORIGINS=http://localhost:5173,https://your-domain.vercel.app

# JWT (still needed for internal token signing)
JWT_SECRET=your-random-secret-here-min-32-chars

# Google OAuth (optional, for Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth (optional, for Apple login)
APPLE_CLIENT_ID=your-apple-service-id
```

### Frontend (`client/.env.local`)

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...  (from Step 2)

# Google OAuth (if configured)
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Apple OAuth (if configured)
VITE_APPLE_CLIENT_ID=your-apple-service-id
```

---

## 🔧 Bước 6: Cấu hình Auth Providers (Optional)

### Google OAuth

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Tạo OAuth 2.0 Client ID
3. Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback`
4. Copy Client ID và Client Secret
5. Vào Supabase Dashboard → **Authentication** → **Providers** → **Google**
6. Enable và nhập Client ID + Secret

### Apple OAuth

1. Vào [Apple Developer](https://developer.apple.com)
2. Tạo App ID và Service ID
3. Vào Supabase Dashboard → **Authentication** → **Providers** → **Apple**
4. Enable và cấu hình

### Email OTP

Supabase tự hỗ trợ Email OTP/Magic Link.  
Vào **Authentication** → **Providers** → **Email**:
- Enable "Confirm email"
- Configure email templates nếu cần

### Phone OTP

Supabase hỗ trợ Twilio, Vonage, TextMob.  
Vào **Authentication** → **Providers** → **Phone**:
- Enable và cấu hình Twilio credentials

---

## 🔧 Bước 7: Chạy Backend

```bash
cd server
# Copy .env from Step 5
npm install   # Install dependencies
node src/index.js
```

Server chạy ở `http://localhost:3001`

---

## 🔧 Bước 8: Chạy Frontend

```bash
cd client
# Copy .env.local from Step 5
npm install
npm run dev
```

Frontend chạy ở `http://localhost:5173`

---

## 🔧 Bước 9: Migration dữ liệu (Optional)

Nếu muốn chuyển dữ liệu hiện có từ SQLite sang Supabase:

### Cách 1: API Migration (Admin only)

```bash
# Login as admin first, get token
TOKEN="your-admin-jwt-token"

# Check existing data
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/check

# Run full migration
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/all

# Or migrate specific tables:
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/users
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/artists
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/tracks
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/playlists
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/likes
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/migrate/submissions
```

### Cách 2: SQL Migration (Direct)

Chạy `server/supabase/migration.sql` trên Supabase Dashboard.

---

## 🔧 Bước 10: Deploy lên Vercel (Production)

### Frontend (Vercel)

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → Import Project
3. **Framework Preset**: Vite
4. **Root Directory**: `client`
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. Thêm Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID` (nếu có)
8. Deploy!

### Backend (Render/Railway/Fly.io)

1. Push code lên GitHub
2. Deploy server folder
3. **Start Command**: `node src/index.js`
4. Thêm Environment Variables từ Step 5
5. Deploy!

---

## 🔧 Bước 11: Cấu hình Auth Redirect URLs

Trong Supabase Dashboard → **Authentication** → **URL Configuration**:

**Site URL**: 
- Dev: `http://localhost:5173`
- Production: `https://your-app.vercel.app`

**Redirect URLs** (thêm tất cả):
- `http://localhost:5173`
- `https://your-app.vercel.app`

---

## 🔧 Bước 12: Tạo Admin User

Sau khi deploy, cần tạo admin user đầu tiên:

### Cách 1: SQL (nhanh nhất)

```sql
-- Find your user in profiles table
SELECT id, username FROM profiles;

-- Set them as admin
UPDATE profiles SET role = 'admin' WHERE username = 'your-username';
```

### Cách 2: Supabase Dashboard

1. Vào **Authentication** → **Users**
2. Tạo user mới hoặc tìm user hiện có
3. Copy User ID
4. Vào **Table Editor** → **profiles**
5. Find profile và đổi `role` thành `admin`

---

## 🔐 Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` KHÔNG BAO GIỜ ở frontend
- [ ] `SUPABASE_ANON_KEY` chỉ ở frontend (safe để expose)
- [ ] `JWT_SECRET` là random string, ít nhất 32 chars
- [ ] RLS enabled trên tất cả tables có user data
- [ ] Storage policies configured
- [ ] CORS origins configured (không dùng `*` ở production)
- [ ] `.env` files trong `.gitignore`
- [ ] Google/Apple OAuth secrets chỉ ở backend
- [ ] Email verification enabled
- [ ] Phone verification configured (nếu dùng)

---

## 📊 Bảng tóm tắt

| Component | Status | File |
|-----------|--------|------|
| SQL Migration | ✅ Ready | `server/supabase/migration.sql` |
| Auth Middleware | ✅ Supabase + Legacy | `server/src/auth.js` |
| Auth Routes | ✅ Dual mode | `server/src/routes/auth.js` |
| Supabase Service | ✅ Full CRUD | `server/src/supabase-service.js` |
| Migration Endpoint | ✅ Admin only | `server/src/routes/migrate.js` |
| Frontend Client | ✅ Auth helpers | `client/src/lib/supabase.js` |
| Env Config | ✅ Template ready | `server/.env.example`, `client/.env.example` |
| Security | ✅ RLS + policies | `server/supabase/migration.sql` |

---

## ❓ Troubleshooting

### "Supabase URL or Anon Key not configured"
→ Chưa set environment variables. Kiểm tra `server/.env`

### Auth errors
→ Kiểm tra JWT_SECRET có match giữa server và token generation

### CORS errors
→ Thêm frontend URL vào `CORS_ORIGINS` trong server .env

### 401 Unauthorized on API calls
→ Token có thể expired. Kiểm tra Supabase session refresh

### Data not persisting
→ Kiểm tra Supabase RLS policies — có thể đang block insert

---

## 🚀 Next Steps

Sau khi Private Beta chạy ổn định:

1. **Real-time subscriptions** — Supabase Realtime cho notifications
2. **Edge Functions** — Serverless functions cho complex logic
3. **Supabase Auth UI** — Built-in auth components (nếu muốn)
4. **Database webhooks** — Trigger notifications khi có data changes
5. **Full Supabase Auth migration** — Bỏ SQLite auth hoàn toàn
