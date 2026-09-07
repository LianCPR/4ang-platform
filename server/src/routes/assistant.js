/**
 * 4ANG ASSISTANT ROUTES — Phase 3.3
 *
 * /api/assistant/message       — send a message, get response
 * /api/assistant/conversations  — list user's conversations
 * /api/assistant/conversations/:id/messages — get conversation messages
 * /api/assistant/conversations/:id — delete a conversation
 * /api/assistant/status        — assistant health check
 */

import express from "express";
import { requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import {
  processMessage,
  getConversations,
  getConversationMessages,
  deleteConversation,
  getAssistantStatus,
} from "../assistant.js";

const router = express.Router();
const assistantLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "assistant" });

/* ── Send Message ── */
router.post("/message", requireAuth, assistantLimit, async (req, res) => {
  try {
    const { message, conversationId, context } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message required" });
    }

    const result = await processMessage(req.user.username, message, {
      conversationId,
      context: context || {},
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (e) {
    console.error("[assistant/message]", e);
    res.status(500).json({ error: "Assistant unavailable" });
  }
});

/* ── List Conversations ── */
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const conversations = await getConversations(req.user.username, limit);
    res.json({ conversations });
  } catch (e) {
    console.error("[assistant/conversations]", e);
    res.json({ conversations: [] });
  }
});

/* ── Get Conversation Messages ── */
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const messages = await getConversationMessages(req.user.username, req.params.id);
    res.json({ messages });
  } catch (e) {
    console.error("[assistant/messages]", e);
    res.json({ messages: [] });
  }
});

/* ── Delete Conversation ── */
router.delete("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteConversation(req.user.username, req.params.id);
    res.json({ deleted });
  } catch (e) {
    console.error("[assistant/delete]", e);
    res.json({ deleted: false });
  }
});

/* ── Status ── */
router.get("/status", (req, res) => {
  res.json(getAssistantStatus());
});

export default router;
