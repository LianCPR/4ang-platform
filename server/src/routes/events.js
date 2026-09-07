/**
 * 4ang Event Ingestion API
 *
 * POST /api/events/batch — Record batched events (playback, library, etc.)
 * GET  /api/events/history — Get user event history
 * GET  /api/events/stats — Get user event statistics
 */

import express from "express";
import { requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

// Valid event types
const VALID_EVENT_TYPES = new Set([
  "track.played", "track.completed", "track.skipped", "track.seeked",
  "track.liked", "track.unliked", "track.saved", "track.unsaved",
  "playlist.created", "playlist.updated", "playlist.track_added", "playlist.track_removed",
  "artist.followed", "artist.unfollowed",
  "user.followed", "user.unfollowed",
  "post.created", "post.liked", "comment.created", "comment.liked",
  "search.executed",
  "recommendation.impression", "recommendation.clicked", "recommendation.played",
  "recommendation.skipped", "recommendation.feedback",
  "room.joined", "room.left",
  "assistant.message", "assistant.tool_called",
  "track.uploaded", "track.analysis.completed",
]);

const VALID_ENTITY_TYPES = new Set([
  "track", "artist", "album", "playlist", "post", "comment",
  "user", "room", "recommendation", "search", "assistant",
]);

const eventBatchLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "ev-batch" });

/**
 * POST /api/events/batch
 * Record a batch of events.
 */
router.post("/batch", requireAuth, eventBatchLimit, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "events array required" });
    }
    if (events.length > 50) {
      return res.status(400).json({ error: "Maximum 50 events per batch" });
    }

    const rows = [];
    for (const event of events) {
      if (!event.event_type || !VALID_EVENT_TYPES.has(event.event_type)) continue;

      rows.push({
        user_id: req.user.id,
        event_type: event.event_type,
        entity_type: VALID_ENTITY_TYPES.has(event.entity_type) ? event.entity_type : null,
        entity_id: event.entity_id || null,
        session_id: event.session_id || null,
        metadata: typeof event.metadata === "object" ? event.metadata : null,
        occurred_at: event.occurred_at || new Date().toISOString(),
      });
    }

    if (rows.length === 0) {
      return res.json({ recorded: 0 });
    }

    const { error } = await supabaseAdmin.from("user_events").insert(rows);
    if (error) {
      console.error("[events/batch]", error.message);
      return res.json({ recorded: 0, error: "Event recording temporarily unavailable" });
    }

    res.json({ recorded: rows.length });
  } catch (e) {
    console.error("[events/batch]", e);
    res.json({ recorded: 0 });
  }
});

/**
 * POST /api/events — Record a single event.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { event_type, entity_type, entity_id, metadata } = req.body;
    if (!event_type || !VALID_EVENT_TYPES.has(event_type)) {
      return res.status(400).json({ error: "Invalid event_type" });
    }

    const { error } = await supabaseAdmin.from("user_events").insert({
      user_id: req.user.id,
      event_type,
      entity_type: VALID_ENTITY_TYPES.has(entity_type) ? entity_type : null,
      entity_id: entity_id || null,
      metadata: typeof metadata === "object" ? metadata : null,
      occurred_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[events]", error.message);
      return res.json({ recorded: false });
    }

    res.json({ recorded: true });
  } catch (e) {
    console.error("[events]", e);
    res.json({ recorded: false });
  }
});

/**
 * GET /api/events/history
 * Get user event history.
 */
router.get("/history", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { data } = await supabaseAdmin
      .from("user_events")
      .select("*")
      .eq("user_id", req.user.id)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    res.json({ events: data || [] });
  } catch (e) {
    console.error("[events/history]", e);
    res.json({ events: [] });
  }
});

/**
 * GET /api/events/stats
 * Get user event statistics.
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const since = req.query.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabaseAdmin
      .from("user_events")
      .select("event_type")
      .eq("user_id", req.user.id)
      .gte("occurred_at", since);

    const { data } = await query;
    const counts = {};
    for (const row of data || []) {
      counts[row.event_type] = (counts[row.event_type] || 0) + 1;
    }
    res.json({ stats: counts });
  } catch (e) {
    console.error("[events/stats]", e);
    res.json({ stats: {} });
  }
});

export default router;
