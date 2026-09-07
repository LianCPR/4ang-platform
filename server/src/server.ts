/**
 * 4ang Server Entry Point
 *
 * Starts the Express server with the configured application.
 */

import { createApp } from "./app.js";
import { getConfig, isProduction } from "./config/env.js";

// Import warning check
import { usingDefaultSecret } from "./auth.js";
import { startRoomHousekeeping } from "./routes/rooms.js";

const app = createApp();
const config = getConfig();

if (usingDefaultSecret) {
  console.warn(
    "[canh bao] Chua dat JWT_SECRET trong .env - dang dung secret mac dinh, KHONG an toan cho production."
  );
}

const server = app.listen(config.PORT, () => {
  console.log(`[4ang] Server running on port ${config.PORT} (${config.NODE_ENV})`);
  console.log(`[4ang] API v1: http://localhost:${config.PORT}/api/v1`);
  console.log(`[4ang] Legacy: http://localhost:${config.PORT}/api`);

  // Start background tasks
  startRoomHousekeeping();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[4ang] SIGTERM received, shutting down...");
  server.close(() => {
    console.log("[4ang] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[4ang] SIGINT received, shutting down...");
  server.close(() => {
    console.log("[4ang] Server closed");
    process.exit(0);
  });
});

export default app;
