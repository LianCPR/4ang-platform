# 4ang Authentication Security

## Architecture

```
Browser
   ↓ Supabase Auth SDK
Supabase Auth (canonical)
   ↓ JWT token
4ang API (JWT verification)
   ↓ req.user (identity context)
Application services
```

## Authentication Methods

| Method | Status | Notes |
|--------|--------|-------|
| Email/Password | ✅ Via Supabase | Canonical |
| Phone OTP | ✅ Via Supabase | Rate limited (5/min) |
| Google OAuth | ✅ Via Supabase | Optional |
| Apple OAuth | ✅ Via Supabase | Optional |
| Backend JWT | ✅ Legacy | Used for sync-profile |

## Token Handling

### Supabase JWT
- Format: `eyJ...` (3-part JWT)
- Verified via Supabase `verifyToken()`
- Contains: user ID, email, role
- Expiry: managed by Supabase

### Backend JWT
- Signed with `JWT_SECRET`
- 7-day expiry
- Used for legacy/sync-profile scenarios

## Security Properties

### Implemented
✅ JWT verification on all protected endpoints
✅ Token format validation (Supabase vs backend)
✅ Expired token rejection
✅ Invalid token rejection
✅ Restricted account check
✅ Admin role resolution from profile + email
✅ No plaintext password storage
✅ Service-role key server-side only

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| OTP send | 5 | 60s |
| OTP verify | 10 | 5min |
| Login | 15 | 5min |

## Admin Authorization

Admin status determined by:
1. `profiles.role === 'admin'` in database
2. Email in `ADMIN_EMAILS` environment variable

Both checks must fail for non-admin access.

## Known Limitations

1. Backend JWT fallback exists for legacy compatibility
2. Token query parameter passing supported (less secure than header)
3. No refresh token rotation documented

## Recommendations

1. **P1**: Consider removing query parameter token support
2. **P2**: Add token refresh logging
3. **P3**: Implement refresh token rotation
