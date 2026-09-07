# 4ang Production Checklist

Use this checklist before every production deployment.

## Pre-Deployment

- [ ] All CI checks pass (lint, typecheck, build, tests)
- [ ] Database migrations reviewed and tested
- [ ] RLS policies verified (not weakened)
- [ ] Environment variables configured for target environment
- [ ] No secrets in source code or Git history
- [ ] CORS origins updated for production domain
- [ ] Rate limiting configured for production

## Deployment

- [ ] Web build completes successfully
- [ ] API build completes successfully
- [ ] API health check responds at /api/health
- [ ] Frontend loads correctly
- [ ] SPA routing works (direct URL access)
- [ ] Assets load (CSS, JS, images)

## Post-Deployment Smoke Tests

- [ ] Authentication flow (login/signup)
- [ ] Music browsing (home page loads tracks)
- [ ] Search functionality
- [ ] Music playback (Player 3.0 works)
- [ ] Queue management
- [ ] Lyrics display
- [ ] Library (liked songs)
- [ ] Playlist creation
- [ ] Artist pages
- [ ] Social features
- [ ] Real-time notifications
- [ ] AI assistant responds
- [ ] Recommendations load

## Security Verification

- [ ] Supabase service-role key NOT in frontend
- [ ] JWT_SECRET is a strong, unique value
- [ ] CORS allows only known origins
- [ ] Rate limiting active on sensitive endpoints
- [ ] File upload validation in place
- [ ] No stack traces exposed to clients
- [ ] HTTPS enforced on all services

## Monitoring

- [ ] Health checks monitored
- [ ] Error rates within normal range
- [ ] No unexpected 5xx errors
- [ ] API response times acceptable
- [ ] Database connection stable

## Rollback Readiness

- [ ] Previous deployment version identified
- [ ] Database rollback plan documented
- [ ] Emergency contacts available
