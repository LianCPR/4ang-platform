/**
 * 4ANG Social Helpers — content sanitisation, mention detection,
 * comment reply/mentions -> notification mapping, list helpers.
 *
 * Shared by the comments and social routes so comment/reaction logic
 * is not duplicated.
 */
import { supabaseAdmin } from "./supabase.js";
import { createNotification } from "./db.js";

// ────────────────────────────────────────────────────────────────
// Content sanitisation / validation
// ────────────────────────────────────────────────────────────────

// Strip HTML/script and normalise whitespace. Returns a plain-text string.
export function sanitizeText(input, maxLength = 1000) {
  if (typeof input !== "string") return "";
  let s = input
    .replace(/<[^>]*>/g, "")   // remove tags
    .replace(/&[a-zA-Z#0-9]+;/g, " ") // remove entities
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); // control chars
  // collapse excessive repeated characters (e.g. "!!!!!" -> "!!!")
  s = s.replace(/(.)\1{6,}/g, (m, c) => c.repeat(3));
  s = s.trim();
  return s.slice(0, maxLength);
}

export function isBlank(s) {
  return !s || s.trim().length === 0;
}

// Detect @mentions referencing real user usernames.
// Returns array of { username, displayName } for each mention found.
export async function extractMentions(text) {
  if (!text) return [];
  const candidates = new Set();
  const re = /(^|\s)@([A-Za-z0-9_.]{1,40})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const u = m[2];
    if (u && !/^(you|everyone|all)$/i.test(u)) candidates.add(u.toLowerCase());
  }
  if (candidates.size === 0) return [];

  const unique = [...candidates];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("username, display_name")
    .in("username", unique);

  return (profiles || []).map((p) => ({
    username: p.username,
    displayName: p.display_name || p.username,
  }));
}

// ────────────────────────────────────────────────────────────────
// Notification guards
// ────────────────────────────────────────────────────────────────

// Never notify the actor about their own action.
// Detect if an existing similar notification was made too recently to
// avoid notification spam (e.g. rapid like/unlike loops).
export async function shouldNotify(targetUsername, actorUsername, type, targetType, targetId, minIntervalMs = 5 * 60 * 1000) {
  if (!targetUsername || !actorUsername) return false;
  if (String(targetUsername).toLowerCase() === String(actorUsername).toLowerCase()) return false;

  // Recent duplicate check (same actor, same type, same target)
  const since = new Date(Date.now() - minIntervalMs).toISOString();
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("username", targetUsername)
    .eq("actor_username", actorUsername)
    .eq("type", type)
    .eq("target_type", targetType || null)
    .eq("target_id", targetId || null)
    .gte("created_at", since)
    .limit(1);

  return !data || data.length === 0;
}

// ────────────────────────────────────────────────────────────────
// Shared comment/activity list helpers
// ────────────────────────────────────────────────────────────────

// Batch-fetch profiles to enrich comment/reaction author info.
export async function getProfilesByUsernames(usernames) {
  const uniq = [...new Set(usernames.filter(Boolean))];
  if (uniq.length === 0) return {};
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username, display_name, avatar_url, role")
    .in("username", uniq);
  const map = {};
  for (const p of (data || [])) map[p.username] = p;
  return map;
}
