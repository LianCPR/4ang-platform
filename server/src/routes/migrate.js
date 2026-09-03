/**
 * 4ANG Migration Status Route — Supabase only.
 * Shows the current state of Supabase tables.
 */
import express from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

router.get("/check", requireAuth, requireAdmin, async (req, res) => {
  const supaCounts = {};
  const tables = [
    "profiles", "artist_profiles", "tracks", "playlists", "playlist_tracks",
    "track_likes", "track_saves", "track_comments", "play_events",
    "notifications", "artist_follows", "submissions", "submission_credits",
    "submission_events", "artist_applications", "releases", "release_tracks",
    "admin_audit_log", "reports", "support_tickets", "activity_events",
    "search_history", "listening_progress", "user_preferences",
  ];

  for (const table of tables) {
    try {
      const { count } = await supabaseAdmin
        .from(table).select("*", { count: "exact", head: true });
      supaCounts[table] = count || 0;
    } catch (e) {
      supaCounts[table] = `Error: ${e.message?.slice(0, 50)}`;
    }
  }

  res.json({ supabase: supaCounts });
});

export default router;
