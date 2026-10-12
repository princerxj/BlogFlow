import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onAuthLost, refreshSession, setAccessToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/** status: 'loading' (restoring session) | 'authed' | 'guest' */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  // Restore the session on page load from the httpOnly refresh cookie.
  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((d) => alive && setState({ status: 'authed', user: d.user }))
      .catch(() => alive && setState({ status: 'guest', user: null }));
    return () => {
      alive = false;
    };
  }, []);

  // A refresh failed in the middle of a request: the session is gone.
  useEffect(() => onAuthLost(() => setState({ status: 'guest', user: null })), []);

  const start = useCallback((data) => {
    setAccessToken(data.accessToken);
    setState({ status: 'authed', user: data.user });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login: async (email, password) => start(await api.login({ email, password })),
      register: async (email, password, name) => start(await api.register({ email, password, ...(name && { name }) })),
      logout: async () => {
        await api.logout().catch(() => {});
        setAccessToken(null);
        setState({ status: 'guest', user: null });
      },
    }),
    [state, start],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
