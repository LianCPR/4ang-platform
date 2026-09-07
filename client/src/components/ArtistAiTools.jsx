/**
 * ArtistAiTools — Phase 3.2
 *
 * AI-powered tools for artists: bio drafts, release descriptions,
 * track metadata suggestions, social announcements.
 * All outputs are DRAFTS — artist must review before publishing.
 */
import { useState } from "react";
import { Sparkles, FileText, Music, Megaphone, Tag, Loader2, Copy, Check } from "lucide-react";
import { api } from "../api";

const TOOLS = [
  { id: "bio", label: "Viết tiểu sử", icon: FileText, description: "AI viết tiểu sử ngắn cho nghệ sĩ" },
  { id: "release", label: "Mô tả release", icon: Music, description: "Viết mô tả cho single/album/EP mới" },
  { id: "track-meta", label: "Gợi ý metadata", icon: Tag, description: "Gợi ý mood, theme, thể loại cho bài hát" },
  { id: "announcement", label: "Thông báo mạng xã hội", icon: Megaphone, description: "Viết bài thông báo release mới" },
];

export default function ArtistAiTools({ artistProfile }) {
  const [activeTool, setActiveTool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    title: "",
    genre: artistProfile?.genre || "",
    existingBio: artistProfile?.bio || "",
    type: "single",
  });

  const handleGenerate = async () => {
    if (!activeTool) return;
    setLoading(true);
    setResult(null);

    try {
      const name = artistProfile?.artist_name || artistProfile?.display_name || "Unknown";

      switch (activeTool) {
        case "bio": {
          const res = await api.ai.artistBio(name, form.genre, form.existingBio);
          setResult(res?.bio || null);
          break;
        }
        case "release": {
          const res = await api.ai.releaseDesc(form.title, name, form.type, form.genre);
          setResult(res?.description || null);
          break;
        }
        case "track-meta": {
          const res = await api.ai.trackMeta(form.title, name, form.genre);
          setResult(res?.metadata || null);
          break;
        }
        case "announcement": {
          const res = await api.ai.announcement(form.title, name, form.type);
          setResult(res?.announcement || null);
          break;
        }
      }
    } catch (e) {
      console.error("[ArtistAiTools]", e);
      setResult("AI không khả dụng. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="artist-ai-tools">
      <div className="ai-tools-header">
        <Sparkles size={18} />
        <span>Công cụ AI</span>
      </div>
      <p className="ai-tools-subtitle">AI tạo bản nháp — bạn chỉnh sửa trước khi đăng</p>

      {/* Tool Selection */}
      <div className="ai-tools-grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`ai-tool-card ${activeTool === tool.id ? "active" : ""}`}
            onClick={() => { setActiveTool(tool.id); setResult(null); }}
          >
            <tool.icon size={20} />
            <span className="ai-tool-label">{tool.label}</span>
            <span className="ai-tool-desc">{tool.description}</span>
          </button>
        ))}
      </div>

      {/* Tool Form */}
      {activeTool && (
        <div className="ai-tool-form">
          {(activeTool === "release" || activeTool === "track-meta" || activeTool === "announcement") && (
            <div className="ai-form-field">
              <label>Tên bài hát / release</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Night Drive"
              />
            </div>
          )}

          {(activeTool === "release" || activeTool === "announcement") && (
            <div className="ai-form-field">
              <label>Loại release</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="single">Single</option>
                <option value="album">Album</option>
                <option value="ep">EP</option>
              </select>
            </div>
          )}

          {activeTool === "bio" && (
            <div className="ai-form-field">
              <label>Tiểu sử hiện tại (tùy chọn)</label>
              <textarea
                value={form.existingBio}
                onChange={(e) => setForm({ ...form, existingBio: e.target.value })}
                placeholder="Để trống nếu chưa có tiểu sử"
                rows={3}
              />
            </div>
          )}

          <button
            className="ai-generate-btn"
            onClick={handleGenerate}
            disabled={loading || (activeTool !== "bio" && !form.title.trim())}
          >
            {loading ? (
              <><Loader2 size={16} className="spin" /> Đang tạo...</>
            ) : (
              <><Sparkles size={16} /> Tạo bản nháp</>
            )}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="ai-result">
          <div className="ai-result-header">
            <span className="ai-result-badge">Bản nháp</span>
            <button className="ai-copy-btn" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Đã sao chép" : "Sao chép"}
            </button>
          </div>
          <div className="ai-result-content">
            {typeof result === "string" ? (
              <p>{result}</p>
            ) : (
              <pre>{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
          <p className="ai-result-note">
            Đây là bản nháp AI. Vui lòng chỉnh sửa trước khi sử dụng.
          </p>
        </div>
      )}
    </div>
  );
}
