# 4ang Environment Management

## Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| **development** | Local development | localhost |
| **production** | Live platform | https://4ang.xyz |

## Environment Variables

### Web Client (Vite)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `VITE_API_URL` | PUBLIC | No | API base URL (defaults to /api) |
| `VITE_SUPABASE_URL` | PUBLIC | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | PUBLIC | Yes | Supabase anon key |

**Note**: Only `VITE_` prefixed variables are exposed to the client bundle.

### API Server (Node.js)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `PORT` | PUBLIC | No | Server port (default: 3001) |
| `NODE_ENV` | PUBLIC | No | development/production |
| `JWT_SECRET` | SECRET | Yes | JWT signing secret |
| `CORS_ORIGINS` | PUBLIC | No | Comma-separated allowed origins |
| `APP_URL` | PUBLIC | No | Frontend URL for redirects |
| `SUPABASE_URL` | SECRET | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | SECRET | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET | Yes | Supabase service role key |
| `GOOGLE_CLIENT_ID` | SECRET | No | Google OAuth client ID |
| `APPLE_CLIENT_ID` | SECRET | No | Apple OAuth client ID |

**⚠️ NEVER expose service-role keys to the frontend.**

### Python Intelligence

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `PORT` | PUBLIC | No | Service port (default: 8000) |
| `SUPABASE_URL` | SECRET | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET | Yes | Supabase service role key |

## Configuration Files

| File | Environment | Committed |
|------|-------------|-----------|
| `.env.example` | Root | ✅ Yes |
| `server/.env.example` | Server | ✅ Yes |
| `client/.env.example` | Client | ✅ Yes |
| `.env` | Any | ❌ Never |
| `.env.local` | Local | ❌ Never |

## Secret Management

### Development
- Use `.env` files (gitignored)
- Never commit real secrets
- Use `.env.example` as template

### Production (Render)
- Set via Render dashboard
- Environment variables section
- Use "Encrypt" for sensitive values

### Production (Cloudflare)
- Set via Cloudflare Pages dashboard
- Environment variables section

## Validation

Required environment variables are validated at startup.
Missing required variables cause immediate failure with clear error messages.

### Server Startup Validation
```javascript
if (!process.env.SUPABASE_URL) {
  console.error("[FATAL] SUPABASE_URL is required");
  process.exit(1);
}
```

### Client Build Validation
Vite automatically validates `VITE_` variables at build time.
Missing required variables produce clear build errors.
