# 4ang Graceful Degradation Matrix

## Philosophy

Core music playback must never depend on AI or auxiliary services.
When non-critical services fail, users should experience degraded but functional behavior.

## Degradation Matrix

| Component | Failure | User Impact | Fallback |
|-----------|---------|-------------|----------|
| **Supabase Auth** | Unavailable | Cannot login/signup | Show error, retry |
| **Supabase DB** | Unavailable | Cannot load data | Show error, retry |
| **Music Playback** | Down | Cannot play | N/A — critical |
| **Search** | Slow/timeout | Delayed results | Show cached/empty |
| **Recommendations** | Unavailable | No recommendations | Show trending/popular |
| **AI Assistant** | Unavailable | AI chat broken | Show "unavailable" message |
| **AI Intent Parsing** | Timeout | Fallback to keywords | Keyword-based intent detection |
| **Audio Analysis** | Failed | No analysis data | Track still playable |
| **Event Ingestion** | Failed | Analytics delayed | Events buffered, retried |
| **Realtime** | Disconnected | Live updates paused | Auto-reconnect |
| **Notifications** | Delayed | Late notifications | Queue, retry delivery |
| **Python Intelligence** | Down | AI features degraded | Graceful error response |
| **C++ Audio Engine** | Failed | No audio analysis | Track unaffected |
| **Storage** | Unavailable | Cannot upload | Show error |
| **Social Feed** | Slow | Delayed feed | Show cached feed |

## Priority Levels

### Critical (must not fail)
- Authentication
- Music playback
- Track browsing
- Library access

### Important (degrade gracefully)
- Search
- Playlist management
- Artist pages
- Social features

### Degradable (can fail without blocking)
- Recommendations
- AI assistant
- Audio analysis
- Event analytics

## Implementation Pattern

```javascript
try {
  const result = await primaryService.call();
  return res.json(result);
} catch (error) {
  // Log the failure
  console.error(JSON.stringify({
    level: "ERROR",
    event: "service_failure",
    service: "primaryService",
    error: error.message,
  }));

  // Return fallback
  const fallback = await fallbackService.call();
  return res.json(fallback);
}
```

## Key Principle

**Music is the product.** Everything else is enhancement.
If AI fails, music still plays.
If recommendations fail, library still works.
If analytics fail, playback still tracks.
