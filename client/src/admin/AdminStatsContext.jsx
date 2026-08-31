import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AdminStatsContext = createContext(null);

export function AdminStatsProvider({ children }) {
  const [stats, setStats] = useState(null);

  const refreshStats = useCallback(() => {
    api.admin.stats().then((res) => setStats(res.stats)).catch(() => {});
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  return <AdminStatsContext.Provider value={{ stats, refreshStats }}>{children}</AdminStatsContext.Provider>;
}

export function useAdminStats() {
  return useContext(AdminStatsContext);
}
