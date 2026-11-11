import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WorkerLayout from '../../components/WorkerLayout';
import WardBadge from '../../components/WardBadge';

/**
 * Worker Profile Screen:
 * 1. Profile Header: Worker Avatar, Full Name, Designation (e.g. Field Inspector), Employee ID
 * 2. Assignment details: Department (e.g. PWD), Municipal Ward (e.g. Ward 2)
 * 3. Status toggle: 'Active On-Duty' vs 'On Leave' (syncs to PATCH /api/v1/worker/profile/)
 * 4. Summary metrics: Total Tasks Completed, Average Turnaround (Days), Rating received
 * 5. Logout button: Clears AuthContext and redirects to /login
 */
const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);

  const workerName = profileData?.name || user?.name || 'Field Worker';
  const designation = profileData?.designation || user?.designation || 'Municipal Field Technician';
  const employeeId = profileData?.employee_id || user?.employee_id || user?.id || 'JMC-EMP';
  const department = profileData?.department || user?.dept || user?.department || 'PWD (Roads & Infrastructure)';
  const rawWard = profileData?.ward ?? user?.ward ?? 4;
  const wardNumMatch = String(rawWard).match(/\d+/);
  const ward = wardNumMatch ? parseInt(wardNumMatch[0], 10) : 4;
  const wardName = profileData?.ward_name || (typeof rawWard === 'string' && rawWard.includes('Ward') ? rawWard : `Ward ${ward}`);
  const email = profileData?.email || user?.email || 'worker@janmitra.gov.in';
  const mobile = profileData?.mobile || user?.mobile || user?.username || '';
  const dutyStatusKey = mobile ? `janmitra_worker_status_${mobile}` : 'janmitra_worker_status';

  // 3. Status toggle: 'Active On-Duty' vs 'On Leave'
  const [isOnDuty, setIsOnDuty] = useState(() => {
    const saved = localStorage.getItem(dutyStatusKey);
    return saved !== null ? saved === 'true' : true;
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadWorkerProfile = async () => {
      try {
        const res = await api.get('/v1/worker/profile/');
        if (mounted && res?.data) {
          setProfileData(res.data);
          if (typeof res.data.is_on_duty === 'boolean') {
            setIsOnDuty(res.data.is_on_duty);
            localStorage.setItem(dutyStatusKey, String(res.data.is_on_duty));
          }
        }
      } catch (err) {
        console.warn('[WorkerProfile] Profile fetch notice:', err.message);
      }
    };
    loadWorkerProfile();
    return () => {
      mounted = false;
    };
  }, [dutyStatusKey]);

  // 4. Summary metrics from real database
  const metrics = useMemo(() => {
    if (profileData?.metrics) {
      return {
        totalCompleted: profileData.metrics.total_completed ?? 0,
        avgTurnaroundDays: profileData.metrics.avg_turnaround_days ?? 0,
        rating: profileData.metrics.rating || '—',
        ratingCount: profileData.metrics.rating_count ?? 0,
        activeOpen: profileData.metrics.active_open ?? 0,
      };
    }
    return {
      totalCompleted: 0,
      avgTurnaroundDays: 0,
      rating: '—',
      ratingCount: 0,
      activeOpen: 0,
    };
  }, [profileData]);

  // Handle On-Duty status toggle with API sync
  const handleToggleStatus = async () => {
    const nextStatus = !isOnDuty;
    setIsUpdatingStatus(true);
    setStatusFeedback('');

    try {
      // 3. Syncs to PATCH /api/v1/worker/profile/
      await api.patch('/v1/worker/profile/', {
        duty_status: nextStatus ? 'on_duty' : 'on_leave',
        is_on_duty: nextStatus,
        status_label: nextStatus ? 'Active On-Duty' : 'On Leave',
      });

      setIsOnDuty(nextStatus);
      localStorage.setItem(dutyStatusKey, String(nextStatus));
      setStatusFeedback(
        nextStatus
          ? 'Status updated: You are now Active On-Duty and receiving assignments.'
          : 'Status updated: You are marked as On Leave. Ticket dispatches paused.'
      );
    } catch (err) {
      setStatusFeedback(err?.response?.data?.detail || 'Failed to update shift status on server.');
    } finally {
      setIsUpdatingStatus(false);
      setTimeout(() => setStatusFeedback(''), 4500);
    }
  };

  // 5. Logout handler: Clears AuthContext and redirects to /login?role=worker
  const handleLogout = () => {
    logout('/login?role=worker');
  };

  return (
    <WorkerLayout activeBottomTab="profile">
      <div className="px-4 pt-4 sm:pt-6 pb-28 sm:pb-32 space-y-4 max-w-2xl mx-auto">
        {/* Status Toast Alert */}
        {statusFeedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200 ${
              isOnDuty
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <span className="text-base">{isOnDuty ? '🟢' : '⏸️'}</span>
            <span className="flex-1">{statusFeedback}</span>
          </div>
        )}

        {/* ========================================================
            1. PROFILE HEADER
            - Worker Avatar
            - Full Name
            - Designation (e.g. Field Inspector)
            - Employee ID
           ======================================================== */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left relative z-10">
            {/* Worker Avatar with Camera Indicator */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-amber-200 via-amber-100 to-amber-300 text-amber-900 flex items-center justify-center text-4xl shadow-inner border-2 border-white ring-4 ring-amber-100">
                👷‍♂️
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] shadow-sm ${
                  isOnDuty ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}
                title={isOnDuty ? 'Active On-Duty' : 'On Leave'}
              >
                {isOnDuty ? '✓' : '⏸'}
              </span>
            </div>

            {/* Name, Designation & Employee ID */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 justify-center sm:justify-start">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {workerName}
                </h1>
                <span className="inline-flex items-center self-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {employeeId}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-bold text-primary flex items-center justify-center sm:justify-start gap-1.5">
                <span>🛡️</span>
                <span>{designation}</span>
              </p>

              <p className="text-xs text-slate-500 font-medium pt-0.5">
                {email} • {mobile}
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================
            2. ASSIGNMENT DETAILS
            - Department (e.g. PWD)
            - Municipal Ward (e.g. Ward 2)
           ======================================================== */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Municipal Assignment Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Department Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-primary flex items-center justify-center text-xl flex-shrink-0">
                🏢
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Department
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                  {department}
                </span>
                <span className="text-[11px] text-slate-500">
                  Civic Infrastructure & Maintenance
                </span>
              </div>
            </div>

            {/* Municipal Ward Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl flex-shrink-0">
                📍
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Jurisdiction Ward
                </span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <WardBadge ward={ward} />
                  <span className="text-xs font-semibold text-slate-700">
                    {wardName}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Primary On-Ground Dispatch Area
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            3. STATUS TOGGLE: 'Active On-Duty' vs 'On Leave'
            - Syncs to PATCH /api/v1/worker/profile/
           ======================================================== */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Shift & Dispatch Status
            </h2>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isOnDuty
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isOnDuty ? 'Active On-Duty' : 'On Leave'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnDuty ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  {isOnDuty ? 'Active On-Duty' : 'On Leave'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {isOnDuty
                  ? 'You are active for on-site grievance dispatch in Ward ' + ward + '.'
                  : 'Ticket assignment paused while you are on registered leave.'}
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isOnDuty}
              disabled={isUpdatingStatus}
              onClick={handleToggleStatus}
              className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                isOnDuty ? 'bg-emerald-600' : 'bg-slate-300'
              } ${isUpdatingStatus ? 'opacity-60 cursor-wait' : ''}`}
              title={isOnDuty ? 'Switch to On Leave' : 'Switch to Active On-Duty'}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isOnDuty ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* ========================================================
            4. SUMMARY METRICS
            - Total Tasks Completed
            - Average Turnaround (Days)
            - Rating received
           ======================================================== */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Performance & Resolution Metrics
            </h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Lifetime stats
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {/* Metric 1: Total Tasks Completed */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-blue-50/60 to-white border border-blue-100/90 text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider block">
                Tasks Done
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                {metrics.totalCompleted}
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">
                Resolved & Verified
              </span>
            </div>

            {/* Metric 2: Average Turnaround (Days) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-amber-50/60 to-white border border-amber-100/90 text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider block">
                Avg. Turnaround
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                {metrics.avgTurnaroundDays} <span className="text-xs font-bold text-slate-500">Days</span>
              </span>
              <span className="text-[10px] text-slate-500 block font-bold">
                {metrics.totalCompleted > 0
                  ? metrics.avgTurnaroundDays <= 3
                    ? '✓ Within 3d SLA'
                    : 'Turnaround Time'
                  : 'No completed tasks'}
              </span>
            </div>

            {/* Metric 3: Rating received */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-purple-50/60 to-white border border-purple-100/90 text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-purple-700 uppercase tracking-wider block">
                Citizen Rating
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 flex items-center justify-center gap-1">
                <span>{metrics.rating}</span>
                <span className="text-amber-500 text-sm">★</span>
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">
                {metrics.ratingCount > 0 ? `${metrics.ratingCount} Review(s)` : 'Awaiting Ratings'}
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================
            5. LOGOUT BUTTON
            - Clears AuthContext and redirects to /login
           ======================================================== */}
        <section className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 px-4 rounded-2xl font-black text-xs text-danger bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200/90 transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer hover:scale-101"
            title="Sign out of field worker portal"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Sign Out of Worker Account</span>
          </button>
        </section>
      </div>
    </WorkerLayout>
  );
};

export default Profile;
