import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data", "app.sqlite");
const db = new DatabaseSync(dbPath);

const email = "haidang280611@gmail.com";
const r = db.prepare("UPDATE users SET is_admin = 1 WHERE email = ?").run(email);
console.log(`Updated ${r.changes} row(s) for ${email}`);

const u = db.prepare("SELECT id, username, email, is_admin FROM users WHERE email = ?").get(email);
console.log("User now:", JSON.stringify(u, null, 2));

db.close();
