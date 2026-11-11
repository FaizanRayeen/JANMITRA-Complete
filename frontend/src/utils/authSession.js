/**
 * Role-isolated authentication storage helper.
 * Keeps Citizen, Worker, Officer, and Admin sessions strictly separated
 * so logging into multiple portals in the same browser never overlaps.
 */

export const normalizePortalRole = (rawRole) => {
  const r = String(rawRole || '').trim().toLowerCase();
  if (['worker', 'field_worker', 'field worker'].includes(r)) return 'worker';
  if (['officer', 'dept_officer', 'department_officer', 'municipal_officer', 'pwd', 'swm', 'phe', 'wsd', 'elec'].includes(r)) {
    return 'officer';
  }
  if (['admin', 'administrator', 'superadmin'].includes(r)) return 'admin';
  if (['citizen', 'user'].includes(r)) return 'citizen';
  return null;
};

export const detectPortalFromPath = (pathname = '', requestUrl = '') => {
  const u = String(requestUrl || '').toLowerCase();
  if (u.includes('/worker/')) return 'worker';
  if (u.includes('/officer/')) return 'officer';
  if (u.includes('/admin/')) return 'admin';

  const p = String(
    pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
  ).toLowerCase();
  if (p.startsWith('/worker')) return 'worker';
  if (p.startsWith('/officer')) return 'officer';
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/citizen')) return 'citizen';
  return null;
};

const sessionKey = (role) => `janmitra_session_${role}`;

export const saveRoleSession = ({ token, refreshToken, user, role }) => {
  const normRole = normalizePortalRole(role || user?.role) || 'citizen';
  const payload = {
    token: token || null,
    refreshToken: refreshToken || null,
    user: user || null,
    role: user?.role || normRole,
    portal: normRole,
    savedAt: Date.now(),
  };

  const json = JSON.stringify(payload);
  try {
    sessionStorage.setItem(sessionKey(normRole), json);
    sessionStorage.setItem('janmitra_active_portal', normRole);
    localStorage.setItem(sessionKey(normRole), json);
    localStorage.setItem('janmitra_last_portal', normRole);
  } catch (err) {
    console.warn('[authSession] Storage write notice:', err?.message);
  }
  return payload;
};

export const getRoleSession = (portalOverride = null, requestUrl = '') => {
  const portal =
    normalizePortalRole(portalOverride) ||
    detectPortalFromPath(undefined, requestUrl);

  const readKey = (k) => {
    try {
      const fromTab = sessionStorage.getItem(k);
      if (fromTab) return JSON.parse(fromTab);
      const fromLocal = localStorage.getItem(k);
      if (fromLocal) return JSON.parse(fromLocal);
    } catch {
      return null;
    }
    return null;
  };

  if (portal) {
    const scoped = readKey(sessionKey(portal));
    if (scoped && scoped.token && scoped.user) {
      return scoped;
    }
    // Safe migration for pre-existing legacy storage ONLY if stored role strictly matches portal
    try {
      const legToken = localStorage.getItem('access_token') || localStorage.getItem('janmitra_token');
      const legUserRaw = localStorage.getItem('user_data') || localStorage.getItem('janmitra_user');
      const legRoleRaw = localStorage.getItem('user_role') || localStorage.getItem('janmitra_role');
      const legUser = legUserRaw ? JSON.parse(legUserRaw) : null;
      const legPortal = normalizePortalRole(legUser?.role || legRoleRaw);
      if (legToken && legUser && legPortal === portal) {
        return saveRoleSession({ token: legToken, user: legUser, role: legPortal });
      }
    } catch {}
    return null;
  }

  // Only on shared non-portal pages (e.g. '/', '/login') allow tab's active portal or legacy key
  try {
    const activeTabPortal = sessionStorage.getItem('janmitra_active_portal') || localStorage.getItem('janmitra_last_portal');
    if (activeTabPortal) {
      const s = readKey(sessionKey(activeTabPortal));
      if (s && s.token && s.user) return s;
    }
  } catch {}

  return null;
};

export const updateRoleUser = (portalOverride, updatedFields) => {
  const portal = normalizePortalRole(portalOverride) || detectPortalFromPath() || 'citizen';
  const current = getRoleSession(portal);
  if (!current) return null;
  const merged = { ...(current.user || {}), ...updatedFields };
  return saveRoleSession({
    ...current,
    user: merged,
  });
};

export const clearRoleSession = (portalOverride = null) => {
  const portal = normalizePortalRole(portalOverride) || detectPortalFromPath();
  const removeKey = (k) => {
    try {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    } catch {}
  };

  if (portal) {
    removeKey(sessionKey(portal));
  } else {
    ['citizen', 'worker', 'officer', 'admin'].forEach((r) => removeKey(sessionKey(r)));
  }

  // Also clear legacy shared keys so stale tokens never leak back across roles
  [
    'access_token',
    'refresh_token',
    'user_role',
    'user_data',
    'janmitra_token',
    'janmitra_refresh_token',
    'janmitra_role',
    'janmitra_user',
  ].forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
};
