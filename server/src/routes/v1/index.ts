/**
 * 4ang API v1 Routes
 *
 * Wraps existing route modules under /api/v1/* namespace.
 * Preserves backward compatibility with legacy /api/* routes.
 */

import express from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/response.js";

// Import existing route modules
import trackRoutes from "../tracks.js";
import artistRoutes from "../artists.js";
import playlistRoutes from "../playlists.js";
import libraryRoutes from "../library.js";
import discoverRoutes from "../discover.js";
import socialRoutes from "../social.js";
import socialDiscoveryRoutes from "../social-discovery.js";
import notificationRoutes from "../notifications.js";
import roomRoutes from "../rooms.js";
import commentRoutes from "../comments.js";
import recommendationRoutes from "../recommendations.js";
import aiRoutes from "../ai.js";
import assistantRoutes from "../assistant.js";
import authRoutes from "../auth.js";
import adminRoutes from "../admin.js";
import submissionRoutes from "../submissions.js";
import releaseRoutes from "../releases.js";
import reportRoutes from "../reports.js";
import artistAppRoutes from "../artist-applications.js";
import artistPostRoutes from "../artist-posts.js";
import supportRoutes from "../support.js";

const router = express.Router();

// ── Health Check ──
router.get("/health", asyncHandler(async (req, res) => {
  sendSuccess(res, {
    status: "ok",
    service: "4ang-api",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}));

// ── Health — Liveness ──
router.get("/health/live", (req, res) => {
  sendSuccess(res, { alive: true });
});

// ── Health — Readiness ──
router.get("/health/ready", asyncHandler(async (req, res) => {
  // Check Supabase connectivity
  try {
    const { supabaseAdmin } = await import("../../supabase.js");
    await supabaseAdmin.from("tracks").select("id").limit(1);
    sendSuccess(res, { ready: true, database: "connected" });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database not ready" },
    });
  }
}));

// ── Domain Routes ──
router.use("/auth", authRoutes);
router.use("/tracks", trackRoutes);
router.use("/artists", artistRoutes);
router.use("/playlists", playlistRoutes);
router.use("/library", libraryRoutes);
router.use("/discover", discoverRoutes);
router.use("/discover", socialDiscoveryRoutes);
router.use("/social", socialRoutes);
router.use("/notifications", notificationRoutes);
router.use("/rooms", roomRoutes);
router.use("/comments", commentRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/ai", aiRoutes);
router.use("/assistant", assistantRoutes);
router.use("/submissions", submissionRoutes);
router.use("/releases", releaseRoutes);
router.use("/reports", reportRoutes);
router.use("/artist-applications", artistAppRoutes);
router.use("/artist-posts", artistPostRoutes);
router.use("/support", supportRoutes);

// ── Admin Routes ──
router.use("/admin", adminRoutes);

export default router;
