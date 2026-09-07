/**
 * 4ANG RECOMMENDATION ROUTES — Phase 3.0 + 3.1
 *
 * /api/recommendations/for-you        — personalized "For You"
 * /api/recommendations/daily-mix      — daily mix clusters
 * /api/recommendations/smart-radio    — continuous radio from seed
 * /api/recommendations/similar-songs  — similar to a track
 * /api/recommendations/similar-artists — similar artists
 * /api/recommendations/taste-profile  — user-facing taste summary
 * /api/recommendations/not-interested — negative feedback
 * /api/recommendations/feedback       — general feedback
 */
import express from "express";
import { requireAuth, optionalAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import {
  getRecommendations,
  getContextualRecommendations,
  getDailyMixes,
  getSmartRadio,
  getSimilarSongs,
  getSimilarArtists,
  getUserTasteProfile,
  handleNotInterested,
  recordRecommendationFeedback,
} from "../recommendation.js";

const router = express.Router();
const recLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "rec" });

/* ── For You ── */
router.get("/for-you", requireAuth, recLimit, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 30);
    const context = req.query.context || "home";
    const result = await getRecommendations(req.user.username, { limit, context });
    res.json(result);
  } catch (e) {
    console.error("[rec/for-you]", e);
    res.json({ tracks: [], reasons: [], metadata: { strategy: "fallback", error: true } });
  }
});

/* ── Contextual ── */
router.get("/contextual", requireAuth, recLimit, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
    const context = req.query.context || "discover";
    const result = await getContextualRecommendations(req.user.username, context, { limit });
    res.json(result);
  } catch (e) {
    console.error("[rec/contextual]", e);
    res.json({ tracks: [], reasons: [], metadata: { strategy: "fallback", error: true } });
  }
});

/* ── Daily Mix ── */
router.get("/daily-mix", requireAuth, recLimit, async (req, res) => {
  try {
    const mixes = await getDailyMixes(req.user.username);
    res.json({ mixes });
  } catch (e) {
    console.error("[rec/daily-mix]", e);
    res.json({ mixes: [] });
  }
});

/* ── Smart Radio ── */
router.get("/smart-radio", optionalAuth, recLimit, async (req, res) => {
  try {
    const trackId = (req.query.trackId || "").trim();
    if (!trackId) return res.status(400).json({ error: "Thiếu trackId." });
    const result = await getSmartRadio(trackId, req.user?.username);
    res.json(result);
  } catch (e) {
    console.error("[rec/smart-radio]", e);
    res.json({ tracks: [], seed: null });
  }
});

/* ── Similar Songs ── */
router.get("/similar-songs", optionalAuth, recLimit, async (req, res) => {
  try {
    const trackId = (req.query.trackId || "").trim();
    if (!trackId) return res.status(400).json({ error: "Thiếu trackId." });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 20);
    const tracks = await getSimilarSongs(trackId, req.user?.username, { limit });
    res.json({ tracks });
  } catch (e) {
    console.error("[rec/similar-songs]", e);
    res.json({ tracks: [] });
  }
});

/* ── Similar Artists ── */
router.get("/similar-artists", optionalAuth, recLimit, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 12);
    const artists = await getSimilarArtists(req.user?.username, { limit });
    res.json({ artists });
  } catch (e) {
    console.error("[rec/similar-artists]", e);
    res.json({ artists: [] });
  }
});

/* ── Taste Profile ── */
router.get("/taste-profile", requireAuth, recLimit, async (req, res) => {
  try {
    const profile = await getUserTasteProfile(req.user.username);
    res.json(profile);
  } catch (e) {
    console.error("[rec/taste-profile]", e);
    res.status(500).json({ error: "Không thể tải hồ sơ sở thích." });
  }
});

/* ── Not Interested ── */
router.post("/not-interested", requireAuth, recLimit, async (req, res) => {
  try {
    const { trackId, blockArtist } = req.body || {};
    if (!trackId) return res.status(400).json({ error: "Thiếu trackId." });
    await handleNotInterested(req.user.username, trackId, { blockArtist: !!blockArtist });
    res.json({ ok: true });
  } catch (e) {
    console.error("[rec/not-interested]", e);
    res.json({ ok: true });
  }
});

/* ── Feedback ── */
router.post("/feedback", requireAuth, recLimit, async (req, res) => {
  try {
    const { trackId, action } = req.body || {};
    if (!trackId || !action) return res.status(400).json({ error: "Thiếu trackId hoặc action." });
    const validActions = ["play", "like", "save", "skip", "not_interested"];
    if (!validActions.includes(action)) return res.status(400).json({ error: "Action không hợp lệ." });
    await recordRecommendationFeedback(req.user.username, trackId, action);
    res.json({ ok: true });
  } catch (e) {
    console.error("[rec/feedback]", e);
    res.json({ ok: true });
  }
});

export default router;
