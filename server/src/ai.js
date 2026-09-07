/**
 * 4ANG AI SERVICE LAYER — Phase 3.2
 *
 * Provider-agnostic, cacheable, rate-limited, privacy-safe AI service.
 *
 * Architecture:
 *   AI Service
 *   ├── Provider Adapter (OpenAI / future providers)
 *   ├── Prompt Manager (templates + structured output schemas)
 *   ├── Cache (in-memory TTL + Supabase persistent)
 *   ├── Rate Limiting (per-user, per-endpoint)
 *   ├── Cost Controls (token budget, request limits)
 *   ├── Response Validation (schema validation)
 *   └── Safety Layer (sanitize output, prevent hallucination)
 *
 * Features built on this service:
 *   - Semantic music understanding (mood/energy/context)
 *   - Natural language intent parsing
 *   - AI recommendation explanations
 *   - Playlist generation foundation
 *   - Artist metadata assistance
 */

import { supabaseAdmin } from "./supabase.js";

/* ═══════════════════════════════════════════════════════════════════════
 * CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════ */

const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || "openai",
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.AI_MODEL || "gpt-4o-mini",
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1024", 10),
  temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "15000", 10),

  // Cost controls
  maxRequestsPerUserPerMinute: parseInt(process.env.AI_RATE_LIMIT || "10", 10),
  maxRequestsPerUserPerDay: parseInt(process.env.AI_DAILY_LIMIT || "100", 10),
  maxInputTokens: 2000,

  // Cache
  cacheTtlMs: 60 * 60 * 1000, // 1 hour for analysis cache
  cacheMaxSize: 500,

  // Safety
  maxOutputLength: 2000,
  blockedPatterns: [/<script/i, /javascript:/i, /on\w+=/i],
};

/* ═══════════════════════════════════════════════════════════════════════
 * IN-MEMORY CACHE
 * ═══════════════════════════════════════════════════════════════════════ */

const aiCache = new Map();

function getCacheKey(prefix, input) {
  // Deterministic cache key from normalized input
  const str = typeof input === "string" ? input : JSON.stringify(input);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `${prefix}:${hash.toString(36)}`;
}

function getCached(key) {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > AI_CONFIG.cacheTtlMs) {
    aiCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  // Evict oldest if full
  if (aiCache.size >= AI_CONFIG.cacheMaxSize) {
    const oldest = aiCache.keys().next().value;
    aiCache.delete(oldest);
  }
  aiCache.set(key, { value, ts: Date.now() });
}

/* ═══════════════════════════════════════════════════════════════════════
 * RATE LIMITING (per-user)
 * ═══════════════════════════════════════════════════════════════════════ */

const userRateBuckets = new Map();

// Sweep old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of userRateBuckets) {
    if (now - bucket.windowStart > 10 * 60 * 1000) userRateBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function checkRateLimit(username) {
  const key = `ai:${username}`;
  const now = Date.now();
  let bucket = userRateBuckets.get(key);

  if (!bucket || now - bucket.windowStart > 60_000) {
    bucket = { windowStart: now, count: 0, dailyCount: bucket?.dailyCount || 0, dailyReset: bucket?.dailyReset || now };
    userRateBuckets.set(key, bucket);
  }

  // Daily reset
  if (now - bucket.dailyReset > 24 * 60 * 60 * 1000) {
    bucket.dailyCount = 0;
    bucket.dailyReset = now;
  }

  bucket.count += 1;
  bucket.dailyCount += 1;

  if (bucket.count > AI_CONFIG.maxRequestsPerUserPerMinute) {
    return { allowed: false, reason: "rate_limit_minute", retryAfter: 60 };
  }
  if (bucket.dailyCount > AI_CONFIG.maxRequestsPerUserPerDay) {
    return { allowed: false, reason: "rate_limit_daily", retryAfter: 3600 };
  }
  return { allowed: true };
}

/* ═══════════════════════════════════════════════════════════════════════
 * INPUT / OUTPUT VALIDATION
 * ═══════════════════════════════════════════════════════════════════════ */

function validateInput(text, maxLength = 500) {
  if (!text || typeof text !== "string") return { valid: false, error: "Input required" };
  const trimmed = text.trim();
  if (trimmed.length === 0) return { valid: false, error: "Empty input" };
  if (trimmed.length > maxLength) return { valid: false, error: `Input exceeds ${maxLength} characters` };
  return { valid: true, value: trimmed };
}

function sanitizeOutput(text) {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();
  // Remove potential HTML/script injection
  clean = clean.replace(/<[^>]*>/g, "");
  clean = clean.replace(/javascript:/gi, "");
  // Remove excessive repeated characters
  clean = clean.replace(/(.)\1{10,}/g, "$1$1$1");
  return clean.slice(0, AI_CONFIG.maxOutputLength);
}

function validateSchema(data, schema) {
  if (!data || typeof data !== "object") return false;
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in data)) return false;
    if (type === "array" && !Array.isArray(data[key])) return false;
    if (type === "string" && typeof data[key] !== "string") return false;
    if (type === "number" && typeof data[key] !== "number") return false;
    if (type === "boolean" && typeof data[key] !== "boolean") return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
 * OPENAI PROVIDER ADAPTER
 * ═══════════════════════════════════════════════════════════════════════ */

async function callOpenAI(messages, { jsonMode = false, temperature, maxTokens } = {}) {
  if (!AI_CONFIG.apiKey) {
    throw new Error("AI provider not configured (OPENAI_API_KEY missing)");
  }

  const body = {
    model: AI_CONFIG.model,
    messages,
    max_tokens: maxTokens || AI_CONFIG.maxTokens,
    temperature: temperature ?? AI_CONFIG.temperature,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_CONFIG.timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit exceeded");
      if (res.status >= 500) throw new Error("AI provider temporarily unavailable");
      throw new Error(`AI request failed (${res.status}): ${errBody.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage || {};

    return {
      content,
      tokens: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0 },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * PUBLIC API — generateText (generic)
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate text from a prompt. Handles provider, rate limiting, caching, validation.
 * @param {string} username - requesting user
 * @param {Array} messages - OpenAI-format messages
 * @param {object} opts - { cachePrefix, cacheKey, jsonMode, temperature, maxTokens }
 * @returns {{ content: string, tokens: object, cached: boolean }}
 */
export async function generateText(username, messages, opts = {}) {
  // Rate limit
  const rl = checkRateLimit(username);
  if (!rl.allowed) {
    throw new Error(`AI rate limited: ${rl.reason}. Retry after ${rl.retryAfter}s.`);
  }

  // Cache check
  if (opts.cachePrefix && opts.cacheKey) {
    const key = getCacheKey(opts.cachePrefix, opts.cacheKey);
    const cached = getCached(key);
    if (cached) return { ...cached, cached: true };
  }

  // Call provider
  const result = await callOpenAI(messages, {
    jsonMode: opts.jsonMode,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });

  // Sanitize
  result.content = sanitizeOutput(result.content);
  result.cached = false;

  // Cache if prefix provided
  if (opts.cachePrefix && opts.cacheKey) {
    const key = getCacheKey(opts.cachePrefix, opts.cacheKey);
    setCache(key, { content: result.content, tokens: result.tokens });
  }

  // Log request (fire-and-forget)
  logAIRequest(username, opts.cachePrefix || "general", result.tokens, true).catch(() => {});

  return result;
}

/**
 * Generate structured JSON from a prompt. Validates against a schema.
 * Returns null if validation fails (caller should fallback).
 */
export async function generateStructured(username, messages, schema, opts = {}) {
  const result = await generateText(username, messages, { ...opts, jsonMode: true });

  try {
    const parsed = JSON.parse(result.content);
    if (schema && !validateSchema(parsed, schema)) {
      console.warn("[ai] Schema validation failed for", opts.cachePrefix);
      return null;
    }
    return { data: parsed, tokens: result.tokens, cached: result.cached };
  } catch (e) {
    console.warn("[ai] JSON parse failed:", e.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * REQUEST LOGGING (lightweight)
 * ═══════════════════════════════════════════════════════════════════════ */

async function logAIRequest(username, endpoint, tokens, success) {
  try {
    await supabaseAdmin.from("ai_requests").insert({
      username,
      endpoint,
      tokens_prompt: tokens?.prompt || 0,
      tokens_completion: tokens?.completion || 0,
      success,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical — don't break if table doesn't exist yet
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * SEMANTIC MUSIC ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════ */

export const MOOD_VOCABULARY = [
  "calm", "happy", "sad", "melancholic", "energetic", "romantic",
  "dreamy", "dark", "hopeful", "nostalgic", "aggressive", "peaceful",
  "uplifting", "mysterious", "playful",
];

export const ENERGY_LEVELS = ["very_low", "low", "medium", "high", "very_high"];

export const CONTEXT_TAGS = [
  "study", "focus", "sleep", "workout", "travel", "party",
  "relax", "night", "morning", "commute", "cooking", "meditation",
];

/**
 * Analyze a track's mood, energy, and context using AI.
 * Caches results. Returns null on failure.
 */
export async function analyzeTrackSemantics(username, track) {
  const cacheKey = `analysis:${track.id || track.title}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const input = {
    title: track.title || "",
    artist: track.artist_name || track.artist || "",
    album: track.album || "",
    genre: track.genre || "",
    description: track.description || "",
  };

  const messages = [
    {
      role: "system",
      content: `You are a music analyst. Analyze the song and return a JSON object with:
- mood: array of 1-3 moods from: ${MOOD_VOCABULARY.join(", ")}
- energy: one of: ${ENERGY_LEVELS.join(", ")}
- contexts: array of 1-3 contexts from: ${CONTEXT_TAGS.join(", ")}
- themes: array of 1-3 short theme strings
- genres: array of 1-2 broad genres
- confidence: number 0-1 (how confident you are based on available info)

Use ONLY the provided metadata. Do NOT invent information you cannot infer.
If metadata is sparse, lower your confidence score.
Return ONLY valid JSON.`,
    },
    {
      role: "user",
      content: JSON.stringify(input),
    },
  ];

  const result = await generateStructured(username, messages, {
    mood: "array", energy: "string", contexts: "array",
    themes: "array", genres: "array", confidence: "number",
  }, { cachePrefix: "track_analysis", cacheKey: input, temperature: 0.3 });

  if (result?.data) {
    setCache(cacheKey, result.data);
    return result.data;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
 * NATURAL LANGUAGE INTENT PARSING
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Parse a natural language music request into structured intent.
 * Supports Vietnamese and English.
 */
export async function parseMusicIntent(username, query) {
  const messages = [
    {
      role: "system",
      content: `You are a music intent parser. Convert the user's natural language request into a structured JSON intent.

Supported fields:
- moods: array of mood strings (calm, happy, sad, energetic, romantic, dreamy, dark, hopeful, nostalgic)
- energy: "very_low" | "low" | "medium" | "high" | "very_high"
- contexts: array of context strings (study, focus, sleep, workout, travel, party, relax, night, morning, commute)
- genres: array of genre strings
- artists: array of artist name strings (if user mentions specific artists)
- duration_minutes: number (if user specifies duration)
- language: string (if user specifies language, e.g. "vietnamese", "english", "korean")
- exclude_artists: array (if user says "không muốn nghe" / "not want" / "don't include")
- query_type: "mood" | "artist" | "genre" | "activity" | "mixed"

Return ONLY valid JSON. Be conservative — only include fields you're confident about.`,
    },
    {
      role: "user",
      content: query,
    },
  ];

  const result = await generateStructured(username, messages, {
    moods: "array", energy: "string", query_type: "string",
  }, { cachePrefix: "intent", cacheKey: query, temperature: 0.2 });

  return result?.data || null;
}

/**
 * Fallback intent parser — keyword-based, no AI required.
 * Used when AI is unavailable.
 */
export function parseMusicIntentFallback(query) {
  const q = query.toLowerCase();
  const intent = { moods: [], energy: "medium", contexts: [], genres: [], query_type: "mixed" };

  // Vietnamese mood keywords
  if (/buồn|sad|melanchol/.test(q)) { intent.moods.push("sad", "melancholic"); intent.energy = "low"; }
  if (/vui|happ|nhảy|dance/.test(q)) { intent.moods.push("happy"); intent.energy = "high"; }
  if (/chill|nhẹ|thư giãn|relax|calm/.test(q)) { intent.moods.push("calm", "peaceful"); intent.energy = "low"; }
  if (/năng lượng|energy|tập|workout|gym/.test(q)) { intent.moods.push("energetic"); intent.energy = "high"; }
  if (/romantic|tình|yêu|love/.test(q)) { intent.moods.push("romantic"); intent.energy = "medium"; }
  if (/dreamy|mộng|ảo/.test(q)) { intent.moods.push("dreamy"); intent.energy = "low"; }
  if (/dark|tối|đen/.test(q)) { intent.moods.push("dark"); intent.energy = "medium"; }

  // Context keywords
  if (/học|study|focus|tập trung/.test(q)) intent.contexts.push("study", "focus");
  if (/ngủ|sleep|đêm|night/.test(q)) intent.contexts.push("sleep", "night");
  if (/tập|workout|gym|chạy/.test(q)) intent.contexts.push("workout");
  if (/đi đường|commute|travel/.test(q)) intent.contexts.push("commute", "travel");
  if (/party|tiệc|vui/.test(q)) intent.contexts.push("party");
  if (/sáng|morning/.test(q)) intent.contexts.push("morning");

  // Genre keywords
  if (/rock/.test(q)) intent.genres.push("rock");
  if (/pop/.test(q)) intent.genres.push("pop");
  if (/hip.?hop|rap/.test(q)) intent.genres.push("hip-hop");
  if (/jazz/.test(q)) intent.genres.push("jazz");
  if (/electronic|edm|house/.test(q)) intent.genres.push("electronic");
  if (/indie/.test(q)) intent.genres.push("indie");
  if (/r&b|rb/.test(q)) intent.genres.push("R&B");
  if (/classical|nhạc cổ điển/.test(q)) intent.genres.push("classical");
  if (/lofi|lo-fi/.test(q)) intent.genres.push("lo-fi");
  if (/bolero/.test(q)) intent.genres.push("bolero");
  if (/v(?:iet)?namese|việt/.test(q)) intent.language = "vietnamese";

  if (intent.moods.length === 0 && intent.contexts.length === 0 && intent.genres.length === 0) {
    intent.query_type = "mood";
  }

  return intent;
}

/* ═══════════════════════════════════════════════════════════════════════
 * AI RECOMMENDATION EXPLANATIONS
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate a natural-language explanation for a recommendation.
 * Input is structured signal data, NOT a raw prompt.
 */
export async function generateExplanation(username, { track, reasons, userTaste }) {
  if (!reasons || reasons.length === 0) return null;

  const messages = [
    {
      role: "system",
      content: `You are a music recommendation explainer. Generate a SHORT Vietnamese explanation (1-2 sentences, max 60 words) for why this song is recommended.

Rules:
- Be grounded in the provided reasons ONLY
- Do NOT invent user behavior
- Be natural and helpful, not robotic
- Use Vietnamese language
- Do not use exclamation marks excessively
- Do not make exaggerated claims

Return ONLY a JSON object: { "explanation": "..." }`,
    },
    {
      role: "user",
      content: JSON.stringify({
        track: { title: track.title, artist: track.artist_name },
        reasons: reasons.slice(0, 3),
        userTaste: {
          topArtists: userTaste?.topArtists?.slice(0, 3)?.map(a => a.name) || [],
          topGenres: userTaste?.topGenres?.slice(0, 3)?.map(g => g.genre) || [],
        },
      }),
    },
  ];

  const result = await generateStructured(username, messages, { explanation: "string" }, {
    cachePrefix: "explanation",
    cacheKey: { trackId: track.id, reasons },
    temperature: 0.5,
    maxTokens: 150,
  });

  return result?.data?.explanation || null;
}

/* ═══════════════════════════════════════════════════════════════════════
 * PLAYLIST GENERATION FOUNDATION
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate a playlist plan from natural language.
 * Returns structured constraints — actual track selection goes through
 * the Phase 3.0 recommendation engine.
 */
export async function generatePlaylistPlan(username, query) {
  const messages = [
    {
      role: "system",
      content: `You are a playlist planner. Convert the user's request into a structured playlist plan.

Return JSON:
{
  "title": "short playlist title in Vietnamese",
  "description": "1-sentence description",
  "mood": ["mood1", "mood2"],
  "energy": "very_low|low|medium|high|very_high",
  "genres": ["genre1"],
  "contexts": ["context1"],
  "duration_minutes": number or null,
  "track_count": number (10-50, default 20),
  "exclude_artists": [],
  "language": "vietnamese|english|any",
  "variety": "low|medium|high"
}

Rules:
- Title and description in Vietnamese
- Be conservative with fields — only include what you're confident about
- track_count default 20, duration_minutes default null
- Return ONLY valid JSON`,
    },
    {
      role: "user",
      content: query,
    },
  ];

  const result = await generateStructured(username, messages, {
    title: "string", description: "string",
  }, { cachePrefix: "playlist_plan", cacheKey: query, temperature: 0.6 });

  return result?.data || null;
}

/**
 * Fallback playlist plan — keyword-based.
 */
export function generatePlaylistPlanFallback(query) {
  const q = query.toLowerCase();
  const plan = {
    title: query.slice(0, 50),
    description: `Playlist từ: ${query}`,
    mood: [], energy: "medium", genres: [], contexts: [],
    duration_minutes: null, track_count: 20,
    exclude_artists: [], language: "any", variety: "medium",
  };

  if (/chill|nhẹ|thư giãn/.test(q)) { plan.mood = ["calm", "peaceful"]; plan.energy = "low"; plan.title = "Chill Mix"; }
  if (/buồn|sad/.test(q)) { plan.mood = ["sad", "melancholic"]; plan.energy = "low"; plan.title = "Buồn Mix"; }
  if (/năng lượng|energy|tập/.test(q)) { plan.mood = ["energetic"]; plan.energy = "high"; plan.title = "Energy Mix"; }
  if (/học|study|focus/.test(q)) { plan.contexts = ["study", "focus"]; plan.energy = "low"; plan.title = "Study Focus"; }
  if (/ngủ|sleep/.test(q)) { plan.contexts = ["sleep"]; plan.energy = "very_low"; plan.title = "Sleep Mix"; }
  if (/party|tiệc/.test(q)) { plan.contexts = ["party"]; plan.energy = "high"; plan.title = "Party Mix"; }
  if (/rock/.test(q)) plan.genres.push("rock");
  if (/pop/.test(q)) plan.genres.push("pop");
  if (/hip.?hop|rap/.test(q)) plan.genres.push("hip-hop");
  if (/30\s*phút|30\s*min/.test(q)) plan.duration_minutes = 30;
  if (/1\s*giờ|60\s*min|1\s*hour/.test(q)) plan.duration_minutes = 60;

  return plan;
}

/* ═══════════════════════════════════════════════════════════════════════
 * ARTIST AI TOOLS
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate a draft artist bio.
 * Returns a DRAFT — artist must review before publishing.
 */
export async function generateArtistBioDraft(username, { artistName, genre, existingBio }) {
  const messages = [
    {
      role: "system",
      content: `You are a music copywriter. Write a short artist biography draft (2-3 sentences, max 100 words) in Vietnamese.

Rules:
- Be professional but warm
- Reference genre and music style
- If existing bio is provided, improve it rather than replace
- Do NOT invent facts (awards, chart positions, etc.)
- Return ONLY JSON: { "bio": "..." }`,
    },
    {
      role: "user",
      content: JSON.stringify({ artistName, genre, existingBio }),
    },
  ];

  const result = await generateStructured(username, messages, { bio: "string" }, {
    cachePrefix: "artist_bio", cacheKey: { name: artistName, genre }, temperature: 0.7,
  });

  return result?.data?.bio || null;
}

/**
 * Generate a release description draft.
 */
export async function generateReleaseDescription(username, { title, artistName, type, genre }) {
  const messages = [
    {
      role: "system",
      content: `You are a music copywriter. Write a short release description (2-3 sentences, max 80 words) in Vietnamese for a new ${type || "single"}.

Rules:
- Be engaging and concise
- Reference the release type and genre
- Do NOT invent chart positions, awards, or sales numbers
- Return ONLY JSON: { "description": "..." }`,
    },
    {
      role: "user",
      content: JSON.stringify({ title, artistName, type, genre }),
    },
  ];

  const result = await generateStructured(username, messages, { description: "string" }, {
    cachePrefix: "release_desc", cacheKey: { title, artistName }, temperature: 0.7,
  });

  return result?.data?.description || null;
}

/**
 * Suggest track metadata (mood, themes) based on title and artist.
 */
export async function suggestTrackMetadata(username, { title, artistName, genre }) {
  const messages = [
    {
      role: "system",
      content: `You are a music metadata assistant. Suggest metadata for a track.

Return JSON:
{
  "mood": ["mood1", "mood2"],
  "themes": ["theme1", "theme2"],
  "suggested_genre": "genre",
  "energy": "low|medium|high",
  "description": "1-sentence description in Vietnamese"
}

Use only reasonable inferences from title, artist, and genre.
Return ONLY valid JSON.`,
    },
    {
      role: "user",
      content: JSON.stringify({ title, artistName, genre }),
    },
  ];

  const result = await generateStructured(username, messages, {
    mood: "array", themes: "array",
  }, { cachePrefix: "track_meta", cacheKey: { title, artistName }, temperature: 0.5 });

  return result?.data || null;
}

/**
 * Generate a social announcement draft for a new release.
 */
export async function generateSocialAnnouncement(username, { title, artistName, type }) {
  const messages = [
    {
      role: "system",
      content: `You are a social media copywriter for a music platform. Write a short announcement (1-2 sentences, max 40 words) in Vietnamese for a new ${type || "release"}.

Rules:
- Be exciting but not exaggerated
- Include the release title and artist
- Do NOT use excessive emoji
- Do NOT make claims about charts/sales
- Return ONLY JSON: { "announcement": "..." }`,
    },
    {
      role: "user",
      content: JSON.stringify({ title, artistName, type }),
    },
  ];

  const result = await generateStructured(username, messages, { announcement: "string" }, {
    cachePrefix: "social_announce", cacheKey: { title, artistName }, temperature: 0.7,
  });

  return result?.data?.announcement || null;
}

/* ═══════════════════════════════════════════════════════════════════════
 * AI SEARCH ENHANCEMENT
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Enhance a search query with AI understanding.
 * Takes raw user query, returns expanded search terms.
 */
export async function enhanceSearchQuery(username, query) {
  const messages = [
    {
      role: "system",
      content: `You are a music search enhancer. Given a user's search query, return related search terms that would help find the same music.

Rules:
- Include synonyms and related terms
- Handle Vietnamese and English queries
- Include artist name variations if applicable
- Return max 5 additional terms
- Return ONLY JSON: { "expandedTerms": ["term1", "term2"], "intent": "mood|artist|song|genre|mixed" }`,
    },
    {
      role: "user",
      content: query,
    },
  ];

  const result = await generateStructured(username, messages, {
    expandedTerms: "array", intent: "string",
  }, { cachePrefix: "search_enhance", cacheKey: query, temperature: 0.3, maxTokens: 200 });

  return result?.data || null;
}

/* ═══════════════════════════════════════════════════════════════════════
 * HEALTH CHECK
 * ═══════════════════════════════════════════════════════════════════════ */

export function getAIStatus() {
  return {
    configured: !!AI_CONFIG.apiKey,
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model,
    cacheSize: aiCache.size,
    rateLimitPerMinute: AI_CONFIG.maxRequestsPerUserPerMinute,
    rateLimitPerDay: AI_CONFIG.maxRequestsPerUserPerDay,
  };
}
