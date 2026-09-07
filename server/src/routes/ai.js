/**
 * 4ANG AI ROUTES — Phase 3.2
 *
 * /api/ai/analyze-track       — semantic music analysis
 * /api/ai/parse-intent         — natural language → structured intent
 * /api/ai/search-enhance       — enhance search query
 * /api/ai/explain              — recommendation explanation
 * /api/ai/playlist-plan        — playlist generation plan
 * /api/ai/artist/bio           — artist bio draft
 * /api/ai/artist/release-desc  — release description draft
 * /api/ai/artist/track-meta    — track metadata suggestions
 * /api/ai/artist/announcement  — social announcement draft
 * /api/ai/status               — AI service health
 */

import express from "express";
import { requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import {
  analyzeTrackSemantics,
  parseMusicIntent,
  parseMusicIntentFallback,
  generateExplanation,
  generatePlaylistPlan,
  generatePlaylistPlanFallback,
  generateArtistBioDraft,
  generateReleaseDescription,
  suggestTrackMetadata,
  generateSocialAnnouncement,
  enhanceSearchQuery,
  getAIStatus,
} from "../ai.js";

const router = express.Router();
const aiLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "ai" });

/* ── AI Status ── */
router.get("/status", (req, res) => {
  res.json(getAIStatus());
});

/* ── Semantic Track Analysis ── */
router.post("/analyze-track", requireAuth, aiLimit, async (req, res) => {
  try {
    const { track } = req.body;
    if (!track || !track.title) {
      return res.status(400).json({ error: "Track title required" });
    }

    const analysis = await analyzeTrackSemantics(req.user.username, track);
    if (!analysis) {
      return res.json({ analysis: null, fallback: true });
    }
    res.json({ analysis });
  } catch (e) {
    console.error("[ai/analyze-track]", e.message);
    res.json({ analysis: null, error: e.message });
  }
});

/* ── Natural Language Intent Parsing ── */
router.post("/parse-intent", requireAuth, aiLimit, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "Query required" });
    }

    let intent;
    try {
      intent = await parseMusicIntent(req.user.username, query.trim());
    } catch (aiError) {
      // Fallback to keyword-based parsing
      intent = parseMusicIntentFallback(query.trim());
      return res.json({ intent, source: "fallback" });
    }

    if (!intent) {
      intent = parseMusicIntentFallback(query.trim());
      return res.json({ intent, source: "fallback" });
    }

    res.json({ intent, source: "ai" });
  } catch (e) {
    console.error("[ai/parse-intent]", e.message);
    const fallback = parseMusicIntentFallback(req.body?.query || "");
    res.json({ intent: fallback, source: "fallback" });
  }
});

/* ── Search Enhancement ── */
router.post("/search-enhance", requireAuth, aiLimit, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query required" });
    }

    let enhanced;
    try {
      enhanced = await enhanceSearchQuery(req.user.username, query.trim());
    } catch {
      return res.json({ enhanced: null, source: "fallback" });
    }

    res.json({ enhanced, source: "ai" });
  } catch (e) {
    console.error("[ai/search-enhance]", e.message);
    res.json({ enhanced: null, source: "fallback" });
  }
});

/* ── Recommendation Explanation ── */
router.post("/explain", requireAuth, aiLimit, async (req, res) => {
  try {
    const { track, reasons, userTaste } = req.body;
    if (!track || !reasons) {
      return res.status(400).json({ error: "Track and reasons required" });
    }

    let explanation;
    try {
      explanation = await generateExplanation(req.user.username, { track, reasons, userTaste });
    } catch {
      return res.json({ explanation: null, source: "fallback" });
    }

    res.json({ explanation, source: "ai" });
  } catch (e) {
    console.error("[ai/explain]", e.message);
    res.json({ explanation: null, source: "fallback" });
  }
});

/* ── Playlist Plan Generation ── */
router.post("/playlist-plan", requireAuth, aiLimit, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "Query required" });
    }

    let plan;
    try {
      plan = await generatePlaylistPlan(req.user.username, query.trim());
    } catch {
      plan = generatePlaylistPlanFallback(query.trim());
      return res.json({ plan, source: "fallback" });
    }

    if (!plan) {
      plan = generatePlaylistPlanFallback(query.trim());
      return res.json({ plan, source: "fallback" });
    }

    res.json({ plan, source: "ai" });
  } catch (e) {
    console.error("[ai/playlist-plan]", e.message);
    const fallback = generatePlaylistPlanFallback(req.body?.query || "");
    res.json({ plan: fallback, source: "fallback" });
  }
});

/* ── Artist Bio Draft ── */
router.post("/artist/bio", requireAuth, aiLimit, async (req, res) => {
  try {
    const { artistName, genre, existingBio } = req.body;
    if (!artistName) {
      return res.status(400).json({ error: "Artist name required" });
    }

    let bio;
    try {
      bio = await generateArtistBioDraft(req.user.username, { artistName, genre, existingBio });
    } catch (e) {
      return res.status(503).json({ error: "AI unavailable", bio: null });
    }

    res.json({ bio, draft: true });
  } catch (e) {
    console.error("[ai/artist/bio]", e.message);
    res.status(500).json({ error: "Failed to generate bio" });
  }
});

/* ── Release Description Draft ── */
router.post("/artist/release-desc", requireAuth, aiLimit, async (req, res) => {
  try {
    const { title, artistName, type, genre } = req.body;
    if (!title || !artistName) {
      return res.status(400).json({ error: "Title and artist name required" });
    }

    let description;
    try {
      description = await generateReleaseDescription(req.user.username, { title, artistName, type, genre });
    } catch (e) {
      return res.status(503).json({ error: "AI unavailable", description: null });
    }

    res.json({ description, draft: true });
  } catch (e) {
    console.error("[ai/artist/release-desc]", e.message);
    res.status(500).json({ error: "Failed to generate description" });
  }
});

/* ── Track Metadata Suggestions ── */
router.post("/artist/track-meta", requireAuth, aiLimit, async (req, res) => {
  try {
    const { title, artistName, genre } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Track title required" });
    }

    let metadata;
    try {
      metadata = await suggestTrackMetadata(req.user.username, { title, artistName, genre });
    } catch (e) {
      return res.status(503).json({ error: "AI unavailable", metadata: null });
    }

    res.json({ metadata, draft: true });
  } catch (e) {
    console.error("[ai/artist/track-meta]", e.message);
    res.status(500).json({ error: "Failed to suggest metadata" });
  }
});

/* ── Social Announcement Draft ── */
router.post("/artist/announcement", requireAuth, aiLimit, async (req, res) => {
  try {
    const { title, artistName, type } = req.body;
    if (!title || !artistName) {
      return res.status(400).json({ error: "Title and artist name required" });
    }

    let announcement;
    try {
      announcement = await generateSocialAnnouncement(req.user.username, { title, artistName, type });
    } catch (e) {
      return res.status(503).json({ error: "AI unavailable", announcement: null });
    }

    res.json({ announcement, draft: true });
  } catch (e) {
    console.error("[ai/artist/announcement]", e.message);
    res.status(500).json({ error: "Failed to generate announcement" });
  }
});

export default router;
