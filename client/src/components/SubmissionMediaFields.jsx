import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Music, ImagePlus, Video, X, RefreshCw } from "lucide-react";
import { formatTime } from "../lib/format";

function useObjectUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function AudioUploadField({ file, existingName, existingPreviewSrc, onSelect, error }) {
  const objectUrl = useObjectUrl(file);
  const [duration, setDuration] = useState(null);
  const inputRef = useRef(null);
  const previewSrc = objectUrl || existingPreviewSrc;
  const displayName = file ? file.name : existingName;

  useEffect(() => { setDuration(null); }, [file]);

  return (
    <div>
      {!displayName ? (
        <label className="upload-area-large">
          <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])} />
          <div className="upload-area-large-icon"><Music size={28} /></div>
          <div className="upload-area-large-text">Bấm để chọn file nhạc</div>
          <div className="upload-area-large-hint">MP3, WAV, FLAC, M4A · tối đa 30MB</div>
        </label>
      ) : (
        <div className="upload-area-large has-file">
          <div className="uploaded-file">
            <div className="uploaded-file-icon"><Music size={18} /></div>
            <div className="uploaded-file-info">
              <div className="uploaded-file-name">{displayName}</div>
              <div className="uploaded-file-meta">
                {file ? formatBytes(file.size) : "Đã tải lên"}
                {duration != null ? " · " + formatTime(duration) : ""}
              </div>
            </div>
            <button type="button" className="icon-btn" onClick={() => inputRef.current?.click()} aria-label="Đổi file nhạc">
              <RefreshCw size={15} />
            </button>
            <input ref={inputRef} type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])} />
          </div>
          {previewSrc && (
            <audio controls preload="metadata" src={previewSrc} style={{ width: "100%", marginTop: "var(--sp-3)", borderRadius: "var(--r-btn)" }} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
          )}
        </div>
      )}
      {error && <p style={{ fontSize: "var(--fs-xs)", color: "var(--danger)", marginTop: "var(--sp-2)" }}>{error}</p>}
    </div>
  );
}

export function CoverUploadField({ file, existingUrl, onSelect, error }) {
  const objectUrl = useObjectUrl(file);
  const inputRef = useRef(null);
  const previewSrc = objectUrl || existingUrl;

  return (
    <div>
      <label className={"upload-cover-area" + (previewSrc ? " has-image" : "")} style={previewSrc ? { backgroundImage: "url('" + previewSrc + "')" } : undefined}>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])} />
        {!previewSrc && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--c-beige)" }}>
            <ImagePlus size={26} />
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--text-muted)" }}>Chọn ảnh bìa</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)" }}>PNG, JPEG, WEBP · tối đa 8MB</div>
          </div>
        )}
        {previewSrc && (
          <span className="upload-cover-replace">
            <RefreshCw size={14} /> Đổi ảnh
          </span>
        )}
      </label>
      {error && <p style={{ fontSize: "var(--fs-xs)", color: "var(--danger)", marginTop: "var(--sp-2)" }}>{error}</p>}
    </div>
  );
}

export function VideoUploadField({ file, existingUrl, hasExisting, onSelect, onRemove }) {
  const objectUrl = useObjectUrl(file);
  const previewSrc = objectUrl || existingUrl;
  const hasAny = !!file || hasExisting;

  return (
    <div>
      {!hasAny ? (
        <label className="upload-area-large" style={{ minHeight: 120 }}>
          <input type="file" accept="video/*" hidden onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])} />
          <div className="upload-area-large-icon"><Video size={24} /></div>
          <div className="upload-area-large-text">Thêm video ca nhạc (không bắt buộc)</div>
          <div className="upload-area-large-hint">MP4, WEBM, MOV · tối đa 150MB</div>
        </label>
      ) : (
        <div className="upload-area-large has-file">
          <div className="uploaded-file">
            <div className="uploaded-file-icon"><Video size={18} /></div>
            <div className="uploaded-file-info">
              <div className="uploaded-file-name">{file ? file.name : "Video đã tải lên"}</div>
              {file && <div className="uploaded-file-meta">{formatBytes(file.size)}</div>}
            </div>
            <button type="button" className="icon-btn" onClick={onRemove} aria-label="Bỏ video">
              <X size={15} />
            </button>
          </div>
          {previewSrc && (
            <video controls preload="metadata" src={previewSrc} className="media-video-preview" style={{ marginTop: "var(--sp-3)" }} />
          )}
        </div>
      )}
    </div>
  );
}
