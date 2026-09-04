import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Reusable error state shown when an API call fails.
 * Props:
 *   message  — error message to display
 *   onRetry  — callback when user clicks retry (optional)
 *   compact  — smaller inline variant (optional)
 */
export default function ErrorState({ message = "Đã xảy ra lỗi. Vui lòng thử lại.", onRetry, compact }) {
  if (compact) {
    return (
      <div className="error-state error-state-compact">
        <AlertTriangle size={16} className="error-icon" />
        <span className="error-msg">{message}</span>
        {onRetry && (
          <button type="button" className="error-retry-btn" onClick={onRetry}>
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="error-state"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="error-state-icon">
        <AlertTriangle size={32} />
      </div>
      <p className="error-state-title">Đã xảy ra lỗi</p>
      <p className="error-state-msg">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" style={{ marginTop: "var(--sp-3)" }} onClick={onRetry}>
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Thử lại
        </button>
      )}
    </motion.div>
  );
}
