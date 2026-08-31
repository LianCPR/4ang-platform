/**
 * Cleanup fake seed data — only keep real accounts.
 * Run: node cleanup.mjs
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "app.sqlite");

console.log(`[cleanup] Opening: ${dbPath}`);
const db = new DatabaseSync(dbPath);

// Fake usernames to remove
const fakeUsers = ["son_tung", "hoang_thuy_linh", "duc_phuc", "bin_ba", "phuong_ly", "listener_1", "listener_2", "listener_3"];

// 1. Delete activity events for fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM activity_events WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} activity events for ${u}`);
}

// 2. Delete play events for fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM play_events WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} play events for ${u}`);
}

// 3. Delete follows FROM or TO fake users
for (const u of fakeUsers) {
  const r1 = db.prepare("DELETE FROM artist_follows WHERE follower_username = ?").run(u);
  const r2 = db.prepare("DELETE FROM artist_follows WHERE artist_username = ?").run(u);
  if (r1.changes) console.log(`  Deleted ${r1.changes} follows by ${u}`);
  if (r2.changes) console.log(`  Deleted ${r2.changes} follows of ${u}`);
}

// 4. Delete likes for fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM likes WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} likes for ${u}`);
}

// 5. Delete playlist tracks in playlists owned by fake users
for (const u of fakeUsers) {
  const pls = db.prepare("SELECT id FROM playlists WHERE owner_username = ?").all(u);
  for (const pl of pls) {
    const r = db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(pl.id);
    if (r.changes) console.log(`  Deleted ${r.changes} playlist tracks from ${pl.id}`);
  }
  const r2 = db.prepare("DELETE FROM playlists WHERE owner_username = ?").run(u);
  if (r2.changes) console.log(`  Deleted ${r2.changes} playlists for ${u}`);
}

// 6. Get track IDs uploaded by fake users
const fakeTrackIds = db.prepare("SELECT id FROM tracks WHERE uploader_username IN (" + fakeUsers.map(() => "?").join(",") + ")").all(...fakeUsers).map(r => r.id);
if (fakeTrackIds.length) {
  console.log(`  Found ${fakeTrackIds.length} tracks by fake users`);
  
  // Delete playlist tracks referencing these tracks
  for (const tid of fakeTrackIds) {
    db.prepare("DELETE FROM playlist_tracks WHERE track_id = ?").run(tid);
  }
  
  // Delete likes for these tracks
  for (const tid of fakeTrackIds) {
    db.prepare("DELETE FROM likes WHERE track_id = ?").run(tid);
  }
  
  // Delete play events for these tracks
  for (const tid of fakeTrackIds) {
    db.prepare("DELETE FROM play_events WHERE track_id = ?").run(tid);
  }
  
  // Delete release_tracks referencing these tracks
  for (const tid of fakeTrackIds) {
    db.prepare("DELETE FROM release_tracks WHERE track_id = ?").run(tid);
  }
  
  // Delete track credits
  for (const tid of fakeTrackIds) {
    db.prepare("DELETE FROM track_credits WHERE track_id = ?").run(tid);
  }
  
  // Delete tracks
  const r = db.prepare("DELETE FROM tracks WHERE uploader_username IN (" + fakeUsers.map(() => "?").join(",") + ")").run(...fakeUsers);
  console.log(`  Deleted ${r.changes} tracks`);
}

// 7. Delete releases by fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM releases WHERE created_by = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} releases for ${u}`);
}

// 8. Delete artist profiles for fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM artist_profiles WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} artist profile for ${u}`);
}

// 9. Delete notifications for fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM notifications WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} notifications for ${u}`);
}

// 10. Delete search history for fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM search_history WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} search history for ${u}`);
}

// 11. Delete submissions by fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM submissions WHERE artist_username = ?").run(u);
  if (r.changes) console.log(`  Deleted ${r.changes} submissions for ${u}`);
}

// 12. Delete the fake users
for (const u of fakeUsers) {
  const r = db.prepare("DELETE FROM users WHERE username = ?").run(u);
  if (r.changes) console.log(`  Deleted user: ${u}`);
}

// Verify what's left
const remainingUsers = db.prepare("SELECT username, display_name, is_artist FROM users").all();
const remainingTracks = db.prepare("SELECT id, title, uploader_username FROM tracks").all();
const remainingPlaylists = db.prepare("SELECT id, title, owner_username FROM playlists").all();

console.log("\n[cleanup] ✅ Done! Remaining data:");
console.log(`  Users: ${remainingUsers.length}`);
remainingUsers.forEach(u => console.log(`    - ${u.username} (${u.display_name}) artist:${u.is_artist}`));
console.log(`  Tracks: ${remainingTracks.length}`);
remainingTracks.forEach(t => console.log(`    - ${t.title} by ${t.uploader_username}`));
console.log(`  Playlists: ${remainingPlaylists.length}`);
remainingPlaylists.forEach(p => console.log(`    - ${p.title} by ${p.owner_username}`));

db.close();
