import { useState, useEffect } from "react";
import { Search, X, Plus, UserPlus } from "lucide-react";
import { api } from "../api";
import { CREDIT_ROLES, creditRoleLabel } from "../lib/submissions";
import { gradientFor, hashHue, initials } from "../lib/format";
import ArtistBadge from "./ArtistBadge";

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SubmissionCreditsEditor({ credits, onChange, primaryArtist }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pendingArtist, setPendingArtist] = useState(null);
  const [pendingRole, setPendingRole] = useState(CREDIT_ROLES[0].value);
  const [externalMode, setExternalMode] = useState(false);
  const [externalName, setExternalName] = useState("");

  useEffect(() => {
    if (!picking || externalMode || !debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    api.searchArtists(debouncedQuery.trim())
      .then((res) => {
        if (cancelled) return;
        setResults(res.artists.filter((a) => a.username !== primaryArtist.username && !credits.some((c) => c.artistUsername === a.username)));
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, picking, externalMode]);

  function startAdd() {
    setPicking(true); setQuery(""); setResults([]); setPendingArtist(null);
    setExternalMode(false); setExternalName(""); setPendingRole(CREDIT_ROLES[0].value);
  }
  function cancelAdd() {
    setPicking(false); setQuery(""); setResults([]); setPendingArtist(null); setExternalMode(false); setExternalName("");
  }
  function confirmAdd() {
    if (externalMode) {
      const name = externalName.trim();
      if (!name) return;
      onChange([...credits, { externalName: name, role: pendingRole }]);
    } else if (pendingArtist) {
      onChange([...credits, {
        artistUsername: pendingArtist.username, artistName: pendingArtist.artistName,
        avatarUrl: pendingArtist.avatarUrl, badge: pendingArtist.badge, role: pendingRole,
      }]);
    } else return;
    cancelAdd();
  }
  function removeCredit(i) {
    onChange(credits.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="credits-list-submit">
        {/* Primary artist — locked */}
        <div className="credit-item-submit is-primary">
          <div className="credit-item-avatar" style={primaryArtist.avatarUrl ? { backgroundImage: "url('" + primaryArtist.avatarUrl + "')" } : { background: gradientFor(hashHue(primaryArtist.artistName)) }}>
            {!primaryArtist.avatarUrl && initials(primaryArtist.artistName)}
          </div>
          <div className="credit-item-info">
            <div className="credit-item-name">
              {primaryArtist.artistName}
              <ArtistBadge badge={primaryArtist.badge} size={12} />
              <span className="credit-item-tag">Bạn</span>
            </div>
            <div className="credit-item-role">Nghệ sĩ chính</div>
          </div>
        </div>

        {/* Additional credits */}
        {credits.map((c, i) => (
          <div className="credit-item-submit" key={i}>
            <div className="credit-item-avatar" style={c.avatarUrl ? { backgroundImage: "url('" + c.avatarUrl + "')" } : { background: gradientFor(hashHue(c.artistName || c.externalName)) }}>
              {!c.avatarUrl && initials(c.artistName || c.externalName)}
            </div>
            <div className="credit-item-info">
              <div className="credit-item-name">
                {c.artistName || c.externalName}
                {c.badge && <ArtistBadge badge={c.badge} size={12} />}
                {!c.artistUsername && <span className="credit-item-tag">Ngoài 4ANG</span>}
              </div>
              <div className="credit-item-role">{creditRoleLabel(c.role)}</div>
            </div>
            <button type="button" className="icon-btn" onClick={() => removeCredit(i)} aria-label={"Xoá " + (c.artistName || c.externalName)}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {!picking ? (
        <button type="button" className="btn-secondary" onClick={startAdd} style={{ width: "100%", justifyContent: "center" }}>
          <Plus size={15} /> Thêm nghệ sĩ
        </button>
      ) : (
        <div style={{ marginTop: "var(--sp-4)", padding: "var(--sp-4)", background: "var(--surface-warm)", border: "1px solid var(--divider)", borderRadius: "var(--r-card)" }}>
          <div style={{ display: "flex", gap: "4px", marginBottom: "var(--sp-3)" }}>
            <button type="button" className={"genre-chip" + (!externalMode ? " active" : "")} onClick={() => setExternalMode(false)} style={{ fontSize: "var(--fs-xs)" }}>
              Nghệ sĩ trên 4ANG
            </button>
            <button type="button" className={"genre-chip" + (externalMode ? " active" : "")} onClick={() => setExternalMode(true)} style={{ fontSize: "var(--fs-xs)" }}>
              Nghệ sĩ ngoài
            </button>
          </div>

          {!externalMode ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px var(--sp-3)", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-pill)", marginBottom: "var(--sp-3)" }}>
                <Search size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                <input
                  type="text" placeholder="Tìm theo tên nghệ sĩ..." value={query}
                  onChange={(e) => { setQuery(e.target.value); setPendingArtist(null); }}
                  style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: "var(--fs-sm)", color: "var(--text-bright)" }}
                />
              </div>
              {searching && <p className="sub" style={{ textAlign: "center" }}>Đang tìm...</p>}
              {!searching && query.trim() && results.length === 0 && <p className="sub" style={{ textAlign: "center" }}>Không tìm thấy nghệ sĩ nào.</p>}
              {results.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "var(--sp-3)", maxHeight: 200, overflowY: "auto" }}>
                  {results.map((a) => (
                    <button
                      key={a.username} type="button"
                      className={"credit-item-submit" + (pendingArtist?.username === a.username ? " is-primary" : "")}
                      onClick={() => setPendingArtist(a)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="credit-item-avatar" style={a.avatarUrl ? { backgroundImage: "url('" + a.avatarUrl + "')" } : { background: gradientFor(hashHue(a.artistName)) }}>
                        {!a.avatarUrl && initials(a.artistName)}
                      </div>
                      <div className="credit-item-info">
                        <div className="credit-item-name">{a.artistName} <ArtistBadge badge={a.badge} size={12} /></div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="field" style={{ marginBottom: "var(--sp-3)" }}>
              <input
                type="text" placeholder="Tên nghệ sĩ ngoài 4ANG"
                value={externalName} onChange={(e) => setExternalName(e.target.value)} maxLength={60}
              />
            </div>
          )}

          <div className="field" style={{ marginBottom: "var(--sp-3)" }}>
            <label style={{ fontSize: "var(--fs-xs)" }}>Vai trò</label>
            <select value={pendingRole} onChange={(e) => setPendingRole(e.target.value)}>
              {CREDIT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)" }}>
            <button type="button" className="btn-secondary btn-sm" onClick={cancelAdd}>Huỷ</button>
            <button type="button" className="btn-primary btn-sm" onClick={confirmAdd} disabled={externalMode ? !externalName.trim() : !pendingArtist}>
              <UserPlus size={14} /> Thêm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
