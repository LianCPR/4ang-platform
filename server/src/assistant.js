/**
 * 4ANG AI MUSIC ASSISTANT — Phase 3.3
 *
 * Orchestrates existing 4ang systems through a structured tool interface.
 * The assistant understands natural language, selects tools, executes them,
 * and generates music-focused responses.
 *
 * Architecture:
 *   User Message
 *   → Intent Parser (AI or fallback)
 *   → Tool Router (select tools)
 *   → Tool Execution (existing services)
 *   → Result Validation
 *   → Response Generator
 *   → Action Confirmation (for writes)
 *
 * The assistant NEVER:
 *   - executes SQL
 *   - invents tracks/artists/albums
 *   - bypasses RLS
 *   - exposes secrets
 *   - auto-publishes content
 *   - performs destructive actions without confirmation
 */

import { supabaseAdmin } from "./supabase.js";
import { generateText, generateStructured, parseMusicIntent, parseMusicIntentFallback } from "./ai.js";
import {
  getRecommendations, getSimilarSongs, getSimilarArtists,
  getUserTasteProfile, getDailyMixes, getSmartRadio,
  recordRecommendationFeedback, handleNotInterested,
} from "./recommendation.js";

/* ═══════════════════════════════════════════════════════════════════════
 * TOOL REGISTRY
 * ═══════════════════════════════════════════════════════════════════════ */

const TOOLS = {
  // ── READ tools (safe, automatic) ──
  searchTracks: {
    name: "searchTracks",
    description: "Search for tracks by title, artist, or keyword",
    permission: "read",
    schema: { query: "string", limit: "number" },
    async execute(username, { query, limit = 10 }) {
      const { data } = await supabaseAdmin
        .from("tracks")
        .select("id, title, artist_name, album, genre, duration_ms, artwork_url, status")
        .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
        .eq("status", "approved")
        .limit(Math.min(limit, 20));
      return (data || []).map(t => ({ ...t, _type: "track" }));
    },
  },

  searchArtists: {
    name: "searchArtists",
    description: "Search for artists by name",
    permission: "read",
    schema: { query: "string", limit: "number" },
    async execute(username, { query, limit = 5 }) {
      const { data } = await supabaseAdmin
        .from("artist_profiles")
        .select("id, username, artist_name, bio, avatar_url, genre, verified")
        .ilike("artist_name", `%${query}%`)
        .limit(Math.min(limit, 10));
      return (data || []).map(a => ({ ...a, _type: "artist" }));
    },
  },

  getRecommendations: {
    name: "getRecommendations",
    description: "Get personalized music recommendations",
    permission: "read",
    schema: { limit: "number", context: "string" },
    async execute(username, { limit = 10, context = "home" }) {
      const result = await getRecommendations(username, { limit, context });
      return (result?.tracks || []).map(t => ({ ...t, _type: "track", _reason: result?.reasons?.[0] }));
    },
  },

  getSimilarSongs: {
    name: "getSimilarSongs",
    description: "Get songs similar to a specific track",
    permission: "read",
    schema: { trackId: "string", limit: "number" },
    async execute(username, { trackId, limit = 8 }) {
      const result = await getSimilarSongs(trackId, username, { limit });
      return (result?.tracks || []).map(t => ({ ...t, _type: "track", _reason: result?.reasons?.[0] }));
    },
  },

  getSimilarArtists: {
    name: "getSimilarArtists",
    description: "Get artists similar to user's taste",
    permission: "read",
    schema: { limit: "number" },
    async execute(username, { limit = 5 }) {
      const result = await getSimilarArtists(username, { limit });
      return (result?.artists || []).map(a => ({ ...a, _type: "artist" }));
    },
  },

  getUserTaste: {
    name: "getUserTaste",
    description: "Get user's music taste profile (top artists, genres, stats)",
    permission: "read",
    schema: {},
    async execute(username) {
      return await getUserTasteProfile(username);
    },
  },

  getLikedSongs: {
    name: "getLikedSongs",
    description: "Get user's liked songs",
    permission: "read",
    schema: { limit: "number" },
    async execute(username, { limit = 20 }) {
      const { data } = await supabaseAdmin
        .from("track_likes")
        .select("track_id, tracks(id, title, artist_name, album, duration_ms, artwork_url, status)")
        .eq("username", username)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 50));
      return (data || []).filter(r => r.tracks?.status === "approved").map(r => ({ ...r.tracks, _type: "track" }));
    },
  },

  getRecentlyPlayed: {
    name: "getRecentlyPlayed",
    description: "Get user's recently played tracks",
    permission: "read",
    schema: { limit: "number" },
    async execute(username, { limit = 10 }) {
      const { data } = await supabaseAdmin
        .from("play_history")
        .select("track_id, tracks(id, title, artist_name, album, duration_ms, artwork_url, status)")
        .eq("username", username)
        .order("played_at", { ascending: false })
        .limit(Math.min(limit, 30));
      return (data || []).filter(r => r.tracks?.status === "approved").map(r => ({ ...r.tracks, _type: "track" }));
    },
  },

  getFollowedArtists: {
    name: "getFollowedArtists",
    description: "Get artists the user follows",
    permission: "read",
    schema: { limit: "number" },
    async execute(username, { limit = 10 }) {
      const { data } = await supabaseAdmin
        .from("artist_follows")
        .select("artist_username, artist_profiles(id, username, artist_name, avatar_url, genre, verified)")
        .eq("username", username)
        .limit(Math.min(limit, 50));
      return (data || []).map(r => ({ ...r.artist_profiles, _type: "artist" })).filter(Boolean);
    },
  },

  getUserPlaylists: {
    name: "getUserPlaylists",
    description: "Get user's playlists",
    permission: "read",
    schema: { limit: "number" },
    async execute(username, { limit = 10 }) {
      const { data } = await supabaseAdmin
        .from("playlists")
        .select("id, name, description, cover_url, track_count, is_public")
        .eq("owner_username", username)
        .order("updated_at", { ascending: false })
        .limit(Math.min(limit, 20));
      return (data || []).map(p => ({ ...p, _type: "playlist" }));
    },
  },

  getDailyMixes: {
    name: "getDailyMixes",
    description: "Get personalized daily mix playlists",
    permission: "read",
    schema: {},
    async execute(username) {
      return await getDailyMixes(username);
    },
  },

  getSmartRadio: {
    name: "getSmartRadio",
    description: "Get smart radio queue from a seed track",
    permission: "read",
    schema: { trackId: "string" },
    async execute(username, { trackId }) {
      return await getSmartRadio(trackId, username);
    },
  },

  getTrack: {
    name: "getTrack",
    description: "Get a single track by ID",
    permission: "read",
    schema: { trackId: "string" },
    async execute(username, { trackId }) {
      const { data } = await supabaseAdmin
        .from("tracks")
        .select("id, title, artist_name, album, genre, duration_ms, artwork_url, status")
        .eq("id", trackId)
        .single();
      if (!data || data.status !== "approved") return null;
      return { ...data, _type: "track" };
    },
  },

  getArtist: {
    name: "getArtist",
    description: "Get artist profile by username",
    permission: "read",
    schema: { artistUsername: "string" },
    async execute(username, { artistUsername }) {
      const { data } = await supabaseAdmin
        .from("artist_profiles")
        .select("id, username, artist_name, bio, avatar_url, genre, verified, follower_count")
        .eq("username", artistUsername)
        .single();
      return data ? { ...data, _type: "artist" } : null;
    },
  },

  // ── WRITE tools (may require confirmation) ──
  createPlaylistDraft: {
    name: "createPlaylistDraft",
    description: "Create a playlist draft (not yet saved)",
    permission: "write",
    schema: { title: "string", description: "string", trackIds: "array" },
    async execute(username, { title, description = "", trackIds = [] }) {
      return { title, description, trackIds, _type: "playlist_draft", _status: "draft" };
    },
  },

  playTrack: {
    name: "playTrack",
    description: "Play a specific track (tells frontend to play)",
    permission: "write",
    schema: { trackId: "string" },
    async execute(username, { trackId }) {
      return { action: "play", trackId, _type: "action" };
    },
  },

  playTracks: {
    name: "playTracks",
    description: "Play a list of tracks starting from index",
    permission: "write",
    schema: { trackIds: "array", startIndex: "number" },
    async execute(username, { trackIds, startIndex = 0 }) {
      return { action: "play_all", trackIds, startIndex, _type: "action" };
    },
  },

  addToQueue: {
    name: "addToQueue",
    description: "Add tracks to the play queue",
    permission: "write",
    schema: { trackIds: "array" },
    async execute(username, { trackIds }) {
      return { action: "add_to_queue", trackIds, _type: "action" };
    },
  },

  notInterested: {
    name: "notInterested",
    description: "Mark a track as not interested (hide from recommendations)",
    permission: "write",
    schema: { trackId: "string" },
    async execute(username, { trackId }) {
      await handleNotInterested(username, trackId);
      return { action: "not_interested", trackId, _type: "action", _status: "completed" };
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════
 * INTENT CLASSIFICATION
 * ═══════════════════════════════════════════════════════════════════════ */

const INTENT_TYPES = {
  SEARCH_MUSIC: "search_music",
  RECOMMEND_MUSIC: "recommend_music",
  SIMILAR_MUSIC: "similar_music",
  CREATE_PLAYLIST: "create_playlist",
  PLAY_MUSIC: "play_music",
  QUEUE_MUSIC: "queue_music",
  LIBRARY_QUERY: "library_query",
  ARTIST_QUERY: "artist_query",
  CURRENT_PLAYBACK: "current_playback",
  DISCOVERY: "discovery",
  NOT_INTERESTED: "not_interested",
  GREETING: "greeting",
  UNKNOWN: "unknown",
};

/**
 * Classify user intent using AI with fallback to keyword rules.
 */
async function classifyIntent(username, message, context) {
  const contextHint = context?.currentTrack
    ? `Current track: "${context.currentTrack.title}" by ${context.currentTrack.artist_name}.`
    : "";

  const messages = [
    {
      role: "system",
      content: `You are a music assistant intent classifier. Classify the user's message into ONE intent type.

Intent types:
- search_music: user wants to find/search for music
- recommend_music: user wants suggestions/recommendations
- similar_music: user wants music similar to something
- create_playlist: user wants to create/modify a playlist
- play_music: user wants to play something now
- queue_music: user wants to add to queue
- library_query: user asks about their library/liked/saved
- artist_query: user asks about a specific artist
- current_playback: user asks about what's playing
- discovery: user wants to discover new music
- not_interested: user wants to hide/remove a recommendation
- greeting: simple greeting or thank you
- unknown: unclear intent

Also extract structured data:
- query: the search/music query
- artistName: if artist mentioned
- trackName: if track mentioned
- mood: mood keywords
- energy: energy level
- activity: activity context
- durationMinutes: if duration specified
- playlistAction: "create" | "modify" | "delete" | null
- currentTrackRef: true if referring to current track
- excludeArtists: artists to exclude

${contextHint}

Return ONLY valid JSON:
{
  "intent": "intent_type",
  "query": "extracted search query or null",
  "artistName": "artist name or null",
  "trackName": "track name or null",
  "mood": ["mood1"],
  "energy": "low|medium|high|null",
  "activity": "activity or null",
  "durationMinutes": number or null,
  "playlistAction": "create|modify|null",
  "currentTrackRef": false,
  "excludeArtists": [],
  "confidence": 0.0-1.0
}`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  try {
    const result = await generateStructured(username, messages, {
      intent: "string", confidence: "number",
    }, { cachePrefix: "assistant_intent", cacheKey: message, temperature: 0.1, maxTokens: 300 });

    if (result?.data?.intent && INTENT_TYPES[result.data.intent.toUpperCase()]) {
      return result.data;
    }
  } catch {
    // AI unavailable — use fallback
  }

  return classifyIntentFallback(message, context);
}

/**
 * Keyword-based intent classification fallback.
 */
function classifyIntentFallback(message, context) {
  const q = message.toLowerCase();
  const result = {
    intent: "unknown", query: message, artistName: null, trackName: null,
    mood: [], energy: null, activity: null, durationMinutes: null,
    playlistAction: null, currentTrackRef: false, excludeArtists: [], confidence: 0.6,
  };

  // Greetings
  if (/^(xin chào|hello|hi|hey|chào|alo|xin lỗi|cảm ơn|thank)/i.test(q)) {
    result.intent = "greeting";
    return result;
  }

  // Not interested
  if (/không muốn|not interested|bỏ qua|ẩn bài này|đừng gợi ý/i.test(q)) {
    result.intent = "not_interested";
    return result;
  }

  // Current track reference
  if (/bài này|bài đang|bài hiện|ngay lúc này|đang phát/i.test(q)) {
    result.currentTrackRef = true;
    if (context?.currentTrack) {
      result.trackName = context.currentTrack.title;
    }
  }

  // Play intent
  if (/^(phát|play|bật|nghe|cho tôi nghe|播放)/i.test(q) && !/tìm|search|gợi ý|tạo|playlist/i.test(q)) {
    result.intent = "play_music";
    if (result.currentTrackRef) {
      result.intent = "current_playback";
    }
    return result;
  }

  // Queue intent
  if (/thêm.*hàng đợi|add.*queue|phát tiếp|queue/i.test(q)) {
    result.intent = "queue_music";
    return result;
  }

  // Playlist creation
  if (/tạo.*playlist|tạo.*danh sách|create.*playlist|làm playlist|muốn playlist/i.test(q)) {
    result.intent = "create_playlist";
    result.playlistAction = "create";
    // Extract duration
    const durMatch = q.match(/(\d+)\s*(phút|minute|min|tiếng|hour|giờ)/);
    if (durMatch) {
      const val = parseInt(durMatch[1]);
      result.durationMinutes = /tiếng|hour|giờ/.test(durMatch[2]) ? val * 60 : val;
    }
    return result;
  }

  // Modify playlist
  if (/thêm bài|xoá bài|bớt bài|sửa playlist|modify playlist|add.*track.*playlist/i.test(q)) {
    result.intent = "create_playlist";
    result.playlistAction = "modify";
    return result;
  }

  // Similar music
  if (/giống|similar|tương tự|cùng vibe|cùng style|như bài|như artist/i.test(q)) {
    result.intent = "similar_music";
    return result;
  }

  // Library query
  if (/bài.*thích|liked|đã thích|nghe gần đây|recently|playlist của tôi|follow.*artist|nghệ sĩ tôi/i.test(q)) {
    result.intent = "library_query";
    return result;
  }

  // Artist query
  if (/nghệ sĩ|artist|ca sĩ|ban nhạc|band|ca khúc của|nhạc của/i.test(q)) {
    result.intent = "artist_query";
    // Extract artist name
    const artistMatch = q.match(/(?:nhạc của|ca sĩ|nghệ sĩ|artist)\s+(.+)/i);
    if (artistMatch) result.artistName = artistMatch[1].trim();
    return result;
  }

  // Recommendation
  if (/gợi ý|recommend|đề xuất|cho tôi|recommend|gợi ý|nên nghe/i.test(q)) {
    result.intent = "recommend_music";
    return result;
  }

  // Discovery
  if (/khám phá|discover|mới|new|hot|trending|phổ biến/i.test(q)) {
    result.intent = "discovery";
    return result;
  }

  // Default: search
  result.intent = "search_music";
  return result;
}

/* ═══════════════════════════════════════════════════════════════════════
 * TOOL ROUTER
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Determine which tools to call based on intent and context.
 */
function routeTools(intent, context) {
  const calls = [];

  switch (intent.intent) {
    case "search_music": {
      const query = intent.query || intent.trackName || intent.artistName || "";
      calls.push({ tool: "searchTracks", args: { query, limit: 10 } });
      if (intent.artistName) {
        calls.push({ tool: "searchArtists", args: { query: intent.artistName, limit: 3 } });
      }
      break;
    }

    case "recommend_music": {
      calls.push({ tool: "getRecommendations", args: { limit: 12, context: "discover" } });
      if (intent.mood?.length || intent.activity) {
        // Also search by mood/activity keywords
        const query = [...(intent.mood || []), intent.activity].filter(Boolean).join(" ");
        if (query) calls.push({ tool: "searchTracks", args: { query, limit: 5 } });
      }
      break;
    }

    case "similar_music": {
      if (intent.currentTrackRef && context?.currentTrack) {
        calls.push({ tool: "getSimilarSongs", args: { trackId: context.currentTrack.id, limit: 10 } });
      } else if (intent.trackName) {
        calls.push({ tool: "searchTracks", args: { query: intent.trackName, limit: 3 } });
      } else {
        calls.push({ tool: "getSimilarArtists", args: { limit: 5 } });
      }
      break;
    }

    case "create_playlist": {
      // Gather candidates based on mood/activity/genre
      if (intent.mood?.length || intent.activity || intent.query) {
        const query = [...(intent.mood || []), intent.activity, intent.query].filter(Boolean).join(" ");
        calls.push({ tool: "searchTracks", args: { query, limit: 20 } });
      }
      calls.push({ tool: "getRecommendations", args: { limit: 15, context: "home" } });
      break;
    }

    case "play_music": {
      if (intent.currentTrackRef && context?.currentTrack) {
        calls.push({ tool: "getTrack", args: { trackId: context.currentTrack.id } });
      } else if (intent.trackName || intent.artistName) {
        calls.push({ tool: "searchTracks", args: { query: intent.trackName || intent.artistName, limit: 5 } });
      } else {
        calls.push({ tool: "getRecommendations", args: { limit: 5, context: "home" } });
      }
      break;
    }

    case "queue_music": {
      if (intent.currentTrackRef && context?.currentTrack) {
        calls.push({ tool: "getSimilarSongs", args: { trackId: context.currentTrack.id, limit: 5 } });
      } else if (intent.trackName || intent.artistName) {
        calls.push({ tool: "searchTracks", args: { query: intent.trackName || intent.artistName, limit: 5 } });
      }
      break;
    }

    case "library_query": {
      calls.push({ tool: "getLikedSongs", args: { limit: 10 } });
      calls.push({ tool: "getUserPlaylists", args: { limit: 5 } });
      calls.push({ tool: "getFollowedArtists", args: { limit: 5 } });
      calls.push({ tool: "getRecentlyPlayed", args: { limit: 10 } });
      break;
    }

    case "artist_query": {
      if (intent.artistName) {
        calls.push({ tool: "searchArtists", args: { query: intent.artistName, limit: 3 } });
      } else {
        calls.push({ tool: "getFollowedArtists", args: { limit: 5 } });
      }
      break;
    }

    case "current_playback": {
      if (context?.currentTrack) {
        calls.push({ tool: "getTrack", args: { trackId: context.currentTrack.id } });
        calls.push({ tool: "getSimilarSongs", args: { trackId: context.currentTrack.id, limit: 5 } });
      }
      break;
    }

    case "discovery": {
      calls.push({ tool: "getDailyMixes", args: {} });
      calls.push({ tool: "getRecommendations", args: { limit: 10, context: "discover" } });
      calls.push({ tool: "getSimilarArtists", args: { limit: 5 } });
      break;
    }

    case "not_interested": {
      if (intent.trackName) {
        calls.push({ tool: "searchTracks", args: { query: intent.trackName, limit: 1 } });
      }
      break;
    }

    case "greeting":
    case "unknown":
    default:
      break;
  }

  return calls;
}

/* ═══════════════════════════════════════════════════════════════════════
 * TOOL EXECUTION
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Execute a batch of tool calls.
 * Returns { results: { toolName: result }, errors: [] }
 */
async function executeTools(username, toolCalls) {
  const results = {};
  const errors = [];

  // Execute in parallel (read tools are safe to parallelize)
  const promises = toolCalls.map(async (call) => {
    const tool = TOOLS[call.tool];
    if (!tool) {
      errors.push({ tool: call.tool, error: "Unknown tool" });
      return;
    }
    try {
      const result = await tool.execute(username, call.args);
      results[call.tool] = result;
    } catch (e) {
      console.error(`[assistant/tool/${call.tool}]`, e.message);
      errors.push({ tool: call.tool, error: e.message });
    }
  });

  await Promise.all(promises);
  return { results, errors };
}

/* ═══════════════════════════════════════════════════════════════════════
 * RESPONSE GENERATOR
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate a natural-language response with structured results.
 */
async function generateResponse(username, message, intent, toolResults, conversationHistory) {
  const hasResults = Object.values(toolResults).some(r =>
    Array.isArray(r) ? r.length > 0 : r != null
  );

  // Build context for response generation
  const contextParts = [];

  if (toolResults.searchTracks?.length) {
    contextParts.push(`Found ${toolResults.searchTracks.length} tracks: ${toolResults.searchTracks.slice(0, 5).map(t => `"${t.title}" by ${t.artist_name}`).join(", ")}`);
  }
  if (toolResults.searchArtists?.length) {
    contextParts.push(`Found ${toolResults.searchArtists.length} artists: ${toolResults.searchArtists.map(a => a.artist_name).join(", ")}`);
  }
  if (toolResults.getRecommendations?.length) {
    contextParts.push(`Got ${toolResults.getRecommendations.length} recommendations`);
  }
  if (toolResults.getSimilarSongs?.length) {
    contextParts.push(`Found ${toolResults.getSimilarSongs.length} similar tracks`);
  }
  if (toolResults.getLikedSongs?.length) {
    contextParts.push(`User has ${toolResults.getLikedSongs.length} liked songs`);
  }
  if (toolResults.getUserPlaylists?.length) {
    contextParts.push(`User has ${toolResults.getUserPlaylists.length} playlists: ${toolResults.getUserPlaylists.map(p => p.name).join(", ")}`);
  }
  if (toolResults.getFollowedArtists?.length) {
    contextParts.push(`User follows ${toolResults.getFollowedArtists.length} artists: ${toolResults.getFollowedArtists.map(a => a.artist_name).join(", ")}`);
  }
  if (toolResults.getRecentlyPlayed?.length) {
    contextParts.push(`Recently played: ${toolResults.getRecentlyPlayed.slice(0, 3).map(t => t.title).join(", ")}`);
  }
  if (toolResults.getDailyMixes?.mixes?.length) {
    contextParts.push(`Got ${toolResults.getDailyMixes.mixes.length} daily mixes`);
  }

  // For greeting or unknown, no AI call needed
  if (intent.intent === "greeting") {
    return {
      text: "Xin chào! Mình là trợ lý âm nhạc của 4ang. Bạn muốn nghe gì hôm nay? Mình có thể tìm nhạc, tạo playlist, hoặc gợi ý theo mood của bạn.",
      actions: [],
    };
  }

  if (!hasResults && intent.intent !== "unknown") {
    return {
      text: `Mình không tìm thấy kết quả phù hợp cho "${message}". Bạn có thể thử mô tả khác hoặc cụ thể hơn.`,
      actions: [],
    };
  }

  // Generate response with AI
  const responseContext = contextParts.join("\n") || "No results found.";

  const messages = [
    {
      role: "system",
      content: `You are 4ang's music assistant. Generate a concise, helpful Vietnamese response.

Context from tool results:
${responseContext}

User intent: ${intent.intent}
User message: "${message}"

Rules:
- Be concise (1-3 sentences)
- Be natural and helpful
- Reference actual results
- If suggesting actions, mention them briefly
- Use Vietnamese
- Do NOT invent tracks or data not in the context
- If no results, suggest alternatives
- For playlist creation, describe what you found

Return ONLY valid JSON:
{
  "text": "response text",
  "suggestedActions": ["action1", "action2"]
}`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  try {
    const result = await generateStructured(username, messages, { text: "string" }, {
      cachePrefix: "assistant_response",
      cacheKey: { message, intent: intent.intent },
      temperature: 0.5,
      maxTokens: 300,
    });

    if (result?.data?.text) {
      return {
        text: result.data.text,
        actions: result.data.suggestedActions || [],
      };
    }
  } catch {
    // AI unavailable — generate simple response
  }

  // Fallback response generation
  return generateFallbackResponse(intent, toolResults);
}

/**
 * Simple fallback response when AI is unavailable.
 */
function generateFallbackResponse(intent, toolResults) {
  switch (intent.intent) {
    case "search_music": {
      const tracks = toolResults.searchTracks || [];
      if (tracks.length === 0) return { text: "Không tìm thấy bài hát phù hợp.", actions: [] };
      return {
        text: `Tìm thấy ${tracks.length} bài hát. Bạn có thể bấm phát ngay.`,
        actions: ["play"],
      };
    }
    case "recommend_music": {
      const recs = toolResults.getRecommendations || [];
      if (recs.length === 0) return { text: "Hiện tại chưa có gợi ý phù hợp.", actions: [] };
      return { text: `Đây là ${recs.length} bài hát mình gợi ý cho bạn.`, actions: ["play"] };
    }
    case "similar_music": {
      const similar = toolResults.getSimilarSongs || [];
      if (similar.length === 0) return { text: "Không tìm thấy bài tương tự.", actions: [] };
      return { text: `Tìm thấy ${similar.length} bài tương tự.`, actions: ["play"] };
    }
    case "create_playlist": {
      const tracks = [...(toolResults.searchTracks || []), ...(toolResults.getRecommendations || [])];
      if (tracks.length === 0) return { text: "Không đủ bài để tạo playlist.", actions: [] };
      return { text: `Tìm thấy ${tracks.length} bài phù hợp. Bạn muốn mình tạo playlist không?`, actions: ["create_playlist"] };
    }
    case "library_query": {
      const parts = [];
      if (toolResults.getLikedSongs?.length) parts.push(`${toolResults.getLikedSongs.length} bài thích`);
      if (toolResults.getUserPlaylists?.length) parts.push(`${toolResults.getUserPlaylists.length} playlist`);
      if (toolResults.getFollowedArtists?.length) parts.push(`${toolResults.getFollowedArtists.length} nghệ sĩ follow`);
      return { text: parts.length ? `Thư viện của bạn: ${parts.join(", ")}.` : "Thư viện trống.", actions: [] };
    }
    default:
      return { text: "Mình chưa hiểu yêu cầu. Bạn có thể thử lại.", actions: [] };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * CONVERSATION MANAGER
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get or create a conversation.
 */
async function getOrCreateConversation(username, conversationId) {
  if (conversationId) {
    const { data } = await supabaseAdmin
      .from("assistant_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("username", username)
      .single();
    if (data) return data;
  }

  // Create new conversation
  const { data, error } = await supabaseAdmin
    .from("assistant_conversations")
    .insert({ username, title: null })
    .select()
    .single();

  if (error) {
    console.error("[assistant/conversation]", error.message);
    return null;
  }
  return data;
}

/**
 * Save a message to conversation.
 */
async function saveMessage(conversationId, role, content, metadata = null) {
  try {
    await supabaseAdmin.from("assistant_messages").insert({
      conversation_id: conversationId,
      role,
      content: typeof content === "string" ? content : JSON.stringify(content),
      metadata,
    });
  } catch (e) {
    console.error("[assistant/saveMessage]", e.message);
  }
}

/**
 * Get recent conversation history for context.
 */
async function getConversationHistory(conversationId, limit = 10) {
  const { data } = await supabaseAdmin
    .from("assistant_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data || [];
}

/**
 * Update conversation title from first meaningful message.
 */
async function updateConversationTitle(conversationId, title) {
  try {
    await supabaseAdmin
      .from("assistant_conversations")
      .update({ title: title.slice(0, 80) })
      .eq("id", conversationId)
      .is("title", null);
  } catch {
    // non-critical
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN ASSISTANT ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Process a user message through the assistant pipeline.
 *
 * @param {string} username
 * @param {string} message
 * @param {object} options - { conversationId, context: { currentTrack, queue } }
 * @returns {object} { conversationId, response, intent, toolResults, actions }
 */
export async function processMessage(username, message, options = {}) {
  const startTime = Date.now();
  const { conversationId: inputConvId, context = {} } = options;

  // Validate input
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return { error: "Message required" };
  }
  const cleanMessage = message.trim().slice(0, 1000);

  // Get or create conversation
  const conversation = await getOrCreateConversation(username, inputConvId);
  if (!conversation) {
    return { error: "Could not create conversation" };
  }

  // Save user message
  await saveMessage(conversation.id, "user", cleanMessage);

  // Get conversation history for context
  const history = await getConversationHistory(conversation.id, 8);

  // Step 1: Classify intent
  const intent = await classifyIntent(username, cleanMessage, context);

  // Step 2: Route to tools
  const toolCalls = routeTools(intent, context);

  // Step 3: Execute tools
  let toolResults = {};
  let toolErrors = [];
  if (toolCalls.length > 0) {
    const executed = await executeTools(username, toolCalls);
    toolResults = executed.results;
    toolErrors = executed.errors;
  }

  // Step 4: Handle not_interested specially
  if (intent.intent === "not_interested" && toolResults.searchTracks?.[0]) {
    const track = toolResults.searchTracks[0];
    await handleNotInterested(username, track.id);
    await saveMessage(conversation.id, "assistant", `Đã ẩn bài "${track.title}" khỏi gợi ý.`, { action: "not_interested", trackId: track.id });
    return {
      conversationId: conversation.id,
      response: {
        text: `Đã ẩn bài "${track.title}" khỏi gợi ý của bạn.`,
        actions: [],
      },
      intent,
      toolResults: {},
      actions: [{ type: "not_interested", trackId: track.id }],
    };
  }

  // Step 5: Generate response
  const response = await generateResponse(username, cleanMessage, intent, toolResults, history);

  // Step 6: Collect actions
  const actions = [];
  const tracks = toolResults.searchTracks || toolResults.getRecommendations || toolResults.getSimilarSongs || [];
  if (tracks.length > 0 && ["play_music", "similar_music", "recommend_music", "discovery"].includes(intent.intent)) {
    actions.push({ type: "play_all", tracks: tracks.slice(0, 20) });
  }
  if (tracks.length > 0 && intent.intent === "queue_music") {
    actions.push({ type: "add_to_queue", tracks: tracks.slice(0, 10) });
  }
  if (intent.intent === "create_playlist" && tracks.length > 0) {
    actions.push({
      type: "playlist_draft",
      draft: {
        title: intent.query || "Playlist mới",
        description: `Tạo từ: ${cleanMessage}`,
        tracks: tracks.slice(0, 20),
      },
    });
  }

  // Save assistant response
  await saveMessage(conversation.id, "assistant", response.text, {
    intent: intent.intent,
    trackCount: tracks.length,
    actions: actions.map(a => a.type),
  });

  // Update conversation title
  await updateConversationTitle(conversation.id, cleanMessage);

  const latency = Date.now() - startTime;

  return {
    conversationId: conversation.id,
    response,
    intent,
    toolResults: {
      tracks: tracks.slice(0, 20),
      artists: toolResults.searchArtists || [],
      playlists: toolResults.getUserPlaylists || [],
      dailyMixes: toolResults.getDailyMixes?.mixes || [],
      recentlyPlayed: toolResults.getRecentlyPlayed || [],
      likedSongs: toolResults.getLikedSongs || [],
      followedArtists: toolResults.getFollowedArtists || [],
    },
    actions,
    toolErrors,
    latency,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * CONVERSATION MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════ */

export async function getConversations(username, limit = 20) {
  const { data } = await supabaseAdmin
    .from("assistant_conversations")
    .select("id, title, created_at, updated_at")
    .eq("username", username)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getConversationMessages(username, conversationId, limit = 50) {
  const { data: conv } = await supabaseAdmin
    .from("assistant_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("username", username)
    .single();
  if (!conv) return [];

  const { data } = await supabaseAdmin
    .from("assistant_messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data || [];
}

export async function deleteConversation(username, conversationId) {
  // Delete messages first
  await supabaseAdmin
    .from("assistant_messages")
    .delete()
    .eq("conversation_id", conversationId);

  // Delete conversation
  const { error } = await supabaseAdmin
    .from("assistant_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("username", username);

  return !error;
}

export function getAssistantStatus() {
  return {
    tools: Object.keys(TOOLS),
    intentTypes: Object.values(INTENT_TYPES),
    version: "3.3.0",
  };
}
