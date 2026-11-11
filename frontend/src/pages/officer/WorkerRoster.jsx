import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { resolveOfficerDept } from '../../utils/officerDeptMeta';
import WardBadge from '../../components/WardBadge';
import PriorityBadge from '../../components/PriorityBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';
import { NotificationBell } from '../../components/NotificationBell';

const WorkerRoster = () => {
  const { user, logout } = useAuth();
  const deptMeta = resolveOfficerDept(user);

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wardFilter, setWardFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMobile, setExpandedMobile] = useState(null);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/v1/officer/workers/');
      setWorkers(res.data?.workers || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load department worker roster.');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchWard = wardFilter === 'All' || String(w.ward) === String(wardFilter);
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        String(w.name || '').toLowerCase().includes(q) ||
        String(w.mobile || '').includes(q) ||
        String(w.employee_id || '').toLowerCase().includes(q);
      return matchWard && matchSearch;
    });
  }, [workers, wardFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-12">
      <OfficerSidebarDrawer isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className={`border-l-4 ${deptMeta.accentBorder} pl-3`}>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${deptMeta.badgeClass}`}>
                {deptMeta.icon} {deptMeta.code} FIELD WORKFORCE
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                {deptMeta.fullTitle} Roster ({workers.length} Technicians)
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <Link to="/officer" className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              &larr; Dashboard
            </Link>
            <button
              type="button"
              onClick={() => logout('/login?role=officer')}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold border border-slate-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 space-y-5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${deptMeta.code} worker by name, mobile, ID...`}
            className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {['All', '1', '2', '3', '4'].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWardFilter(w)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  wardFilter === w ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {w === 'All' ? 'All Wards' : `Ward ${w}`}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorMessage message={error} onRetry={fetchRoster} />}

        {loading ? (
          <LoadingSkeleton variant="card" count={3} message={`Loading ${deptMeta.code} technicians...`} />
        ) : filteredWorkers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2 shadow-xs">
            <div className="text-3xl">👷</div>
            <h3 className="text-sm font-black text-slate-900">No Matching {deptMeta.code} Technicians Found</h3>
            <p className="text-xs text-slate-500">Adjust the Ward filter or search query to view technicians.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredWorkers.map((w) => (
              <div key={w.mobile} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900">{w.name}</h3>
                      <WardBadge ward={w.ward} />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          w.status === 'On Leave'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      📱 {w.mobile} &bull; {w.employee_id} &bull; {w.designation}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-amber-600">
                      {w.rating !== '—' ? `${w.rating} ★` : 'No ratings yet'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {w.reviews || 0} citizen review(s)
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-center bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <div className="text-lg font-black text-primary">{w.active_tasks}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Active Tasks</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-emerald-700">{w.completed_tasks}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Completed</div>
                  </div>
                </div>

                {w.active_complaints && w.active_complaints.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedMobile(expandedMobile === w.mobile ? null : w.mobile)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {expandedMobile === w.mobile ? 'Hide' : 'View'} {w.active_complaints.length} active assignment(s)
                    </button>
                    {expandedMobile === w.mobile && (
                      <div className="mt-2 space-y-1.5">
                        {w.active_complaints.map((ac) => (
                          <div key={ac.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                            <div className="truncate">
                              <span className="font-mono font-bold text-primary mr-1.5">#{ac.tracking_id}</span>
                              <span className="font-semibold text-slate-700">{ac.title}</span>
                            </div>
                            <PriorityBadge level={ac.priority} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default WorkerRoster;
