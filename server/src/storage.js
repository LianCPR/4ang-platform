/**
 * 4ANG Supabase Storage Helper
 *
 * Uploads files to Supabase Storage buckets.
 * Falls back to local disk when SUPABASE_URL is not configured,
 * so the dev experience stays identical.
 *
 * Buckets:
 *   audio          — submission audio (private)
 *   artwork        — submission covers (public)
 *   avatars        — user & artist avatars (public)
 *   artist-images  — artist cover images (public)
 *   videos         — submission videos (private)
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Local fallback dirs (same as current uploads/) ─────────────
const LOCAL_BASE = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
const LOCAL_DIRS = {
  audio: LOCAL_BASE,
  artwork: path.join(LOCAL_BASE, "covers"),
  avatars: path.join(LOCAL_BASE, "avatars"),
  "artist-images": path.join(LOCAL_BASE, "artist-images"),
  videos: path.join(LOCAL_BASE, "videos"),
};

// Ensure local dirs exist
for (const dir of Object.values(LOCAL_DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Supabase availability ─────────────────────────────────────
const supabaseReady = () => {
  const url = process.env.SUPABASE_URL;
  return url && !url.includes("placeholder");
};

// ── MIME → extension whitelists ────────────────────────────────
const AUDIO_EXT = { "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/flac": ".flac", "audio/x-m4a": ".m4a", "audio/mp4": ".m4a" };
const IMAGE_EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
const VIDEO_EXT = { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov" };

function extForMime(mime, whitelist) {
  return whitelist[mime] || "";
}

// ── Size limits ────────────────────────────────────────────────
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;   // 30 MB
export const MAX_COVER_BYTES = 8 * 1024 * 1024;     // 8 MB
export const MAX_VIDEO_BYTES = 150 * 1022 * 1024;   // 150 MB

// ── Upload functions ──────────────────────────────────────────

/**
 * Upload a buffer to Supabase Storage.
 * @param {string} bucket - Bucket name (audio|artwork|avatars|artist-images|videos)
 * @param {string} userId - User ID or username for path prefix
 * @param {Buffer} buffer - File contents
 * @param {string} mimeType - MIME type
 * @param {string} originalName - Original filename (for extension fallback)
 * @returns {{ path: string, url: string, publicUrl?: string }}
 */
export async function uploadFile(bucket, userId, buffer, mimeType, originalName) {
  const ext = extForMime(mime, getWhitelist(bucket)) || path.extname(originalName) || "";
  const filename = `${randomUUID()}${ext}`;
  const filePath = `${userId}/${filename}`;

  if (supabaseReady()) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Get public URL for public buckets, signed URL for private
    let url;
    if (bucket === "artwork" || bucket === "avatars" || bucket === "artist-images") {
      const { data: pubData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
      url = pubData?.publicUrl || "";
    } else {
      // Private bucket — create signed URL (1 year)
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(filePath, 365 * 24 * 60 * 60);
      if (signedError) throw new Error(`Signed URL failed: ${signedError.message}`);
      url = signedData?.signedUrl || "";
    }

    return { path: filePath, url, publicUrl: bucket !== "audio" && bucket !== "videos" ? url : undefined };
  }

  // ── Local fallback ──────────────────────────────────────────
  const localDir = LOCAL_DIRS[bucket] || LOCAL_BASE;
  const localPath = path.join(localDir, filename);
  fs.writeFileSync(localPath, buffer);
  return { path: filename, url: `/api/${bucket}/${filename}` };
}

/**
 * Delete a file from Supabase Storage or local disk.
 */
export async function deleteFile(bucket, filePath) {
  if (!filePath) return;

  if (supabaseReady()) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath]);
    if (error) console.warn(`[storage] delete failed for ${bucket}/${filePath}:`, error.message);
    return;
  }

  // Local fallback
  const localDir = LOCAL_DIRS[bucket] || LOCAL_BASE;
  const fullPath = path.join(localDir, filePath);
  fs.unlink(fullPath, () => {});
}

/**
 * Get a public or signed URL for an existing file.
 */
export async function getFileUrl(bucket, filePath) {
  if (!filePath) return null;

  if (supabaseReady()) {
    if (bucket === "artwork" || bucket === "avatars" || bucket === "artist-images") {
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
      return data?.publicUrl || null;
    }
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 365 * 24 * 60 * 60);
    if (error) return null;
    return data?.signedUrl || null;
  }

  // Local fallback
  return `/api/${bucket}/${filePath}`;
}

// ── Helpers ────────────────────────────────────────────────────

function getWhitelist(bucket) {
  switch (bucket) {
    case "audio": return AUDIO_EXT;
    case "artwork":
    case "avatars":
    case "artist-images": return IMAGE_EXT;
    case "videos": return VIDEO_EXT;
    default: return {};
  }
}

function mime(bucket, file) {
  if (file?.mimetype) return file.mimetype;
  const ext = path.extname(file?.originalname || "").toLowerCase();
  if (bucket === "audio") return ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : ext === ".flac" ? "audio/flac" : "audio/m4a";
  if (bucket === "videos") return ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "video/quicktime";
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
}
