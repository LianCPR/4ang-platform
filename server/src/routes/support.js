import express from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = express.Router();

// User: get my tickets
router.get("/tickets", requireAuth, (req, res) => {
  try {
    const tickets = db.prepare(
      "SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC"
    ).all(req.user.id);
    res.json({ tickets: tickets.map(shapeTicket) });
  } catch (e) {
    // Table might not exist
    res.json({ tickets: [] });
  }
});

// User: create ticket
router.post("/tickets", requireAuth, (req, res) => {
  const { type, subject, message } = req.body || {};
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ." });
  }
  const id = randomUUID();
  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO support_tickets (id, user_id, username, type, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(id, req.user.id, req.user.username, (type || "general").slice(0, 30), subject.trim().slice(0, 120), message.trim().slice(0, 2000), now, now);
    const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id);
    res.status(201).json({ ticket: shapeTicket(ticket) });
  } catch (e) {
    // If table doesn't exist, create it and retry
    if (e.message?.includes("no such table")) {
      createTicketsTable();
      db.prepare(
        `INSERT INTO support_tickets (id, user_id, username, type, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(id, req.user.id, req.user.username, (type || "general").slice(0, 30), subject.trim().slice(0, 120), message.trim().slice(0, 2000), now, now);
      const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id);
      return res.status(201).json({ ticket: shapeTicket(ticket) });
    }
    res.status(500).json({ error: "Lỗi server." });
  }
});

// User: get single ticket
router.get("/tickets/:id", requireAuth, (req, res) => {
  const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: "Không tìm thấy." });
  res.json({ ticket: shapeTicket(ticket) });
});

// Admin: list all tickets
router.get("/admin/tickets", requireAuth, requireAdmin, (req, res) => {
  const status = req.query.status;
  let tickets;
  if (status) {
    tickets = db.prepare("SELECT * FROM support_tickets WHERE status = ? ORDER BY created_at DESC").all(status);
  } else {
    tickets = db.prepare("SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100").all();
  }
  res.json({ tickets: tickets.map(shapeTicket) });
});

// Admin: reply to ticket
router.post("/admin/tickets/:id/reply", requireAuth, requireAdmin, (req, res) => {
  const { reply, status } = req.body || {};
  const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Không tìm thấy." });
  const now = Date.now();
  db.prepare("UPDATE support_tickets SET admin_reply = ?, status = ?, updated_at = ? WHERE id = ?")
    .run(reply || "", status || ticket.status, now, req.params.id);
  const updated = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(req.params.id);
  res.json({ ticket: shapeTicket(updated) });
});

function shapeTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    type: row.type,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.admin_reply || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createTicketsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      type TEXT DEFAULT 'general',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_reply TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_support_user ON support_tickets(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status, created_at);
  `);
}

export default router;
