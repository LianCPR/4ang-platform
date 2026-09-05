import { Component } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Flower } from "../assets/Botanical";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="nf-page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div
            className="nf-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ textAlign: "center", maxWidth: 420, padding: "var(--sp-8) var(--sp-5)" }}
          >
            <div style={{ marginBottom: "var(--sp-4)", opacity: 0.3 }}>
              <AlertTriangle size={48} color="var(--c-gold)" />
            </div>
            <div className="nf-code" style={{ fontSize: "var(--fs-3xl)", marginBottom: "var(--sp-2)" }}>
              Oops
            </div>
            <h1 className="nf-title" style={{ fontSize: "var(--fs-lg)", marginBottom: "var(--sp-2)" }}>
              Đã xảy ra lỗi
            </h1>
            <p className="nf-subtitle" style={{ marginBottom: "var(--sp-6)", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              Có vẻ như một phần của ứng dụng gặp sự cố. Bạn có thể thử lại hoặc quay về trang chủ.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="nf-btn" onClick={this.handleRetry}>
                <RefreshCw size={15} /> Thử lại
              </button>
              <button type="button" className="nf-btn" onClick={this.handleGoHome} style={{ background: "var(--surface-hover)" }}>
                <Home size={15} /> Về trang chủ
              </button>
            </div>
            <div style={{ marginTop: "var(--sp-6)" }}>
              <Flower size={16} style={{ color: "var(--c-sage)", opacity: 0.2 }} />
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
