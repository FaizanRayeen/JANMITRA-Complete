/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/context/AuthContext.jsx
 * Author: Team ResolveIT
 * Description: Authentication Context & Provider for managing JWT tokens,
 *              user profile, roles (citizen, worker, dept_officer, admin),
 *              and automatic FCM token registration upon login.
 * ==============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { requestFCMPermission } from '../firebase';
import {
  detectPortalFromPath,
  normalizePortalRole,
  saveRoleSession,
  getRoleSession,
  updateRoleUser,
  clearRoleSession,
} from '../utils/authSession';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    const fallbackSession = getRoleSession();
    return {
      user: fallbackSession?.user || null,
      token: fallbackSession?.token || null,
      role: fallbackSession?.role || null,
      isAuthenticated: Boolean(fallbackSession?.token && fallbackSession?.user),
      login: () => {},
      logout: () => {}
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const location = useLocation();
  const currentPortal = detectPortalFromPath(location.pathname);

  const [sessionState, setSessionState] = useState(() => getRoleSession(currentPortal));

  // Synchronize auth state automatically when navigating between portals
  useEffect(() => {
    const active = getRoleSession(currentPortal);
    setSessionState(active);
  }, [currentPortal, location.pathname]);

  const token = sessionState?.token || null;
  const role = sessionState?.role || null;
  const user = sessionState?.user || null;
  const isAuthenticated = Boolean(token && user);

  /**
   * Save authentication payload into strict role-isolated storage
   */
  const login = useCallback(async (authData) => {
    const accessToken = authData.access || authData.token || authData.access_token;
    const refreshToken = authData.refresh || authData.refresh_token;
    const userData = authData.user || authData;
    const userRole = normalizePortalRole(userData.role || authData.role) || 'citizen';

    const saved = saveRoleSession({
      token: accessToken,
      refreshToken,
      user: userData,
      role: userRole,
    });
    setSessionState(saved);

    // Trigger FCM notification permission on login
    try {
      await requestFCMPermission();
    } catch (fcmErr) {
      console.warn('[Auth] FCM permission request skipped/failed:', fcmErr);
    }

    return { token: accessToken, role: userData.role || userRole, user: userData };
  }, []);

  /**
   * Update user details for the active portal session only
   */
  const updateUser = useCallback((updatedFields) => {
    const portal = detectPortalFromPath(location.pathname);
    const updated = updateRoleUser(portal, updatedFields);
    if (updated) {
      setSessionState(updated);
    }
  }, [location.pathname]);

  /**
   * Logout only the active portal role (leaves other open portal tabs intact)
   */
  const logout = useCallback((redirectOverride) => {
    const portal = detectPortalFromPath(location.pathname) || normalizePortalRole(role);
    clearRoleSession(portal);
    setSessionState(null);

    if (typeof redirectOverride === 'string' && redirectOverride) {
      window.location.href = redirectOverride;
      return;
    }

    if (portal === 'worker') {
      window.location.href = '/login?role=worker';
    } else if (portal === 'officer') {
      window.location.href = '/login?role=officer';
    } else if (portal === 'admin') {
      window.location.href = '/login?role=admin';
    } else {
      window.location.href = '/login?role=citizen';
    }
  }, [location.pathname, role]);

  const setUser = useCallback((newUser) => {
    if (!newUser) return;
    updateUser(newUser);
  }, [updateUser]);

  const value = {
    token,
    role,
    user,
    isAuthenticated,
    login,
    logout,
    updateUser,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
