import { motion } from "framer-motion";
import { Home, Music } from "lucide-react";
import { Flower, Butterfly } from "../assets/Botanical";

export default function NotFoundPage({ onGoHome }) {
  return (
    <div className="nf-page">
      <motion.div
        className="nf-content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="nf-botanical"
          animate={{ y: [0, -6, 0], rotate: [0, 3, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Butterfly size={40} style={{ color: "var(--c-rose)", opacity: 0.4 }} />
        </motion.div>

        <div className="nf-code">404</div>
        <h1 className="nf-title">Trang không tồn tại</h1>
        <p className="nf-subtitle">
          Có vẻ như bài hát này đã lạc mất somewhere.<br />
          Hãy quay về trang chủ và tiếp tục khám phá âm nhạc.
        </p>

        <div className="nf-actions">
          <button type="button" className="nf-btn" onClick={onGoHome}>
            <Home size={16} />
            Về trang chủ
          </button>
        </div>

        <div className="nf-footer-decor">
          <Flower size={14} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
        </div>
      </motion.div>
    </div>
  );
}
