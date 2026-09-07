/**
 * 4ang Identity Types
 *
 * Typed identity model built around Supabase Auth.
 */

// ═══════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════

export type UserRole = "user" | "artist" | "verified_artist" | "moderator" | "admin";

// ═══════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════

export type Permission =
  // Music
  | "music.read"
  | "music.upload"
  | "music.edit_own"
  | "music.delete_own"
  | "music.moderate"
  // Artist
  | "artist.manage_own"
  | "artist.verified"
  | "artist.studio"
  | "artist.publish"
  // Playlist
  | "playlist.create"
  | "playlist.edit_own"
  | "playlist.delete_own"
  // Social
  | "social.post"
  | "social.comment"
  | "social.follow"
  | "social.share"
  // Room
  | "room.create"
  | "room.moderate"
  // AI
  | "ai.assistant"
  | "ai.recommendations"
  // Admin
  | "admin.manage"
  | "admin.users"
  | "admin.moderation"
  | "admin.analytics";

// ═══════════════════════════════════════════════════════════════════
// ROLE → PERMISSION MAPPING
// ═══════════════════════════════════════════════════════════════════

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    "music.read",
    "playlist.create",
    "playlist.edit_own",
    "playlist.delete_own",
    "social.post",
    "social.comment",
    "social.follow",
    "social.share",
    "room.create",
    "ai.assistant",
    "ai.recommendations",
  ],
  artist: [
    "music.read",
    "music.upload",
    "music.edit_own",
    "music.delete_own",
    "artist.manage_own",
    "artist.studio",
    "artist.publish",
    "playlist.create",
    "playlist.edit_own",
    "playlist.delete_own",
    "social.post",
    "social.comment",
    "social.follow",
    "social.share",
    "room.create",
    "ai.assistant",
    "ai.recommendations",
  ],
  verified_artist: [
    "music.read",
    "music.upload",
    "music.edit_own",
    "music.delete_own",
    "artist.manage_own",
    "artist.verified",
    "artist.studio",
    "artist.publish",
    "playlist.create",
    "playlist.edit_own",
    "playlist.delete_own",
    "social.post",
    "social.comment",
    "social.follow",
    "social.share",
    "room.create",
    "ai.assistant",
    "ai.recommendations",
  ],
  moderator: [
    "music.read",
    "music.moderate",
    "playlist.create",
    "playlist.edit_own",
    "playlist.delete_own",
    "social.post",
    "social.comment",
    "social.follow",
    "social.share",
    "room.create",
    "room.moderate",
    "ai.assistant",
    "ai.recommendations",
    "admin.moderation",
  ],
  admin: [
    "music.read",
    "music.upload",
    "music.edit_own",
    "music.delete_own",
    "music.moderate",
    "artist.manage_own",
    "artist.verified",
    "artist.studio",
    "artist.publish",
    "playlist.create",
    "playlist.edit_own",
    "playlist.delete_own",
    "social.post",
    "social.comment",
    "social.follow",
    "social.share",
    "room.create",
    "room.moderate",
    "ai.assistant",
    "ai.recommendations",
    "admin.manage",
    "admin.users",
    "admin.moderation",
    "admin.analytics",
  ],
};

// ═══════════════════════════════════════════════════════════════════
// IDENTITY CONTEXT
// ═══════════════════════════════════════════════════════════════════

export interface IdentityContext {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  permissions: Permission[];
  isArtist: boolean;
  isVerifiedArtist: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  avatarUrl?: string;
  displayName?: string;
}

// ═══════════════════════════════════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════════════════════════════════

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: UserRole;
  is_restricted?: boolean;
  follower_count?: number;
  following_count?: number;
  created_at: string;
  updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function buildIdentityContext(profile: UserProfile): IdentityContext {
  const role = profile.role || "user";
  return {
    userId: profile.id,
    username: profile.username,
    role,
    permissions: getPermissionsForRole(role),
    isArtist: role === "artist" || role === "verified_artist",
    isVerifiedArtist: role === "verified_artist",
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    avatarUrl: profile.avatar_url,
    displayName: profile.display_name,
  };
}
