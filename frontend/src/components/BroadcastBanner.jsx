/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/components/BroadcastBanner.jsx
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen Broadcast Advisory Banner Component.
 *              - Fetches broadcast_message from /api/v1/admin/settings/ or announcements API.
 *              - If active advisory exists: renders an amber banner at top of Citizen Home:
 *                Speaker icon (📢), title: 'NMC Civic Advisory', text, dismiss button (X).
 *              - Dismissing caches the banner ID in sessionStorage to prevent repeated popups.
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';

export const BroadcastBanner = ({ onDismiss } = {}) => {
  const [advisory, setAdvisory] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchBroadcast = async () => {
      setIsLoading(true);
      try {
        let resData = null;

        try {
          const annRes = await api.get('/api/v1/announcements/');
          if (annRes?.data) {
            resData = annRes.data;
          }
        } catch (annErr) {
          // Endpoint unreachable; do not render stale hardcoded maintenance alerts
        }

        if (!isMounted) return;

        let messageText = '';
        let bannerId = 'jmc-adv-default';
        let bannerTitle = 'Municipal Civic Advisory';
        let severity = 'warning';
        let isActive = true;

        if (resData) {
          severity = resData.broadcast_severity || resData.announcement?.severity || 'warning';
          bannerTitle = resData.title || resData.announcement?.title || 'Municipal Civic Advisory';
          if (typeof resData.broadcast_message === 'string' && resData.broadcast_message.trim()) {
            messageText = resData.broadcast_message.trim();
            bannerId = resData.id || resData.broadcast_id || `adv-${messageText.slice(0, 16).replace(/\s+/g, '-')}`;
            isActive = resData.is_active !== false && resData.active !== false;
          } else if (resData.broadcast_message && typeof resData.broadcast_message === 'object') {
            messageText = resData.broadcast_message.text || resData.broadcast_message.message || '';
            bannerId = resData.broadcast_message.id || bannerId;
            isActive = resData.broadcast_message.active !== false && resData.broadcast_message.is_active !== false;
          } else if (resData.announcement) {
            const ann = Array.isArray(resData.announcement) ? resData.announcement[0] : resData.announcement;
            messageText = ann?.text || ann?.message || ann?.title || '';
            bannerId = ann?.id || bannerId;
            isActive = ann?.active !== false && ann?.is_active !== false;
          } else if (Array.isArray(resData) && resData.length > 0) {
            const first = resData[0];
            messageText = first.text || first.message || first.broadcast_message || '';
            bannerId = first.id || bannerId;
            isActive = first.active !== false && first.is_active !== false;
          }
        }

        // Check sessionStorage cache for this bannerId
        const isCached =
          sessionStorage.getItem(`janmitra_dismissed_advisory_${bannerId}`) === 'true' ||
          sessionStorage.getItem('dismissed_broadcast_id') === String(bannerId);

        if (isCached) {
          setIsDismissed(true);
        } else if (isActive && messageText) {
          setAdvisory({
            id: bannerId,
            title: bannerTitle,
            text: messageText,
            severity,
            active: isActive
          });
        }
      } catch (err) {
        console.warn('[BroadcastBanner] Advisory loading note:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBroadcast();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    if (advisory?.id) {
      sessionStorage.setItem(`janmitra_dismissed_advisory_${advisory.id}`, 'true');
      sessionStorage.setItem('dismissed_broadcast_id', String(advisory.id));
    }
    setIsDismissed(true);
    if (typeof onDismiss === 'function') {
      onDismiss(advisory?.id);
    }
  };

  // If dismissed, loading, or no active advisory, do not render
  if (isDismissed || isLoading || !advisory || !advisory.active) {
    return null;
  }

  const bannerTone =
    advisory.severity === 'danger'
      ? 'bg-rose-600 text-white border-rose-700/40'
      : advisory.severity === 'info'
      ? 'bg-blue-600 text-white border-blue-700/40'
      : 'bg-amber-500 text-amber-950 border-amber-600/30';

  return (
    <aside
      role="region"
      aria-label="Civic Advisory Announcement"
      className={`${bannerTone} border-b shadow-sm relative transition-all duration-300`}
    >
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-start justify-between gap-3">
        {/* Left: Speaker Icon + Advisory Content */}
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="text-lg leading-none shrink-0 mt-0.5 select-none"
            role="img"
            aria-label="Speaker"
          >
            📢
          </span>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs uppercase tracking-wide">
                {advisory.title || 'Municipal Civic Advisory'}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-black/15 tracking-wider">
                Official
              </span>
            </div>
            <p className="text-xs font-semibold opacity-95 mt-0.5 leading-snug">
              {advisory.text}
            </p>
          </div>
        </div>

        {/* Right: Dismiss Button (X) */}
        <button
          onClick={handleDismiss}
          type="button"
          className="shrink-0 p-1 -mr-1 opacity-80 hover:opacity-100 hover:bg-black/10 active:scale-95 rounded-lg transition-all"
          aria-label="Dismiss Advisory"
          title="Dismiss advisory"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default BroadcastBanner;
