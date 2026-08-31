import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminNotFound() {
  return (
    <div className="admin-status-page">
      <Compass size={40} className="c-accent" />
      <div className="admin-status-code">404</div>
      <div className="admin-status-title">Không tìm thấy trang</div>
      <p className="admin-status-sub">Trang quản trị này không tồn tại hoặc đã được di chuyển.</p>
      <Link to="/admin" className="btn-secondary">Về Dashboard</Link>
    </div>
  );
}
