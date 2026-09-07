/**
 * 4ang Identity Types — Shared
 */

export type UserRole = "user" | "artist" | "verified_artist" | "moderator" | "admin";

export type Permission =
  | "music.read" | "music.upload" | "music.edit_own" | "music.delete_own" | "music.moderate"
  | "artist.manage_own" | "artist.verified" | "artist.studio" | "artist.publish"
  | "playlist.create" | "playlist.edit_own" | "playlist.delete_own"
  | "social.post" | "social.comment" | "social.follow" | "social.share"
  | "room.create" | "room.moderate"
  | "ai.assistant" | "ai.recommendations"
  | "admin.manage" | "admin.users" | "admin.moderation" | "admin.analytics";

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
