/**
 * AiDiscovery — Phase 3.2
 *
 * AI-powered music discovery: natural language search, playlist generation.
 * Uses the existing 4ang design system.
 */
import { useState, useRef, useCallback } from "react";
import { Sparkles, Music, Play, Shuffle, X, Loader2, Search, Wand2 } from "lucide-react";
import { api } from "../api";

const QUICK_PROMPTS = [
  { label: "Chill để học", query: "nhạc chill để học buổi tối" },
  { label: "Năng lượng cao", query: "nhạc năng lượng cao để tập gym" },
  { label: "Buồn nhẹ nhàng", query: "nhạc buồn nhưng nhẹ nhàng, không quá dark" },
  { label: "Đi đường", query: "nhạc để lái xe, đi đường buổi tối" },
  { label: "Party", query: "nhạc party sôi động" },
  { label: "Thư giãn", query: "nhạc thư giãn cuối tuần" },
];

export default function AiDiscovery({ onPlay }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (searchQuery) => {
    const q = (searchQuery || query).trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPlan(null);

    try {
      // 1. Parse intent
      let intent = null;
      let intentSource = "fallback";
      try {
        const intentRes = await api.ai.parseIntent(q);
        intent = intentRes?.intent;
        intentSource = intentRes?.source || "ai";
      } catch {
        // AI unavailable — continue with null intent
      }

      // 2. Generate playlist plan
      let playlistPlan = null;
      let planSource = "fallback";
      try {
        const planRes = await api.ai.playlistPlan(q);
        playlistPlan = planRes?.plan;
        planSource = planRes?.source || "ai";
      } catch {
        // AI unavailable
      }
      setPlan(playlistPlan);

      // 3. Use intent to get contextual recommendations
      if (intent) {
        const context = intent.contexts?.[0] || "discover";
        let tracks = [];

        // Try the recommendation API first
        try {
          const recRes = await api.recommendations?.contextual?.(context, 20);
          if (recRes?.tracks?.length) {
            tracks = recRes.tracks;
          }
        } catch {
          // Recommendation API unavailable
        }

        // Fallback: search with expanded terms
        if (tracks.length === 0) {
          try {
            const searchTerms = [q, ...(intent.genres || []), ...(intent.moods || [])].join(" ");
            const searchRes = await api.tracks?.search?.(searchTerms);
            tracks = searchRes?.tracks || [];
          } catch {
            // Search unavailable
          }
        }

        setResult({
          tracks,
          intent,
          source: planSource !== "fallback" ? planSource : intentSource,
        });
      } else {
        // No intent — try direct search
        try {
          const searchRes = await api.tracks?.search?.(q);
          setResult({
            tracks: searchRes?.tracks || [],
            intent: null,
            source: "fallback",
          });
        } catch {
          setError("Không thể tìm nhạc. Vui lòng thử lại.");
        }
      }
    } catch (e) {
      console.error("[AiDiscovery]", e);
      setError("Không thể phân tích yêu cầu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSearch();
    }
  };

  const handleQuickPrompt = (prompt) => {
    setQuery(prompt.query);
    handleSearch(prompt.query);
  };

  const playAll = (tracks) => {
    if (tracks.length > 0 && onPlay) {
      onPlay(tracks, 0);
    }
  };

  const shuffleAll = (tracks) => {
    if (tracks.length > 0 && onPlay) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      onPlay(shuffled, 0);
    }
  };

  return (
    <div className="ai-discovery">
      <div className="ai-discovery-header">
        <div className="ai-discovery-title">
          <Sparkles size={20} />
          <span>Tìm nhạc bằng cảm xúc</span>
        </div>
        <p className="ai-discovery-subtitle">
          Mô tả bạn muốn nghe gì — AI sẽ tìm nhạc phù hợp
        </p>
      </div>

      {/* Search Input */}
      <div className="ai-search-bar">
        <Search size={18} className="ai-search-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ví dụ: nhạc chill để học buổi tối..."
          className="ai-search-input"
          disabled={loading}
        />
        {query && (
          <button
            className="ai-search-clear"
            onClick={() => { setQuery(""); setResult(null); setPlan(null); setError(null); }}
            aria-label="Xoá"
          >
            <X size={16} />
          </button>
        )}
        <button
          className="ai-search-btn"
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          aria-label="Tìm kiếm"
        >
          {loading ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
        </button>
      </div>

      {/* Quick Prompts */}
      {!result && !loading && (
        <div className="ai-quick-prompts">
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              className="ai-quick-prompt"
              onClick={() => handleQuickPrompt(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="ai-error">
          <span>{error}</span>
          <button onClick={() => handleSearch()}>Thử lại</button>
        </div>
      )}

      {/* Playlist Plan */}
      {plan && (
        <div className="ai-plan">
          <div className="ai-plan-header">
            <Music size={16} />
            <span className="ai-plan-title">{plan.title}</span>
            {plan.description && (
              <span className="ai-plan-desc">{plan.description}</span>
            )}
          </div>
          <div className="ai-plan-tags">
            {plan.mood?.map((m, i) => <span key={i} className="ai-tag mood">{m}</span>)}
            {plan.energy && plan.energy !== "medium" && (
              <span className="ai-tag energy">{plan.energy}</span>
            )}
            {plan.genres?.map((g, i) => <span key={i} className="ai-tag genre">{g}</span>)}
            {plan.duration_minutes && (
              <span className="ai-tag duration">{plan.duration_minutes} phút</span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result?.tracks?.length > 0 && (
        <div className="ai-results">
          <div className="ai-results-header">
            <span>{result.tracks.length} bài hát</span>
            <div className="ai-results-actions">
              <button
                className="ai-action-btn"
                onClick={() => playAll(result.tracks)}
                aria-label="Phát tất cả"
              >
                <Play size={14} /> Phát tất cả
              </button>
              <button
                className="ai-action-btn secondary"
                onClick={() => shuffleAll(result.tracks)}
                aria-label="Phát ngẫu nhiên"
              >
                <Shuffle size={14} /> Xáo trộn
              </button>
            </div>
          </div>

          <div className="ai-track-list">
            {result.tracks.map((track, i) => (
              <div
                key={track.id || i}
                className="ai-track-row"
                onClick={() => onPlay && onPlay(result.tracks, i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onPlay && onPlay(result.tracks, i)}
              >
                <span className="ai-track-num">{i + 1}</span>
                {track.artwork_url && (
                  <div
                    className="ai-track-art"
                    style={{ backgroundImage: `url(${track.artwork_url})` }}
                  />
                )}
                <div className="ai-track-info">
                  <span className="ai-track-title">{track.title}</span>
                  <span className="ai-track-artist">{track.artist_name}</span>
                </div>
                {track._reason && (
                  <span className="ai-track-reason">{track._reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && result && result.tracks?.length === 0 && !error && (
        <div className="ai-empty">
          <Music size={32} />
          <p>Không tìm thấy bài hát phù hợp</p>
          <p className="ai-empty-hint">Thử mô tả khác hoặc kiểm tra lại sau</p>
        </div>
      )}
    </div>
  );
}
