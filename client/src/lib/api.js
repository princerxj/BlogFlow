// HTTP client. The access token lives in memory only (never localStorage): an XSS bug can't
// steal a long-lived credential, and the httpOnly refresh cookie restores the session on reload.
const BASE = import.meta.env.VITE_API_URL || '';

let accessToken = null;
const authLostListeners = new Set();

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const onAuthLost = (fn) => {
  authLostListeners.add(fn);
  return () => authLostListeners.delete(fn);
};

export class ApiError extends Error {
  constructor(status, message, body = null) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.details = body?.details;
    this.body = body;
  }
}

async function send(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { res, data };
}

// One refresh at a time: refresh tokens are single-use, so parallel refreshes would invalidate each other.
let refreshing = null;
export function refreshSession() {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'fetch' }, // CSRF guard required by the server
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        accessToken = null;
        throw new ApiError(res.status, data?.error || 'Session expired', data);
      }
      accessToken = data.accessToken;
      return data;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request(method, path, body) {
  let { res, data } = await send(method, path, body);

  // Access token expired: refresh once and replay the request.
  if (res.status === 401 && data?.code === 'token_expired') {
    try {
      await refreshSession();
    } catch (err) {
      authLostListeners.forEach((fn) => fn());
      throw err;
    }
    ({ res, data } = await send(method, path, body));
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText || 'Request failed', data);
  return data;
}

export const api = {
  register: (body) => request('POST', '/api/auth/register', body),
  login: (body) => request('POST', '/api/auth/login', body),
  logout: () =>
    fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'fetch' } }),

  listProjects: () => request('GET', '/api/projects?limit=50'),
  createProject: (body) => request('POST', '/api/projects', body),
  getProject: (id) => request('GET', `/api/projects/${id}`),
  getVersions: (id) => request('GET', `/api/projects/${id}/versions`),
  resume: (id, body) => request('POST', `/api/projects/${id}/resume`, body),
  retry: (id) => request('POST', `/api/projects/${id}/retry`),
  sync: (id) => request('POST', `/api/projects/${id}/sync`),
  deleteProject: (id) => request('DELETE', `/api/projects/${id}`),
};
