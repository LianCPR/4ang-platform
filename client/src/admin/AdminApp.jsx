import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./styles/admin.css";
import { useAdminSession } from "./useAdminSession.js";
import { AdminStatsProvider } from "./AdminStatsContext.jsx";
import AdminShell from "./AdminShell.jsx";
import AdminLogin from "./AdminLogin.jsx";
import AdminForbidden from "./AdminForbidden.jsx";
import AdminNotFound from "./AdminNotFound.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import SubmissionQueue from "./pages/SubmissionQueue.jsx";
import SubmissionReview from "./pages/SubmissionReview.jsx";
import Verifications from "./pages/Verifications.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import UserDetail from "./pages/UserDetail.jsx";
import ArtistsPage from "./pages/ArtistsPage.jsx";
import ArtistDetail from "./pages/ArtistDetail.jsx";
import MusicPage from "./pages/MusicPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SupportTicketsPage from "./pages/SupportTicketsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

export default function AdminApp() {
  const { loading, session, notAdmin, login, logout } = useAdminSession();
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2600); }

  if (loading) {
    return <div className="admin-status-page"><p className="admin-status-sub">Đang tải Admin Platform...</p></div>;
  }

  if (!session) {
    if (notAdmin) return <AdminForbidden onExit={() => { window.location.href = "/"; }} />;
    return <AdminLogin onLogin={login} />;
  }

  return (
    <div className="admin-root">
      <AdminStatsProvider>
        <AdminShell session={session} onLogout={() => { logout(); }}>
          <Routes>
            <Route path="/" element={<Dashboard showToast={showToast} />} />
            <Route path="submissions" element={<SubmissionQueue />} />
            <Route path="submissions/:id" element={<SubmissionReview showToast={showToast} />} />
            <Route path="verifications" element={<Verifications showToast={showToast} />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:username" element={<UserDetail showToast={showToast} />} />
            <Route path="artists" element={<ArtistsPage />} />
            <Route path="artists/:username" element={<ArtistDetail showToast={showToast} />} />
            <Route path="music" element={<MusicPage showToast={showToast} />} />
            <Route path="reports" element={<ReportsPage showToast={showToast} />} />
            <Route path="support" element={<SupportTicketsPage showToast={showToast} />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="settings" element={<SettingsPage showToast={showToast} />} />
            <Route path="*" element={<AdminNotFound />} />
          </Routes>
        </AdminShell>
      </AdminStatsProvider>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
