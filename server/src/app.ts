/**
 * 4ang Express Application
 *
 * Configures middleware, routes, and error handling.
 */

import express from "express";
import cors from "cors";
import { getConfig } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import v1Routes from "./routes/v1/index.js";

// Import existing routes for backward compatibility
import authRoutes from "./routes/auth.js";
import trackRoutes from "./routes/tracks.js";
import adminRoutes, { publicBannerRouter } from "./routes/admin.js";
import artistRoutes from "./routes/artists.js";
import submissionRoutes from "./routes/submissions.js";
import reportRoutes from "./routes/reports.js";
import playlistRoutes from "./routes/playlists.js";
import discoverRoutes from "./routes/discover.js";
import socialDiscoveryRoutes from "./routes/social-discovery.js";
import notificationRoutes from "./routes/notifications.js";
import libraryRoutes from "./routes/library.js";
import socialRoutes from "./routes/social.js";
import commentRoutes from "./routes/comments.js";
import roomsRoutes from "./routes/rooms.js";
import releaseRoutes from "./routes/releases.js";
import artistAppRoutes from "./routes/artist-applications.js";
import supportRoutes from "./routes/support.js";
import migrateRoutes from "./routes/migrate.js";
import artistPostRoutes from "./routes/artist-posts.js";
import recommendationRoutes from "./routes/recommendations.js";
import aiRoutes from "./routes/ai.js";
import assistantRoutes from "./routes/assistant.js";

export function createApp() {
  const app = express();
  const config = getConfig();

  // ═══════════════════════════════════════════════════════════════════
  // MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  // Request ID (first — before everything else)
  app.use(requestIdMiddleware);

  // CORS
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.CORS_ORIGINS.includes("*") || config.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS origin not allowed"));
      }
    },
  }));

  // Body parsing
  app.use(express.json({ limit: "1mb" }));

  // ═══════════════════════════════════════════════════════════════════
  // API v1 ROUTES (new architecture)
  // ═══════════════════════════════════════════════════════════════════

  app.use("/api/v1", v1Routes);

  // ═══════════════════════════════════════════════════════════════════
  // LEGACY ROUTES (backward compatibility)
  // ═══════════════════════════════════════════════════════════════════

  // Health check (legacy)
  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "song-backend", time: new Date().toISOString() });
  });

  // Legacy route mounting (preserves existing frontend calls)
  app.use("/api/auth", authRoutes);
  app.use("/api/tracks", trackRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", publicBannerRouter);
  app.use("/api/artists", artistRoutes);
  app.use("/api/submissions", submissionRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/playlists", playlistRoutes);
  app.use("/api/discover", discoverRoutes);
  app.use("/api/discover", socialDiscoveryRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/library", libraryRoutes);
  app.use("/api/social", socialRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/rooms", roomsRoutes);
  app.use("/api/releases", releaseRoutes);
  app.use("/api/artist-applications", artistAppRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/migrate", migrateRoutes);
  app.use("/api/artist-posts", artistPostRoutes);
  app.use("/api/recommendations", recommendationRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/assistant", assistantRoutes);

  // ═══════════════════════════════════════════════════════════════════
  // STATIC FILES (uploads)
  // ═══════════════════════════════════════════════════════════════════

  import path from "path";
  import { fileURLToPath } from "url";
  import { mkdirSync } from "node:fs";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const LOCAL_UPLOADS = path.join(__dirname, "..", "uploads");
  const LOCAL_AVATARS = path.join(LOCAL_UPLOADS, "avatars");
  const LOCAL_COVERS = path.join(LOCAL_UPLOADS, "covers");
  const LOCAL_PLAYLIST_COVERS = path.join(LOCAL_UPLOADS, "playlist-covers");
  mkdirSync(LOCAL_AVATARS, { recursive: true });
  mkdirSync(LOCAL_COVERS, { recursive: true });
  mkdirSync(LOCAL_PLAYLIST_COVERS, { recursive: true });
  app.use("/api/avatars", express.static(LOCAL_AVATARS));
  app.use("/api/artwork", express.static(LOCAL_COVERS));
  app.use("/api/track-covers", express.static(LOCAL_COVERS));
  app.use("/api/playlist-covers", express.static(LOCAL_PLAYLIST_COVERS));

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  app.use(errorHandler);

  return app;
}
