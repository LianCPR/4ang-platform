import { motion } from "framer-motion";
import { Home, Lock } from "lucide-react";
import { Flower, Butterfly } from "../assets/Botanical";

export default function AccessDeniedPage({ onGoHome, message }) {
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
          <Lock size={36} style={{ color: "var(--c-rose)", opacity: 0.35 }} />
        </motion.div>

        <div className="nf-code" style={{ color: "var(--c-rose)" }}>403</div>
        <h1 className="nf-title">Không có quyền truy cập</h1>
        <p className="nf-subtitle">
          {message || "Nội dung này là riêng tư hoặc bạn chưa có quyền xem."}<br />
          Hãy đăng nhập hoặc quay về trang chủ để tiếp tục khám phá."
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
