/**
 * 4ANG Social Routes — User follows, Feed, Activity
 */
import express from "express";
import { requireAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";
import { shapeTrack, recordActivity, createNotification, shapePublicUserSummary } from "../db.js";

const router = express.Router();

// ======================== USER FOLLOWS ========================

// Follow a user
router.post("/follow/:username", requireAuth, async (req, res) => {
  const targetUsername = req.params.username;
  if (req.user.username === targetUsername) {
    return res.status(400).json({ error: "Không thể tự theo dõi chính mình." });
  }

  // Get target user
  const { data: targetUser } = await supabaseAdmin
    .from("profiles").select("id, username").eq("username", targetUsername).single();
  if (!targetUser) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  // Check existing follow
  const { data: existing } = await supabaseAdmin
    .from("user_follows").select("id")
    .eq("follower_id", req.user.id).eq("following_id", targetUser.id)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from("user_follows").insert({
      follower_id: req.user.id,
      following_id: targetUser.id,
      follower_username: req.user.username,
      following_username: targetUsername,
      created_at: new Date().toISOString(),
    });

    // Record activity
    await recordActivity(req.user.username, "USER_FOLLOWED", "user", targetUsername, null);

    // Notify
    createNotification(targetUsername, "NEW_FOLLOWER", "Người mới theo dõi",
      `${req.user.displayName || req.user.username} đã theo dõi bạn.`,
      { actorUsername: req.user.username, targetType: "user", targetId: targetUsername });
  }

  const { count } = await supabaseAdmin
    .from("user_follows").select("*", { count: "exact", head: true })
    .eq("following_id", targetUser.id);

  res.json({ isFollowing: true, followers: count || 0 });
});

// Unfollow a user
router.delete("/follow/:username", requireAuth, async (req, res) => {
  const { data: targetUser } = await supabaseAdmin
    .from("profiles").select("id").eq("username", req.params.username).single();
  if (!targetUser) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  await supabaseAdmin.from("user_follows")
    .delete().eq("follower_id", req.user.id).eq("following_id", targetUser.id);

  const { count } = await supabaseAdmin
    .from("user_follows").select("*", { count: "exact", head: true })
    .eq("following_id", targetUser.id);

  res.json({ isFollowing: false, followers: count || 0 });
});

// Check if following multiple users
router.post("/follow/check", requireAuth, async (req, res) => {
  const { usernames } = req.body || {};
  if (!Array.isArray(usernames)) return res.json({ following: {} });

  const { data: rows } = await supabaseAdmin
    .from("user_follows").select("following_username")
    .eq("follower_id", req.user.id)
    .in("following_username", usernames);

  const followingMap = {};
  for (const r of (rows || [])) followingMap[r.following_username] = true;
  res.json({ following: followingMap });
});

// Get followers of a user
router.get("/followers/:username", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const { data: user } = await supabaseAdmin
    .from("profiles").select("id").eq("username", req.params.username).single();
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const { data: rows } = await supabaseAdmin
    .from("user_follows").select("follower_username")
    .eq("following_id", user.id)
    .order("created_at", { ascending: false }).limit(limit);

  const usernames = (rows || []).map(r => r.follower_username);
  if (usernames.length === 0) return res.json({ users: [] });

  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("*").in("username", usernames);

  res.json({ users: (profiles || []).map(shapePublicUserSummary) });
});

// Get following of a user
router.get("/following/:username", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const { data: user } = await supabaseAdmin
    .from("profiles").select("id").eq("username", req.params.username).single();
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const { data: rows } = await supabaseAdmin
    .from("user_follows").select("following_username")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false }).limit(limit);

  const usernames = (rows || []).map(r => r.following_username);
  if (usernames.length === 0) return res.json({ users: [] });

  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("*").in("username", usernames);

  res.json({ users: (profiles || []).map(shapePublicUserSummary) });
});

// ======================== FEED ========================

// Get social feed
router.get("/feed", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const before = req.query.before; // cursor for pagination

    // Get followed usernames
    const { data: followedArtists } = await supabaseAdmin
      .from("artist_follows").select("artist_username")
      .eq("follower_username", req.user.username);

    const { data: followedUsers } = await supabaseAdmin
      .from("user_follows").select("following_username")
      .eq("follower_username", req.user.username);

    const followedUsernames = [
      req.user.username, // include own activity
      ...(followedArtists || []).map(r => r.artist_username),
      ...(followedUsers || []).map(r => r.following_username),
    ];

    if (followedUsernames.length === 0) {
      // If not following anyone, show recent public activity
      let query = supabaseAdmin
        .from("activity_events").select("*")
        .order("created_at", { ascending: false }).limit(limit);

      if (before) query = query.lt("created_at", before);

      const { data: events } = await query;
      return res.json({ activities: await shapeFeedEvents(events || []), hasMore: (events || []).length === limit });
    }

    let query = supabaseAdmin
      .from("activity_events").select("*")
      .in("username", followedUsernames)
      .order("created_at", { ascending: false }).limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data: events } = await query;
    res.json({ activities: await shapeFeedEvents(events || []), hasMore: (events || []).length === limit });
  } catch (e) {
    console.error("[FEED]", e);
    res.status(500).json({ error: "Không thể tải feed." });
  }
});

// Shape feed events into rich activity objects
async function shapeFeedEvents(events) {
  if (events.length === 0) return [];

  // Batch-fetch profiles
  const usernames = [...new Set(events.map(e => e.username).filter(Boolean))];
  const { data: profiles } = usernames.length > 0
    ? await supabaseAdmin.from("profiles").select("*").in("username", usernames)
    : { data: [] };
  const profileMap = {};
  for (const p of (profiles || [])) profileMap[p.username] = p;

  // Batch-fetch tracks if needed
  const trackIds = [...new Set(events
    .filter(e => e.target_type === "track" || e.target_type === "song")
    .map(e => e.target_id).filter(Boolean))];
  let trackMap = {};
  if (trackIds.length > 0) {
    const { data: tracks } = await supabaseAdmin.from("tracks").select("*").in("id", trackIds);
    for (const t of (tracks || [])) trackMap[t.id] = t;
  }

  // Batch-fetch playlists if needed
  const playlistIds = [...new Set(events
    .filter(e => e.target_type === "playlist")
    .map(e => e.target_id).filter(Boolean))];
  let playlistMap = {};
  if (playlistIds.length > 0) {
    const { data: playlists } = await supabaseAdmin.from("playlists").select("*").in("id", playlistIds.map(Number).filter(n => !isNaN(n)));
    for (const p of (playlists || [])) playlistMap[String(p.id)] = p;
  }

  return events.map(event => {
    const profile = profileMap[event.username] || {};
    const meta = typeof event.metadata === "string" ? (() => { try { return JSON.parse(event.metadata); } catch { return {}; } })() : (event.metadata || {});

    let target = null;
    const targetType = event.target_type;
    const targetId = event.target_id;

    if (targetType === "track" || targetType === "song") {
      const track = trackMap[targetId];
      if (track) {
        target = {
          type: "track",
          id: track.id,
          title: track.title,
          artist: track.credits?.[0]?.artistName || track.composer || track.uploader_display_name || track.uploader_username,
          coverUrl: track.cover_url || null,
          duration: track.duration || 0,
        };
      }
    } else if (targetType === "playlist") {
      const playlist = playlistMap[String(targetId)];
      if (playlist) {
        target = {
          type: "playlist",
          id: playlist.id,
          title: playlist.title,
          coverUrl: playlist.cover_url || null,
          trackCount: playlist.track_count || 0,
        };
      }
    } else if (targetType === "artist") {
      target = { type: "artist", username: targetId, name: meta.artistName || targetId };
    } else if (targetType === "user") {
      target = { type: "user", username: targetId, name: meta.displayName || targetId };
    }

    return {
      id: event.id,
      username: event.username,
      displayName: profile.display_name || profile.username || event.username,
      avatarUrl: profile.avatar_url || null,
      eventType: event.event_type,
      target,
      message: meta.message || null,
      createdAt: event.created_at,
    };
  });
}

// ======================== PEOPLE SEARCH ========================

// Search people
router.get("/people", async (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  if (q.length < 1) return res.json({ users: [] });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const likePattern = `%${q}%`;

  const { data: rows } = await supabaseAdmin
    .from("profiles").select("id, username, display_name, avatar_url, role")
    .or(`username.ilike.${likePattern},display_name.ilike.${likePattern}`)
    .limit(limit);

  res.json({ users: (rows || []).map(r => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name || r.username,
    avatarUrl: r.avatar_url || null,
    role: r.role || null,
  }))});
});

// ======================== RECORD SHARE ACTIVITY ========================

// Record a share event
router.post("/share", requireAuth, async (req, res) => {
  const { type, id, message } = req.body || {};
  if (!type || !id) return res.status(400).json({ error: "Thiếu thông tin." });

  await recordActivity(req.user.username, "SHARED", type, String(id),
    message ? { message } : null);

  res.json({ ok: true });
});

export default router;
