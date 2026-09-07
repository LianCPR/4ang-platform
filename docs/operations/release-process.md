# 4ang Release Process

## Overview

All changes flow through: Code → PR → CI → Review → Merge → Deploy

## Development Flow

1. Create feature branch from `main`
2. Make changes with logical commits
3. Push branch, open Pull Request
4. CI runs automatically (lint, typecheck, build, tests)
5. Code review by team member
6. Merge to `main`
7. Automatic deployment triggers

## Deployment Targets

| Component | Platform | Trigger |
|-----------|----------|---------|
| Web (Frontend) | Cloudflare | Push to main |
| API (Backend) | Render | Push to main |
| Python Intelligence | Self-hosted | Manual |
| C++ Audio Engine | Local/WASM | Build-time |

## Deployment Steps

### Web (Cloudflare)
1. CI builds web application
2. Cloudflare Pages deploys automatically
3. Verify: https://4ang.xyz loads correctly
4. Verify: SPA routing works (direct URL access)
5. Verify: Assets load (CSS, JS)

### API (Render)
1. CI validates API syntax
2. Render auto-deploys on push to main
3. Verify: /api/health responds
4. Verify: Authentication works
5. Verify: Key endpoints respond correctly

## Rollback Procedure

### Web Rollback
1. Go to Cloudflare Pages dashboard
2. Select the previous successful deployment
3. Click "Rollback to this deployment"
4. Verify frontend works

### API Rollback
1. Go to Render dashboard
2. Find the previous successful deploy
3. Click "Rollback to this version"
4. Verify API health check

### Database Rollback
- **Preferred**: Forward-fix with a new migration
- **Emergency**: Restore from Supabase backup
- **Never**: Manually alter production schema without tracking

## Version Tracking

Every deployment is tracked by Git commit SHA.
Expose safe version info through health endpoint:

```
GET /api/health
→ { "ok": true, "version": "abc1234", "env": "production" }
```

## Emergency Procedures

### Complete Outage
1. Check Cloudflare status
2. Check Render status
3. Check Supabase status
4. Rollback to last known good deployment
5. Communicate status to users

### Database Issues
1. Check Supabase dashboard
2. Review recent migrations
3. Forward-fix if possible
4. Restore from backup if necessary

### Security Incident
1. Rotate affected secrets immediately
2. Review access logs
3. Identify scope of breach
4. Notify affected users if required
5. Document incident
