import { useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "../api.js";

// Reuses the exact same JWT/users system as the public app (Part 31: "do
// not duplicate authentication unnecessarily") — there is exactly one
// login endpoint, one users table, one token format. What's different
// here is what happens with the result: a token that comes back without
// isAdmin never gets treated as a valid Admin session, and is cleared
// immediately rather than lingering in localStorage.
export function useAdminSession() {
  const [state, setState] = useState({ loading: true, session: null });

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) { setState({ loading: false, session: null }); return; }
    try {
      const { user } = await api.me();
      if (!user.isAdmin) {
        setState({ loading: false, session: null, notAdmin: true });
        return;
      }
      setState({ loading: false, session: user });
    } catch (e) {
      setToken(null);
      setState({ loading: false, session: null });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (username, password) => {
    const { token, user } = await api.login({ username, password });
    if (!user.isAdmin) {
      // Deliberately do not persist a non-admin token into the Admin
      // Platform's session — a real person can still be signed into the
      // public app in another tab without that leaking in here.
      throw new Error("Tài khoản này không có quyền Admin.");
    }
    setToken(token);
    setState({ loading: false, session: user });
    return user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setState({ loading: false, session: null });
  }, []);

  return { ...state, refresh, login, logout };
}
