# 4ang Authorization Security

## Authorization Model

### Middleware Hierarchy

```
requireAuth → sets req.user
   ↓
requireAdmin → checks req.user.isAdmin
   ↓
requireArtist → checks req.user.isArtist || req.user.isAdmin
   ↓
Application logic → checks ownership
```

### Role Resolution

Server derives roles from:
1. `profiles.role` in database
2. `ADMIN_EMAILS` environment variable

**Never** trust client-provided roles.

## Protected Endpoints

### Admin (requireAuth + requireAdmin)

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/admin/*` | ALL | Admin-only prefix |
| `/api/artist-posts/admin/:id/hide` | POST | Admin moderation |
| `/api/migrate/*` | ALL | Migration operations |

### Artist (requireAuth + requireArtist)

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/artists/` | POST | Create artist profile |
| Studio operations | Various | Via artist route |

### Authenticated (requireAuth)

| Domain | Endpoints | Ownership Check |
|--------|-----------|-----------------|
| Library | `/api/library/*` | User's own library |
| Playlists | `/api/playlists/*` | User's own playlists |
| Notifications | `/api/notifications/*` | User's own notifications |
| Events | `/api/events/*` | User's own events |
| Reports | `/api/reports/*` | User's own reports |
| Support | `/api/support/*` | User's own tickets |

### Public (no auth required)

| Endpoint | Notes |
|----------|-------|
| `/api/health` | Health check |
| `/api/tracks` | Track listing (public) |
| `/api/discover/*` | Discovery/browse |
| `/api/artists/:username` | Public artist profiles |
| `/api/banners` | Marketing banners |

## IDOR Protection

### Critical Ownership Checks

Every mutation must verify the requesting user owns the resource:

```javascript
// GOOD — server-side ownership check
router.delete("/:id", requireAuth, async (req, res) => {
  const { data } = await supabaseAdmin
    .from("playlists")
    .select("user_id")
    .eq("id", req.params.id)
    .single();

  if (!data) return res.status(404).json({ error: "Not found" });
  if (data.user_id !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  // proceed with deletion
});
```

### Verified

✅ Admin routes use `requireAdmin` middleware
✅ Artist routes check ownership or `requireArtist`
✅ Playlist mutations check `user_id` ownership
✅ Library operations use `req.user.id` for queries
✅ Event ingestion uses `req.user.id` for ownership
✅ Notification reads use `req.user.id`

### Known Gaps

⚠️ Some public endpoints (tracks, discovery) expose data without auth — this is intentional for browsing
⚠️ Artist post reactions use `req.user.id` but do not prevent self-reaction

## Privilege Escalation Prevention

### Rules

1. Client-provided `role`, `isAdmin`, `isArtist` are NEVER trusted
2. Server resolves roles from database on every request
3. Admin status checked against both DB role AND email list
4. Artist status resolved from profile on each auth check

### Verified

✅ `requireAdmin` checks `req.user.isAdmin` (server-resolved)
✅ `requireArtist` checks `req.user.isArtist` (server-resolved)
✅ No route trusts `req.body.role` or `req.query.role`

## Recommendations

1. **P2**: Add ownership checks to any remaining endpoints that accept user IDs in body
2. **P2**: Verify artist can only modify own posts (currently checked)
3. **P3**: Add audit logging for admin operations
