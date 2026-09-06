/**
 * 4ANG Room Routes — create/join rooms, shared queue, host controls,
 * playback sync, reactions, invites, discovery.
 * Data flows through Express + supabaseAdmin (RLS is defense-in-depth).
 */
import express from "express";
import { requireAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";
import { shapeTrack, recordActivity, createNotification } from "../db.js";
import { rateLimit } from "../rateLimit.js";

const router = express.Router();

/* ── helpers ───────────────────────────────────────────────────────── */

function ok(res, data) { return res.json({ ok: true, ...data }); }
function err(res, status, msg) { return res.status(status).json({ error: msg }); }

const createRL = rateLimit({ windowMs: 10 * 60_000, max: 8, keyPrefix: "room:create" });
const joinRL   = rateLimit({ windowMs: 60_000,  max: 10, keyPrefix: "room:join" });
const reactRL  = rateLimit({ windowMs: 2_000,   max: 1,  keyPrefix: "room:react" });
const queueRL  = rateLimit({ windowMs: 60_000,  max: 30, keyPrefix: "room:queue" });
const inviteRL = rateLimit({ windowMs: 60_000,  max: 10, keyPrefix: "room:invite" });

const ALLOWED_REACTIONS = ["❤️", "🔥", "🎵", "👏"];

/* ── room shape helpers ────────────────────────────────────────────── */

function shapeRoomLight(row, { participantCount = 0, trackTitle = null, trackArtist = null, trackCover = null } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    privacy: row.privacy,
    hostUsername: row.host_username,
    currentTrackId: row.current_track_id,
    isPlaying: row.is_playing,
    participantCount,
    trackTitle,
    trackArtist,
    trackCover,
    allowSongAdds: row.allow_song_adds,
    allowReactions: row.allow_reactions,
    participantLimit: row.participant_limit,
    status: row.status,
    createdAt: row.created_at,
  };
}

function shapeRoomFull(row, { participants = [], queue = [], track = null } = {}) {
  const base = shapeRoomLight(row, {
    participantCount: participants.length,
    trackTitle: track?.title || null,
    trackArtist: track?.credits?.[0]?.artistName || track?.composer || null,
    trackCover: track?.coverUrl || null,
  });
  if (!base) return null;
  return {
    ...base,
    positionMs: Number(row.position_ms) || 0,
    playbackStartedAt: row.playback_started_at || null,
    queueVersion: row.queue_version || 0,
    participants,
    queue,
    joinCode: row.join_code || null,
    joinedAt: row.joined_at || null,
    isMember: row._isMember || false,
    isHost: row._isHost || false,
  };
}

function shapeParticipant(r) {
  return {
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name || r.username,
    avatarUrl: r.avatar_url || null,
    role: r.role,
    isOnline: !!r.is_online,
    lastSeenAt: r.last_seen_at,
    joinedAt: r.joined_at,
  };
}

function shapeQueueItem(r) {
  return { id: r.id, trackId: r.track_id, addedBy: r.added_by_username, position: r.position };
}

async function resolveRoom(id) {
  const { data } = await supabaseAdmin.from("rooms").select("*").eq("id", id).maybeSingle();
  return data;
}

async function getParticipants(roomId) {
  const { data } = await supabaseAdmin
    .from("room_participants").select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  return (data || []).map(shapeParticipant);
}

async function getQueue(roomId) {
  const { data } = await supabaseAdmin
    .from("room_queue").select("*")
    .eq("room_id", roomId)
    .order("position", { ascending: true });
  return (data || []).map(shapeQueueItem);
}

async function renumberQueue(roomId) {
  const { data: items } = await supabaseAdmin
    .from("room_queue").select("id")
    .eq("room_id", roomId)
    .order("position", { ascending: true });
  if (!items || items.length === 0) return;
  for (let i = 0; i < items.length; i++) {
    await supabaseAdmin.from("room_queue").update({ position: i }).eq("id", items[i].id);
  }
}

async function bumpQueueVersion(roomId) {
  const { data: room } = await supabaseAdmin.from("rooms").select("queue_version").eq("id", roomId).maybeSingle();
  const newVer = (room?.queue_version || 0) + 1;
  await supabaseAdmin.from("rooms").update({ queue_version: newVer, updated_at: new Date().toISOString() }).eq("id", roomId);
  return newVer;
}

async function resolveTrackMinimal(trackId) {
  if (!trackId) return null;
  const { data } = await supabaseAdmin.from("tracks").select("*").eq("id", String(trackId)).maybeSingle();
  if (!data) return null;
  if (data.status !== "approved") return null;
  try { return await shapeTrack(data); } catch { return null; }
}

async function addRoomToActivity(username, roomId, roomName, participantCount) {
  try {
    await recordActivity(username, "ROOM_STARTED", "room", String(roomId), {
      roomName,
      participantCount: participantCount || 1,
    });
  } catch {}
}

async function cleanupOldReactions() {
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  await supabaseAdmin.from("room_reactions").delete().lt("created_at", cutoff);
}

/* ── background: stale reaction sweeper + stale host detector ───────── */

let hostSweepTimer = null;

export function startRoomHousekeeping() {
  // Reactions sweep every 90s
  setInterval(() => { cleanupOldReactions().catch(() => {}); }, 90_000).unref?.();
  // Host heartbeat checker every 45s
  hostSweepTimer = setInterval(async () => {
    try {
      const { data: rooms } = await supabaseAdmin
        .from("rooms").select("id, host_id, host_username")
        .eq("status", "active");
      for (const room of (rooms || [])) {
        const { data: host } = await supabaseAdmin
          .from("room_participants").select("last_seen_at, is_online")
          .eq("room_id", room.id).eq("user_id", room.host_id).maybeSingle();
        if (!host || (host.is_online && new Date(host.last_seen_at).getTime() < Date.now() - 75_000)) {
          // Host offline > 75s → transfer or end
          const { data: nextHost } = await supabaseAdmin
            .from("room_participants").select("user_id, username")
            .eq("room_id", room.id).neq("user_id", room.host_id).eq("is_online", true)
            .order("joined_at", { ascending: true }).limit(1).maybeSingle();
          if (nextHost) {
            await supabaseAdmin.from("rooms").update({
              host_id: nextHost.user_id, host_username: nextHost.username, updated_at: new Date().toISOString(),
            }).eq("id", room.id);
            await supabaseAdmin.from("room_participants").update({ role: "host" }).eq("room_id", room.id).eq("user_id", nextHost.user_id);
            await supabaseAdmin.from("room_participants").update({ role: "listener" }).eq("room_id", room.id).eq("user_id", room.host_id);
            await createNotification(nextHost.username, "ROOM_HOST_TRANSFER", "Bạn trở thành chủ phòng",
              `Bạn đã trở thành chủ phòng nhạc sau khi chủ trước ngắt kết nối.`,
              { targetType: "room", targetId: room.id }).catch(() => {});
          } else {
            await supabaseAdmin.from("rooms").update({ status: "ended", ended_at: new Date().toISOString(), is_playing: false, updated_at: new Date().toISOString() }).eq("id", room.id);
          }
        }
      }
    } catch {}
  }, 45_000);
  hostSweepTimer?.unref?.();
}

/* ══════════════════════════════════════════════════════════════════════
   ROUTES
   ══════════════════════════════════════════════════════════════════════ */

// ── DISCOVERY ─────────────────────────────────────────────────────────

router.get("/discovery", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { data: rooms } = await supabaseAdmin
      .from("rooms").select("*")
      .eq("status", "active").eq("privacy", "public")
      .order("created_at", { ascending: false })
      .limit(limit);
    const shaped = [];
    for (const r of (rooms || [])) {
      const participants = await getParticipants(r.id);
      shaped.push(shapeRoomLight(r, {
        participantCount: participants.filter(p => p.isOnline).length,
        trackTitle: null, trackArtist: null, trackCover: null,
      }));
    }
    ok(res, { rooms: shaped });
  } catch (e) {
    console.error("[rooms.discovery]", e);
    err(res, 500, "Không thể tải danh sách phòng.");
  }
});

// ── MY ROOMS ──────────────────────────────────────────────────────────

router.get("/mine", requireAuth, async (req, res) => {
  try {
    // Rooms where user is host
    const { data: hosted } = await supabaseAdmin
      .from("rooms").select("id").eq("host_id", req.user.id).eq("status", "active");
    // Rooms where user is participant (active only)
    const { data: memberOf } = await supabaseAdmin
      .from("room_participants").select("room_id")
      .eq("user_id", req.user.id);
    const roomIds = [...new Set([...(hosted || []).map(r => r.id), ...(memberOf || []).map(r => r.room_id)])];
    if (roomIds.length === 0) return ok(res, { rooms: [] });
    const { data: rooms } = await supabaseAdmin
      .from("rooms").select("*").in("id", roomIds)
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    const shaped = [];
    for (const r of (rooms || [])) {
      const participants = await getParticipants(r.id);
      shaped.push(shapeRoomLight(r, { participantCount: participants.filter(p => p.isOnline).length }));
    }
    ok(res, { rooms: shaped });
  } catch (e) {
    console.error("[rooms.mine]", e);
    err(res, 500, "Không thể tải phòng của bạn.");
  }
});

// ── CREATE ROOM ───────────────────────────────────────────────────────

router.post("/", createRL, requireAuth, async (req, res) => {
  try {
    const { name, description, privacy, joinCode, allowSongAdds, allowReactions, participantLimit, initialTrackId } = req.body || {};
    if (!name || name.trim().length === 0) return err(res, 400, "Tên phòng không được để trống.");
    const trimmed = name.trim().slice(0, 80);
    const priv = ["public", "private"].includes(privacy) ? privacy : "public";
    const code = priv === "private" ? (joinCode || generateCode()) : null;

    // Validate initial track
    let initialTrack = null;
    if (initialTrackId) {
      initialTrack = await resolveTrackMinimal(initialTrackId);
      if (!initialTrack) return err(res, 400, "Bài hát không tồn tại hoặc chưa được phê duyệt.");
    }

    const { data: room, error: insErr } = await supabaseAdmin.from("rooms").insert({
      name: trimmed,
      description: description?.trim().slice(0, 300) || "",
      privacy: priv,
      host_id: req.user.id,
      host_username: req.user.username,
      join_code: code,
      current_track_id: initialTrack?.id || null,
      is_playing: false,
      position_ms: 0,
      playback_started_at: null,
      current_queue_position: 0,
      queue_version: 0,
      allow_song_adds: allowSongAdds !== false,
      allow_reactions: allowReactions !== false,
      participant_limit: Math.min(Math.max(parseInt(participantLimit, 10) || 60, 2), 200),
      status: "active",
    }).select("*").maybeSingle();

    if (insErr) {
      console.error("[rooms.create]", insErr);
      return err(res, 500, "Không thể tạo phòng.");
    }

    // Add host as participant
    await supabaseAdmin.from("room_participants").insert({
      room_id: room.id,
      user_id: req.user.id,
      username: req.user.username,
      display_name: req.user.displayName || req.user.username,
      avatar_url: req.user.avatarUrl || null,
      role: "host",
      is_online: true,
    });

    // Seed queue with initial track
    if (initialTrack) {
      await supabaseAdmin.from("room_queue").insert({
        room_id: room.id,
        track_id: initialTrack.id,
        added_by_username: req.user.username,
        position: 0,
      });
    }

    // Record feed activity
    addRoomToActivity(req.user.username, room.id, trimmed, 1);

    ok(res, { room: shapeRoomLight(room, { participantCount: 1 }) });
  } catch (e) {
    console.error("[rooms.create]", e);
    err(res, 500, "Không thể tạo phòng.");
  }
});

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── GET ROOM ──────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.status !== "active") return err(res, 410, "Phòng đã kết thúc.");

    // Membership check
    const { data: membership } = await supabaseAdmin
      .from("room_participants").select("role, joined_at")
      .eq("room_id", room.id).eq("user_id", req.user.id).maybeSingle();

    const isMember = !!membership;
    const isHost = room.host_id === req.user.id;

    // Private rooms require membership
    if (room.privacy === "private" && !isMember && !isHost) {
      return err(res, 403, "Phòng riêng tư. Bạn cần mã tham gia.");
    }

    const participants = await getParticipants(room.id);
    const queue = await getQueue(room.id);

    // Resolve current track if present
    let track = null;
    if (room.current_track_id) {
      track = await resolveTrackMinimal(room.current_track_id);
    }

    const shaped = shapeRoomFull(room, { participants, queue, track });
    shaped.isHost = isHost;
    shaped.isMember = isMember || isHost;
    shaped.joinedAt = membership?.joined_at || null;

    ok(res, { room: shaped });
  } catch (e) {
    console.error("[rooms.get]", e);
    err(res, 500, "Không thể tải phòng.");
  }
});

// ── JOIN ROOM ─────────────────────────────────────────────────────────

router.post("/:id/join", joinRL, requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.status !== "active") return err(res, 410, "Phòng đã kết thúc.");

    // Check membership
    const { data: existing } = await supabaseAdmin
      .from("room_participants").select("id")
      .eq("room_id", room.id).eq("user_id", req.user.id).maybeSingle();

    if (existing) {
      // Already a member — just return room state
      const participants = await getParticipants(room.id);
      const queue = await getQueue(room.id);
      let track = null;
      if (room.current_track_id) track = await resolveTrackMinimal(room.current_track_id);
      const shaped = shapeRoomFull(room, { participants, queue, track });
      shaped.isMember = true;
      shaped.isHost = room.host_id === req.user.id;
      return ok(res, { room: shaped, alreadyMember: true });
    }

    // Private room: require join code
    if (room.privacy === "private") {
      const { joinCode } = req.body || {};
      if (joinCode && joinCode.toUpperCase() === room.join_code) {
        // valid code
      } else {
        return err(res, 403, "Phòng riêng tư. Cần mã tham gia hợp lệ.");
      }
    }

    // Participant limit
    const { count } = await supabaseAdmin
      .from("room_participants").select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count || 0) >= room.participant_limit) {
      return err(res, 400, "Phòng đã đầy.");
    }

    // Check for existing invite (for tracking purposes)
    await supabaseAdmin
      .from("room_invites").update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("room_id", room.id).eq("invitee_username", req.user.username).eq("status", "pending");

    await supabaseAdmin.from("room_participants").insert({
      room_id: room.id,
      user_id: req.user.id,
      username: req.user.username,
      display_name: req.user.displayName || req.user.username,
      avatar_url: req.user.avatarUrl || null,
      role: "listener",
      is_online: true,
    });

    // Return full room state for joiner
    const participants = await getParticipants(room.id);
    const queue = await getQueue(room.id);
    let track = null;
    if (room.current_track_id) track = await resolveTrackMinimal(room.current_track_id);
    const shaped = shapeRoomFull(room, { participants, queue, track });
    shaped.isMember = true;
    shaped.isHost = false;

    ok(res, { room: shaped });
  } catch (e) {
    console.error("[rooms.join]", e);
    err(res, 500, "Không thể tham gia phòng.");
  }
});

// ── LEAVE ROOM ────────────────────────────────────────────────────────

router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");

    const { data: membership } = await supabaseAdmin
      .from("room_participants").select("id, role")
      .eq("room_id", room.id).eq("user_id", req.user.id).maybeSingle();

    if (!membership) return ok(res, { left: true });

    // If host: transfer to next listener or end
    if (room.host_id === req.user.id) {
      const { data: nextHost } = await supabaseAdmin
        .from("room_participants").select("user_id, username")
        .eq("room_id", room.id).neq("user_id", req.user.id)
        .order("joined_at", { ascending: true }).limit(1).maybeSingle();

      if (nextHost) {
        await supabaseAdmin.from("rooms").update({
          host_id: nextHost.user_id, host_username: nextHost.username, updated_at: new Date().toISOString(),
        }).eq("id", room.id);
        await supabaseAdmin.from("room_participants").update({ role: "host" }).eq("room_id", room.id).eq("user_id", nextHost.user_id);
        await createNotification(nextHost.username, "ROOM_HOST_TRANSFER", "Bạn trở thành chủ phòng",
          `${req.user.displayName || req.user.username} đã rời đi. Bạn trở thành chủ phòng.`,
          { targetType: "room", targetId: room.id }).catch(() => {});
      } else {
        // No one left → end room
        await supabaseAdmin.from("rooms").update({
          status: "ended", ended_at: new Date().toISOString(), is_playing: false, updated_at: new Date().toISOString(),
        }).eq("id", room.id);
      }
    }

    await supabaseAdmin.from("room_participants").delete()
      .eq("room_id", room.id).eq("user_id", req.user.id);

    ok(res, { left: true });
  } catch (e) {
    console.error("[rooms.leave]", e);
    err(res, 500, "Không thể rời phòng.");
  }
});

// ── END ROOM (host) ───────────────────────────────────────────────────

router.post("/:id/end", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.host_id !== req.user.id) return err(res, 403, "Chỉ chủ phòng mới kết thúc được.");

    await supabaseAdmin.from("rooms").update({
      status: "ended", ended_at: new Date().toISOString(), is_playing: false, updated_at: new Date().toISOString(),
    }).eq("id", room.id);

    ok(res, { ended: true });
  } catch (e) {
    console.error("[rooms.end]", e);
    err(res, 500, "Không thể kết thúc phòng.");
  }
});

// ── TRANSFER HOST ─────────────────────────────────────────────────────

router.post("/:id/transfer-host", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.host_id !== req.user.id) return err(res, 403, "Chỉ chủ phòng mới chuyển quyền.");
    const { username } = req.body || {};
    if (!username) return err(res, 400, "Thiếu tên người nhận quyền.");
    if (username === req.user.username) return err(res, 400, "Bạn đã là chủ phòng.");

    const { data: target } = await supabaseAdmin
      .from("room_participants").select("user_id, username")
      .eq("room_id", room.id).eq("username", username).maybeSingle();
    if (!target) return err(res, 404, "Người dùng không có trong phòng.");

    await supabaseAdmin.from("rooms").update({
      host_id: target.user_id, host_username: target.username, updated_at: new Date().toISOString(),
    }).eq("id", room.id);
    await supabaseAdmin.from("room_participants").update({ role: "host" }).eq("room_id", room.id).eq("user_id", target.user_id);
    await supabaseAdmin.from("room_participants").update({ role: "listener" }).eq("room_id", room.id).eq("user_id", req.user.id);

    await createNotification(target.username, "ROOM_HOST_TRANSFER", "Bạn trở thành chủ phòng",
      `${req.user.displayName || req.user.username} đã chuyển quyền chủ phòng cho bạn.`,
      { targetType: "room", targetId: room.id }).catch(() => {});

    ok(res, { transferred: true, hostUsername: target.username });
  } catch (e) {
    console.error("[rooms.transfer]", e);
    err(res, 500, "Không thể chuyển quyền.");
  }
});

// ── HEARTBEAT ─────────────────────────────────────────────────────────

router.post("/:id/heartbeat", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    await supabaseAdmin.from("room_participants").update({
      last_seen_at: new Date().toISOString(),
      is_online: true,
    }).eq("room_id", room.id).eq("user_id", req.user.id);

    ok(res, { ok: true });
  } catch (e) {
    ok(res, { ok: false });
  }
});

// ── HOST SYNC (push playback state) ───────────────────────────────────

router.post("/:id/sync", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.host_id !== req.user.id) return err(res, 403, "Chỉ chủ phòng mới đồng bộ được.");

    const { positionMs, isPlaying, currentTrackId, queueVersion } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };

    if (typeof positionMs === "number") updates.position_ms = Math.max(0, Math.round(positionMs));
    if (typeof isPlaying === "boolean") {
      updates.is_playing = isPlaying;
      if (isPlaying) updates.playback_started_at = new Date().toISOString();
      else updates.playback_started_at = null;
    }
    if (currentTrackId) {
      updates.current_track_id = currentTrackId;
      // Advance queue cursor
      const { data: qItem } = await supabaseAdmin
        .from("room_queue").select("position")
        .eq("room_id", room.id).eq("track_id", currentTrackId)
        .maybeSingle();
      if (qItem) updates.current_queue_position = qItem.position;
    }
    if (typeof queueVersion === "number") updates.queue_version = queueVersion;

    await supabaseAdmin.from("rooms").update(updates).eq("id", room.id);

    // Return updated state with syncedAt
    const { data: updated } = await supabaseAdmin.from("rooms").select("*").eq("id", room.id).maybeSingle();
    ok(res, {
      positionMs: Number(updated.position_ms) || 0,
      isPlaying: !!updated.is_playing,
      currentTrackId: updated.current_track_id,
      queueVersion: updated.queue_version || 0,
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[rooms.sync]", e);
    err(res, 500, "Không thể đồng bộ.");
  }
});

// ── PARTICIPANT POLL SYNC (GET) ───────────────────────────────────────

router.get("/:id/sync", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.status !== "active") return err(res, 410, "Phòng đã kết thúc.");

    const { data: membership } = await supabaseAdmin
      .from("room_participants").select("id")
      .eq("room_id", room.id).eq("user_id", req.user.id).maybeSingle();
    if (!membership && room.host_id !== req.user.id) return err(res, 403, "Bạn chưa tham gia phòng.");

    // Update heartbeat while we're here
    await supabaseAdmin.from("room_participants").update({
      last_seen_at: new Date().toISOString(), is_online: true,
    }).eq("room_id", room.id).eq("user_id", req.user.id);

    ok(res, {
      positionMs: Number(room.position_ms) || 0,
      isPlaying: !!room.is_playing,
      currentTrackId: room.current_track_id,
      playbackStartedAt: room.playback_started_at || null,
      queueVersion: room.queue_version || 0,
      status: room.status,
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[rooms.sync.get]", e);
    err(res, 500, "Không thể tải trạng thái.");
  }
});

// ── QUEUE: ADD TRACK ──────────────────────────────────────────────────

router.post("/:id/queue", queueRL, requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.status !== "active") return err(res, 410, "Phòng đã kết thúc.");

    // Permission check
    const { data: membership } = await supabaseAdmin
      .from("room_participants").select("id")
      .eq("room_id", room.id).eq("user_id", req.user.id).maybeSingle();
    if (!membership) return err(res, 403, "Bạn chưa tham gia phòng.");

    const isHost = room.host_id === req.user.id;
    if (!isHost && !room.allow_song_adds) return err(res, 403, "Chủ phòng không cho phép thêm bài.");

    const { trackId } = req.body || {};
    if (!trackId) return err(res, 400, "Thiếu trackId.");
    const track = await resolveTrackMinimal(trackId);
    if (!track) return err(res, 400, "Bài hát không hợp lệ.");

    // Find max position to append
    const { data: lastItem } = await supabaseAdmin
      .from("room_queue").select("position")
      .eq("room_id", room.id)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const nextPos = (lastItem?.position ?? -1) + 1;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("room_queue").insert({
        room_id: room.id,
        track_id: track.id,
        added_by_username: req.user.username,
        position: nextPos,
      }).select("*").maybeSingle();

    if (insErr) return err(res, 500, "Không thể thêm bài.");

    const queueVersion = await bumpQueueVersion(room.id);

    ok(res, { item: shapeQueueItem(inserted), queueVersion });
  } catch (e) {
    console.error("[rooms.queue.add]", e);
    err(res, 500, "Không thể thêm bài.");
  }
});

// ── QUEUE: REORDER (host) ─────────────────────────────────────────────

router.post("/:id/queue/reorder", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.host_id !== req.user.id) return err(res, 403, "Chỉ chủ phòng mới sắp xếp hàng chờ.");

    const { order } = req.body || {};
    if (!Array.isArray(order)) return err(res, 400, "Thiếu danh sách order.");

    for (let i = 0; i < order.length; i++) {
      await supabaseAdmin.from("room_queue").update({ position: i }).eq("id", order[i]).eq("room_id", room.id);
    }

    const queueVersion = await bumpQueueVersion(room.id);
    const queue = await getQueue(room.id);
    ok(res, { queue, queueVersion });
  } catch (e) {
    console.error("[rooms.queue.reorder]", e);
    err(res, 500, "Không thể sắp xếp.");
  }
});

// ── QUEUE: REMOVE ITEM ────────────────────────────────────────────────

router.delete("/:id/queue/:queueId", requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");

    const { data: item } = await supabaseAdmin
      .from("room_queue").select("added_by_username")
      .eq("id", req.params.queueId).eq("room_id", room.id).maybeSingle();
    if (!item) return err(res, 404, "Không tìm thấy bài trong hàng chờ.");

    const isHost = room.host_id === req.user.id;
    const isOwner = item.added_by_username === req.user.username;
    if (!isHost && !isOwner) return err(res, 403, "Không có quyền xóa.");

    await supabaseAdmin.from("room_queue").delete().eq("id", req.params.queueId);
    await renumberQueue(room.id);
    const queueVersion = await bumpQueueVersion(room.id);
    const queue = await getQueue(room.id);
    ok(res, { queue, queueVersion });
  } catch (e) {
    console.error("[rooms.queue.remove]", e);
    err(res, 500, "Không thể xóa.");
  }
});

// ── HOST CONTROLS: PLAY / PAUSE / SEEK / NEXT / PREV / SHUFFLE / REPEAT ──

async function hostOnly(req, res) {
  const room = await resolveRoom(req.params.id);
  if (!room) { err(res, 404, "Không tìm thấy phòng."); return null; }
  if (room.host_id !== req.user.id) { err(res, 403, "Chỉ chủ phòng."); return null; }
  return room;
}

async function updateRoomPlayback(roomId, updates) {
  updates.updated_at = new Date().toISOString();
  await supabaseAdmin.from("rooms").update(updates).eq("id", roomId);
  const { data: updated } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  return updated;
}

function syncPayload(room) {
  return {
    positionMs: Number(room.position_ms) || 0,
    isPlaying: !!room.is_playing,
    currentTrackId: room.current_track_id,
    queueVersion: room.queue_version || 0,
    syncedAt: new Date().toISOString(),
  };
}

// PLAY specific track
router.post("/:id/play", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const { trackId, positionMs } = req.body || {};
    if (!trackId) return err(res, 400, "Thiếu trackId.");

    const updated = await updateRoomPlayback(room.id, {
      current_track_id: trackId,
      position_ms: positionMs || 0,
      is_playing: true,
      playback_started_at: new Date().toISOString(),
    });

    // If track not in queue, add it
    const { data: inQueue } = await supabaseAdmin
      .from("room_queue").select("id")
      .eq("room_id", room.id).eq("track_id", trackId).maybeSingle();
    if (!inQueue) {
      const { data: lastItem } = await supabaseAdmin
        .from("room_queue").select("position")
        .eq("room_id", room.id).order("position", { ascending: false }).limit(1).maybeSingle();
      await supabaseAdmin.from("room_queue").insert({
        room_id: room.id, track_id: trackId, added_by_username: req.user.username, position: (lastItem?.position ?? -1) + 1,
      });
      await bumpQueueVersion(room.id);
    }
    // Set current queue position
    const { data: qItem } = await supabaseAdmin
      .from("room_queue").select("position")
      .eq("room_id", room.id).eq("track_id", trackId).maybeSingle();
    if (qItem) {
      await supabaseAdmin.from("rooms").update({ current_queue_position: qItem.position }).eq("id", room.id);
      updated.current_queue_position = qItem.position;
    }

    ok(res, syncPayload(updated));
  } catch (e) {
    console.error("[rooms.play]", e);
    err(res, 500, "Không thể phát.");
  }
});

// PAUSE
router.post("/:id/pause", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const { positionMs } = req.body || {};
    const updated = await updateRoomPlayback(room.id, {
      is_playing: false,
      position_ms: positionMs ?? Number(room.position_ms),
      playback_started_at: null,
    });
    ok(res, syncPayload(updated));
  } catch (e) { err(res, 500, "Không thể tạm dừng."); }
});

// SEEK
router.post("/:id/seek", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const { positionMs } = req.body || {};
    if (typeof positionMs !== "number") return err(res, 400, "Thiếu positionMs.");
    const updates = { position_ms: Math.max(0, Math.round(positionMs)) };
    if (room.is_playing) updates.playback_started_at = new Date().toISOString();
    const updated = await updateRoomPlayback(room.id, updates);
    ok(res, syncPayload(updated));
  } catch (e) { err(res, 500, "Không thể tua."); }
});

// NEXT
router.post("/:id/next", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const queue = await getQueue(room.id);
    if (queue.length === 0) return err(res, 400, "Hàng chờ trống.");
    const curIdx = queue.findIndex(q => q.trackId === room.current_track_id);
    const nextIdx = curIdx + 1;
    if (nextIdx >= queue.length) return err(res, 400, "Đã hết hàng chờ.");
    const nextItem = queue[nextIdx];
    const updated = await updateRoomPlayback(room.id, {
      current_track_id: nextItem.trackId,
      current_queue_position: nextItem.position,
      position_ms: 0,
      is_playing: true,
      playback_started_at: new Date().toISOString(),
    });
    ok(res, syncPayload(updated));
  } catch (e) { err(res, 500, "Không thể chuyển bài."); }
});

// PREV
router.post("/:id/prev", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const queue = await getQueue(room.id);
    if (queue.length === 0) return err(res, 400, "Hàng chờ trống.");
    const curIdx = queue.findIndex(q => q.trackId === room.current_track_id);
    const prevIdx = curIdx > 0 ? curIdx - 1 : queue.length - 1;
    const prevItem = queue[prevIdx];
    const updated = await updateRoomPlayback(room.id, {
      current_track_id: prevItem.trackId,
      current_queue_position: prevItem.position,
      position_ms: 0,
      is_playing: true,
      playback_started_at: new Date().toISOString(),
    });
    ok(res, syncPayload(updated));
  } catch (e) { err(res, 500, "Không thể chuyển bài."); }
});

// SHUFFLE (reorder queue randomly, keep current track at index 0)
router.post("/:id/shuffle", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const { data: items } = await supabaseAdmin
      .from("room_queue").select("id, track_id")
      .eq("room_id", room.id).order("position", { ascending: true });
    if (!items || items.length === 0) return ok(res, { queue: [], queueVersion: room.queue_version });

    // Fisher-Yates shuffle
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Ensure current track is at index 0
    const curIdx = shuffled.findIndex(i => i.track_id === room.current_track_id);
    if (curIdx > 0) {
      const temp = shuffled[0];
      shuffled[0] = shuffled[curIdx];
      shuffled[curIdx] = temp;
    }
    for (let i = 0; i < shuffled.length; i++) {
      await supabaseAdmin.from("room_queue").update({ position: i }).eq("id", shuffled[i].id);
    }
    await supabaseAdmin.from("rooms").update({ current_queue_position: 0 }).eq("id", room.id);

    const queueVersion = await bumpQueueVersion(room.id);
    const queue = await getQueue(room.id);
    ok(res, { queue, queueVersion });
  } catch (e) { err(res, 500, "Không thể trộn hàng chờ."); }
});

// REPEAT (set repeat mode)
router.post("/:id/repeat", requireAuth, async (req, res) => {
  try {
    const room = await hostOnly(req, res);
    if (!room) return;
    const { mode } = req.body || {};
    const validModes = ["off", "all", "one"];
    if (!validModes.includes(mode)) return err(res, 400, "Mode không hợp lệ.");
    // Store on room (no dedicated column; use metadata or jsonb-like; rooms has no settings col)
    // We'll just return the mode for the client to use; durable state via host client.
    ok(res, { mode });
  } catch (e) { err(res, 500, "Không thể cập nhật."); }
});

// ── REACTIONS ─────────────────────────────────────────────────────────

router.post("/:id/react", reactRL, requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (!room.allow_reactions) return err(res, 403, "Phòng không cho phép reaction.");

    const { data: membership } = await supabaseAdmin
      .from("room_participants").select("id")
      .eq("room_id", room.id).eq("user_id", req.user.id).maybeSingle();
    if (!membership) return err(res, 403, "Bạn chưa tham gia phòng.");

    const { emoji } = req.body || {};
    if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) return err(res, 400, "Emoji không hợp lệ.");

    await supabaseAdmin.from("room_reactions").insert({
      room_id: room.id,
      username: req.user.username,
      emoji,
    });

    ok(res, { emoji, username: req.user.username, at: new Date().toISOString() });
  } catch (e) {
    console.error("[rooms.react]", e);
    err(res, 500, "Không thể thả reaction.");
  }
});

// ── INVITES ───────────────────────────────────────────────────────────

router.post("/:id/invite", inviteRL, requireAuth, async (req, res) => {
  try {
    const room = await resolveRoom(req.params.id);
    if (!room) return err(res, 404, "Không tìm thấy phòng.");
    if (room.host_id !== req.user.id) return err(res, 403, "Chỉ chủ phòng mới mời.");

    const { username } = req.body || {};
    if (!username) return err(res, 400, "Thiếu tên người được mời.");
    if (username === req.user.username) return err(res, 400, "Không thể tự mời mình.");

    // Check target exists
    const { data: target } = await supabaseAdmin
      .from("profiles").select("id, username").eq("username", username).maybeSingle();
    if (!target) return err(res, 404, "Không tìm thấy người dùng.");

    // Check if already member
    const { data: existingMember } = await supabaseAdmin
      .from("room_participants").select("id")
      .eq("room_id", room.id).eq("user_id", target.id).maybeSingle();
    if (existingMember) return err(res, 400, "Đã là thành viên.");

    // Upsert invite
    await supabaseAdmin.from("room_invites").upsert({
      room_id: room.id,
      inviter_username: req.user.username,
      invitee_username: username,
      status: "pending",
    }, { onConflict: "room_id,invitee_username", ignoreDuplicates: false });

    await createNotification(username, "ROOM_INVITE", "Lời mời vào phòng",
      `${req.user.displayName || req.user.username} mời bạn vào phòng "${room.name}".`,
      {
        actorUsername: req.user.username,
        targetType: "room",
        targetId: room.id,
        metadata: { roomName: room.name, joinCode: room.join_code, privacy: room.privacy },
      });

    ok(res, { invited: true });
  } catch (e) {
    console.error("[rooms.invite]", e);
    err(res, 500, "Không thể gửi lời mời.");
  }
});

// ── MY PENDING INVITES ────────────────────────────────────────────────

router.get("/invites/list", requireAuth, async (req, res) => {
  try {
    const { data: invites } = await supabaseAdmin
      .from("room_invites").select("*")
      .eq("invitee_username", req.user.username).eq("status", "pending")
      .order("created_at", { ascending: false });

    const roomIds = [...new Set((invites || []).map(i => i.room_id).filter(Boolean))];
    if (roomIds.length === 0) return ok(res, { invites: [] });

    const { data: rooms } = await supabaseAdmin
      .from("rooms").select("id, name, host_username, privacy, status")
      .in("id", roomIds);
    const roomMap = {};
    for (const r of (rooms || [])) roomMap[r.id] = r;

    ok(res, {
      invites: (invites || []).map(i => ({
        id: i.id,
        roomId: i.room_id,
        inviter: i.inviter_username,
        room: roomMap[i.room_id] || null,
        createdAt: i.created_at,
      })).filter(i => i.room?.status === "active"),
    });
  } catch (e) {
    console.error("[rooms.invites]", e);
    err(res, 500, "Không thể tải lời mời.");
  }
});

export default router;
