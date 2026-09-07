/**
 * 4ANG Artist Posts — Phase 2.4 "Artist Social 2.0"
 *
 * Official artist posts (text + music attachments: track / release /
 * playlist, incl. auto release announcements). Comments & reactions
 * REUSE the Phase 2.1 unified system (target_type = 'artist_post'),
 * so existing comment threads, notifications and moderation work as-is.
 *
 * Ownership is always derived from the authenticated artist identity
 * (artist_profiles.username), never from a client-supplied artist id.
 */
import express from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "../rateLimit.js";
import {
  supabaseAdmin,
  shapeArtistProfile,
  resolveUrl,
  createNotification,
  recordActivity,
} from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { sanitizeText, isBlank, shouldNotify } from "../social-helpers.js";

const router = express.Router();

const createLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "artist-posts" });
const viewLimiter = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "artist-post-views" });

// ────────────────────────────────────────────────────────────────
// Shared shaping
// ────────────────────────────────────────────────────────────────
export async function shapeArtistPosts(postRows, viewerUsername) {
  if (!postRows || postRows.length === 0) return [];

  const usernames = [...new Set(postRows.map((p) => p.artist_username).filter(Boolean))];
  const profiles = usernames.length > 0
    ? await supabaseAdmin.from("artist_profiles").select("*").in("username", usernames)
    : { data: [] };
  const profileMap = {};
  for (const ap of (profiles.data || [])) profileMap[ap.username] = ap;

  const trackIds = postRows.filter((p) => p.music_type === "track" && p.track_id).map((p) => p.track_id);
  const releaseIds = postRows.filter((p) => p.music_type === "release" && p.release_id).map((p) => p.release_id);
  const playlistIds = postRows.filter((p) => p.music_type === "playlist" && p.playlist_id).map((p) => p.playlist_id);

  const [tracks, releases, releaseTracks, playlists] = await Promise.all([
    trackIds.length > 0
      ? supabaseAdmin.from("tracks").select("id, title, cover_url, cover_path, duration, composer, uploader_display_name, uploader_username, credits").in("id", trackIds)
      : { data: [] },
    releaseIds.length > 0
      ? supabaseAdmin.from("releases").select("id, title, type, cover_url, cover_path, release_date, created_by_username").in("id", releaseIds)
      : { data: [] },
    releaseIds.length > 0
      ? supabaseAdmin.from("release_tracks").select("id, release_id, track_id").in("release_id", releaseIds)
      : { data: [] },
    playlistIds.length > 0
      ? supabaseAdmin.from("playlists").select("id, title, cover_url, cover_path, track_count, owner_username").in("id", playlistIds)
      : { data: [] },
  ]);

  const trackMap = {}; for (const t of (tracks.data || [])) trackMap[t.id] = t;
  const releaseMap = {}; for (const r of (releases.data || [])) releaseMap[r.id] = r;
  const releaseCounts = {};
  for (const rt of (releaseTracks.data || [])) {
    if (!releaseCounts[rt.release_id]) releaseCounts[rt.release_id] = 0;
    releaseCounts[rt.release_id]++;
  }
  const playlistMap = {}; for (const pl of (playlists.data || [])) playlistMap[pl.id] = pl;

  let reactedMap = {};
  if (viewerUsername && postRows.length > 0) {
    const ids = postRows.map((p) => p.id);
    const { data: reactions } = await supabaseAdmin
      .from("social_reactions")
      .select("target_id")
      .eq("target_type", "artist_post")
      .eq("username", viewerUsername)
      .in("target_id", ids);
    for (const r of (reactions || [])) reactedMap[r.target_id] = true;
  }

  return postRows.map((post) => {
    const profile = profileMap[post.artist_username];
    const shapedProfile = shapeArtistProfile(profile, {});
    let target = null;

    if (post.music_type === "track" && trackMap[post.track_id]) {
      const t = trackMap[post.track_id];
      const credits = typeof t.credits === "string" ? JSON.parse(t.credits || "[]") : (t.credits || []);
      target = {
        type: "track",
        id: t.id,
        title: t.title,
        artist: credits[0]?.artistName || t.composer || t.uploader_display_name || t.uploader_username,
        coverUrl: resolveUrl("artwork", t.cover_path || t.cover_url || null),
        duration: t.duration || 0,
      };
    } else if (post.music_type === "release" && releaseMap[post.release_id]) {
      const r = releaseMap[post.release_id];
      target = {
        type: "release",
        id: r.id,
        title: r.title,
        releaseType: r.type,
        coverUrl: resolveUrl("artwork", r.cover_path || r.cover_url || null),
        releaseDate: r.release_date || null,
        trackCount: releaseCounts[r.id] || 0,
      };
    } else if (post.music_type === "playlist" && playlistMap[post.playlist_id]) {
      const pl = playlistMap[post.playlist_id];
      target = {
        type: "playlist",
        id: pl.id,
        title: pl.title,
        coverUrl: resolveUrl("artwork", pl.cover_path || pl.cover_url || null),
        trackCount: pl.track_count || 0,
      };
    }

    const isAnnouncement = post.post_type === "release_announcement";
    const defaultMessage = isAnnouncement && target
      ? `Phát hành mới: ${target.title}`
      : null;

    return {
      id: post.id,
      kind: "artist_post",
      eventType: "ARTIST_POSTED",
      artistUsername: post.artist_username || null,
      displayName: shapedProfile?.artistName || profile?.username || post.artist_username || "Nghệ sĩ",
      avatarUrl: shapedProfile?.avatarUrl || null,
      badge: shapedProfile?.badge || null,
      body: post.body || null,
      message: post.body || defaultMessage,
      postType: post.post_type || "post",
      musicType: post.music_type || null,
      target,
      likeCount: post.like_count || 0,
      commentCount: post.comment_count || 0,
      reacted: !!reactedMap[post.id],
      viewCount: post.view_count || 0,
      isFeatured: !!post.is_featured,
      status: post.status,
      editedAt: post.edited_at || null,
      createdAt: typeof post.created_at === "number" ? post.created_at : new Date(post.created_at).getTime(),
    };
  });
}

// ────────────────────────────────────────────────────────────────
// Feed + follower notification (shared by create & announcements)
// ────────────────────────────────────────────────────────────────
async function publishToFeedAndNotify(postId, username, displayName, { message = null } = {}) {
  await recordActivity(username, "ARTIST_POSTED", "artist_post", postId, message ? { message } : null);

  const { data: followers } = await supabaseAdmin
    .from("artist_follows").select("follower_username")
    .eq("artist_username", username);
  const notifier = displayName || username;
  for (const f of (followers || [])) {
    if (!f.follower_username) continue;
    await createNotification(
      f.follower_username,
      "ARTIST_POSTED",
      "Bài đăng nghệ sĩ",
      `${notifier} vừa đăng bài trên 4ANG.`,
      { actorUsername: username, targetType: "artist_post", targetId: postId }
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Release announcement (called on ADMIN publish — application hook,
// idempotent: one announcement per release, no repeats on re-approve)
// ────────────────────────────────────────────────────────────────
export async function ensureReleaseAnnouncementForRelease(releaseRow) {
  if (!releaseRow || !releaseRow.created_by_username) return null;

  const { data: artist } = await supabaseAdmin
    .from("artist_profiles").select("*")
    .eq("username", releaseRow.created_by_username).maybeSingle();
  if (!artist) return null;

  // Idempotent: already announced?
  const { data: existing } = await supabaseAdmin
    .from("artist_posts").select("id")
    .eq("release_id", releaseRow.id)
    .eq("post_type", "release_announcement")
    .maybeSingle();
  if (existing) return existing.id;

  const postId = randomUUID();
  const { error } = await supabaseAdmin.from("artist_posts").insert({
    id: postId,
    artist_id: artist.user_id,
    artist_username: releaseRow.created_by_username,
    post_type: "release_announcement",
    music_type: "release",
    release_id: releaseRow.id,
    body: null,
    status: "published",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[artist-posts] release announcement insert:", error.message);
    return null;
  }
  await publishToFeedAndNotify(postId, releaseRow.created_by_username, artist.artist_name);
  return postId;
}

// ────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────

// Public list for an artist profile page.
router.get("/", async (req, res) => {
  try {
    const username = (req.query.username || "").trim();
    if (!username) return res.status(400).json({ error: "Thiếu username." });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 40);
    const before = req.query.before;
    const type = req.query.type;

    // Owner sees their drafts/hidden too; everyone else only published.
    const { data: artistProfile } = await supabaseAdmin
      .from("artist_profiles").select("*").eq("username", username).maybeSingle();
    if (!artistProfile) return res.json({ posts: [] });
    const isOwner = req.user?.username === username;

    let query = supabaseAdmin.from("artist_posts").select("*").eq("artist_username", username);
    if (type && type !== "all") query = query.eq("post_type", type);
    if (!isOwner) query = query.eq("status", "published");
    query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (before) query = query.lt("created_at", before);

    const { data: rows } = await query;
    const posts = await shapeArtistPosts(rows || [], req.user?.username || null);
    res.json({ posts, hasMore: (rows || []).length === limit });
  } catch (e) {
    console.error("[artist-posts.list]", e);
    res.status(500).json({ error: "Không thể tải bài đăng." });
  }
});

// Owner's posts (studio) — every status.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { data: artist } = await supabaseAdmin
      .from("artist_profiles").select("username").eq("username", req.user.username).maybeSingle();
    if (!artist) return res.status(403).json({ error: "Chỉ nghệ sĩ mới xem được danh sách này." });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 60);
    const before = req.query.before;
    let query = supabaseAdmin
      .from("artist_posts").select("*")
      .eq("artist_username", req.user.username)
      .order("created_at", { ascending: false }).limit(limit);
    if (before) query = query.lt("created_at", before);
    const { data: rows } = await query;
    const posts = await shapeArtistPosts(rows || [], req.user.username);
    res.json({ posts, hasMore: (rows || []).length === limit });
  } catch (e) {
    console.error("[artist-posts.mine]", e);
    res.status(500).json({ error: "Không thể tải bài đăng." });
  }
});

// Create a post (artist only).
router.post("/", requireAuth, createLimiter, async (req, res) => {
  try {
    const { data: artist } = await supabaseAdmin
      .from("artist_profiles").select("*").eq("username", req.user.username).maybeSingle();
    if (!artist) {
      return res.status(403).json({ error: "Chỉ nghệ sĩ mới có thể đăng bài." });
    }

    const rawBody = req.body?.body;
    const content = sanitizeText(rawBody, 500);
    const musicType = req.body?.musicType;

    let attachType = null;
    let attachId = null;

    if (musicType) {
      if (!["track", "release", "playlist"].includes(musicType)) {
        return res.status(400).json({ error: "Loại nhạc không hợp lệ." });
      }
      const musicId = String(req.body?.musicId || "").trim();
      if (!musicId) return res.status(400).json({ error: "Thiếu tác phẩm." });

      if (musicType === "track") {
        const { data: track } = await supabaseAdmin
          .from("tracks").select("id, status, uploader_username").eq("id", musicId).maybeSingle();
        if (!track) return res.status(404).json({ error: "Bài hát không tồn tại." });
        if (track.uploader_username !== req.user.username) {
          return res.status(403).json({ error: "Chỉ có thể đăng nhạc của chính nghệ sĩ." });
        }
        if (track.status !== "approved") {
          return res.status(409).json({ error: "Bài hát chưa được phát hành." });
        }
        attachType = "track"; attachId = musicId;
      } else if (musicType === "release") {
        const { data: release } = await supabaseAdmin
          .from("releases").select("id, status, created_by_username").eq("id", musicId).maybeSingle();
        if (!release) return res.status(404).json({ error: "Phát hành không tồn tại." });
        if (release.created_by_username !== req.user.username) {
          return res.status(403).json({ error: "Chỉ có thể đăng nhạc của chính nghệ sĩ." });
        }
        if (release.status !== "published") {
          return res.status(409).json({ error: "Phát hành chưa được duyệt." });
        }
        attachType = "release"; attachId = musicId;
      } else {
        const { data: playlist } = await supabaseAdmin
          .from("playlists").select("id, owner_username").eq("id", musicId).maybeSingle();
        if (!playlist) return res.status(404).json({ error: "Playlist không tồn tại." });
        if (playlist.owner_username !== req.user.username) {
          return res.status(403).json({ error: "Chỉ có thể đăng nhạc của chính nghệ sĩ." });
        }
        attachType = "playlist"; attachId = musicId;
      }
    }

    if (!attachType && isBlank(content)) {
      return res.status(400).json({ error: "Nội dung bài đăng trống." });
    }

    const postId = randomUUID();
    const row = {
      id: postId,
      artist_id: artist.user_id,
      artist_username: req.user.username,
      post_type: "post",
      music_type: attachType,
      track_id: attachType === "track" ? attachId : null,
      release_id: attachType === "release" ? attachId : null,
      playlist_id: attachType === "playlist" ? attachId : null,
      body: attachType ? (content || null) : content,
      status: "published",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("artist_posts").insert(row);
    if (error) {
      console.error("[artist-posts.create]", error.message);
      return res.status(500).json({ error: "Không thể đăng bài." });
    }

    const { data: inserted } = await supabaseAdmin
      .from("artist_posts").select("*").eq("id", postId).single();
    await publishToFeedAndNotify(postId, req.user.username, artist.artist_name, {
      message: content || null,
    });

    const shaped = await shapeArtistPosts(inserted ? [inserted] : [], req.user.username);
    res.status(201).json({ post: shaped[0] || null });
  } catch (e) {
    console.error("[artist-posts.create]", e);
    res.status(500).json({ error: "Không thể đăng bài." });
  }
});

// Single post detail (published, or the owner).
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from("artist_posts").select("*").eq("id", req.params.id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    const isOwner = post.artist_username === req.user.username;
    if (post.status === "deleted") return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    if (!isOwner && post.status !== "published") {
      return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    }
    const shaped = await shapeArtistPosts([post], req.user.username);
    res.json({ post: shaped[0] || null });
  } catch (e) {
    console.error("[artist-posts.detail]", e);
    res.status(500).json({ error: "Không thể tải bài đăng." });
  }
});

// Edit own post: body, featured, status (music attachments immutable).
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from("artist_posts").select("*").eq("id", req.params.id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    if (post.artist_username !== req.user.username) {
      return res.status(403).json({ error: "Không có quyền sửa bài đăng này." });
    }

    const updates = {};
    if (req.body?.body !== undefined) {
      const content = sanitizeText(req.body.body, 500);
      if (content.length === 0 && !post.music_type) {
        return res.status(400).json({ error: "Nội dung bài đăng trống." });
      }
      updates.body = content || null;
    }
    if (req.body?.is_featured !== undefined) updates.is_featured = !!req.body.is_featured;
    if (req.body?.status !== undefined) {
      if (!["published", "hidden", "deleted"].includes(req.body.status)) {
        return res.status(400).json({ error: "Trạng thái không hợp lệ." });
      }
      if (req.body.status === "deleted") {
        await supabaseAdmin.from("activity_events")
          .delete().eq("target_type", "artist_post").eq("target_id", post.id);
      }
      updates.status = req.body.status;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Không có gì để cập nhật." });
    }
    updates.edited_at = new Date().toISOString();
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from("artist_posts")
      .update(updates).eq("id", post.id);
    if (error) return res.status(500).json({ error: "Không thể cập nhật bài đăng." });

    const { data: updated } = await supabaseAdmin
      .from("artist_posts").select("*").eq("id", post.id).single();
    const shaped = await shapeArtistPosts(updated ? [updated] : [], req.user.username);
    res.json({ post: shaped[0] || null });
  } catch (e) {
    console.error("[artist-posts.patch]", e);
    res.status(500).json({ error: "Không thể cập nhật bài đăng." });
  }
});

// Soft-delete own post (removes it from the feed).
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from("artist_posts").select("*").eq("id", req.params.id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    if (post.artist_username !== req.user.username) {
      return res.status(403).json({ error: "Không có quyền xoá bài đăng này." });
    }
    await supabaseAdmin.from("activity_events")
      .delete().eq("target_type", "artist_post").eq("target_id", post.id);
    await supabaseAdmin.from("artist_posts").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", post.id);
    res.json({ ok: true });
  } catch (e) {
    console.error("[artist-posts.delete]", e);
    res.status(500).json({ error: "Không thể xoá bài đăng." });
  }
});

// Toggle reaction (unified social_reactions, target_type 'artist_post').
router.post("/:id/react", requireAuth, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from("artist_posts").select("id, status, artist_username").eq("id", req.params.id).maybeSingle();
    if (!post || post.status === "deleted") {
      return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    }
    if (post.status !== "published" && post.artist_username !== req.user.username) {
      return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    }

    const { data: existing } = await supabaseAdmin
      .from("social_reactions")
      .select("id")
      .eq("target_type", "artist_post")
      .eq("target_id", post.id)
      .eq("username", req.user.username)
      .maybeSingle();

    let reacted = true;
    if (existing) {
      await supabaseAdmin.from("social_reactions").delete().eq("id", existing.id);
      reacted = false;
    } else {
      const { error: insErr } = await supabaseAdmin.from("social_reactions").insert({
        target_type: "artist_post",
        target_id: post.id,
        username: req.user.username,
        created_at: new Date().toISOString(),
      });
      if (insErr && !String(insErr.message || "").includes("duplicate")) {
        console.error("[artist-posts.react.insert]", insErr);
        return res.status(500).json({ error: "Không thể thả tym." });
      }
    }

    if (reacted && req.user.username !== post.artist_username) {
      const notify = await shouldNotify(post.artist_username, req.user.username, "POST_LIKED", "artist_post", post.id);
      if (notify) {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("display_name").eq("username", req.user.username).maybeSingle();
        await createNotification(
          post.artist_username, "POST_LIKED", "Yêu thích bài đăng",
          `${profile?.display_name || req.user.username} đã thích bài đăng của bạn.`,
          { actorUsername: req.user.username, targetType: "artist_post", targetId: post.id }
        );
      }
    }

    const { data: updated } = await supabaseAdmin
      .from("artist_posts").select("like_count").eq("id", post.id).single();
    res.json({ reacted, likeCount: updated?.like_count || 0 });
  } catch (e) {
    console.error("[artist-posts.react]", e);
    res.status(500).json({ error: "Không thể thả tym." });
  }
});

// Increment view count (client throttles; server simple counter).
router.post("/:id/view", requireAuth, viewLimiter, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from("artist_posts").select("id, view_count").eq("id", req.params.id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    await supabaseAdmin.from("artist_posts")
      .update({ view_count: (post.view_count || 0) + 1 }).eq("id", post.id);
    res.json({ ok: true, viewCount: (post.view_count || 0) + 1 });
  } catch (e) {
    console.error("[artist-posts.view]", e);
    res.status(500).json({ error: "Không thể tăng lượt xem." });
  }
});

// Toggle featured (own post).
router.post("/:id/pin", requireAuth, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from("artist_posts").select("id, is_featured, artist_username").eq("id", req.params.id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài đăng." });
    if (post.artist_username !== req.user.username) {
      return res.status(403).json({ error: "Không có quyền ghim bài đăng này." });
    }
    const next = !post.is_featured;
    await supabaseAdmin.from("artist_posts").update({ is_featured: next, updated_at: new Date().toISOString() }).eq("id", post.id);
    res.json({ ok: true, isFeatured: next });
  } catch (e) {
    console.error("[artist-posts.pin]", e);
    res.status(500).json({ error: "Không thể ghim bài đăng." });
  }
});

// Admin moderation: hide a post.
router.post("/admin/:id/hide", requireAuth, requireAdmin, async (req, res) => {
  const { data: post } = await supabaseAdmin
    .from("artist_posts").select("id, status, artist_username").eq("id", req.params.id).maybeSingle();
  if (!post) return res.status(404).json({ error: "Không tìm thấy bài đăng." });
  await supabaseAdmin.from("artist_posts").update({ status: "hidden", updated_at: new Date().toISOString() }).eq("id", post.id);
  res.json({ ok: true });
});

export default router;