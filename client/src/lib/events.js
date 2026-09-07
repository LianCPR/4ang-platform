/**
 * 4ang Event Batching Service
 *
 * Buffers analytics events and sends them in batches.
 * Critical user actions (like, save) are sent immediately.
 * Playback analytics are batched.
 */

import { api } from "../api.js";

const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BUFFER_MS = 60_000; // Max time before force-flush

let eventBuffer = [];
let flushTimer = null;
let lastFlushTime = Date.now();

/**
 * Queue an event for batched sending.
 */
export function trackEvent(eventType, entityType, entityId, metadata = {}) {
  const event = {
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    session_id: getSessionId(),
    occurred_at: new Date().toISOString(),
  };

  eventBuffer.push(event);

  // Flush if buffer is full or max time exceeded
  if (eventBuffer.length >= BATCH_SIZE || (Date.now() - lastFlushTime > MAX_BUFFER_MS)) {
    flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, BATCH_INTERVAL_MS);
  }
}

/**
 * Send events immediately (for critical actions).
 */
export async function trackEventImmediate(eventType, entityType, entityId, metadata = {}) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      }),
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Flush buffered events to the API.
 */
async function flushEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, BATCH_SIZE);
  lastFlushTime = Date.now();

  try {
    await fetch("/api/events/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Re-queue failed events
    eventBuffer.unshift(...batch);
  }
}

/**
 * Generate or retrieve session ID.
 */
function getSessionId() {
  try {
    let sid = sessionStorage.getItem("4ang_session_id");
    if (!sid) {
      sid = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
      sessionStorage.setItem("4ang_session_id", sid);
    }
    return sid;
  } catch {
    return "unknown";
  }
}

/**
 * Get access token from Supabase.
 */
function getAccessToken() {
  try {
    const key = Object.keys(localStorage).find(k => k.includes("supabase") && k.includes("auth"));
    if (key) {
      const data = JSON.parse(localStorage.getItem(key));
      return data?.access_token || "";
    }
  } catch {}
  return "";
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (eventBuffer.length > 0) {
      // Use sendBeacon for reliable delivery on page close
      const batch = eventBuffer.splice(0);
      try {
        navigator.sendBeacon("/api/events/batch", JSON.stringify({ events: batch }));
      } catch {
        // Fallback — events may be lost
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export function trackPlay(trackId, artistUsername) {
  trackEvent("track.played", "track", trackId, { artist_username: artistUsername });
}

export function trackComplete(trackId, artistUsername) {
  trackEvent("track.completed", "track", trackId, { artist_username: artistUsername });
}

export function trackSkip(trackId, artistUsername, positionMs) {
  trackEvent("track.skipped", "track", trackId, { artist_username: artistUsername, position_ms: positionMs });
}

export function trackSearch(query, resultCount) {
  trackEvent("search.executed", "search", null, { query, result_count: resultCount });
}

export function trackLike(trackId) {
  trackEventImmediate("track.liked", "track", trackId);
}

export function trackUnlike(trackId) {
  trackEventImmediate("track.unliked", "track", trackId);
}

export function trackFollowArtist(artistUsername) {
  trackEventImmediate("artist.followed", "artist", artistUsername);
}

export function trackUnfollowArtist(artistUsername) {
  trackEventImmediate("artist.unfollowed", "artist", artistUsername);
}
