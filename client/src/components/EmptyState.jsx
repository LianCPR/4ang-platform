import { motion } from "framer-motion";
import { Flower } from "../assets/Botanical";

export default function EmptyState({ title, subtitle, action }) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Flower size={32} className="empty-sprig" />
      <p>{title}</p>
      {subtitle && <p className="sub">{subtitle}</p>}
      {action && <button className="btn-secondary" style={{ marginTop: "var(--sp-3)" }} onClick={action.onClick}>{action.label}</button>}
    </motion.div>
  );
}
