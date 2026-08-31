/**
 * 4ANG Seed Data Script
 * Only creates minimal data if the database is completely empty.
 * Does NOT create fake accounts — only your real accounts exist.
 * Run: node seed.mjs
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "app.sqlite");

console.log(`[seed] Opening: ${dbPath}`);
const db = new DatabaseSync(dbPath);

const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
const trackCount = db.prepare("SELECT COUNT(*) as c FROM tracks").get().c;

console.log(`[seed] Current: ${userCount} users, ${trackCount} tracks`);

if (userCount > 0) {
  console.log("[seed] Database already has data. Skipping seed.");
  console.log("[seed] To reset: delete server/data/app.sqlite and restart server.");
  db.close();
  process.exit(0);
}

console.log("[seed] Database is empty. Run the app and create your first account.");
console.log("[seed] The first user to sign up automatically becomes admin.");
db.close();
