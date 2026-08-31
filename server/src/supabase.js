import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[4ANG] Supabase URL or Anon Key not configured.");
}

// Client with anon key — respects RLS (for user-context operations)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

// Client with service role key — bypasses RLS (for admin/server operations)
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || supabaseAnonKey || "placeholder-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Verify a Supabase JWT token and return the user.
 * Used by requireAuth middleware.
 */
export async function verifyToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Get user profile from the profiles table.
 */
export async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

/**
 * Check if user is admin.
 */
export async function isAdmin(userId) {
  const profile = await getProfile(userId);
  return profile?.role === "admin";
}

/**
 * Check if user is restricted.
 */
export async function isRestricted(userId) {
  const profile = await getProfile(userId);
  return profile?.is_restricted === true;
}
