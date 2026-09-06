/**
 * Phase 2.2 — useRoomSync
 *
 * Manages the Supabase Realtime channel for a room: presence, broadcast,
 * and postgres_changes on durable tables. Falls back to HTTP polling
 * when Supabase is not configured or the user has no Supabase session.
 *
 * Returns live room state. The consuming component applies drift correction
 * and coordinates with the global player.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { api } from "../api";

const HEARTBEAT_MS = 20_000;
const POLL_MS = 5_000;
const REACTION_TTL_MS = 30_000;
const CHANNEL_NAME_PREFIX = "room:";

/* ── helpers ────────────────────────────────────────────────────────── */

function pruneReactions(list, now) {
  return list.filter(r => now - (r.at || 0) < REACTION_TTL_MS);
}

/* ── hook ───────────────────────────────────────────────────────────── */

export function useRoomSync(roomId, { session, isHost, onTrackChange }) {
  const [participants, setParticipants] = useState([]);
  const [queue, setQueue] = useState([]);
  const [playback, setPlayback] = useState({
    isPlaying: false, positionMs: 0, currentTrackId: null,
    queueVersion: 0, playbackStartedAt: null, syncedAt: 0,
  });
  const [reactions, setReactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState(null); // 'realtime' | 'polling'

  const channelRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Track changes callback ref (avoids stale closure)
  const onTrackChangeRef = useRef(onTrackChange);
  onTrackChangeRef.current = onTrackChange;

  /* ── fetch initial state ─────────────────────────────────────────── */

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await api.rooms.getSync(roomId);
      if (res.ok) {
        setPlayback({
          isPlaying: res.isPlaying,
          positionMs: res.positionMs,
          currentTrackId: res.currentTrackId,
          queueVersion: res.queueVersion,
          playbackStartedAt: res.playbackStartedAt,
          syncedAt: new Date(res.syncedAt).getTime(),
        });
        // Fetch full room state (queue + participants)
        const full = await api.rooms.get(roomId);
        if (full.ok) {
          setQueue(full.room.queue || []);
          setParticipants(full.room.participants || []);
        }
      }
    } catch {}
  }, [roomId]);

  /* ── HTTP fallback polling ────────────────────────────────────────── */

  const startPolling = useCallback(() => {
    stopPolling();
    setConnectionMethod("polling");
    setIsConnected(true);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.rooms.getSync(roomId);
        if (res.ok) {
          setPlayback(prev => {
            const next = {
              isPlaying: res.isPlaying,
              positionMs: res.positionMs,
              currentTrackId: res.currentTrackId,
              queueVersion: res.queueVersion,
              playbackStartedAt: res.playbackStartedAt,
              syncedAt: new Date(res.syncedAt).getTime(),
            };
            if (next.currentTrackId !== prev.currentTrackId && onTrackChangeRef.current) {
              onTrackChangeRef.current(next.currentTrackId, next);
            }
            return next;
          });
        }
        // Also fetch full room state periodically (queue + participants)
        const full = await api.rooms.get(roomId);
        if (full.ok) {
          setQueue(full.room.queue || []);
          setParticipants(full.room.participants || []);
        }
      } catch {}
    }, POLL_MS);
  }, [roomId]);

  function stopPolling() {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }

  /* ── heartbeat ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!roomId || !session) return;
    api.rooms.heartbeat(roomId).catch(() => {});
    heartbeatTimerRef.current = setInterval(() => {
      api.rooms.heartbeat(roomId).catch(() => {});
    }, HEARTBEAT_MS);
    return () => { if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current); };
  }, [roomId, session]);

  /* ── Supabase Realtime channel ────────────────────────────────────── */

  useEffect(() => {
    if (!roomId || !session) return;
    if (!isSupabaseConfigured) { startPolling(); return fetchState(); }

    let cancelled = false;

    async function setup() {
      // Check for supabase session (needed for postgres_changes auth)
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sbSession?.access_token) { startPolling(); return fetchState(); }

      try {
        const channelName = CHANNEL_NAME_PREFIX + roomId;
        const channel = supabase.channel(channelName, { config: { broadcast: { self: true } } });
        channelRef.current = channel;

        /* ── postgres_changes: rooms (playback durable state) ──────── */
        channel.on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "rooms",
          filter: `id=eq.${roomId}`,
        }, (payload) => {
          const r = payload.new;
          if (!r) return;
          setPlayback(prev => {
            const next = {
              isPlaying: !!r.is_playing,
              positionMs: Number(r.position_ms) || 0,
              currentTrackId: r.current_track_id,
              queueVersion: r.queue_version || 0,
              playbackStartedAt: r.playback_started_at || null,
              syncedAt: Date.now(),
            };
            if (next.currentTrackId !== prev.currentTrackId && onTrackChangeRef.current) {
              onTrackChangeRef.current(next.currentTrackId, next);
            }
            return next;
          });
        });

        /* ── postgres_changes: room_queue ─────────────────────────── */
        channel.on("postgres_changes", {
          event: "*", schema: "public", table: "room_queue",
          filter: `room_id=eq.${roomId}`,
        }, async () => {
          // Re-fetch full queue (simple + correct after any mutation)
          try {
            const full = await api.rooms.get(roomId);
            if (full.ok) setQueue(full.room.queue || []);
          } catch {}
        });

        /* ── postgres_changes: room_participants ──────────────────── */
        channel.on("postgres_changes", {
          event: "*", schema: "public", table: "room_participants",
          filter: `room_id=eq.${roomId}`,
        }, async () => {
          try {
            const full = await api.rooms.get(roomId);
            if (full.ok) setParticipants(full.room.participants || []);
          } catch {}
        });

        /* ── postgres_changes: room_reactions ─────────────────────── */
        channel.on("postgres_changes", {
          event: "INSERT", schema: "public", table: "room_reactions",
          filter: `room_id=eq.${roomId}`,
        }, (payload) => {
          const r = payload.new;
          if (!r) return;
          setReactions(prev => {
            const next = [...prev, { id: r.id, username: r.username, emoji: r.emoji, at: new Date(r.created_at).getTime() }];
            return pruneReactions(next, Date.now());
          });
        });

        /* ── broadcast: playback (instant sync from host) ─────────── */
        channel.on("broadcast", { event: "playback" }, ({ payload }) => {
          if (!payload) return;
          setPlayback(prev => {
            const next = {
              isPlaying: !!payload.isPlaying,
              positionMs: Number(payload.positionMs) || 0,
              currentTrackId: payload.currentTrackId,
              queueVersion: payload.queueVersion || prev.queueVersion,
              playbackStartedAt: payload.playbackStartedAt || prev.playbackStartedAt,
              syncedAt: payload.syncedAt ? new Date(payload.syncedAt).getTime() : Date.now(),
            };
            if (next.currentTrackId !== prev.currentTrackId && onTrackChangeRef.current) {
              onTrackChangeRef.current(next.currentTrackId, next);
            }
            return next;
          });
        });

        /* ── broadcast: reaction ──────────────────────────────────── */
        channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
          if (!payload || !payload.emoji) return;
          setReactions(prev => {
            const next = [...prev, { id: `b-${Date.now()}-${Math.random()}`, username: payload.username, emoji: payload.emoji, at: payload.at || Date.now() }];
            return pruneReactions(next, Date.now());
          });
        });

        /* ── presence ──────────────────────────────────────────────── */
        channel.on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const presenceMap = {};
          for (const key of Object.keys(state)) {
            const p = state[key];
            if (Array.isArray(p) && p.length > 0) presenceMap[p[0].username] = p[0];
          }
          // Merge DB participants with presence (presence takes priority for online status)
          setParticipants(prev => prev.map(p => ({
            ...p,
            isOnline: !!presenceMap[p.username] || p.isOnline,
            displayName: presenceMap[p.username]?.displayName || p.displayName,
            avatarUrl: presenceMap[p.username]?.avatarUrl || p.avatarUrl,
          })));
        });

        /* ── subscribe ─────────────────────────────────────────────── */
        await channel.subscribe(async (status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            setConnectionMethod("realtime");
            // Track presence
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await channel.track({
                userId: user.id,
                username: session.username,
                displayName: session.displayName || session.username,
                avatarUrl: session.avatarUrl || null,
                isHost,
                onlineAt: Date.now(),
              });
            }
            // Fetch initial state
            await fetchState();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setIsConnected(false);
            startPolling();
          }
        });

        // Cleanup on unmount or roomId change
        return () => {
          cancelled = true;
          channel.unsubscribe();
          channelRef.current = null;
          setIsConnected(false);
          setConnectionMethod(null);
        };
      } catch (e) {
        console.warn("[room-sync] realtime setup failed, falling back to polling:", e.message);
        startPolling();
        return fetchState();
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      stopPolling();
      setIsConnected(false);
      setConnectionMethod(null);
    };
  }, [roomId, session, isHost, startPolling, fetchState]);

  /* ── prune reactions periodically ─────────────────────────────────── */

  useEffect(() => {
    const timer = setInterval(() => {
      setReactions(prev => pruneReactions(prev, Date.now()));
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  /* ── broadcastSync for host ───────────────────────────────────────── */

  const broadcastSync = useCallback((payload) => {
    if (channelRef.current && payload) {
      channelRef.current.send({ type: "broadcast", event: "playback", payload });
    }
  }, []);

  /* ── sendReaction (broadcast for instant; API call done by caller) ── */

  const broadcastReaction = useCallback((emoji, username) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "reaction",
        payload: { emoji, username, at: Date.now() },
      });
    }
  }, []);

  return {
    participants,
    queue,
    playback,
    reactions,
    isConnected,
    connectionMethod,
    broadcastSync,
    broadcastReaction,
    refreshState: fetchState,
  };
}

/**
 * Drift correction: compare local audio position to target.
 * Returns a correction function to call on each animation frame or interval.
 */
export function createDriftCorrector(audioRef, ytPlayerRef, getSource) {
  let lastCorrectionAt = 0;
  const THRESHOLD_IGNORE = 0.6;    // seconds — do nothing
  const THRESHOLD_RATE   = 2.0;    // seconds — rate nudge zone
  const THRESHOLD_SEEK   = 4.0;    // seconds — hard seek
  const RATE_NUDGE       = 0.04;   // ±4% playback rate nudge
  const MIN_CORRECTION_INTERVAL = 3_000; // ms between hard seeks

  return function correctDrift(targetPositionSec) {
    const source = getSource();
    if (source === "yt" || !audioRef.current) return;
    const audio = audioRef.current;
    if (audio.paused || !audio.duration) return;

    const local = audio.currentTime;
    const drift = Math.abs(local - targetPositionSec);
    const now = Date.now();

    if (drift < THRESHOLD_IGNORE) {
      // Reset rate if it was nudged
      if (audio.playbackRate !== 1) audio.playbackRate = 1;
      return;
    }

    if (drift < THRESHOLD_RATE) {
      // Gentle rate nudge
      audio.playbackRate = 1 + (targetPositionSec > local ? RATE_NUDGE : -RATE_NUDGE);
      return;
    }

    if (drift >= THRESHOLD_SEEK && now - lastCorrectionAt > MIN_CORRECTION_INTERVAL) {
      audio.playbackRate = 1;
      audio.currentTime = targetPositionSec;
      lastCorrectionAt = now;
    }
  };
}
