/**
 * 4ANG SOCIAL DISCOVERY 2.0 — Phase 2.3
 *
 * Deterministic, explainable discovery built on REAL signals:
 * follows (user + artist), track likes, play activity, shares,
 * public playlists, active public rooms. No AI, no embeddings, no
 * fabricated data. Every recommendation carries human-readable
 * reasons that are backed by actual rows.
 *
 * Privacy: network sections are strictly restricted to users the
 * viewer follows + public artifacts (public playlists, active public
 * rooms, public activity events). Private playlists, private rooms
 * and strangers' listening history are never queried or returned.
 */
import express from "express";
import { requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { supabaseAdmin } from "../supabase.js";
import {
  shapeTrack, shapePlaylist, recordActivity,
} from "../db.js";

const router = express.Router();
const socialLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "social-disc" });
const clickLimit = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "social-click" });

const NOW_14D = () => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const NOW_30D = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

/* ─────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────
 * Context — one batched pull of the viewer's social + taste signals
 * ───────────────────────────────────────────────────────────────────── */
async function buildContext(username) {
  const { data: meRows } = await supabaseAdmin
    .from("profiles").select("id, username, display_name, avatar_url, role")
    .eq("username", username).maybeSingle();
  const me = meRows || null;
  if (!me) return null;

  // 1) Users I follow (and follow usernames)
  const { data: myFollowRows } = await supabaseAdmin
    .from("user_follows").select("following_username, following_id")
    .eq("follower_username", username);
  const followingUsernames = [...new Set((myFollowRows || []).map((r) => r.following_username).filter(Boolean))];
  const followingIds = [...new Set((myFollowRows || []).map((r) => r.following_id).filter(Boolean))];

  // 2) People who follow me (mutual detection)
  const { data: myFollowerRows } = await supabaseAdmin
    .from("user_follows").select("follower_username")
    .eq("following_id", me.id);
  const myFollowers = new Set((myFollowerRows || []).map((r) => r.follower_username).filter(Boolean));

  // 3) Artists I follow
  const { data: myArtistFollowRows } = await supabaseAdmin
    .from("artist_follows").select("artist_username").eq("follower_username", username);
  const followedArtists = new Set((myArtistFollowRows || []).map((r) => r.artist_username).filter(Boolean));

  // 4) My taste: liked tracks → artists/genres, played tracks → artists/genres
  const { data: myLikes } = await supabaseAdmin
    .from("track_likes").select("track_id").eq("username", username)
    .order("created_at", { ascending: false }).limit(200);
  const myLikedIds = [...new Set((myLikes || []).map((r) => r.track_id))];

  const { data: myPlays } = await supabaseAdmin
    .from("play_events").select("track_id").eq("username", username)
    .order("created_at", { ascending: false }).limit(80);
  const myPlayedIds = [...new Set((myPlays || []).map((r) => r.track_id))];

  async function collectTaste(ids) {
    const out = { artists: new Set(), genres: new Set(), ids: new Set(ids) };
    if (ids.length === 0) return out;
    const { data: rows } = await supabaseAdmin
      .from("tracks").select("id, uploader_username, genres").in("id", ids);
    for (const t of (rows || [])) {
      if (t.uploader_username) out.artists.add(t.uploader_username);
      const gs = Array.isArray(t.genres) ? t.genres : [];
      for (const g of gs) if (g) out.genres.add(g);
    }
    return out;
  }

  const [likedTaste, playedTaste] = await Promise.all([
    collectTaste(myLikedIds),
    collectTaste(myPlayedIds),
  ]);

  return {
    me,
    username,
    followingUsernames,
    followingIds,
    myFollowers,
    followedArtists,
    likedIds: myLikedIds,
    playedIds: myPlayedIds,
    likedArtists: likedTaste.artists,
    likedGenres: likedTaste.genres,
    playedArtists: playedTaste.artists,
    playedGenres: playedTaste.genres,
  };
}

async function profileMapFor(usernames) {
  const map = {};
  if (!usernames || usernames.length === 0) return map;
  const { data } = await supabaseAdmin.from("profiles")
    .select("username, display_name, avatar_url, role").in("username", usernames);
  for (const p of (data || [])) map[p.username] = p;
  return map;
}

function publicUser(profile, extra = {}) {
  if (!profile) return null;
  return {
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url || null,
    isArtist: profile.role === "artist" || null,
    ...extra,
  };
}

/* ─────────────────────────────────────────────────────────────────────
 * Sections
 * ───────────────────────────────────────────────────────────────────── */

// "Friends are listening" — recent TRACK_PLAYED activity from followed users
async function friendsListening(ctx) {
  if (ctx.followingUsernames.length === 0) return [];
  const { data: events } = await supabaseAdmin
    .from("activity_events")
    .select("username, target_id, created_at")
    .eq("event_type", "TRACK_PLAYED")
    .in("username", ctx.followingUsernames)
    .gte("created_at", NOW_14D())
    .order("created_at", { ascending: false })
    .limit(12);
  if (!events || events.length === 0) return [];

  const trackIds = [...new Set(events.map((e) => e.target_id).filter(Boolean))];
  const { data: trackRows } = await supabaseAdmin.from("tracks").select("*").in("id", trackIds);
  const trackObj = {};
  for (const t of (trackRows || [])) trackObj[t.id] = t;

  const profiles = await profileMapFor([...new Set(events.map((e) => e.username))]);

  const items = [];
  for (const ev of events) {
    const t = trackObj[ev.target_id];
    if (!t || t.status !== "approved") continue;
    const shaped = await shapeTrack(t);
    if (!shaped) continue;
    items.push({
      person: publicUser(profiles[ev.username], { mutual: ctx.myFollowers.has(ev.username) }),
      track: shaped,
      heardAt: ev.created_at,
    });
    if (items.length >= 6) break;
  }
  return items;
}

// "New from artists you follow" — latest approved tracks from followed artists
async function fromArtistsYouFollow(ctx) {
  if (ctx.followedArtists.size === 0) return [];
  const { data: rows } = await supabaseAdmin
    .from("tracks").select("*")
    .in("uploader_username", [...ctx.followedArtists])
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);
  const out = [];
  for (const r of (rows || [])) {
    const shaped = await shapeTrack(r);
    if (shaped) {
      shaped.reasons = ["Nghệ sĩ bạn theo dõi phát hành mới"];
      out.push(shaped);
    }
    if (out.length >= 6) break;
  }
  return out;
}

// "Trending in your circle" — tracks with activity from ≥2 followed users
async function trendingInCircle(ctx) {
  if (ctx.followingUsernames.length === 0) return [];
  const { data: events } = await supabaseAdmin
    .from("activity_events")
    .select("event_type, username, target_id")
    .in("event_type", ["TRACK_LIKED", "TRACK_PLAYED"])
    .in("username", ctx.followingUsernames)
    .gte("created_at", NOW_14D());
  if (!events || events.length < 2) return [];

  const weights = { TRACK_LIKED: 12, TRACK_PLAYED: 10 };
  const scores = {}; // track -> { score, people:Set, liked:Set }
  for (const ev of events) {
    if (!ev.target_id || !ev.username) continue;
    const s = scores[ev.target_id] || (scores[ev.target_id] = { score: 0, people: new Set(), liked: new Set() });
    s.score += weights[ev.event_type] || 5;
    s.people.add(ev.username);
    if (ev.event_type === "TRACK_LIKED") s.liked.add(ev.username);
  }

  const ranked = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .filter(({ s }) => s.people.size >= 2)
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, 8);

  if (ranked.length === 0) return [];

  const { data: trackRows } = await supabaseAdmin.from("tracks").select("*").in("id", ranked.map((r) => r.id));
  const trackObj = {};
  for (const t of (trackRows || [])) trackObj[t.id] = t;

  const out = [];
  for (const { id, s } of ranked) {
    const row = trackObj[id];
    if (!row || row.status !== "approved") continue;
    const shaped = await shapeTrack(row);
    if (!shaped) continue;
    const n = s.people.size;
    shaped.reasons = [
      s.liked.size >= 2
        ? `${s.liked.size} người bạn theo dõi thích bài này`
        : `${n} người bạn theo dõi nghe bài này`,
    ];
    shaped.trendingInCircle = n;
    out.push(shaped);
  }
  return out;
}

// "Shared with you" — SHARED events from followed users (tracks / playlists)
async function sharedWithYou(ctx) {
  if (ctx.followingUsernames.length === 0) return [];
  const { data: events } = await supabaseAdmin
    .from("activity_events")
    .select("event_type, username, target_type, target_id, metadata, created_at")
    .eq("event_type", "SHARED")
    .in("username", ctx.followingUsernames)
    .order("created_at", { ascending: false })
    .limit(12);
  if (!events || events.length === 0) return [];

  const profiles = await profileMapFor([...new Set(events.map((e) => e.username))]);
  const out = [];
  const seen = new Set();

  for (const ev of events) {
    const key = `${ev.target_type}:${ev.target_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let item = null;
    if (ev.target_type === "track" || ev.target_type === "song") {
      const { data: t } = await supabaseAdmin.from("tracks").select("*").eq("id", ev.target_id).maybeSingle();
      if (t && t.status === "approved") {
        const shaped = await shapeTrack(t);
        if (shaped) {
          shaped.reasons = ["Được " + (profiles[ev.username]?.display_name || ev.username) + " chia sẻ gần đây"];
          item = { type: "track", track: shaped, by: publicUser(profiles[ev.username]) };
        }
      }
    } else if (ev.target_type === "playlist") {
      const { data: p } = await supabaseAdmin.from("playlists").select("*").eq("id", Number(ev.target_id)).maybeSingle();
      if (p && p.is_public) {
        item = {
          type: "playlist",
          playlist: await shapePlaylist(p),
          by: publicUser(profiles[ev.username]),
          reasons: ["Playlist được " + (profiles[ev.username]?.display_name || ev.username) + " chia sẻ"],
        };
      }
    }
    if (item) out.push(item);
    if (out.length >= 6) break;
  }
  return out;
}

// "Public playlists from people you follow"
async function playlistsFromNetwork(ctx) {
  if (ctx.followingUsernames.length === 0) return [];
  const { data: rows } = await supabaseAdmin
    .from("playlists")
    .select("id, owner_username, title, cover_url, track_count, is_public, created_at, updated_at")
    .eq("is_public", true)
    .in("owner_username", ctx.followingUsernames)
    .order("updated_at", { ascending: false })
    .limit(8);
  const out = [];
  for (const r of (rows || [])) {
    const shaped = await shapePlaylist(r);
    if (shaped) out.push(shaped);
    if (out.length >= 6) break;
  }
  return out;
}

// "Active rooms from people you follow"
async function roomsFromNetwork(ctx) {
  if (ctx.followingUsernames.length === 0) return [];
  const { data: rows } = await supabaseAdmin
    .from("rooms").select("*")
    .eq("status", "active")
    .eq("privacy", "public")
    .in("host_username", ctx.followingUsernames)
    .order("updated_at", { ascending: false })
    .limit(6);
  if (!rows || rows.length === 0) return [];

  const roomIds = rows.map((r) => r.id);
  const { data: counts } = await supabaseAdmin
    .from("room_participants").select("room_id").in("room_id", roomIds);
  const countMap = {};
  for (const c of (counts || [])) countMap[c.room_id] = (countMap[c.room_id] || 0) + 1;

  const hosts = await profileMapFor([...new Set(rows.map((r) => r.host_username))]);

  const out = [];
  for (const r of rows) {
    let song = null;
    if (r.current_track_id) {
      const { data: t } = await supabaseAdmin.from("tracks").select("*").eq("id", r.current_track_id).maybeSingle();
      if (t) song = await shapeTrack(t);
    }
    out.push({
      id: r.id,
      name: r.name,
      host: publicUser(hosts[r.host_username]),
      song: song ? { id: song.id, title: song.title, artist: song.primaryArtistName || song.uploaderDisplayName, coverUrl: song.coverUrl } : null,
      participantCount: countMap[r.id] || 1,
      reasons: ["Phòng từ " + (hosts[r.host_username]?.display_name || r.host_username)],
    });
  }
  return out;
}

// "Because you liked..." — tracks sharing artists/genres with liked songs
async function becauseYouLiked(ctx) {
  const tasteArtists = ctx.likedArtists.size > 0 || ctx.playedArtists.size > 0;
  const tasteGenres = ctx.likedGenres.size > 0 || ctx.playedGenres.size > 0;
  if (!tasteArtists && !tasteGenres) return [];

  const { data: candidates } = await supabaseAdmin
    .from("tracks").select("*")
    .eq("status", "approved")
    .order("play_count", { ascending: false })
    .limit(200);

  const exclude = new Set([...ctx.likedIds, ...ctx.playedIds]);
  const likedArtists = ctx.likedArtists, playedArtists = ctx.playedArtists;
  const likedGenres = ctx.likedGenres, playedGenres = ctx.playedGenres;

  const scored = [];
  for (const t of (candidates || [])) {
    if (exclude.has(t.id)) continue;
    let score = 0;
    const reasons = [];
    const tGenres = Array.isArray(t.genres) ? t.genres : [];

    if (likedArtists.has(t.uploader_username)) { score += 10; reasons.push("Cùng nghệ sĩ bạn thích"); }
    if (playedArtists.has(t.uploader_username)) { score += 8; reasons.push("Nghệ sĩ bạn từng nghe"); }

    const genresFromTaste = tGenres.filter((g) => likedGenres.has(g));
    if (genresFromTaste.length > 0) { score += genresFromTaste.length * 6; reasons.push("Cùng thể loại bạn thích: " + genresFromTaste[0]); }
    const playedGenreHits = tGenres.filter((g) => likedGenres.has(g) || playedGenres.has(g)).length;
    if (!genresFromTaste.length && playedGenreHits > 0) { score += playedGenreHits * 4; }

    score += (t.play_count || 0) * 0.05;
    if (score > 0) scored.push({ t, score, reasons: reasons.slice(0, 2) });
  }
  scored.sort((a, b) => b.score - a.score);

  const out = [];
  for (const { t, reasons } of scored.slice(0, 8)) {
    const shaped = await shapeTrack(t);
    if (shaped) {
      shaped.reasons = reasons;
      out.push(shaped);
    }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
 * People + taste discovery (one batched computation, two sections)
 * ───────────────────────────────────────────────────────────────────── */
async function peopleAndTaste(ctx) {
  // Candidate pool: people who follow me + followers of people I follow.
  let candidates = new Set(ctx.myFollowers);
  if (ctx.followingIds.length > 0) {
    const { data: twoHop } = await supabaseAdmin
      .from("user_follows").select("follower_username")
      .in("following_id", ctx.followingIds);
    for (const r of (twoHop || [])) if (r.follower_username) candidates.add(r.follower_username);
  }
  // A few recently active people as fallback when pool is thin.
  if (candidates.size < 12) {
    const { data: active } = await supabaseAdmin
      .from("activity_events").select("username")
      .gte("created_at", NOW_30D())
      .order("created_at", { ascending: false })
      .limit(40);
    for (const r of (active || [])) candidates.add(r.username);
  }

  for (const u of [ctx.username, ...ctx.followingUsernames]) candidates.delete(u);
  const list = [...candidates].slice(0, 40);
  if (list.length === 0) return { people: [], taste: [] };

  const profiles = await profileMapFor(list);

  // Batch taste signals for all candidates.
  const [candArtistFollows, candTrackLikes, candRecentActivity] = await Promise.all([
    supabaseAdmin.from("artist_follows").select("follower_username, artist_username").in("follower_username", list),
    supabaseAdmin.from("track_likes").select("username, track_id").in("username", list),
    supabaseAdmin.from("activity_events").select("username").in("username", list).gte("created_at", NOW_30D()),
  ]);

  const activeSet = new Set((candRecentActivity.data || []).map((r) => r.username));

  // Map liked track -> uploader/genres (mentions) for candidate likes.
  const candLikeMap = {}; // username -> Set<trackId>
  for (const l of (candTrackLikes.data || [])) {
    (candLikeMap[l.username] = candLikeMap[l.username] || new Set()).add(l.track_id);
  }
  const allLikedIds = [...new Set(Object.values(candLikeMap).flatMap((s) => [...s]))];
  const likeTrackInfo = {};
  if (allLikedIds.length > 0) {
    const { data: rows } = await supabaseAdmin.from("tracks")
      .select("id, uploader_username, genres").in("id", allLikedIds);
    for (const t of (rows || [])) likeTrackInfo[t.id] = t;
  }

  function tasteStats(username) {
    const artists = new Set();
    const genres = new Set();
    const likeIds = candLikeMap[username] || new Set();
    for (const id of likeIds) {
      const info = likeTrackInfo[id];
      if (!info) continue;
      if (info.uploader_username) artists.add(info.uploader_username);
      const gs = Array.isArray(info.genres) ? info.genres : [];
      for (const g of gs) if (g) genres.add(g);
    }
    const followedArtists = new Set();
    for (const af of (candArtistFollows.data || [])) {
      if (af.follower_username === username) followedArtists.add(af.artist_username);
    }
    return { artists, genres, followedArtists };
  }

  const rows = [];
  for (const username of list) {
    const s = tasteStats(username);
    const sharedArtists = [...new Set([...s.artists, ...s.followedArtists])]
      .filter((a) => ctx.likedArtists.has(a) || ctx.playedArtists.has(a) || ctx.followedArtists.has(a));
    const sharedGenres = [...s.genres].filter((g) => ctx.likedGenres.has(g) || ctx.playedGenres.has(g));
    const sharedLikedSongs = [...(candLikeMap[username] || [])].filter((id) => ctx.likedIds.includes(id)).length;
    const sharedItems = sharedArtists.length + sharedGenres.length + sharedLikedSongs;
    const mutual = ctx.myFollowers.has(username);

    let score = 0;
    const reasons = [];
    if (mutual) { score += 12; reasons.push("Quan tâm lẫn nhau"); }
    if (sharedArtists.length > 0) { score += Math.min(20, sharedArtists.length * 10); reasons.push(`${Math.min(sharedArtists.length, 2)} nghệ sĩ chung`); }
    if (sharedGenres.length > 0) { score += Math.min(12, sharedGenres.length * 6); reasons.push(`Cùng thích thể loại ${sharedGenres[0]}`); }
    if (sharedLikedSongs >= 1) { score += Math.min(15, sharedLikedSongs * 3); reasons.push(`${sharedLikedSongs} bài bạn cùng thích`); }
    if (activeSet.has(username)) { score += 5; reasons.push("Hoạt động gần đây"); }
    if (profiles[username]?.role === "artist") { score += 3; }

    const shared = [
      ...sharedArtists.slice(0, 2).map((a) => ({ type: "artist", name: a })),
      ...sharedGenres.slice(0, 2).map((g) => ({ type: "genre", name: g })),
    ];
    const match = sharedItems >= 3 ? Math.min(95, Math.round((15 + sharedItems * 12) / 5) * 5) : null;

    if (!profiles[username]) continue;
    rows.push({ username, profile: publicUser(profiles[username], { mutual }), shared, sharedItems, match, score, reasons, mutual });
  }

  rows.sort((a, b) => b.score - a.score);

  const people = rows
    .filter((r) => !r.profile.isArtist)
    .slice(0, 8)
    .map(({ profile, sharedItems, reasons, match }) => ({
      ...profile,
      sharedItems,
      reasons: reasons.slice(0, 2),
      match,
    }));

  const taste = rows
    .filter((r) => r.sharedItems >= 2)
    .slice(0, 5)
    .map(({ profile, shared, sharedItems, match, reasons }) => ({
      ...profile,
      similarIn: shared.slice(0, 2),
      sharedItems,
      match,
      reasons: reasons.slice(0, 2),
    }));

  return { people, taste };
}

/* ─────────────────────────────────────────────────────────────────────
 * Routes
 * ───────────────────────────────────────────────────────────────────── */

// GET /api/discover/social — the Discovery 2.0 payload
router.get("/social", requireAuth, socialLimit, async (req, res) => {
  try {
    const ctx = await buildContext(req.user.username);
    if (!ctx) return res.json({ hasSocialData: false, sections: {} });

    const hasNetwork = ctx.followingUsernames.length > 0 || ctx.followedArtists.size > 0;
    const [friends, fromArtists, circle, shared, playlists, rooms, because, peopleAndTasteRes] = await Promise.all([
      friendsListening(ctx),
      fromArtistsYouFollow(ctx),
      trendingInCircle(ctx),
      sharedWithYou(ctx),
      playlistsFromNetwork(ctx),
      roomsFromNetwork(ctx),
      becauseYouLiked(ctx),
      peopleAndTaste(ctx),
    ]);

    const sections = {};
    if (hasNetwork && friends.length > 0) sections.friendsListening = friends;
    if (fromArtists.length > 0) sections.fromArtistsYouFollow = fromArtists;
    if (circle.length > 0) sections.trendingInCircle = circle;
    if (hasNetwork && shared.length > 0) sections.sharedWithYou = shared;
    if (hasNetwork && playlists.length > 0) sections.playlistsFromNetwork = playlists;
    if (hasNetwork && rooms.length > 0) sections.roomsFromNetwork = rooms;
    if (because.length > 0) sections.becauseYouLiked = because;
    if (peopleAndTasteRes.people.length > 0) sections.peopleSuggestions = peopleAndTasteRes.people;
    if (peopleAndTasteRes.taste.length > 0) sections.tasteMatches = peopleAndTasteRes.taste;

    res.json({ hasSocialData: Object.keys(sections).length > 0, sections });
  } catch (e) {
    console.error("[social-discovery]", e);
    res.status(500).json({ error: "Không thể tải khám phá xã hội." });
  }
});

// POST /api/discover/click — analytics (reuses activity_events infra)
router.post("/click", requireAuth, clickLimit, async (req, res) => {
  const { section, type, id } = req.body || {};
  if (!section || !type || !id) return res.status(400).json({ error: "Thiếu thông tin." });
  recordActivity(req.user.username, "DISCOVERY_CLICK", type, String(id), { section }).catch(() => {});
  res.json({ ok: true });
});

export default router;