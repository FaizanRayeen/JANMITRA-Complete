import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WorkerLayout from '../../components/WorkerLayout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import WorkerRouteMap from '../../components/WorkerRouteMap';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import {
  saveCachedTasks,
  getCachedTasks,
  getLastCachedTime,
  queueOfflineStatusUpdate,
  getOfflineQueue,
  syncOfflineQueue,
  isDeviceOnline,
} from '../../utils/offlineStorage';

// Priority border styling for left card accent
const PRIORITY_BORDER_CLASSES = {
  severe: 'border-l-4 border-l-danger',
  critical: 'border-l-4 border-l-danger',
  high: 'border-l-4 border-l-orange-500',
  medium: 'border-l-4 border-l-amber-500',
  low: 'border-l-4 border-l-slate-400',
};

// Relative time formatting helper
const formatRelativeTime = (dateInput) => {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (isNaN(diffInSeconds) || diffInSeconds < 0) return 'Just now';
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

// Fallback seed tasks for initial / demo baseline
const SEED_WORKER_TASKS = [
  {
    id: 'CMP-20481',
    description:
      'Severe deep trench and cave-in pothole near main traffic signal junction. Risk of direct accident.',
    category: 'Roads & Infrastructure',
    ward: 2,
    priority: 'Critical',
    status: 'In-Progress',
    address: '4th Main Road Crossing, Near Primary School Gate, Ward 2',
    created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    has_photos: true,
    photo_count: 2,
  },
  {
    id: 'CMP-20482',
    description:
      'Overflowing commercial waste bin spilling onto pedestrian footpath for the past 48 hours.',
    category: 'Garbage & Waste Management',
    ward: 2,
    priority: 'High',
    status: 'Assigned',
    address: 'Commercial Market Footpath, Opposite Sector 2 Gate, Ward 2',
    created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    has_photos: true,
    photo_count: 3,
  },
  {
    id: 'CMP-20486',
    description:
      'Fresh report: Broken drainage slab leaving open stormwater ditch on pedestrian walking path.',
    category: 'Water & Drainage',
    ward: 2,
    priority: 'High',
    status: 'Assigned',
    address: 'Behind Community Dispensary, 2nd Cross, Ward 2',
    created_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    has_photos: true,
    photo_count: 1,
  },
  {
    id: 'CMP-20483',
    description:
      'Main water delivery valve leaking clean drinking water on Sector 4 road.',
    category: 'Water & Drainage',
    ward: 2,
    priority: 'Medium',
    status: 'Work Done',
    address: 'Sector 4 Road, Near Water Booster Pump Station, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    has_photos: true,
    photo_count: 1,
  },
  {
    id: 'CMP-20484',
    description:
      'Street light lamp post #14 flickering continuously at night.',
    category: 'Street Lighting & Electrical',
    ward: 2,
    priority: 'Low',
    status: 'Closed',
    address: 'Lane 7, In front of House #42, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),
    has_photos: false,
    photo_count: 0,
  },
];

const TaskList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab mapping: 'assigned' | 'inprogress' | 'completed'
  const initialTab =
    searchParams.get('tab') === 'completed'
      ? 'completed'
      : searchParams.get('tab') === 'inprogress'
      ? 'inprogress'
      : 'assigned';

  const [activeFilterTab, setActiveFilterTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'route'
  const [searchQuery, setSearchQuery] = useState('');
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 2. Connectivity and Offline State
  const [isOnline, setIsOnline] = useState(isDeviceOnline());
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastCacheDate, setLastCacheDate] = useState(getLastCachedTime());
  const [toastMessage, setToastMessage] = useState(null);
  const [workerInfo, setWorkerInfo] = useState(null);

  const extractWardNum = useCallback((w) => {
    if (!w) return null;
    const match = String(w).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }, []);

  const workerWard = extractWardNum(workerInfo?.ward || user?.ward) || 2;
  const workerName = workerInfo?.name || user?.name || 'Field Worker';
  const workerDept = workerInfo?.department || user?.department || 'Field Operations';
  const workerCacheKey = user?.mobile || user?.username || `ward-${workerWard}`;

  // Toast notification helper
  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Accept incoming dispatch request
  const handleAcceptTask = async (taskId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.post(`/v1/worker/tasks/${taskId}/accept/`, {});
      const updatedTask = res?.data?.task;
      showToast('success', `Task #${updatedTask?.tracking_id || taskId} accepted! Assigned to you.`);
      setAllTasks((prev) => {
        const next = prev.map((t) =>
          t.id === taskId || t.tracking_id === taskId
            ? { ...(updatedTask || t), status: 'In-Progress', is_claimed_by_me: true, can_accept: false, worker_name: workerName }
            : t
        );
        saveCachedTasks(next, workerCacheKey);
        return next;
      });
      handleTabChange('inprogress');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Could not accept task. Please check your login or network.';
      showToast('error', msg);
    }
  };

  // Synchronize filter tab with query parameter if changed externally
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'completed') {
      setActiveFilterTab((prev) => (prev !== 'completed' ? 'completed' : prev));
    } else if (tabParam === 'inprogress') {
      setActiveFilterTab((prev) => (prev !== 'inprogress' ? 'inprogress' : prev));
    } else if (tabParam === 'assigned') {
      setActiveFilterTab((prev) => (prev !== 'assigned' ? 'assigned' : prev));
    }
  }, [searchParams]);

  const handleTabChange = (tabKey) => {
    setActiveFilterTab(tabKey);
    setSearchParams(tabKey === 'assigned' ? {} : { tab: tabKey }, { replace: true });
  };

  // Refresh count of items in the offline queue
  const refreshQueueCount = useCallback(async () => {
    try {
      const queue = await getOfflineQueue();
      setOfflineQueueCount(Array.isArray(queue) ? queue.length : 0);
    } catch {
      setOfflineQueueCount(0);
    }
  }, []);

  // 1. Fetch tasks & Cache assigned tasks in localStorage on successful fetch
  const fetchTasks = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      // Check current connectivity
      const onlineStatus = isDeviceOnline();
      setIsOnline(onlineStatus);

      // If offline: render cached tasks strictly scoped to this worker
      if (!onlineStatus) {
        const cached = getCachedTasks(workerCacheKey);
        if (Array.isArray(cached) && cached.length > 0) {
          setAllTasks(cached);
        } else {
          setError('Offline and no cached tasks available for your account yet.');
        }
        setLoading(false);
        setRefreshing(false);
        refreshQueueCount();
        return;
      }

      try {
        const response = await api.get('/v1/worker/tasks/');
        const data = response.data;
        if (data?.worker) {
          setWorkerInfo(data.worker);
        }
        const list = Array.isArray(data) ? data : data?.tasks || data?.results || [];
        const normalized = list.map((item) => ({
          ...item,
          address:
            item.address ||
            item.location_address ||
            `Ward ${item.ward_number || item.ward || workerWard}`,
          latitude: item.latitude ?? item.location_lat ?? null,
          longitude: item.longitude ?? item.location_lng ?? null,
        }));

        setAllTasks(normalized);
        saveCachedTasks(normalized, workerCacheKey);
        setLastCacheDate(new Date().toISOString());
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load assigned tasks from server.');
        const cached = getCachedTasks(workerCacheKey);
        if (Array.isArray(cached) && cached.length > 0) {
          setAllTasks(cached);
        } else {
          setAllTasks([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        refreshQueueCount();
      }
    },
    [workerCacheKey, workerWard, refreshQueueCount]
  );

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 4. Auto-sync queued updates when online event fires
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast('info', 'Connection restored! Auto-syncing queued offline actions...');

      setSyncing(true);
      try {
        const result = await syncOfflineQueue();
        if (result.syncedCount > 0) {
          showToast(
            'success',
            `Auto-sync complete: ${result.syncedCount} task status update(s) uploaded to server!`
          );
          fetchTasks(true);
        } else {
          showToast('success', 'Back online. Task queue is up to date.');
        }
      } catch (syncErr) {
        console.warn('Sync error:', syncErr);
      } finally {
        setSyncing(false);
        refreshQueueCount();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast(
        'warning',
        'Device went offline. Running in Offline Mode using cached tasks.'
      );
      // Load cached tasks
      const cached = getCachedTasks(workerCacheKey);
      if (Array.isArray(cached) && cached.length > 0) {
        setAllTasks(cached);
      }
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchTasks, workerCacheKey, refreshQueueCount]);

  // Manual Trigger to sync offline queue
  const handleManualSync = async () => {
    if (!isDeviceOnline()) {
      showToast('warning', 'Device is currently offline. Cannot sync until connection is restored.');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (result.syncedCount > 0) {
        showToast('success', `Successfully synced ${result.syncedCount} queued updates!`);
        fetchTasks(true);
      } else {
        showToast('info', 'No pending offline updates to sync.');
      }
    } catch {
      showToast('error', 'Sync encountered an error.');
    } finally {
      setSyncing(false);
      refreshQueueCount();
    }
  };

  // 3. Queue status updates in IndexedDB/localStorage when offline
  const handleUpdateTaskStatus = async (taskId, newStatus, e) => {
    if (e) e.stopPropagation();

    const currentOnline = isDeviceOnline();

    if (!currentOnline) {
      // 3. Queue update in IndexedDB & localStorage
      await queueOfflineStatusUpdate(taskId, newStatus, {
        worker: workerName,
        updated_at: new Date().toISOString(),
      });

      // Optimistically update in-memory UI
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, offline_queued: true } : t
        )
      );

      refreshQueueCount();
      showToast(
        'warning',
        `Offline: Task ${taskId} marked as '${newStatus}' and queued for sync.`
      );
    } else {
      // Online direct update
      try {
        const formData = new FormData();
        formData.append('status', newStatus);

        await api.patch(`/v1/worker/tasks/${taskId}/status/`, formData);

        setAllTasks((prev) => {
          const next = prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
          saveCachedTasks(next, workerCacheKey);
          return next;
        });

        showToast('success', `Task status updated to '${newStatus}'.`);
      } catch (err) {
        if (!isDeviceOnline()) {
          await queueOfflineStatusUpdate(taskId, newStatus);
          setAllTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: newStatus, offline_queued: true } : t
            )
          );
          refreshQueueCount();
          showToast('warning', 'Device offline: Update queued in offline storage.');
        } else {
          showToast('error', err?.response?.data?.detail || 'Could not update task status.');
        }
      }
    }
  };

  // Priority sorting helper: Severe -> High -> Medium -> Low
  const priorityRank = {
    severe: 0,
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  // Filter tasks based on activeFilterTab and search query (backend enforces Ward+Dept+Cross-Ward assigned isolation)
  const filteredTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        const status = String(task.status || '').trim();

        // 1. Assigned (New) tab
        if (activeFilterTab === 'assigned') {
          return ['Assigned', 'Submitted', 'Validated', 'Pending', 'New'].includes(status);
        }

        // 2. In-Progress tab
        if (activeFilterTab === 'inprogress') {
          return ['In-Progress', 'In Progress'].includes(status);
        }

        // 3. Completed tab
        if (activeFilterTab === 'completed') {
          return ['Work Done', 'Closed', 'Resolved', 'Verified'].includes(status);
        }

        return true;
      })
      .filter((task) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (task.tracking_id && task.tracking_id.toLowerCase().includes(q)) ||
          (task.id && String(task.id).toLowerCase().includes(q)) ||
          (task.title && task.title.toLowerCase().includes(q)) ||
          (task.category && task.category.toLowerCase().includes(q)) ||
          (task.description && task.description.toLowerCase().includes(q)) ||
          (task.address && task.address.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const pa = priorityRank[String(a.priority || '').toLowerCase()] ?? 99;
        const pb = priorityRank[String(b.priority || '').toLowerCase()] ?? 99;
        return pa - pb;
      });
  }, [allTasks, activeFilterTab, searchQuery]);

  // Compute live counts for each filter tab
  const tabCounts = useMemo(() => {
    const assigned = allTasks.filter((t) =>
      ['Assigned', 'Submitted', 'Validated', 'Pending', 'New'].includes(
        String(t.status || '').trim()
      )
    ).length;

    const inProgress = allTasks.filter((t) =>
      ['In-Progress', 'In Progress'].includes(String(t.status || '').trim())
    ).length;

    const completed = allTasks.filter((t) =>
      ['Work Done', 'Closed', 'Resolved', 'Verified'].includes(String(t.status || '').trim())
    ).length;

    return { assigned, inProgress, completed };
  }, [allTasks]);

  const handleOpenTask = (taskId, e) => {
    if (e) e.stopPropagation();
    navigate(`/worker/task/${taskId}`);
  };

  const handleBottomTabChange = (tabKey) => {
    if (tabKey === 'tasks') {
      handleTabChange('assigned');
    } else if (tabKey === 'completed') {
      handleTabChange('completed');
    } else if (tabKey === 'profile') {
      navigate('/worker/profile');
    }
  };

  return (
    <WorkerLayout
      activeBottomTab={activeFilterTab === 'completed' ? 'completed' : 'tasks'}
      onBottomTabChange={handleBottomTabChange}
    >
      <div className="px-4 pt-4 sm:pt-6 space-y-4">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : toastMessage.type === 'error'
                ? 'bg-rose-600 text-white shadow-rose-500/20'
                : toastMessage.type === 'warning'
                ? 'bg-amber-600 text-white shadow-amber-500/20'
                : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}
          >
            <span>{toastMessage.type === 'success' ? '✓' : toastMessage.type === 'error' ? '✕' : toastMessage.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* ========================================================
            SUB-HEADER: Greeting, Ward Context, Online/Offline Pill & Refresh
           ======================================================== */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">👷</span>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Welcome, {workerName}
              </h1>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                Ward {workerWard}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>On-Duty Dispatch</span>
              </span>

              {!isOnline && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Offline Mode ({offlineQueueCount} queued)</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-amber-300">🏢 {workerDept}</span>
              <span className="text-slate-500">•</span>
              <span>Municipal Field Dispatch Queue</span>
              {lastCacheDate && (
                <span className="text-[11px] text-slate-400">
                  (Updated {new Date(lastCacheDate).toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Sync Now Button if pending offline queue */}
            {offlineQueueCount > 0 && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white transition shadow-2xs disabled:opacity-50"
                title="Sync queued status updates to server"
              >
                <span className={syncing ? 'animate-spin' : ''}>⚡</span>
                <span>{syncing ? 'Syncing...' : `Sync Queue (${offlineQueueCount})`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchTasks(true)}
              disabled={refreshing || loading}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 transition cursor-pointer ${
                refreshing ? 'opacity-70 cursor-wait' : ''
              }`}
              title="Refresh assigned tasks"
            >
              <span className={`text-sm ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
              <span>{refreshing ? 'Updating...' : 'Refresh Tasks'}</span>
            </button>
          </div>
        </div>

        {/* 2. Amber Offline Mode Banner Banner Notification */}
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs animate-fade-in">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="space-y-0.5 flex-1">
              <div className="font-extrabold flex items-center gap-2">
                <span>Working in Offline Mode</span>
                <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.2 rounded font-bold">
                  LocalStorage & IndexedDB Active
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Network connection is currently unavailable. Displaying cached tasks. Status updates made offline will be stored locally and automatically synchronized with the server when connection is restored.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            FILTER TABS: Incoming Requests | In-Progress | Completed
           ======================================================== */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs">
          <div className="grid grid-cols-3 gap-1" role="tablist">
            {/* Tab 1: Incoming Requests */}
            <button
              type="button"
              role="tab"
              aria-selected={activeFilterTab === 'assigned'}
              onClick={() => handleTabChange('assigned')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeFilterTab === 'assigned'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="whitespace-nowrap flex items-center gap-1.5">
                <span>⚡</span>
                <span className={activeFilterTab === 'assigned' ? 'text-white' : 'text-slate-800'}>
                  Incoming
                </span>
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full leading-tight ${
                  activeFilterTab === 'assigned'
                    ? 'bg-white/30 text-white'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {tabCounts.assigned}
              </span>
            </button>

            {/* Tab 2: In-Progress */}
            <button
              type="button"
              role="tab"
              aria-selected={activeFilterTab === 'inprogress'}
              onClick={() => handleTabChange('inprogress')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeFilterTab === 'inprogress'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="whitespace-nowrap flex items-center gap-1">
                <span>🛠️</span>
                <span>In-Progress</span>
              </span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                  activeFilterTab === 'inprogress'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tabCounts.inProgress}
              </span>
            </button>

            {/* Tab 3: Completed */}
            <button
              type="button"
              role="tab"
              aria-selected={activeFilterTab === 'completed'}
              onClick={() => handleTabChange('completed')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeFilterTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="whitespace-nowrap flex items-center gap-1">
                <span>✅</span>
                <span>Completed</span>
              </span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                  activeFilterTab === 'completed'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tabCounts.completed}
              </span>
            </button>
          </div>
        </div>

        {/* View Mode Toggle & Quick Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* List vs Route View Toggle */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋</span>
              <span>Cards ({filteredTasks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('route')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'route'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🗺️</span>
              <span>Route View</span>
            </button>
          </div>

          {/* Quick Search within current tab */}
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, category, address..."
              className="w-full bg-white pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-2xs"
            />
            <span className="absolute left-3 top-2 text-slate-400 text-xs">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {error && <ErrorMessage message={error} onRetry={() => fetchTasks(false)} />}

        {/* ========================================================
            TASK CARDS, ROUTE VIEW & EMPTY STATE
           ======================================================== */}
        {loading ? (
          <div className="space-y-4">
            <LoadingSkeleton
              variant="card"
              count={3}
              message="Loading assigned field tasks from local cache..."
            />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-12 text-center shadow-xs mt-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              {activeFilterTab === 'completed' ? '📂' : '📋'}
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              No tasks currently assigned in your ward.
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              {activeFilterTab === 'assigned'
                ? 'All newly assigned grievances for Ward ' + workerWard + ' have been attended to.'
                : activeFilterTab === 'inprogress'
                ? 'You do not have any tasks currently marked as in-progress.'
                : 'Tasks resolved and marked as closed will be archived here.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                fetchTasks(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              <span>🔄 Check for new assignments</span>
            </button>
          </div>
        ) : viewMode === 'route' ? (
          <WorkerRouteMap
            tasks={filteredTasks}
            onUpdateStatus={handleUpdateTaskStatus}
          />
        ) : (
          /* ========================================================
             TASK CARDS
             Card contains:
             - Complaint ID
             - Category badge
             - Priority pill
             - Ward badge
             - Address
             - Offline queued badge if pending sync
             - Quick Status update buttons (Start Work / Mark Done)
             - 'Open Task' button
             ======================================================== */
          <div className="space-y-3.5 pt-1">
            {filteredTasks.map((task) => {
              const priorityKey = (task.priority || 'low').toLowerCase();
              const borderClass =
                PRIORITY_BORDER_CLASSES[priorityKey] || 'border-l-4 border-l-slate-400';
              const isCritical = priorityKey === 'severe' || priorityKey === 'critical';

              const photoCount =
                task.photo_count ||
                (task.images && task.images.length) ||
                (task.has_photos ? 1 : 0);

              const isAssigned =
                ['Assigned', 'Submitted', 'Pending', 'New', 'Validated'].includes(
                  String(task.status || '').trim()
                ) && task.can_accept !== false;
              const isInProgress = ['In-Progress', 'In Progress'].includes(
                String(task.status || '').trim()
              );

              return (
                <div
                  key={task.id}
                  onClick={() => handleOpenTask(task.id)}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer relative group ${borderClass} ${
                    isCritical ? 'ring-1 ring-red-400/40 bg-red-50/10' : ''
                  }`}
                >
                  {/* Incoming Dispatch Alert Beacon */}
                  {isAssigned && (
                    <div className="mb-3 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>⚡ Incoming Dispatch Request • Ward {task.ward_number || task.ward || workerWard}</span>
                      </span>
                      <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        {task.target_sla ? `SLA: ${task.target_sla}` : 'Urgent'}
                      </span>
                    </div>
                  )}

                  {/* TOP ROW: Complaint ID + Badges (Priority pill, Ward badge) */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-900 tracking-tight bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/80">
                        {task.tracking_id || task.id}
                      </span>
                      <PriorityBadge level={task.priority} />
                      {task.priority_score && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                          Score: {task.priority_score}/100
                        </span>
                      )}
                      {task.offline_queued && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 animate-pulse">
                          <span>⏳</span>
                          <span>Sync Pending</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <WardBadge ward={task.ward} />
                    </div>
                  </div>

                  {/* SECOND ROW: Category badge */}
                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <CategoryBadge category={task.category} />
                    <StatusBadge status={task.status} />
                  </div>

                  {/* THIRD ROW: Description & Thumbnail */}
                  <div className="mt-3 flex items-start gap-3">
                    <p className="flex-1 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed line-clamp-2">
                      {task.description || task.title || 'No detailed description provided.'}
                    </p>
                    {task.photo_url && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 shadow-2xs">
                        <img
                          src={resolveMediaUrl(task.photo_url)}
                          alt="Grievance"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>

                  {/* FOURTH ROW: Address (Mandatory requirement) */}
                  <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-sm leading-none flex-shrink-0 text-red-500 mt-0.5">
                      📍
                    </span>
                    <span className="font-semibold text-slate-800 leading-snug break-words">
                      {task.address || `Ward ${task.ward}, Municipal Zone`}
                    </span>
                  </div>

                  {/* BOTTOM ROW: Quick Actions + Directions + 'Open Task' */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <span>🕒</span>
                        <span>{formatRelativeTime(task.created_at || task.submitted_at)}</span>
                      </span>

                      {Boolean(photoCount > 0) && (
                        <span
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md"
                          title="Attached citizen evidence photos"
                        >
                          📷 {photoCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Live Google Maps Navigation Link */}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude || 21.1458},${task.longitude || 79.0882}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition shadow-2xs"
                        title="Get live GPS directions via Google Maps"
                      >
                        <span>🧭</span>
                        <span>Directions</span>
                      </a>

                      {/* Dispatch Claim / Accept Work Button */}
                      {isAssigned && (
                        <button
                          type="button"
                          onClick={(e) => handleAcceptTask(task.id, e)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 transition transform active:scale-95 animate-pulse cursor-pointer"
                          title="Claim and accept this dispatch request"
                        >
                          <span>⚡</span>
                          <span>Accept Work</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/worker/task/${task.id}`);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition shadow-2xs"
                          title="Submit live camera proof of work"
                        >
                          <span>📸</span>
                          <span>Submit Proof</span>
                        </button>
                      )}

                      {/* 'Open Task' Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenTask(task.id, e)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-blue-700 active:bg-blue-800 transition shadow-2xs group-hover:scale-102 flex-shrink-0"
                      >
                        <span>Open Task</span>
                        <span className="text-sm transition-transform group-hover:translate-x-0.5">
                          ➔
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkerLayout>
  );
};

export default TaskList;
