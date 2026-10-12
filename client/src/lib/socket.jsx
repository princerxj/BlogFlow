import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken, refreshSession } from './api.js';
import { useAuth } from './auth.jsx';

export const SocketContext = createContext({ connected: false, subscribe: () => () => {} });
export const useSocketStatus = () => useContext(SocketContext);

const BASE = import.meta.env.VITE_API_URL || undefined;

/**
 * One Socket.IO connection per logged-in user. Events are fanned out to subscribers.
 * Events are not replayed by the server, so after a (re)connect we emit a synthetic
 * { type: 'resync' } and pages re-fetch their state.
 */
export function SocketProvider({ children }) {
  const { status } = useAuth();
  const [connected, setConnected] = useState(false);
  const subscribers = useRef(new Set());
  const subscribeRef = useRef((fn) => {
    subscribers.current.add(fn);
    return () => subscribers.current.delete(fn);
  });

  useEffect(() => {
    if (status !== 'authed') return undefined;

    const opts = { auth: (cb) => cb({ token: getAccessToken() }), withCredentials: true };
    const socket = BASE ? io(BASE, opts) : io(opts);
    const emit = (e) => subscribers.current.forEach((fn) => fn(e));
    let hasConnectedBefore = false;

    // The server closes a socket when its access token expires. Refresh, then reconnect by hand
    // (socket.io-client does not auto-reconnect after a server-initiated disconnect).
    const renew = () => refreshSession().then(() => socket.connect()).catch(() => {});

    socket.on('connect', () => {
      setConnected(true);
      if (hasConnectedBefore) emit({ type: 'resync' });
      hasConnectedBefore = true;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('project:event', emit);
    socket.on('auth:expired', renew);
    socket.on('connect_error', (err) => {
      if (err.message === 'token_expired') renew();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [status]);

  return <SocketContext.Provider value={{ connected, subscribe: subscribeRef.current }}>{children}</SocketContext.Provider>;
}

/** Subscribe to live project events for as long as the component is mounted. */
export function useProjectEvents(handler) {
  const { subscribe } = useSocketStatus();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => subscribe((e) => latest.current(e)), [subscribe]);
}
