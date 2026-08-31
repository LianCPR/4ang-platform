/**
 * 4ANG Data Migration Route
 * Admin-only endpoint to migrate existing SQLite data to Supabase.
 * 
 * Usage:
 *   POST /api/migrate/to-supabase  — migrate all data
 *   POST /api/migrate/check        — check what data exists
 * 
 * Only works when SUPABASE_URL is configured.
 */
import express from "express";
import { db } from "../db.js";
import { supabaseAdmin } from "../supabase.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = express.Router();
const USE_SUPABASE = !!process.env.SUPABASE_URL;

// ─── Check existing data ────────────────────────────────────────
router.get("/check", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) {
    return res.status(400).json({ error: "Supabase chưa được cấu hình." });
  }

  const counts = {};
  const tables = [
    "users", "artists", "tracks", "albums", "album_songs",
    "playlists", "playlist_songs", "likes", "saves",
    "comments", "recently_played", "notifications",
    "artist_follows", "play_events", "submissions",
    "music_submissions", "lyrics",
  ];

  for (const table of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
      counts[table] = row?.c || 0;
    } catch {
      counts[table] = "N/A";
    }
  }

  // Check Supabase tables
  const supaCounts = {};
  for (const table of ["profiles", "artists", "tracks", "playlists", "playlist_songs", "likes", "saves", "play_events", "notifications"]) {
    try {
      const { count } = await supabaseAdmin
        .from(table).select("*", { count: "exact", head: true });
      supaCounts[table] = count || 0;
    } catch (e) {
      supaCounts[table] = `Error: ${e.message?.slice(0, 50)}`;
    }
  }

  res.json({ sqlite: counts, supabase: supaCounts });
});

// ─── Migrate users → profiles ───────────────────────────────────
router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const users = db.prepare("SELECT * FROM users").all();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const u of users) {
    try {
      // Check if profile exists
      const { data: existing } = await supabaseAdmin
        .from("profiles").select("id").eq("username", u.username).single();
      if (existing) { results.skipped++; continue; }

      // Create Supabase auth user
      const supaId = u.id || crypto.randomUUID();
      const tempPassword = crypto.randomUUID();

      // Try creating auth user (may fail if email already exists)
      const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
        id: supaId,
        email: u.email || `${u.username}@migrated.4ang.local`,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { username: u.username, display_name: u.display_name },
      });

      if (authErr && !authErr.message?.includes("already")) {
        results.errors.push(`${u.username}: ${authErr.message}`);
        continue;
      }

      // Get actual Supabase user ID
      let userId = supaId;
      if (authErr?.message?.includes("already")) {
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers({
          filter: u.email || `${u.username}@migrated.4ang.local`,
        });
        userId = existingUser?.users?.[0]?.id || supaId;
      }

      // Create profile
      const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        username: u.username,
        display_name: u.display_name,
        email: u.email || null,
        phone: u.phone || null,
        avatar_url: u.avatar_url || null,
        bio: u.bio || "",
        role: u.is_admin ? "admin" : "user",
        email_verified: !!u.email_verified,
        phone_verified: !!u.phone_verified,
        is_restricted: !!u.is_restricted,
        restricted_reason: u.restricted_reason || null,
        restricted_at: u.restricted_at || null,
        created_at: u.created_at || Date.now(),
        updated_at: Date.now(),
      }, { onConflict: "id" });

      if (profileErr) {
        results.errors.push(`${u.username} profile: ${profileErr.message}`);
        continue;
      }

      results.created++;
    } catch (e) {
      results.errors.push(`${u.username}: ${e.message}`);
    }
  }

  res.json(results);
});

// ─── Migrate artists ────────────────────────────────────────────
router.post("/artists", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const artists = db.prepare("SELECT * FROM artists").all();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const a of artists) {
    try {
      const { data: existing } = await supabaseAdmin
        .from("artists").select("id").eq("username", a.username).single();
      if (existing) { results.skipped++; continue; }

      // Get the profile for this user
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(a.username);
      let profileId = user?.id || null;

      // If profile doesn't exist in Supabase yet, skip
      if (profileId) {
        const { data: supaProfile } = await supabaseAdmin
          .from("profiles").select("id").eq("id", profileId).single();
        if (!supaProfile) {
          results.errors.push(`${a.username}: profile not in Supabase`);
          continue;
        }
      }

      const { error } = await supabaseAdmin.from("artists").insert({
        id: a.id || crypto.randomUUID(),
        user_id: profileId,
        username: a.username,
        artist_name: a.artist_name,
        avatar_url: a.avatar_url || null,
        cover_url: a.cover_url || null,
        bio: a.bio || "",
        genres: a.genres || [],
        links: a.links || [],
        verification_status: a.verification_status || "none",
        verification_note: a.verification_note || null,
        created_at: a.created_at || Date.now(),
      });

      if (error) {
        results.errors.push(`${a.username}: ${error.message}`);
        continue;
      }
      results.created++;
    } catch (e) {
      results.errors.push(`${a.username}: ${e.message}`);
    }
  }

  res.json(results);
});

// ─── Migrate tracks ─────────────────────────────────────────────
router.post("/tracks", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const tracks = db.prepare("SELECT * FROM tracks").all();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const t of tracks) {
    try {
      const { data: existing } = await supabaseAdmin
        .from("tracks").select("id").eq("id", t.id).single();
      if (existing) { results.skipped++; continue; }

      // Get uploader profile
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(t.uploader_id);
      let uploaderId = user?.id || t.uploader_id;

      const { error } = await supabaseAdmin.from("tracks").insert({
        id: t.id,
        title: t.title,
        uploader_id: uploaderId,
        description: t.description || "",
        audio_url: t.audio_url || "",
        cover_url: t.cover_url || "",
        video_url: t.video_url || "",
        duration: t.duration || null,
        genres: t.genres || [],
        lyrics: t.lyrics || "",
        timed_lyrics: t.timed_lyrics || null,
        status: t.status || "approved",
        share_count: t.share_count || 0,
        play_count: t.play_count || 0,
        isrc: t.isrc || null,
        rights_holder: t.rights_holder || null,
        rights_year: t.rights_year || null,
        rights_label: t.rights_label || null,
        rights_record_id: t.rights_record_id || null,
        rights_declared_at: t.rights_declared_at || null,
        release_date: t.release_date || null,
        created_at: t.created_at || Date.now(),
        updated_at: t.updated_at || Date.now(),
      });

      if (error) {
        results.errors.push(`${t.title}: ${error.message}`);
        continue;
      }
      results.created++;
    } catch (e) {
      results.errors.push(`${t.title}: ${e.message}`);
    }
  }

  res.json(results);
});

// ─── Migrate playlists ──────────────────────────────────────────
router.post("/playlists", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const playlists = db.prepare("SELECT * FROM playlists").all();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const p of playlists) {
    try {
      const { data: existing } = await supabaseAdmin
        .from("playlists").select("id").eq("id", p.id).single();
      if (existing) { results.skipped++; continue; }

      const { error } = await supabaseAdmin.from("playlists").insert({
        id: p.id,
        owner_id: p.owner_id,
        title: p.title,
        description: p.description || "",
        cover_url: p.cover_url || null,
        is_public: !!p.is_public,
        track_count: p.track_count || 0,
        created_at: p.created_at || Date.now(),
        updated_at: p.updated_at || Date.now(),
      });

      if (error) { results.errors.push(`${p.title}: ${error.message}`); continue; }

      // Migrate playlist songs
      const songs = db.prepare("SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC").all(p.id);
      for (const s of songs) {
        await supabaseAdmin.from("playlist_songs").upsert({
          playlist_id: p.id,
          track_id: s.track_id,
          position: s.position || 0,
          added_at: s.added_at || Date.now(),
        }, { onConflict: "playlist_id,track_id" });
      }

      results.created++;
    } catch (e) {
      results.errors.push(`${p.title}: ${e.message}`);
    }
  }

  res.json(results);
});

// ─── Migrate likes ──────────────────────────────────────────────
router.post("/likes", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const likes = db.prepare("SELECT * FROM likes").all();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const l of likes) {
    try {
      const { error } = await supabaseAdmin.from("likes").upsert({
        user_id: l.user_id,
        track_id: l.track_id,
        created_at: l.created_at || Date.now(),
      }, { onConflict: "user_id,track_id" });

      if (error) { results.errors.push(`${l.user_id}/${l.track_id}: ${error.message}`); continue; }
      results.created++;
    } catch (e) {
      results.errors.push(`${l.user_id}/${l.track_id}: ${e.message}`);
    }
  }

  res.json(results);
});

// ─── Migrate submissions ────────────────────────────────────────
router.post("/submissions", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const subs = db.prepare("SELECT * FROM music_submissions").all();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const s of subs) {
    try {
      const { data: existing } = await supabaseAdmin
        .from("submissions").select("id").eq("id", s.id).single();
      if (existing) { results.skipped++; continue; }

      const { error } = await supabaseAdmin.from("submissions").insert({
        id: s.id,
        artist_username: s.artist_username,
        status: s.status || "pending",
        title: s.title || null,
        notes: s.notes || null,
        admin_note: s.admin_note || null,
        created_at: s.created_at || Date.now(),
        updated_at: s.updated_at || Date.now(),
      });

      if (error) { results.errors.push(`${s.id}: ${error.message}`); continue; }
      results.created++;
    } catch (e) {
      results.errors.push(`${s.id}: ${e.message}`);
    }
  }

  res.json(results);
});

// ─── Run all migrations ─────────────────────────────────────────
router.post("/all", requireAuth, requireAdmin, async (req, res) => {
  if (!USE_SUPABASE) return res.status(400).json({ error: "Supabase chưa được cấu hình." });

  const results = {};

  // Users first (creates profiles)
  try {
    const users = db.prepare("SELECT * FROM users").all();
    let created = 0, skipped = 0, errors = [];

    for (const u of users) {
      try {
        const { data: existing } = await supabaseAdmin
          .from("profiles").select("id").eq("username", u.username).single();
        if (existing) { skipped++; continue; }

        const supaId = u.id || crypto.randomUUID();
        const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
          id: supaId,
          email: u.email || `${u.username}@migrated.4ang.local`,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { username: u.username, display_name: u.display_name },
        });

        let userId = supaId;
        if (authErr?.message?.includes("already")) {
          const { data: eu } = await supabaseAdmin.auth.admin.listUsers({
            filter: u.email || `${u.username}@migrated.4ang.local`,
          });
          userId = eu?.users?.[0]?.id || supaId;
        } else if (authErr) {
          errors.push(`${u.username}: ${authErr.message}`);
          continue;
        }

        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          username: u.username,
          display_name: u.display_name,
          email: u.email || null,
          phone: u.phone || null,
          avatar_url: u.avatar_url || null,
          bio: u.bio || "",
          role: u.is_admin ? "admin" : "user",
          email_verified: !!u.email_verified,
          phone_verified: !!u.phone_verified,
          is_restricted: !!u.is_restricted,
          created_at: u.created_at || Date.now(),
          updated_at: Date.now(),
        }, { onConflict: "id" });

        created++;
      } catch (e) { errors.push(`${u.username}: ${e.message}`); }
    }
    results.users = { created, skipped, errors: errors.slice(0, 5) };
  } catch (e) { results.users = { error: e.message }; }

  // Tracks
  try {
    const tracks = db.prepare("SELECT * FROM tracks").all();
    let created = 0, skipped = 0, errors = [];
    for (const t of tracks) {
      try {
        const { data: existing } = await supabaseAdmin.from("tracks").select("id").eq("id", t.id).single();
        if (existing) { skipped++; continue; }
        const { error } = await supabaseAdmin.from("tracks").insert({
          id: t.id, title: t.title, uploader_id: t.uploader_id,
          description: t.description || "", audio_url: t.audio_url || "",
          cover_url: t.cover_url || "", video_url: t.video_url || "",
          duration: t.duration || null, genres: t.genres || [],
          lyrics: t.lyrics || "", timed_lyrics: t.timed_lyrics || null,
          status: t.status || "approved", share_count: t.share_count || 0,
          play_count: t.play_count || 0, release_date: t.release_date || null,
          created_at: t.created_at || Date.now(), updated_at: t.updated_at || Date.now(),
        });
        if (error) { errors.push(error.message); continue; }
        created++;
      } catch (e) { errors.push(e.message); }
    }
    results.tracks = { created, skipped, errors: errors.slice(0, 5) };
  } catch (e) { results.tracks = { error: e.message }; }

  // Playlists + songs
  try {
    const playlists = db.prepare("SELECT * FROM playlists").all();
    let created = 0, skipped = 0, errors = [];
    for (const p of playlists) {
      try {
        const { data: existing } = await supabaseAdmin.from("playlists").select("id").eq("id", p.id).single();
        if (existing) { skipped++; continue; }
        await supabaseAdmin.from("playlists").insert({
          id: p.id, owner_id: p.owner_id, title: p.title,
          description: p.description || "", cover_url: p.cover_url || null,
          is_public: !!p.is_public, track_count: p.track_count || 0,
          created_at: p.created_at || Date.now(), updated_at: p.updated_at || Date.now(),
        });
        const songs = db.prepare("SELECT * FROM playlist_songs WHERE playlist_id = ?").all(p.id);
        for (const s of songs) {
          await supabaseAdmin.from("playlist_songs").upsert({
            playlist_id: p.id, track_id: s.track_id,
            position: s.position || 0, added_at: s.added_at || Date.now(),
          }, { onConflict: "playlist_id,track_id" });
        }
        created++;
      } catch (e) { errors.push(e.message); }
    }
    results.playlists = { created, skipped, errors: errors.slice(0, 5) };
  } catch (e) { results.playlists = { error: e.message }; }

  // Likes
  try {
    const likes = db.prepare("SELECT * FROM likes").all();
    let created = 0, skipped = 0, errors = [];
    for (const l of likes) {
      try {
        const { error } = await supabaseAdmin.from("likes").upsert({
          user_id: l.user_id, track_id: l.track_id,
          created_at: l.created_at || Date.now(),
        }, { onConflict: "user_id,track_id" });
        if (error) { errors.push(error.message); continue; }
        created++;
      } catch (e) { errors.push(e.message); }
    }
    results.likes = { created, skipped, errors: errors.slice(0, 5) };
  } catch (e) { results.likes = { error: e.message }; }

  res.json(results);
});

export default router;
