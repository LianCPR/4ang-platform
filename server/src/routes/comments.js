/**
 * 4ANG Comments Routes — unified comment system (Phase 2.1)
 *
 * Supports comments + one-level replies + reactions on any supported
 * target: track, playlist, album, post (activity_events) and user.
 * All content is sanitised server-side; mentions are validated against
 * real users and produce notifications.
 */
import express from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";
import { recordActivity, createNotification } from "../db.js";
import { rateLimit } from "../rateLimit.js";
import {
  sanitizeText, isBlank, extractMentions, shouldNotify,
  getProfilesByUsernames,
} from "../social-helpers.js";

const router = express.Router();

const COMMENT_LIMIT = 500;
const REPLY_LIMIT = 500;

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

// Build the reaction membership map for a set of comment ids for the
// current user + like counts (from counters).
async function reactionsForComments(ids, username) {
  const map = {};
  if (ids.length === 0) return { reacted: map, counts: {} };
  const { data } = await supabaseAdmin
    .from("social_reactions")
    .select("target_id, username")
    .eq("target_type", "comment")
    .in("target_id", ids);
  for (const r of (data || [])) {
    if (r.username === username) map[r.target_id] = true;
  }
  return { reacted: map };
}

async function shapeComments(rows, viewer) {
  if (!rows || rows.length === 0) return [];
  const authors = await getProfilesByUsernames(rows.map((c) => c.author_username));
  const ids = rows.map((c) => c.id);
  const { reacted } = await reactionsForComments(ids, viewer);
  return rows.map((c) => {
    const p = authors[c.author_username] || {};
    return {
      id: c.id,
      targetType: c.target_type,
      targetId: c.target_id,
      parentId: c.parent_id || null,
      authorUsername: c.author_username,
      authorDisplayName: c.author_display_name || p.display_name || c.author_username,
      authorAvatar: p.avatar_url || null,
      isAuthor: viewer === c.author_username,
      text: c.is_deleted ? null : c.text,
      isDeleted: !!c.is_deleted,
      edited: !!c.edited_at,
      createdAt: typeof c.created_at === "string" ? new Date(c.created_at).getTime() : c.created_at,
      editedAt: c.edited_at ? (typeof c.edited_at === "string" ? new Date(c.edited_at).getTime() : c.edited_at) : null,
      likeCount: c.like_count || 0,
      replyCount: c.reply_count || 0,
      reacted: !!reacted[c.id],
      replies: [],
    };
  });
}

// ────────────────────────────────────────────────────────────────
// List comments for a target (with replies, paginated)
// ────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    if (!targetType || !targetId) return res.status(400).json({ error: "Thiếu thông tin." });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 50);
    const before = req.query.before; // cursor: top-level comment created_at

    let query = supabaseAdmin
      .from("social_comments")
      .select("*")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Cursor pagination: before expects an ISO timestamp (inclusive filter)
    if (before) query = query.lt("created_at", before);

    const { data } = await query;
    const topComments = (data || []).filter((c) => !c.is_deleted || true);

    // Load replies for the returned top-level comments
    let replies = [];
    if (topComments.length > 0) {
      const parentIds = topComments.map((c) => c.id);
      const { data: replyRows } = await supabaseAdmin
        .from("social_comments")
        .select("*")
        .in("parent_id", parentIds)
        .order("created_at", { ascending: true });
      const shapedReplies = await shapeComments(replyRows || [], req.user?.username || "__anon__");
      const replyMap = {};
      for (const r of shapedReplies) {
        if (!replyMap[r.parentId]) replyMap[r.parentId] = [];
        replyMap[r.parentId].push(r);
      }
      replies = replyMap;
    }

    const shaped = await shapeComments(topComments, req.user?.username || "__anon__");
    for (const c of shaped) c.replies = replies[c.id] || [];

    const totalResult = await supabaseAdmin
      .from("social_comments")
      .select("id", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .is("parent_id", null);
    const total = totalResult.count || 0;

    res.json({
      comments: shaped,
      hasMore: shaped.length === limit,
      total,
    });
  } catch (e) {
    console.error("[comments.list]", e);
    res.status(500).json({ error: "Không thể tải bình luận." });
  }
});

// ────────────────────────────────────────────────────────────────
// Create a comment on a target / reply to a comment
// ────────────────────────────────────────────────────────────────
const createLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "comments" });

router.post("/", requireAuth, createLimiter, async (req, res) => {
  try {
    const { targetType, targetId, parentId, text } = req.body || {};
    const content = sanitizeText(text, COMMENT_LIMIT);
    if (!targetType || !targetId) return res.status(400).json({ error: "Thiếu thông tin." });
    if (isBlank(content)) return res.status(400).json({ error: "Bình luận trống." });

    // Resolve author display name
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("display_name").eq("username", req.user.username).maybeSingle();
    const authorDisplayName = profile?.display_name || req.user.username;

    const isReply = !!parentId;

    // If replying, verify the parent comment exists and matches the target
    if (isReply) {
      const { data: parent } = await supabaseAdmin
        .from("social_comments").select("id, target_type, target_id, author_username")
        .eq("id", parentId).maybeSingle();
      if (!parent) return res.status(404).json({ error: "Bình luận gốc không tồn tại." });
      if (parent.target_id !== String(targetId) || parent.target_type !== targetType) {
        return res.status(400).json({ error: "Bình luận gốc không hợp lệ." });
      }
    }

    // Duplicate detection (anti-spam): same author + same text + same target
    // within 60s.
    const dupSince = new Date(Date.now() - 60_000).toISOString();
    const { data: dup } = await supabaseAdmin
      .from("social_comments")
      .select("id")
      .eq("author_username", req.user.username)
      .eq("target_type", targetType)
      .eq("target_id", String(targetId))
      .eq("text", content)
      .gte("created_at", dupSince)
      .limit(1);
    if (dup && dup.length > 0) {
      return res.status(429).json({ error: "Bạn vừa gửi bình luận này. Hãy chờ một chút." });
    }

    const id = randomUUID();
    const { error } = await supabaseAdmin.from("social_comments").insert({
      id,
      target_type: targetType,
      target_id: String(targetId),
      parent_id: isReply ? parentId : null,
      author_id: req.user.id,
      author_username: req.user.username,
      author_display_name: authorDisplayName,
      text: content,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[comments.create]", error);
      return res.status(500).json({ error: "Không thể lưu bình luận." });
    }

    // Notifications: mention extraction + reply notification
    try {
      const mentions = await extractMentions(content);
      const mentionTargets = new Set(mentions.map((m) => m.username.toLowerCase()));

      if (isReply) {
        const { data: parent } = await supabaseAdmin
          .from("social_comments").select("author_username, text").eq("id", parentId).single();
        const replyTo = parent?.author_username;
        const notify = await shouldNotify(replyTo, req.user.username, "COMMENT_REPLY", targetType, String(targetId));
        if (notify) {
          await createNotification(replyTo, "COMMENT_REPLY", "Trả lời bình luận",
            `${authorDisplayName} đã trả lời bình luận của bạn.`,
            { actorUsername: req.user.username, targetType, targetId: String(targetId), commentId: id });
        }
        // Notify other mentioned users
        for (const mt of mentionTargets) {
          if (mt === String(replyTo || "").toLowerCase()) continue;
          const ok = await shouldNotify(mt, req.user.username, "MENTION", targetType, String(targetId));
          if (ok) {
            await createNotification(mt, "MENTION", "Bạn được nhắc đến",
              `${authorDisplayName} đã nhắc đến bạn trong một bình luận.`,
              { actorUsername: req.user.username, targetType, targetId: String(targetId), commentId: id });
          }
        }
      } else {
        // Top-level comment on an artist post → notify the artist (Phase 2.4).
        if (targetType === "artist_post") {
          const { data: ap } = await supabaseAdmin
            .from("artist_posts").select("artist_username, artist_id")
            .eq("id", String(targetId)).maybeSingle();
          if (ap) {
            const notify = await shouldNotify(ap.artist_username, req.user.username, "NEW_COMMENT", "artist_post", String(targetId));
            if (notify) {
              await createNotification(ap.artist_username, "NEW_COMMENT", "Bình luận mới",
                `${authorDisplayName} đã bình luận bài đăng của bạn.`,
                { actorUsername: req.user.username, targetType: "artist_post", targetId: String(targetId), commentId: id });
            }
          }
        }
        for (const mt of mentionTargets) {
          const ok = await shouldNotify(mt, req.user.username, "MENTION", targetType, String(targetId));
          if (ok) {
            await createNotification(mt, "MENTION", "Bạn được nhắc đến",
              `${authorDisplayName} đã nhắc đến bạn trong một bình luận.`,
              { actorUsername: req.user.username, targetType, targetId: String(targetId), commentId: id });
          }
        }
      }
    } catch (e) {
      console.error("[comments.notify]", e);
    }

    // Analytics
    recordActivity(req.user.username, "COMMENT_CREATED", targetType, String(targetId), parentId ? { isReply: true } : { isReply: false }).catch(() => {});

    res.status(201).json({ ok: true, id });
  } catch (e) {
    console.error("[comments.create]", e);
    res.status(500).json({ error: "Không thể lưu bình luận." });
  }
});

// ────────────────────────────────────────────────────────────────
// Edit own comment / reply
// ────────────────────────────────────────────────────────────────
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { text } = req.body || {};
    const content = sanitizeText(text, COMMENT_LIMIT);
    if (isBlank(content)) return res.status(400).json({ error: "Bình luận trống." });

    const { data: row } = await supabaseAdmin
      .from("social_comments").select("id, author_username, is_deleted")
      .eq("id", req.params.id).maybeSingle();
    if (!row) return res.status(404).json({ error: "Không tìm thấy bình luận." });
    if (row.is_deleted) return res.status(400).json({ error: "Bình luận đã bị xoá." });
    if (row.author_username !== req.user.username) {
      return res.status(403).json({ error: "Bạn không thể sửa bình luận này." });
    }

    await supabaseAdmin.from("social_comments").update({
      text: content,
      edited_at: new Date().toISOString(),
    }).eq("id", row.id);

    res.json({ ok: true });
  } catch (e) {
    console.error("[comments.edit]", e);
    res.status(500).json({ error: "Không thể sửa bình luận." });
  }
});

// ────────────────────────────────────────────────────────────────
// Delete own comment / reply (soft delete, preserves thread)
// ────────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin
      .from("social_comments").select("id, author_username, parent_id, target_type, target_id")
      .eq("id", req.params.id).maybeSingle();
    if (!row) return res.status(404).json({ error: "Không tìm thấy bình luận." });
    if (row.author_username !== req.user.username && !req.user.isAdmin) {
      return res.status(403).json({ error: "Bạn không thể xoá bình luận này." });
    }

    // Soft delete: preserve thread structure if it has replies, else hard delete.
    const { count } = await supabaseAdmin
      .from("social_comments").select("id", { count: "exact", head: true })
      .eq("parent_id", row.id);
    if (count > 0) {
      await supabaseAdmin.from("social_comments").update({
        is_deleted: true, text: "Bình luận đã bị xoá.",
      }).eq("id", row.id);
    } else {
      await supabaseAdmin.from("social_comments").delete().eq("id", row.id);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[comments.delete]", e);
    res.status(500).json({ error: "Không thể xoá bình luận." });
  }
});

// ────────────────────────────────────────────────────────────────
// React (like) to a comment — toggle, optimistic client, dup-safe
// ────────────────────────────────────────────────────────────────
router.post("/:id/react", requireAuth, async (req, res) => {
  try {
    const { data: comment } = await supabaseAdmin
      .from("social_comments").select("id, author_username, target_type, target_id")
      .eq("id", req.params.id).maybeSingle();
    if (!comment) return res.status(404).json({ error: "Không tìm thấy bình luận." });

    const { data: existing } = await supabaseAdmin
      .from("social_reactions")
      .select("id")
      .eq("target_type", "comment")
      .eq("target_id", comment.id)
      .eq("username", req.user.username)
      .maybeSingle();

    let reacted = true;
    if (existing) {
      await supabaseAdmin.from("social_reactions").delete().eq("id", existing.id);
      reacted = false;
    } else {
      const { error: insErr } = await supabaseAdmin.from("social_reactions").insert({
        target_type: "comment", target_id: comment.id, username: req.user.username,
        created_at: new Date().toISOString(),
      });
      if (insErr && !String(insErr.message || "").includes("duplicate")) {
        console.error("[comments.react.insert]", insErr);
        return res.status(500).json({ error: "Không thể thả tym." });
      }
    }

    // Notify the comment author (only on add, not on remove; anti-spam guarded)
    if (reacted) {
      const notify = await shouldNotify(comment.author_username, req.user.username, "COMMENT_LIKED", comment.target_type, String(comment.target_id));
      if (notify) {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("display_name").eq("username", req.user.username).maybeSingle();
        await createNotification(comment.author_username, "COMMENT_LIKED", "Tym bình luận",
          `${profile?.display_name || req.user.username} đã thả tym bình luận của bạn.`,
          { actorUsername: req.user.username, targetType: comment.target_type, targetId: String(comment.target_id), commentId: comment.id });
      }
    }

    const { count } = await supabaseAdmin
      .from("social_reactions")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "comment").eq("target_id", comment.id);

    res.json({ reacted, likeCount: count || 0 });
  } catch (e) {
    console.error("[comments.react]", e);
    res.status(500).json({ error: "Không thể thả tym." });
  }
});

// ────────────────────────────────────────────────────────────────
// People search (reused by @mention autocomplete)
// ────────────────────────────────────────────────────────────────
router.get("/mention-search", async (req, res) => {
  const q = ((req.query.q || "") + "").trim().toLowerCase();
  if (q.length < 1) return res.json({ users: [] });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  const pattern = `%${q}%`;
  const { data: rows } = await supabaseAdmin
    .from("profiles")
    .select("username, display_name, avatar_url")
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .order("username", { ascending: true })
    .limit(limit);
  res.json({ users: (rows || []).map((r) => ({
    username: r.username,
    displayName: r.display_name || r.username,
    avatarUrl: r.avatar_url || null,
  })) });
});

export default router;
