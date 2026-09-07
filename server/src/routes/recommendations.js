/**
 * 4ANG RECOMMENDATION ROUTES — Phase 3.0
 *
 * /api/recommendations/for-you  — personalized "For You" section
 * /api/recommendations/feedback  — record user feedback on recommendations
 */
import express from "express";
import { requireAuth, optionalAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import {
  getRecommendations,
  getContextualRecommendations,
  recordRecommendationFeedback,
} from "../recommendation.js";

const router = express.Router();
const recLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "rec" });

/**
 * GET /api/recommendations/for-you
 *
 * Personalized "For You" recommendations.
 * Returns tracks with explainable reasons.
 *
 * Query params:
 *   limit (1-30, default 20)
 *   context (home | discover | radio)
 */
router.get("/for-you", requireAuth, recLimit, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 30);
    const context = req.query.context || "home";

    const result = await getRecommendations(req.user.username, { limit, context });

    res.json({
      tracks: result.tracks,
      reasons: result.reasons,
      metadata: result.metadata,
    });
  } catch (e) {
    console.error("[recommendations/for-you]", e);
    // Graceful fallback — return empty, let client use existing discovery
    res.json({ tracks: [], reasons: [], metadata: { strategy: "fallback", error: true } });
  }
});

/**
 * GET /api/recommendations/contextual
 *
 * Context-specific recommendations.
 *
 * Query params:
 *   context (discover | radio)
 *   limit (1-30, default 12)
 */
router.get("/contextual", requireAuth, recLimit, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
    const context = req.query.context || "discover";

    const result = await getContextualRecommendations(req.user.username, context, { limit });

    res.json({
      tracks: result.tracks,
      reasons: result.reasons,
      metadata: result.metadata,
    });
  } catch (e) {
    console.error("[recommendations/contextual]", e);
    res.json({ tracks: [], reasons: [], metadata: { strategy: "fallback", error: true } });
  }
});

/**
 * POST /api/recommendations/feedback
 *
 * Record user feedback on a recommended track.
 *
 * Body:
 *   trackId (string)
 *   action (play | like | save | skip | not_interested)
 */
router.post("/feedback", requireAuth, recLimit, async (req, res) => {
  try {
    const { trackId, action } = req.body || {};
    if (!trackId || !action) {
      return res.status(400).json({ error: "Thiếu trackId hoặc action." });
    }

    const validActions = ["play", "like", "save", "skip", "not_interested"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: "Action không hợp lệ." });
    }

    await recordRecommendationFeedback(req.user.username, trackId, action);
    res.json({ ok: true });
  } catch (e) {
    console.error("[recommendations/feedback]", e);
    res.json({ ok: true }); // Non-critical, always succeed from client perspective
  }
});

export default router;
