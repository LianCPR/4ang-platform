export default function StatCard({ icon: Icon, label, value, tone, hint }) {
  return (
    <div className={"admin-stat-card" + (tone ? " tone-" + tone : "")}>
      <div className="admin-stat-card-top">
        {Icon && <Icon size={16} />}
      </div>
      <div className="admin-stat-card-value">{value}</div>
      <div className="admin-stat-card-label">{label}</div>
      {hint && <div className="admin-stat-card-link">{hint}</div>}
    </div>
  );
}
