# 4ang Incident Response

## Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| **P0** | Complete platform outage | Immediate |
| **P1** | Major feature broken (auth, playback) | 1 hour |
| **P2** | Minor feature broken (social, recommendations) | 4 hours |
| **P3** | Cosmetic or non-critical issue | Next release |

## Incident Response Flow

```
Detect → Triage → Contain → Resolve → Review
```

## Detection Sources

- Health check failures
- User reports
- Monitoring alerts
- CI/CD failures
- Security scanning

## Common Incidents

### API Down (P0)
1. Check Render dashboard for deployment status
2. Verify API health: `curl https://fourang-api.onrender.com/api/health`
3. Check Render logs for startup errors
4. Rollback to previous deployment if needed
5. Verify after rollback

### Frontend Down (P0)
1. Check Cloudflare Pages dashboard
2. Verify: `curl -I https://4ang.xyz`
3. Check build logs for errors
4. Rollback to previous deployment

### Authentication Broken (P1)
1. Verify Supabase status: https://status.supabase.com
2. Check API logs for auth errors
3. Verify JWT_SECRET is correct
4. Test login flow manually
5. Check CORS configuration

### Database Issues (P1)
1. Check Supabase dashboard
2. Verify connection from API
3. Review recent migrations
4. Check RLS policies
5. Forward-fix or restore from backup

### AI/Intelligence Down (P2)
1. Check Python service health
2. Verify service is running
3. Check for Python errors in logs
4. Restart service if needed
5. AI failure should NOT break core features

### C++ Audio Engine Issues (P3)
1. Audio analysis is non-critical
2. Player should work without analysis
3. Check build environment if needed

## Communication

### Internal
- Slack/Discord channel for incidents
- Status page updates

### External
- Social media acknowledgment for P0/P1
- In-app notification if possible

## Post-Incident

1. Document what happened
2. Identify root cause
3. Create fix (if not already done)
4. Add monitoring to prevent recurrence
5. Update runbooks if needed
6. Share learnings with team

## Emergency Contacts

| Role | Contact |
|------|---------|
| Platform Owner | [your contact] |
| Supabase Support | support@supabase.com |
| Render Support | support@render.com |
| Cloudflare Support | via dashboard |
