import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import SubmissionStatusBadge from "./SubmissionStatusBadge";
import { assetSrcFor } from "../api";
import { gradientFor, hashHue, timeAgo } from "../lib/format";

export default function SubmissionCard({ submission: s, onOpen }) {
  return (
    <motion.button type="button" className="submission-card glass-interactive" onClick={onOpen} whileTap={{ scale: 0.99 }}>
      <div className="submission-card-art" style={s.coverUrl ? { backgroundImage: "url('" + assetSrcFor(s.coverUrl) + "')" } : { background: gradientFor(hashHue(s.title)) }} />
      <div className="submission-card-info">
        <div className="submission-card-title">{s.title}</div>
        <div className="sub">Cập nhật {timeAgo(s.updatedAt)}</div>
        {s.adminNote && (s.status === "changes_requested" || s.status === "rejected") && (
          <div className="submission-card-note">"{s.adminNote}"</div>
        )}
      </div>
      <SubmissionStatusBadge status={s.status} />
      <ChevronRight size={16} />
    </motion.button>
  );
}
