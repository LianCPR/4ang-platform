# 4ang Rollback Procedures

## Overview

Every deployment should be rollback-ready within minutes.

## Web Rollback (Cloudflare Pages)

1. Go to Cloudflare Dashboard → Pages → 4ang
2. Click "Deployments" tab
3. Find the last known good deployment
4. Click "..." → "Rollback to this deployment"
5. Verify: https://4ang.xyz loads correctly
6. Verify: SPA routing works

**Time to rollback: ~30 seconds**

## API Rollback (Render)

1. Go to Render Dashboard → 4ang-backend
2. Click "Events" tab
3. Find the previous successful deployment
4. Click "Rollback to this version"
5. Verify: /api/health responds
6. Test key endpoints

**Time to rollback: ~2 minutes** (cold start)

## Database Rollback

### Preferred: Forward-Fix
1. Write a new migration that corrects the issue
2. Apply the fix migration
3. Deploy the corrected application

### Emergency: Restore from Backup
1. Go to Supabase Dashboard → Database → Backups
2. Select the backup point before the problematic migration
3. Contact Supabase support if needed
4. Verify data integrity after restore

**⚠️ Database rollback is destructive — use only as last resort.**

## Python Intelligence Rollback

1. SSH to the intelligence service host
2. Checkout the previous Git commit
3. Restart the service
4. Verify: /health responds

## Verification After Rollback

After any rollback, verify:

- [ ] Health checks pass
- [ ] Authentication works
- [ ] Core features work (music, playback, search)
- [ ] No new errors in logs

## Prevention

- Always test migrations on staging first
- Use feature flags for risky changes
- Keep deployments small and frequent
- Monitor error rates after deployment
