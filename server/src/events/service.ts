/**
 * 4ang Event Service
 *
 * Records application events to PostgreSQL.
 * Designed for future migration to event bus.
 */

import { supabaseAdmin } from "../supabase.js";
import type { AppEvent, EventService as IEventService, EventType } from "./types.js";

class EventServiceImpl implements IEventService {
  /**
   * Record a single event.
   */
  async record(event: AppEvent): Promise<void> {
    try {
      await supabaseAdmin.from("user_events").insert({
        user_id: event.user_id,
        event_type: event.event_type,
        entity_type: event.entity_type || null,
        entity_id: event.entity_id || null,
        session_id: event.session_id || null,
        metadata: event.metadata || null,
        occurred_at: event.occurred_at || new Date().toISOString(),
      });
    } catch (e) {
      // Non-critical — don't break app if event recording fails
      console.error("[event-service] Failed to record event:", e);
    }
  }

  /**
   * Record a batch of events.
   */
  async recordBatch(events: AppEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const rows = events.map(e => ({
        user_id: e.user_id,
        event_type: e.event_type,
        entity_type: e.entity_type || null,
        entity_id: e.entity_id || null,
        session_id: e.session_id || null,
        metadata: e.metadata || null,
        occurred_at: e.occurred_at || new Date().toISOString(),
      }));

      await supabaseAdmin.from("user_events").insert(rows);
    } catch (e) {
      console.error("[event-service] Failed to record batch:", e);
    }
  }

  /**
   * Get events for a user.
   */
  async getUserEvents(userId: string, limit = 50): Promise<AppEvent[]> {
    const { data } = await supabaseAdmin
      .from("user_events")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      event_type: row.event_type as EventType,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      session_id: row.session_id,
      metadata: row.metadata,
      occurred_at: row.occurred_at,
    }));
  }

  /**
   * Get event counts by type for a user.
   */
  async getEventCounts(userId: string, since?: string): Promise<Record<string, number>> {
    let query = supabaseAdmin
      .from("user_events")
      .select("event_type")
      .eq("user_id", userId);

    if (since) {
      query = query.gte("occurred_at", since);
    }

    const { data } = await query;

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.event_type] = (counts[row.event_type] || 0) + 1;
    }
    return counts;
  }
}

// Singleton
export const eventService = new EventServiceImpl();

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export async function recordPlaybackEvent(
  userId: string,
  eventType: "track.played" | "track.completed" | "track.skipped" | "track.seeked",
  trackId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await eventService.record({
    user_id: userId,
    event_type: eventType,
    entity_type: "track",
    entity_id: trackId,
    metadata,
    occurred_at: new Date().toISOString(),
  });
}

export async function recordLikeEvent(
  userId: string,
  liked: boolean,
  trackId: string
): Promise<void> {
  await eventService.record({
    user_id: userId,
    event_type: liked ? "track.liked" : "track.unliked",
    entity_type: "track",
    entity_id: trackId,
    occurred_at: new Date().toISOString(),
  });
}

export async function recordFollowEvent(
  userId: string,
  followed: boolean,
  targetUsername: string
): Promise<void> {
  await eventService.record({
    user_id: userId,
    event_type: followed ? "artist.followed" : "artist.unfollowed",
    entity_type: "artist",
    entity_id: targetUsername,
    occurred_at: new Date().toISOString(),
  });
}

export async function recordSearchEvent(
  userId: string,
  query: string,
  resultCount: number
): Promise<void> {
  await eventService.record({
    user_id: userId,
    event_type: "search.executed",
    entity_type: "search",
    metadata: { query, result_count: resultCount },
    occurred_at: new Date().toISOString(),
  });
}
