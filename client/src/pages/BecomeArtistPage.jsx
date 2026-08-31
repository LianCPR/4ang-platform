import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, X, Plus, Check, Music, Users, BarChart3, Headphones, Star, ExternalLink, Camera } from "lucide-react";
import { api } from "../api";
import { GENRES } from "../lib/genres";
import { Vine, Flower, Butterfly, Bird, RoseCluster } from "../assets/Botanical";

const LINK_PLATFORMS = ["Instagram", "YouTube", "TikTok", "Spotify", "Facebook", "SoundCloud", "Website", "Khác"];

const STEPS = [
  { num: "01", title: "Tạo hồ sơ", desc: "Điền tên nghệ sĩ, giới thiệu và thể loại âm nhạc của bạn." },
  { num: "02", title: "Hoàn thiện thông tin", desc: "Thêm liên kết để người nghe có thể tìm hiểu thêm về bạn." },
  { num: "03", title: "Bắt đầu hành trình", desc: "Sau khi hoàn tất, bạn sẽ có hồ sơ nghệ sĩ và có thể gửi nhạc đến 4ANG." },
];

const BENEFITS = [
  { icon: Users, text: "Hồ sơ nghệ sĩ riêng" },
  { icon: Music, text: "Trang công khai dành cho người nghe" },
  { icon: Upload, text: "Có thể gửi yêu cầu phát hành nhạc" },
  { icon: BarChart3, text: "Quản lý các bài hát đã gửi" },
  { icon: Headphones, text: "Theo dõi số liệu nghe nhạc" },
  { icon: Star, text: "Thống kê người nghe hàng tháng" },
];

export default function BecomeArtistPage({ session, showToast, onBack, onArtistCreated }) {
  const [artistName, setArtistName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(session?.email || "");
  const [bio, setBio] = useState("");
  const [genres, setGenres] = useState([]);
  const [mainGenre, setMainGenre] = useState("");
  const [country, setCountry] = useState("");
  const [links, setLinks] = useState([{ platform: "Instagram", url: "" }]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingApp, setExistingApp] = useState(null);
  const fileRef = useRef(null);

  // Check for existing application
  useState(() => {
    api.myArtistApplication().then((res) => {
      if (res.application) setExistingApp(res.application);
    }).catch(() => {});
  });

  function toggleGenre(g) {
    setGenres((gs) => gs.includes(g) ? gs.filter((x) => x !== g) : gs.length >= 5 ? gs : [...gs, g]);
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Ảnh phải nhỏ hơn 5MB."); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  function updateLink(i, field, value) {
    setLinks((ls) => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }
  function addLink() { if (links.length < 5) setLinks((ls) => [...ls, { platform: "Instagram", url: "" }]); }
  function removeLink(i) { setLinks((ls) => ls.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!artistName.trim()) { setError("Vui lòng nhập tên nghệ sĩ."); return; }
    if (artistName.trim().length < 2) { setError("Tên nghệ sĩ phải có ít nhất 2 ký tự."); return; }
    if (genres.length === 0) { setError("Vui lòng chọn ít nhất 1 thể loại."); return; }

    const cleanLinks = links.filter((l) => l.url.trim());
    for (const l of cleanLinks) {
      if (!/^https?:\/\/.+/.test(l.url.trim())) {
        setError("Mỗi liên kết cần URL hợp lệ (bắt đầu bằng http:// hoặc https://).");
        return;
      }
    }

    if (!agreed) { setError("Vui lòng đồng ý với điều khoản."); return; }

    setBusy(true);
    try {
      const payload = {
        artistName: artistName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        bio: bio.trim(),
        mainGenre,
        country: country.trim(),
        socialLinks: cleanLinks.map((l) => ({ label: l.platform, url: l.url.trim() })),
      };
      const res = await api.submitArtistApplication(payload);
      setSuccess(true);
      setExistingApp(res.application);
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra, thử lại nhé.");
    }
    setBusy(false);
  }

  // Success state
  if (success) {
    return (
      <div className="ba-page">
        <div className="ba-bg-decor">
          <div className="ba-decor-tl"><Vine size={120} direction="right" /></div>
          <div className="ba-decor-tr"><Flower size={40} style={{ opacity: 0.12, color: "var(--c-rose)" }} /></div>
          <div className="ba-decor-br"><RoseCluster size={60} /></div>
          <div className="ba-decor-bl"><Butterfly size={24} style={{ opacity: 0.15, color: "var(--c-sage)" }} /></div>
        </div>
        <motion.div className="ba-success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="ba-success-icon">
            <Star size={32} style={{ color: "var(--c-gold)" }} />
          </div>
          <h2>Yêu cầu đã được gửi</h2>
          <p>4ANG đã nhận được yêu cầu của bạn. Đội ngũ 4ANG sẽ xem xét thông tin và phản hồi trong vòng tối đa 24 giờ. Bạn sẽ nhận được thông báo trong 4ANG và email chính thức khi yêu cầu được chấp thuận.</p>
          <div className="ba-pending-status">
            <div className="ba-pending-label">PENDING REVIEW</div>
            <div className="ba-pending-detail">
              <span>Submitted:</span>
              <span>{existingApp?.submittedAt ? new Date(existingApp.submittedAt).toLocaleString("vi-VN") : "—"}</span>
            </div>
            <div className="ba-pending-detail">
              <span>Expected review:</span>
              <span>Within 24 hours</span>
            </div>
          </div>
          <div className="ba-success-actions">
            <button type="button" className="btn-primary" onClick={onBack}>Tiếp tục khám phá</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="ba-page">
      {/* Background decorations */}
      <div className="ba-bg-decor">
        <div className="ba-decor-tl"><Vine size={120} direction="right" /></div>
        <div className="ba-decor-tr"><Flower size={40} style={{ opacity: 0.12, color: "var(--c-rose)" }} /></div>
        <div className="ba-decor-br"><RoseCluster size={60} /></div>
        <div className="ba-decor-bl"><Butterfly size={24} style={{ opacity: 0.15, color: "var(--c-sage)" }} /></div>
        <div className="ba-decor-mid"><Bird size={20} style={{ opacity: 0.1, color: "var(--c-sage)" }} /></div>
      </div>

      {/* Back button */}
      <div className="ba-back">
        <button type="button" className="link-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại hồ sơ
        </button>
      </div>

      {/* Pending Application State */}
      {existingApp && !success && (
        <motion.div className="ba-pending-application" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="ba-pending-status">
            <div className="ba-pending-label">PENDING REVIEW</div>
            <div className="ba-pending-detail">
              <span>Submitted:</span>
              <span>{existingApp.submittedAt ? new Date(existingApp.submittedAt).toLocaleString("vi-VN") : "—"}</span>
            </div>
            <div className="ba-pending-detail">
              <span>Expected review:</span>
              <span>Within 24 hours</span>
            </div>
            {existingApp.status === "rejected" && existingApp.reviewNote && (
              <div className="ba-pending-reject-note">
                <span>Lý do:</span>
                <span>{existingApp.reviewNote}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Hero */}
      <motion.section className="ba-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <span className="ba-eyebrow">4ANG FOR ARTISTS</span>
        <h1 className="ba-hero-title">Âm nhạc của bạn<br />xứng đáng được lắng nghe.</h1>
        <p className="ba-hero-sub">Tạo hồ sơ nghệ sĩ, xây dựng cộng đồng người nghe và gửi những bản nhạc của bạn đến 4ANG để phát hành.</p>
        <p className="ba-hero-desc">Khi trở thành nghệ sĩ, bạn sẽ có trang hồ sơ riêng, quyền gửi bài hát đến 4ANG, theo dõi số liệu người nghe và phát triển hành trình âm nhạc của mình.</p>
      </motion.section>

      {/* Process Steps */}
      <motion.section className="ba-steps" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        {STEPS.map((s, i) => (
          <div key={i} className="ba-step">
            <span className="ba-step-num">{s.num}</span>
            <h3 className="ba-step-title">{s.title}</h3>
            <p className="ba-step-desc">{s.desc}</p>
          </div>
        ))}
      </motion.section>

      {/* Main Content: Form + Benefits */}
      <div className="ba-content">
        {/* Form */}
        <motion.form className="ba-form" onSubmit={handleSubmit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>

          {/* Section 1: Artist Info */}
          <div className="ba-form-section">
            <h2 className="ba-form-heading">Thông tin nghệ sĩ</h2>
            <p className="ba-form-desc">Hãy cho mọi người biết bạn là ai.</p>

            <div className="ba-field">
              <label className="ba-label">Tên nghệ sĩ <span className="ba-required">*</span></label>
              <input
                type="text"
                className="ba-input"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Tên bạn muốn hiển thị trên 4ANG"
                maxLength={60}
              />
            </div>

            <div className="ba-field">
              <label className="ba-label">Họ và tên</label>
              <input
                type="text"
                className="ba-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Họ và tên thật (cho admin review)"
                maxLength={100}
              />
            </div>

            <div className="ba-field">
              <label className="ba-label">Email liên hệ <span className="ba-required">*</span></label>
              <input
                type="email"
                className="ba-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="ba-field">
              <label className="ba-label">Giới thiệu</label>
              <textarea
                className="ba-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Kể một chút về bạn, âm nhạc của bạn và câu chuyện bạn muốn mang đến cho người nghe..."
                rows={5}
                maxLength={1000}
              />
              <span className="ba-char-count">{bio.length}/1000</span>
            </div>

            <div className="ba-field">
              <label className="ba-label">Thể loại chính</label>
              <select
                className="ba-input"
                value={mainGenre}
                onChange={(e) => setMainGenre(e.target.value)}
              >
                <option value="">Chọn thể loại chính</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="ba-field">
              <label className="ba-label">Quốc gia / Khu vực</label>
              <input
                type="text"
                className="ba-input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Việt Nam"
                maxLength={60}
              />
            </div>

            <div className="ba-field">
              <label className="ba-label">Ảnh đại diện nghệ sĩ</label>
              <div className="ba-avatar-upload" onClick={() => fileRef.current?.click()}>
                {avatarPreview ? (
                  <div className="ba-avatar-preview">
                    <img src={avatarPreview} alt="Avatar" />
                    <button type="button" className="ba-avatar-remove" onClick={(e) => { e.stopPropagation(); setAvatarFile(null); setAvatarPreview(null); }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="ba-avatar-placeholder">
                    <Camera size={24} style={{ color: "var(--c-sage)" }} />
                    <span>Nhấn để tải ảnh lên</span>
                    <span className="ba-avatar-hint">JPG, PNG · Tối đa 5MB</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
            </div>
          </div>

          {/* Section 2: Music */}
          <div className="ba-form-section">
            <h2 className="ba-form-heading">Âm nhạc của bạn</h2>
            <p className="ba-form-desc">Chọn những thể loại thể hiện rõ nhất màu sắc âm nhạc của bạn.</p>

            <div className="ba-field">
              <label className="ba-label">Thể loại <span className="ba-required">*</span> <span className="ba-counter">{genres.length}/5</span></label>
              <div className="ba-genre-grid">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={"ba-genre-chip" + (genres.includes(g) ? " selected" : "") + (genres.length >= 5 && !genres.includes(g) ? " disabled" : "")}
                    onClick={() => toggleGenre(g)}
                  >
                    {genres.includes(g) && <Check size={12} />}
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Links */}
          <div className="ba-form-section">
            <h2 className="ba-form-heading">Kết nối với người nghe</h2>
            <p className="ba-form-desc">Thêm những nơi mọi người có thể tìm thấy bạn.</p>

            <div className="ba-links">
              {links.map((l, i) => (
                <div key={i} className="ba-link-row">
                  <select className="ba-link-platform" value={l.platform} onChange={(e) => updateLink(i, "platform", e.target.value)}>
                    {LINK_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    type="url"
                    className="ba-link-url"
                    value={l.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    placeholder="https://..."
                  />
                  {links.length > 1 && (
                    <button type="button" className="ba-link-remove" onClick={() => removeLink(i)} aria-label="Xoá liên kết">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
              {links.length < 5 && (
                <button type="button" className="ba-link-add" onClick={addLink}>
                  <Plus size={14} /> Thêm liên kết
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div className="ba-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Terms */}
          <div className="ba-terms">
            <label className="ba-checkbox-label">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="ba-checkbox" />
              <span>Tôi xác nhận rằng thông tin mình cung cấp là chính xác và đồng ý với <button type="button" className="ba-link-inline">điều khoản</button> dành cho nghệ sĩ của 4ANG.</span>
            </label>
          </div>

          {/* Submit */}
          <div className="ba-submit">
            <button type="submit" className="btn-primary btn-lg" disabled={busy || !agreed}>
              {busy ? <span className="btn-busy"><span className="busy-dot" /> Đang tạo...</span> : "Trở thành nghệ sĩ →"}
            </button>
          </div>
        </motion.form>

        {/* Benefits sidebar */}
        <motion.aside className="ba-benefits" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <h3>Bạn sẽ nhận được gì?</h3>
          <div className="ba-benefits-list">
            {BENEFITS.map((b, i) => (
              <div key={i} className="ba-benefit-item">
                <div className="ba-benefit-icon"><b.icon size={18} /></div>
                <span>{b.text}</span>
              </div>
            ))}
          </div>

          <div className="ba-verification-info">
            <h4>Hệ thống xác minh 4ANG</h4>
            <div className="ba-verification-item">
              <span className="ba-badge ba-badge-independent">Artist</span>
              <div>
                <strong>Nghệ sĩ tự do</strong>
                <p>Đăng ký hồ sơ nghệ sĩ để bắt đầu hành trình.</p>
              </div>
            </div>
            <div className="ba-verification-item">
              <span className="ba-badge ba-badge-verified">✓ Verified</span>
              <div>
                <strong>Nghệ sĩ được 4ANG xác minh</strong>
                <p>Dấu xác minh được cấp sau khi hồ sơ được xem xét riêng.</p>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
