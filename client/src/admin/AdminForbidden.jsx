import { ShieldAlert } from "lucide-react";

export default function AdminForbidden({ onExit }) {
  return (
    <div className="admin-status-page">
      <ShieldAlert size={40} className="c-danger" />
      <div className="admin-status-code">403</div>
      <div className="admin-status-title">Không có quyền truy cập</div>
      <p className="admin-status-sub">
        Tài khoản này không có quyền Admin. Khu vực quản trị 4ANG chỉ dành cho những tài khoản được cấp quyền.
      </p>
      <button className="btn-secondary" onClick={onExit}>Về trang chủ 4ANG</button>
    </div>
  );
}
