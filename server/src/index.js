import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import trackRoutes from "./routes/tracks.js";
import adminRoutes from "./routes/admin.js";
import artistRoutes, { ARTIST_IMG_DIR } from "./routes/artists.js";
import submissionRoutes, { COVER_DIR } from "./routes/submissions.js";
import reportRoutes from "./routes/reports.js";
import playlistRoutes, { PLAYLIST_COVER_DIR } from "./routes/playlists.js";
import discoverRoutes from "./routes/discover.js";
import notificationRoutes from "./routes/notifications.js";
import libraryRoutes from "./routes/library.js";
import releaseRoutes from "./routes/releases.js";
import artistAppRoutes from "./routes/artist-applications.js";
import supportRoutes from "./routes/support.js";
import migrateRoutes from "./routes/migrate.js";
import { usingDefaultSecret } from "./auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

if (usingDefaultSecret) {
  console.warn(
    "[canh bao] Chua dat JWT_SECRET trong .env - dang dung secret mac dinh, KHONG an toan cho production."
  );
}

const corsOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Non-browser tools (curl, health checks, server-to-server requests) have no Origin.
    if (!origin || corsOrigins.includes("*") || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS origin not allowed"));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "song-backend", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/discover", discoverRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/releases", releaseRoutes);
app.use("/api/artist-applications", artistAppRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/migrate", migrateRoutes);
// Artist avatar/cover images — public and unauthenticated on purpose
// (profile pictures aren't sensitive, unlike gated track audio).
app.use("/api/artist-images", express.static(ARTIST_IMG_DIR));
// Published-track cover art — public the same way. Filenames are random
// UUIDs never revealed by any API response before a submission is
// actually published (the private preview route requires owner/admin and
// is fetched by id, not this static path), so nothing pending leaks.
app.use("/api/track-covers", express.static(COVER_DIR));
app.use("/api/playlist-covers", express.static(PLAYLIST_COVER_DIR));

// Serve client build in production (for standalone deployment)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (process.env.NODE_ENV === "production" || process.env.SERVE_CLIENT === "true") {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  // Log internally but never expose stack traces or internals to clients.
  console.error("[error]", err.message || err);
  if (process.env.NODE_ENV !== "production") console.error(err.stack);
  res.status(500).json({ error: "Lỗi server. Vui lòng thử lại sau." });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy ở http://localhost:${PORT}`);
});
