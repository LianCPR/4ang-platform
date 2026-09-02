const TOKEN_KEY = "song_app_token";

// In development Vite proxies /api to http://localhost:3001.
// In production Vercel uses VITE_API_URL to point to the separate Express backend.
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}/api${path}`;
}

function absoluteBackendUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* localStorage unavailable, ignore */ }
}

async function request(path, { method = "GET", body, isForm = false, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  const token = getToken();
  if (token && !headers["Authorization"]) headers["Authorization"] = "Bearer " + token;
  let payload = body;
  if (body && !isForm && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(apiUrl(path), { method, headers, body: payload });
  } catch {
    // fetch() itself throws on network failure (offline, server down,
    // CORS) — that raw browser message ("Failed to fetch") is not
    // something to show anyone. This is the one place that translates it,
    // so every call site (auth, upload, likes, ...) benefits at once.
    throw new Error("Không thể kết nối tới máy chủ. Kiểm tra kết nối mạng và thử lại.");
  }

  // Surface useful diagnostics for non-2xx responses
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
  if (!res.ok) {
    if (res.status === 405) throw new Error("API endpoint không tồn tại hoặc phương thức không được hỗ trợ. Kiểm tra VITE_API_URL.");
    throw new Error((data && data.error) || "Lỗi " + res.status);
  }
  return data;
}

// Builds a playable/streamable URL for a track's audio, attaching the JWT as
// a query param — needed because <audio> tags can't send Authorization
// headers, and non-approved tracks require the uploader or an admin to be
// identified even when just streaming a preview.
export function audioSrcFor(track) {
  const token = getToken();
  const base = absoluteBackendUrl(track.audioUrl);
  if (!base) return base;
  return token
    ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : base;
}

// Generic authenticated asset URL — same trick as audioSrcFor, for any
// gated backend URL (submission previews, private track video) that
// browsers can't attach an Authorization header to.
export function assetSrcFor(url) {
  const token = getToken();
  const base = absoluteBackendUrl(url);
  if (!base) return base;
  return token
    ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : base;
}

export function videoSrcFor(track) {
  if (!track || !track.videoUrl) return null;
  return assetSrcFor(track.videoUrl);
}

export const api = {
  // Supabase Auth — Email OTP (new flow)
  syncProfile: (supabaseToken) => {
    return request("/auth/sync-profile", {
      method: "POST",
      // Pass the Supabase JWT directly in the Authorization header.
      // The backend validates it server-side — never trust a user_id from JSON.
      headers: {
        "Authorization": "Bearer " + supabaseToken,
      },
    }).catch((err) => {
      // Surface clear error messages for common sync-profile failures
      const msg = err.message || "";
      if (msg.includes("405")) throw new Error("Backend API không khả dụng. Vui lòng kiểm tra VITE_API_URL.");
      if (msg.includes("401")) throw new Error("Phiên Supabase không hợp lệ. Vui lòng đăng nhập lại.");
      if (msg.includes("500")) throw new Error("Lỗi server khi đồng bộ hồ sơ. Thử lại sau.");
      throw err;
    });
  },

  // Legacy backend OTP (kept for SQLite / backward compat)
  sendEmailOTP: (email) => request("/auth/otp/email/send", { method: "POST", body: { email } }),
  verifyEmailOTP: (email, code) => request("/auth/otp/email/verify", { method: "POST", body: { email, code } }),
  sendPhoneOTP: (phone) => request("/auth/otp/phone/send", { method: "POST", body: { phone } }),
  verifyPhoneOTP: (phone, code) => request("/auth/otp/phone/verify", { method: "POST", body: { phone, code } }),
  oauthGoogle: (accessToken) => request("/auth/google", { method: "POST", body: { accessToken } }),
  oauthApple: (identityToken, firstName, lastName) => request("/auth/apple", { method: "POST", body: { identityToken, firstName, lastName } }),

  // Legacy password auth (backward compat, not exposed in new UI)
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/auth/me"),
  authProviders: () => request("/auth/providers"),
  updateProfile: (payload) => request("/auth/profile", { method: "PATCH", body: payload }),
  publicTracks: () => request("/tracks"),
  myTracks: () => request("/tracks/mine"),
  like: (id) => request("/tracks/" + id + "/like", { method: "POST" }),
  save: (id) => request("/tracks/" + id + "/save", { method: "POST" }),
  share: (id) => request("/tracks/" + id + "/share", { method: "POST" }),
  play: (id) => request("/tracks/" + id + "/play", { method: "POST" }),
  comment: (id, text) => request("/tracks/" + id + "/comments", { method: "POST", body: { text } }),

  becomeArtist: (payload) => request("/artists", { method: "POST", body: payload }),
  myArtistProfile: () => request("/artists/me"),
  updateArtistProfile: (payload) => request("/artists/me", { method: "PATCH", body: payload }),
  requestVerification: () => request("/artists/me/verification-request", { method: "POST" }),
  artistProfile: (username) => request("/artists/" + encodeURIComponent(username)),
  followArtist: (username) => request("/artists/" + encodeURIComponent(username) + "/follow", { method: "POST" }),
  unfollowArtist: (username) => request("/artists/" + encodeURIComponent(username) + "/follow", { method: "DELETE" }),
  myFollowing: () => request("/artists/me/following"),
  uploadArtistAvatar: (file) => { const fd = new FormData(); fd.append("avatar", file); return request("/artists/me/avatar", { method: "POST", body: fd, isForm: true }); },
  uploadArtistCover: (file) => { const fd = new FormData(); fd.append("cover", file); return request("/artists/me/cover", { method: "POST", body: fd, isForm: true }); },
  searchArtists: (q) => request("/artists/search?q=" + encodeURIComponent(q)),

  // Artist Applications (Phase 9)
  myArtistApplication: () => request("/artist-applications/me"),
  submitArtistApplication: (payload) => request("/artist-applications", { method: "POST", body: payload }),
  myVerifiedApplication: () => request("/artist-applications/verified/me"),
  checkPhoneVerified: () => request("/artist-applications/verified/check-phone"),
  submitVerifiedApplication: (payload) => request("/artist-applications/verified", { method: "POST", body: payload }),

  // Releases (Phase 9)
  listReleases: (params) => request("/releases" + (params ? "?" + new URLSearchParams(params).toString() : "")),
  getRelease: (id) => request("/releases/" + id),
  createRelease: (payload) => request("/releases", { method: "POST", body: payload }),
  updateRelease: (id, payload) => request("/releases/" + id, { method: "PATCH", body: payload }),
  addTrackToRelease: (releaseId, trackId) => request("/releases/" + releaseId + "/tracks", { method: "POST", body: { trackId } }),
  removeTrackFromRelease: (releaseId, trackId) => request("/releases/" + releaseId + "/tracks/" + trackId, { method: "DELETE" }),
  submitRelease: (id) => request("/releases/" + id + "/submit", { method: "POST" }),
  deleteRelease: (id) => request("/releases/" + id, { method: "DELETE" }),

  // Submissions (Phase 6) — both create and edit send the whole form as
  // multipart, since files travel alongside the metadata in one request.
  createSubmission: (formData) => request("/submissions", { method: "POST", body: formData, isForm: true }),
  updateSubmission: (id, formData) => request("/submissions/" + id, { method: "PATCH", body: formData, isForm: true }),
  deleteSubmission: (id) => request("/submissions/" + id, { method: "DELETE" }),
  mySubmissions: () => request("/submissions/mine"),
  artistStats: () => request("/artists/me/stats"),
  submission: (id) => request("/submissions/" + id),

  // Reports — any signed-in user can file one; only Admin can list/resolve
  // (that half lives under api.admin below).
  reportContent: (payload) => request("/reports", { method: "POST", body: payload }),

  // --- Phase 8: Playlists ---
  myPlaylists: () => request("/playlists/mine"),
  publicPlaylists: (limit) => request("/playlists" + (limit ? "?limit=" + limit : "")),
  createPlaylist: (payload) => request("/playlists", { method: "POST", body: payload }),
  playlist: (id) => request("/playlists/" + id),
  updatePlaylist: (id, payload) => request("/playlists/" + id, { method: "PATCH", body: payload }),
  deletePlaylist: (id) => request("/playlists/" + id, { method: "DELETE" }),
  addToPlaylist: (playlistId, trackId) => request("/playlists/" + playlistId + "/tracks", { method: "POST", body: { trackId } }),
  removeFromPlaylist: (playlistId, trackId) => request("/playlists/" + playlistId + "/tracks/" + trackId, { method: "DELETE" }),
  reorderPlaylist: (playlistId, order) => request("/playlists/" + playlistId + "/tracks/reorder", { method: "PUT", body: { order } }),
  uploadPlaylistCover: (playlistId, file) => { const fd = new FormData(); fd.append("cover", file); return request("/playlists/" + playlistId + "/cover", { method: "POST", body: fd, isForm: true }); },

  // --- Phase 8: Discover ---
  trending: (limit, days) => request("/discover/trending" + "?limit=" + (limit || 12) + (days ? "&days=" + days : "")),
  newReleases: (limit, genre) => request("/discover/new-releases" + "?limit=" + (limit || 12) + (genre ? "&genre=" + encodeURIComponent(genre) : "")),
  risingArtists: (limit) => request("/discover/rising-artists" + "?limit=" + (limit || 8)),
  recommendations: (limit) => request("/discover/recommendations" + "?limit=" + (limit || 12)),
  becauseYouListened: (limit) => request("/discover/because-you-listened" + "?limit=" + (limit || 8)),
  discoverGenres: () => request("/discover/genres"),
  genreDetail: (name) => request("/discover/genres/" + encodeURIComponent(name)),
  artistReleases: (limit) => request("/discover/artist-releases" + "?limit=" + (limit || 12)),

  // --- Phase 8: Notifications ---
  notifications: (limit) => request("/notifications" + (limit ? "?limit=" + limit : "")),
  markNotificationRead: (id) => request("/notifications/" + id + "/read", { method: "PATCH" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),
  unreadNotificationCount: () => request("/notifications/unread-count"),

  // --- Phase 8: Library ---
  recentlyPlayed: (limit) => request("/library/recently-played" + (limit ? "?limit=" + limit : "")),
  likedTracks: (limit) => request("/library/liked" + (limit ? "?limit=" + limit : "")),
  followedArtists: (limit) => request("/library/followed-artists" + (limit ? "?limit=" + limit : "")),
  savedTracks: (limit) => request("/library/saved" + (limit ? "?limit=" + limit : "")),
  saveProgress: (trackId, progressSeconds, durationSeconds) => request("/library/progress", { method: "POST", body: { trackId, progressSeconds, durationSeconds } }),
  continueListening: (limit) => request("/library/continue-listening" + (limit ? "?limit=" + limit : "")),

  // --- Phase 8: Unified Search ---
  search: (q) => request("/library/search?q=" + encodeURIComponent(q)),
  saveSearchHistory: (q) => request("/library/search-history", { method: "POST", body: { query: q } }),
  searchHistory: () => request("/library/search-history"),
  clearSearchHistory: () => request("/library/search-history", { method: "DELETE" }),

  // ---------------------------------------------------------------------
  // Admin Platform (Phase 7) — every call here hits an Admin-only,
  // server-enforced route (see server/src/routes/admin.js,
  // server/src/routes/submissions.js, server/src/routes/reports.js).
  // Nothing here is trusted client-side; a non-admin token gets a real 403
  // from the server regardless of what the UI shows.
  // ---------------------------------------------------------------------
  admin: {
    stats: () => request("/admin/stats"),
    activity: (limit) => request("/admin/activity" + (limit ? "?limit=" + limit : "")),
    analytics: (days) => request("/admin/analytics" + (days ? "?days=" + days : "")),

    submissionQueue: (status, q) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const qs = params.toString();
      return request("/submissions" + (qs ? "?" + qs : ""));
    },
    submission: (id) => request("/submissions/" + id),
    reviewSubmission: (id) => request("/submissions/" + id + "/review", { method: "POST" }),
    requestChanges: (id, note) => request("/submissions/" + id + "/request-changes", { method: "POST", body: { note } }),
    rejectSubmission: (id, note) => request("/submissions/" + id + "/reject", { method: "POST", body: { note } }),
    approveSubmission: (id, note) => request("/submissions/" + id + "/approve", { method: "POST", body: { note } }),
    publishSubmission: (id) => request("/submissions/" + id + "/publish", { method: "POST" }),

    releases: (status, q) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const qs = params.toString();
      return request("/admin/releases" + (qs ? "?" + qs : ""));
    },
    release: (id) => request("/admin/releases/" + id),
    approveRelease: (id) => request("/admin/releases/" + id + "/approve", { method: "POST" }),
    rejectRelease: (id, reason) => request("/admin/releases/" + id + "/reject", { method: "POST", body: { reason } }),

    verifications: (status) => request("/admin/verifications" + (status ? "?status=" + status : "")),
    verifyArtist: (username) => request("/artists/" + encodeURIComponent(username) + "/verify", { method: "POST" }),
    rejectArtistVerification: (username, note) => request("/artists/" + encodeURIComponent(username) + "/reject", { method: "POST", body: { note } }),

    users: (q) => request("/admin/users" + (q ? "?q=" + encodeURIComponent(q) : "")),
    user: (username) => request("/admin/users/" + encodeURIComponent(username)),
    restrictUser: (username, reason) => request("/admin/users/" + encodeURIComponent(username) + "/restrict", { method: "POST", body: { reason } }),
    restoreUser: (username) => request("/admin/users/" + encodeURIComponent(username) + "/restore", { method: "POST" }),

    tracks: (params = {}) => {
      const usp = new URLSearchParams();
      if (params.q) usp.set("q", params.q);
      if (params.status) usp.set("status", params.status);
      const qs = usp.toString();
      return request("/admin/tracks" + (qs ? "?" + qs : ""));
    },
    updateTrack: (id, payload) => request("/admin/tracks/" + id, { method: "PATCH", body: payload }),
    unpublishTrack: (id, reason) => request("/admin/tracks/" + id + "/unpublish", { method: "POST", body: { reason } }),
    republishTrack: (id) => request("/admin/tracks/" + id + "/republish", { method: "POST" }),

    reports: (status) => request("/reports" + (status ? "?status=" + status : "")),
    resolveReport: (id, outcome, note) => request("/reports/" + id + "/resolve", { method: "POST", body: { outcome, note } }),

    settings: () => request("/admin/settings"),
    updateSettings: (payload) => request("/admin/settings", { method: "POST", body: payload }),

    auditLog: (limit) => request("/admin/audit-log" + (limit ? "?limit=" + limit : "")),

    supportTickets: (status) => request("/support/admin/tickets" + (status ? "?status=" + status : "")),
    replySupportTicket: (id, reply, status) => request("/support/admin/tickets/" + id + "/reply", { method: "POST", body: { reply, status } }),
  },

  // Support Tickets
  mySupportTickets: () => request("/support/tickets"),
  createSupportTicket: (payload) => request("/support/tickets", { method: "POST", body: payload }),
  getSupportTicket: (id) => request("/support/tickets/" + id),

  // Playlists
  myPlaylists: () => request("/playlists"),
  getPlaylist: (id) => request("/playlists/" + id),
  createPlaylist: (payload) => request("/playlists", { method: "POST", body: payload }),
  updatePlaylist: (id, payload) => request("/playlists/" + id, { method: "PATCH", body: payload }),
  deletePlaylist: (id) => request("/playlists/" + id, { method: "DELETE" }),
  addTrackToPlaylist: (playlistId, trackId) => request("/playlists/" + playlistId + "/tracks", { method: "POST", body: { trackId } }),
  removeTrackFromPlaylist: (playlistId, trackId) => request("/playlists/" + playlistId + "/tracks/" + trackId, { method: "DELETE" }),
  likedSongsPlaylist: () => request("/playlists/liked"),

  // --- Smart Mix ---
  smartMix: (type, limit) => request("/discover/smart-mix" + "?type=" + encodeURIComponent(type || "my-mix") + (limit ? "&limit=" + limit : "")),

  // --- Charts ---
  charts: (days) => request("/discover/charts" + (days ? "?days=" + days : "")),

  // --- Listening Stats ---
  listeningStats: (days) => request("/library/stats" + (days ? "?days=" + days : "")),

  // --- Delete single search history item ---
  deleteSearchHistoryItem: (query) => request("/library/search-history/item", { method: "POST", body: { query } }),

  // --- Onboarding Preferences ---
  getPreferences: () => request("/auth/preferences"),
  savePreferences: (prefs) => request("/auth/preferences", { method: "POST", body: prefs }),
  completeOnboarding: () => request("/auth/complete-onboarding", { method: "POST" }),

  // --- All Artists (for onboarding) ---
  fetchAllArtists: () => request("/artists/all"),
};
