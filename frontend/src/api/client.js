import axios from 'axios';
import { getRoleSession, saveRoleSession, clearRoleSession, detectPortalFromPath } from '../utils/authSession';

const getStoredToken = (url = '') => getRoleSession(null, url)?.token || null;
const getStoredRefreshToken = (url = '') => getRoleSession(null, url)?.refreshToken || null;
const clearAuthState = (url = '') => {
  const portal = detectPortalFromPath(undefined, url);
  clearRoleSession(portal);
};

const normalizeRole = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();

  if (['citizen', 'user'].includes(normalized)) return 'citizen';
  if (['worker', 'field_worker', 'field worker'].includes(normalized)) return 'worker';
  if (['officer', 'department_officer', 'municipal_officer', 'dept_officer'].includes(normalized)) return 'officer';
  if (['admin', 'administrator', 'superadmin'].includes(normalized)) return 'admin';

  const deptAliases = {
    pwd: 'officer',
    public_works: 'officer',
    'public works': 'officer',
    'public works department': 'officer',
    swm: 'officer',
    wsd: 'officer',
    elec: 'officer',
  };

  return deptAliases[normalized] || null;
};

const resolveDefaultBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const rawBaseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  resolveDefaultBaseUrl();

const cleanBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const api = axios.create({
  baseURL: cleanBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config) => {
    // Normalize URL: ensure '/v1/...' resolves cleanly to '/api/v1/...' without duplicating '/api'
    if (config.url && config.url.startsWith('/v1/') && !cleanBaseUrl.endsWith('/api')) {
      config.url = `/api${config.url}`;
    }
    const token = getStoredToken(config.url || '');
    if (token) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      const reqUrl = originalRequest.url || '';
      const portal = detectPortalFromPath(undefined, reqUrl) || 'citizen';
      const refreshToken = getStoredRefreshToken(reqUrl);

      if (refreshToken && !String(reqUrl).includes('/auth/token/refresh/')) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers = {
                ...(originalRequest.headers || {}),
                Authorization: `Bearer ${token}`,
              };
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshEndpoint = cleanBaseUrl.endsWith('/api')
            ? `${cleanBaseUrl}/v1/auth/token/refresh/`
            : `${cleanBaseUrl}/api/v1/auth/token/refresh/`;
          const res = await axios.post(
            refreshEndpoint,
            { refresh: refreshToken }
          );

          const newToken = res.data?.access || res.data?.token;
          if (newToken) {
            const currentSession = getRoleSession(null, reqUrl) || {};
            saveRoleSession({ ...currentSession, token: newToken, role: currentSession.role || portal });
            originalRequest.headers = {
              ...(originalRequest.headers || {}),
              Authorization: `Bearer ${newToken}`,
            };
            processQueue(null, newToken);
            return api(originalRequest);
          }

          throw new Error('No refresh token issued by backend');
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          clearAuthState(reqUrl);
          if (window.location.pathname !== '/login') {
            window.location.assign(`/login?role=${portal}`);
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }

      clearAuthState(reqUrl);
      if (window.location.pathname !== '/login') {
        window.location.assign(`/login?role=${portal}`);
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
