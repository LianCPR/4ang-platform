-- ═══════════════════════════════════════════════════════════════════════
-- 018 — MUSIC ROOMS / LISTENING TOGETHER (Phase 2.2)
-- Durable room state, participants, shared queue, reactions.
-- Realtime layer uses Supabase Realtime (presence + broadcast +
-- postgres_changes); PostgreSQL stores only durable state, never
-- per-second playback positions.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. ROOMS
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public','private')),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_username TEXT NOT NULL,
  join_code TEXT,
  -- Current playback (durable, updated on significant events only)
  current_track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  is_playing BOOLEAN NOT NULL DEFAULT FALSE,
  position_ms BIGINT NOT NULL DEFAULT 0,
  playback_started_at TIMESTAMPTZ,
  -- Queue cursor: the room_queue.position row currently playing
  current_queue_position INTEGER NOT NULL DEFAULT 0,
  queue_version INTEGER NOT NULL DEFAULT 0,
  -- Settings
  allow_song_adds BOOLEAN NOT NULL DEFAULT TRUE,
  allow_reactions BOOLEAN NOT NULL DEFAULT TRUE,
  participant_limit INTEGER NOT NULL DEFAULT 60 CHECK (participant_limit BETWEEN 2 AND 200),
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_active ON public.rooms(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON public.rooms(host_username, status);
CREATE INDEX IF NOT EXISTS idx_rooms_created ON public.rooms(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 2. ROOM PARTICIPANTS (presence base; realtime refines it client-side)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('host','listener')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);

-- ───────────────────────────────────────────────────────────────────────
-- 3. ROOM QUEUE (shared ordering; position is renumbered on write)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  added_by_username TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_queue_room ON public.room_queue(room_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_queue_room_pos ON public.room_queue(room_id, position);

-- ───────────────────────────────────────────────────────────────────────
-- 4. ROOM REACTIONS (transient, rate-limited server-side, pruned)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_reactions_room ON public.room_reactions(room_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 5. ROOM INVITES (explicit user invites -> ROOM_INVITE notifications)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  inviter_username TEXT NOT NULL,
  invitee_username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (room_id, invitee_username)
);

CREATE INDEX IF NOT EXISTS idx_room_invites_invitee ON public.room_invites(invitee_username, status);

-- ───────────────────────────────────────────────────────────────────────
-- 6. Helper: is the given user a member of the room?
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_room_member(uid uuid, rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = rid AND rp.user_id = uid);
$$;

CREATE OR REPLACE FUNCTION public.is_room_host(uid uuid, rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms r
    WHERE r.id = rid AND r.host_id = uid AND r.status = 'active');
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 7. RLS — rooms
-- Public: active public rooms readable by any authenticated user.
-- Private: only members can read.
-- Host can update/delete their own active room.
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_members_and_public" ON public.rooms;
CREATE POLICY "rooms_select_members_and_public" ON public.rooms
  FOR SELECT TO authenticated
  USING (status = 'active' AND (privacy = 'public'
     OR public.is_room_member(auth.uid(), id)));

DROP POLICY IF EXISTS "rooms_insert_own" ON public.rooms;
CREATE POLICY "rooms_insert_own" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "rooms_update_host" ON public.rooms;
CREATE POLICY "rooms_update_host" ON public.rooms
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid() AND status = 'active');

DROP POLICY IF EXISTS "rooms_delete_host" ON public.rooms;
CREATE POLICY "rooms_delete_host" ON public.rooms
  FOR DELETE TO authenticated
  USING (host_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────
-- 8. RLS — room_participants
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select_own_or_member" ON public.room_participants;
CREATE POLICY "participants_select_own_or_member" ON public.room_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.rooms r
            WHERE r.id = room_id AND r.status = 'active'
              AND (r.privacy = 'public' OR public.is_room_member(auth.uid(), r.id))));

DROP POLICY IF EXISTS "participants_insert_own" ON public.room_participants;
CREATE POLICY "participants_insert_own" ON public.room_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'listener');

DROP POLICY IF EXISTS "participants_update_own" ON public.room_participants;
CREATE POLICY "participants_update_own" ON public.room_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "participants_delete_own" ON public.room_participants;
CREATE POLICY "participants_delete_own" ON public.room_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────
-- 9. RLS — room_queue
-- Read: any member of the room (public rooms are readable when you can
-- read the room). Write: members may add; host may update/delete.
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.room_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "queue_select_member" ON public.room_queue;
CREATE POLICY "queue_select_member" ON public.room_queue
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms r
          WHERE r.id = room_id AND r.status = 'active'
            AND (r.privacy = 'public' OR public.is_room_member(auth.uid(), r.id))));

DROP POLICY IF EXISTS "queue_insert_member" ON public.room_queue;
CREATE POLICY "queue_insert_member" ON public.room_queue
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r
          WHERE r.id = room_id AND r.status = 'active'
            AND public.is_room_member(auth.uid(), r.id)
            AND r.allow_song_adds = TRUE));

DROP POLICY IF EXISTS "queue_update_host" ON public.room_queue;
CREATE POLICY "queue_update_host" ON public.room_queue
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));

DROP POLICY IF EXISTS "queue_delete_host" ON public.room_queue;
CREATE POLICY "queue_delete_host" ON public.room_queue
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));

-- ───────────────────────────────────────────────────────────────────────
-- 10. RLS — room_reactions (members may view room + insert own)
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.room_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_member" ON public.room_reactions;
CREATE POLICY "reactions_select_member" ON public.room_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms r
          WHERE r.id = room_id AND r.status = 'active'
            AND (r.privacy = 'public' OR public.is_room_member(auth.uid(), r.id))));

DROP POLICY IF EXISTS "reactions_insert_member" ON public.room_reactions;
CREATE POLICY "reactions_insert_member" ON public.room_reactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r
          WHERE r.id = room_id AND r.status = 'active'
            AND public.is_room_member(auth.uid(), r.id)
            AND r.allow_reactions = TRUE));

-- ───────────────────────────────────────────────────────────────────────
-- 11. RLS — room_invites (invitee sees their own; host sees room's)
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites_select_invitee_or_host" ON public.room_invites;
CREATE POLICY "invites_select_invitee_or_host" ON public.room_invites
  FOR SELECT TO authenticated
  USING (invitee_username = (SELECT username FROM public.profiles WHERE id = auth.uid())
   OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));

-- ───────────────────────────────────────────────────────────────────────
-- 12. Realtime availability — add room tables to the realtime publication
-- so postgres_changes can replicate. Runs guarded for projects where the
-- publication exists (enabled via Realtime settings).
-- ───────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_queue';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_reactions';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;