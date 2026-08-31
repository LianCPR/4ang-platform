import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../../api.js";
import { SkeletonBlock } from "../components/Skeleton.jsx";

const RANGES = [7, 30, 90];

const METRICS = [
  { key: "newUsers", label: "Người dùng mới", color: "var(--accent-bright)" },
  { key: "submissionsCreated", label: "Bài gửi mới", color: "var(--pending)" },
  { key: "tracksPublished", label: "Bài phát hành", color: "var(--success)" },
  { key: "plays", label: "Lượt nghe", color: "var(--wine-bright)" },
];

function shortDate(d) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.admin.analytics(days).then(setData).catch(() => setData({ series: [], totals: {} }));
  }, [days]);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Phân tích</h1>
          <p className="admin-page-sub">Số liệu thật, theo ngày — không có điểm dữ liệu giả.</p>
        </div>
        <div className="admin-filter-row" style={{ margin: 0 }}>
          {RANGES.map((r) => (
            <button key={r} className={"admin-filter-tab" + (days === r ? " active" : "")} onClick={() => setDays(r)}>{r} ngày</button>
          ))}
        </div>
      </div>

      {!data ? (
        <SkeletonBlock height={400} />
      ) : (
        <>
          <div className="admin-stat-grid">
            {METRICS.map((m) => (
              <div className="admin-stat-card" key={m.key}>
                <div className="admin-stat-card-value">{(data.totals[m.key] ?? 0).toLocaleString("vi-VN")}</div>
                <div className="admin-stat-card-label">{m.label} ({days} ngày qua)</div>
              </div>
            ))}
          </div>

          {METRICS.map((m) => (
            <div className="admin-chart-card" key={m.key}>
              <div className="admin-chart-head">
                <h2>{m.label}</h2>
                <span className="admin-chart-total">{(data.totals[m.key] ?? 0).toLocaleString("vi-VN")}</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.series}>
                  <defs>
                    <linearGradient id={"grad-" + m.key} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={shortDate}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 10, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey={m.key} stroke={m.color} fill={`url(#grad-${m.key})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
