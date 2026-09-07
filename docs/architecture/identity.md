# 4ang Identity Architecture

## Overview

4ang uses Supabase Auth as the Identity Provider. The application builds an identity layer on top for roles, permissions, and authorization.

## Architecture

```
Supabase Auth (canonical)
      ↓
Identity Adapter (server/src/identity/)
      ↓
IdentityContext (typed)
      ↓
Authorization Middleware
      ↓
Application Services
```

## Roles

| Role | Description |
|------|-------------|
| `user` | Basic user |
| `artist` | Music artist with studio access |
| `verified_artist` | Verified artist |
| `moderator` | Content moderator |
| `admin` | Full access |

## Permissions

### Music
- `music.read` — Listen to music
- `music.upload` — Upload tracks (artist+)
- `music.edit_own` — Edit own tracks
- `music.delete_own` — Delete own tracks
- `music.moderate` — Moderate content (moderator+)

### Artist
- `artist.manage_own` — Manage artist profile
- `artist.verified` — Verified status
- `artist.studio` — Access studio
- `artist.publish` — Publish releases

### Social
- `social.post` — Create posts
- `social.comment` — Comment
- `social.follow` — Follow users/artists
- `social.share` — Share content

### Admin
- `admin.manage` — System management
- `admin.users` — User management
- `admin.moderation` — Content moderation
- `admin.analytics` — View analytics

## Middleware

```typescript
import { requireIdentity, requireRole, requirePermission } from "../identity/middleware.js";

// Require authentication
router.get("/profile", requireIdentity, controller.getProfile);

// Require specific role
router.post("/studio/tracks", requireIdentity, requireRole("artist", "admin"), controller.upload);

// Require specific permission
router.delete("/tracks/:id", requireIdentity, requirePermission("music.delete_own"), controller.delete);
```

## Identity Context

Every authenticated request has `req.identity`:

```typescript
interface IdentityContext {
  userId: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  isArtist: boolean;
  isAdmin: boolean;
}
```

## Security Rules

1. Supabase Auth handles password/OAuth/session
2. Service role key never exposed to frontend
3. RLS enforced at database level
4. API authorization enforced at middleware level
5. No custom password system
6. No duplicate auth database
