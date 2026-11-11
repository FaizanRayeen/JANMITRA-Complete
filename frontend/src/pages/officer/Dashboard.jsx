import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { resolveOfficerDept } from '../../utils/officerDeptMeta';
import KPICard from '../../components/KPICard';
import WardBadge from '../../components/WardBadge';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';
import { NotificationBell } from '../../components/NotificationBell';
import ComplaintDetailModal from './ComplaintDetailModal';
import AssignWorker from './AssignWorker';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deptMeta = resolveOfficerDept(user);

  const [wardFilter, setWardFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [dateRange, setDateRange] = useState('30d');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [workers, setWorkers] = useState([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignTargetComplaint, setAssignTargetComplaint] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchComplaintId, setDispatchComplaintId] = useState('');
  const [dispatchWorkerMobile, setDispatchWorkerMobile] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const closeDispatchModal = () => {
    setShowDispatchModal(false);
    setDispatchComplaintId('');
    setDispatchWorkerMobile('');
  };

  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, workersRes] = await Promise.all([
        api.get('/v1/officer/dashboard/', {
          params: {
            ward: wardFilter,
            status: statusFilter,
            priority: priorityFilter,
            range: dateRange,
            search: searchQuery,
          },
        }),
        api.get('/v1/officer/workers/'),
      ]);
      setDashboardData(dashRes.data);
      setWorkers(workersRes.data?.workers || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Unable to load department operations data. Please ensure you are signed in as a Department Officer.'
      );
    } finally {
      setLoading(false);
    }
  }, [wardFilter, statusFilter, priorityFilter, dateRange, searchQuery]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (searchParams.get('dispatch') === '1') {
      setShowDispatchModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('dispatch');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleQuickApprove = async (complaint) => {
    try {
      await api.post(`/v1/officer/complaints/${complaint.id}/validate/`, {
        action: 'approve',
      });
      showToast('success', `Complaint #${complaint.tracking_id} validated and dispatched to Field Queue.`);
      fetchDashboardData();
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Failed to validate grievance.');
    }
  };

  const handleQuickDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchComplaintId || !dispatchWorkerMobile) return;
    setDispatching(true);
    try {
      const targetComp =
        openComplaintsForDispatch.find((c) => c.id === dispatchComplaintId) ||
        complaints.find((c) => c.id === dispatchComplaintId);
      const targetWorker = workers.find((w) => w.mobile === dispatchWorkerMobile);
      const wardMismatch =
        targetComp &&
        targetWorker &&
        Number(targetComp.ward_number) !== Number(targetWorker.ward);

      await api.post(`/v1/officer/complaints/${dispatchComplaintId}/assign/`, {
        worker_mobile: dispatchWorkerMobile,
        override_ward: Boolean(wardMismatch),
        override_reason: wardMismatch ? 'Department officer emergency cross-ward dispatch' : undefined,
      });
      showToast('success', 'Field worker assigned and notified successfully.');
      closeDispatchModal();
      fetchDashboardData();
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Dispatch failed.');
    } finally {
      setDispatching(false);
    }
  };

  const officerInfo = dashboardData?.officer || {};
  const kpi = dashboardData?.kpi || {
    total: 0,
    open: 0,
    pending_validation: 0,
    in_progress: 0,
    assigned: 0,
    resolved: 0,
    sla_at_risk: 0,
    avg_resolution_days: 0,
  };
  const complaints = dashboardData?.complaints || [];
  const wardStats = dashboardData?.ward_stats || [];
  const prioDist = dashboardData?.priority_distribution || [];
  const trends = dashboardData?.trends || [];
  const pendingValidationCount = dashboardData?.pending_validation_count || 0;
  const openComplaintsForDispatch = Array.isArray(dashboardData?.open_complaints)
    ? dashboardData.open_complaints
    : complaints.filter((c) => !['Work Done', 'Resolved', 'Closed', 'Rejected'].includes(c.status));
  const selectedDispatchComplaint = openComplaintsForDispatch.find((c) => c.id === dispatchComplaintId) || null;
  const sortedDispatchWorkers = [...workers].sort((a, b) => {
    if (!selectedDispatchComplaint) return Number(a.ward) - Number(b.ward);
    const wTarget = Number(selectedDispatchComplaint.ward_number);
    const aMatch = Number(a.ward) === wTarget ? 0 : 1;
    const bMatch = Number(b.ward) === wTarget ? 0 : 1;
    return aMatch - bMatch || Number(a.ward) - Number(b.ward);
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-12">
      <OfficerSidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        pendingValidationCount={pendingValidationCount}
        onOpenDispatch={() => setShowDispatchModal(true)}
      />

      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-xl border font-bold text-xs sm:text-sm flex items-center gap-2.5 animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Department-Isolated Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Open Officer Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className={`border-l-4 ${deptMeta.accentBorder} pl-3`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${deptMeta.badgeClass}`}>
                  {deptMeta.icon} {deptMeta.code} PORTAL
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {officerInfo.name || user?.name || 'Department Officer'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {officerInfo.department || deptMeta.fullTitle} Command Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <NotificationBell
              onComplaintClick={(cid) => {
                const match =
                  complaints.find((c) => c.id === cid || c.tracking_id === cid) ||
                  openComplaintsForDispatch.find((c) => c.id === cid || c.tracking_id === cid);
                if (match) setSelectedComplaint(match);
              }}
            />

            <Link
              to="/officer/validation"
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <span>🤖 Validation Queue</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 font-black text-[10px]">
                {pendingValidationCount}
              </span>
            </Link>

            {openComplaintsForDispatch.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDispatchModal(true)}
                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡ Assign Task</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white font-black text-[10px]">
                  {openComplaintsForDispatch.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => logout('/login?role=officer')}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold border border-slate-200 transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Department Scope Banner */}
        <div className={`bg-gradient-to-r ${deptMeta.headerGradient} text-white rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xl">{deptMeta.icon}</span>
            <span className="text-sm sm:text-base font-black tracking-tight">
              {deptMeta.fullTitle}
            </span>
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${deptMeta.pillDark}`}>
              {deptMeta.categoryLabel} &bull; Wards 1–4
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-white/10 text-white border border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
            >
              <option value="7d" className="text-slate-900">Last 7 Days</option>
              <option value="30d" className="text-slate-900">Last 30 Days</option>
              <option value="90d" className="text-slate-900">Last 90 Days</option>
              <option value="all" className="text-slate-900">All Time</option>
            </select>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold border border-white/20 transition cursor-pointer"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} onRetry={fetchDashboardData} />}

        {/* KPI Cards Row (100% Real SQLite Counts) */}
        {loading && !dashboardData ? (
          <LoadingSkeleton variant="card" count={3} message={`Loading ${deptMeta.code} metrics...`} />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <KPICard title={`${deptMeta.code} Total`} value={kpi.total} subtitle="Department grievances" color="blue" icon="📋" />
              <KPICard title="Needs Review" value={kpi.pending_validation} subtitle="AI-flagged Submitted" color="purple" icon="🤖" />
              <KPICard title="Active Work" value={kpi.assigned + kpi.in_progress} subtitle="Assigned & In-Progress" color="amber" icon="🚧" />
              <KPICard title="Resolved / Closed" value={kpi.resolved} subtitle={`Avg ${kpi.avg_resolution_days}d turnaround`} color="green" icon="✅" />
              <KPICard title="Severe / High Open" value={kpi.sla_at_risk} subtitle="Priority SLA watch" color="red" icon="🚨" />
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Tracking ID, title, address, worker..."
                className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="All">All Wards (1–4)</option>
                <option value="1">Ward 1</option>
                <option value="2">Ward 2</option>
                <option value="3">Ward 3</option>
                <option value="4">Ward 4</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted (Needs Review)</option>
                <option value="Validated">Validated</option>
                <option value="Assigned">Assigned</option>
                <option value="In-Progress">In-Progress</option>
                <option value="Work Done">Work Done</option>
                <option value="Closed">Closed</option>
                <option value="Rejected">Rejected</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="All">All Priority Tiers</option>
                <option value="Severe">Severe (80–100)</option>
                <option value="High">High (60–79)</option>
                <option value="Medium">Medium (40–59)</option>
                <option value="Low">Low (&lt; 40)</option>
              </select>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h2 className="text-sm font-black text-slate-900 mb-3">
                  Ward Breakdown ({deptMeta.code}{wardFilter !== 'All' ? ` • Ward ${wardFilter}` : ''})
                </h2>
                <div className="h-56">
                  {wardStats.some((w) => w.total > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wardFilter !== 'All' ? wardStats.filter((w) => String(w.wardNum) === String(wardFilter)) : wardStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="ward" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="in_progress" name="In-Progress" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No grievances match current filters.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h2 className="text-sm font-black text-slate-900 mb-3">
                  4-Tier AI Priority Split{wardFilter !== 'All' ? ` (Ward ${wardFilter})` : ''}
                </h2>
                <div className="h-56">
                  {prioDist.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prioDist.filter((d) => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {prioDist.filter((d) => d.value > 0).map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No grievances match current filters.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h2 className="text-sm font-black text-slate-900 mb-3">
                  7-Day Volume vs Resolution{wardFilter !== 'All' ? ` (Ward ${wardFilter})` : ''}
                </h2>
                <div className="h-56">
                  {trends.some((t) => t.submitted > 0 || t.resolved > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="submitted" name="Submitted" stroke={deptMeta.accentHex} strokeWidth={2.5} />
                        <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No 7-day activity for current filters.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Department Grievance & SLA Ledger */}
            <section id="high-priority-section" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {deptMeta.code} Grievance Queue (Priority Sorted)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Severe &rarr; High &rarr; Medium &rarr; Low &bull; Click any grievance to inspect photos, map &amp; assign staff.
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                  {complaints.length} Record(s)
                </span>
              </div>

              {complaints.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 space-y-1.5">
                  <div className="text-3xl">{deptMeta.icon}</div>
                  <div className="font-bold text-slate-700">
                    No {deptMeta.code} grievances found for the selected filters.
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Tracking ID</th>
                        <th className="px-4 py-3">Priority &amp; SLA</th>
                        <th className="px-4 py-3">Ward</th>
                        <th className="px-4 py-3">Issue Summary</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Assigned Worker</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {complaints.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedComplaint(c)}
                          className="hover:bg-blue-50/40 cursor-pointer transition"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-primary whitespace-nowrap">
                            #{c.tracking_id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge level={c.priority_level || c.priority} />
                              <span className="text-[10px] font-mono text-slate-500">
                                {c.priority_score}/100 ({c.target_sla})
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <WardBadge ward={c.ward_number || c.ward} />
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-bold text-slate-800 truncate">{c.title}</div>
                            <div className="text-[11px] text-slate-500 truncate">{c.address}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">
                            {c.worker_name && c.worker_name !== 'Unassigned' ? c.worker_name : (
                              <span className="text-amber-700 font-bold">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5" onClick={(e) => e.stopPropagation()}>
                            {['Submitted', 'Pending Validation'].includes(c.status) && (
                              <button
                                type="button"
                                onClick={() => handleQuickApprove(c)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                              >
                                Validate
                              </button>
                            )}
                            {!['Work Done', 'Closed', 'Resolved', 'Rejected'].includes(c.status) && (
                              <button
                                type="button"
                                onClick={() => setAssignTargetComplaint(c)}
                                className="px-2.5 py-1 rounded-lg bg-primary hover:bg-blue-700 text-white text-[11px] font-bold"
                              >
                                Assign
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedComplaint(c)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Department Workforce Summary Strip */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">
                  {deptMeta.code} Field Workforce ({workers.length} Technicians)
                </h2>
                <Link
                  to="/officer/roster"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Open Full Roster &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {workers.map((w) => (
                  <div key={w.mobile} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{w.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Ward {w.ward} &bull; {w.mobile}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 block">
                        {w.active_tasks} active
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {w.completed_tasks} done
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <ComplaintDetailModal
        complaint={selectedComplaint}
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        onWorkerAssigned={(_, workerName) => {
          showToast('success', `Assigned to ${workerName}`);
          setSelectedComplaint(null);
          fetchDashboardData();
        }}
      />

      <AssignWorker
        complaint={assignTargetComplaint}
        isOpen={Boolean(assignTargetComplaint)}
        onClose={() => setAssignTargetComplaint(null)}
        onAssigned={(workerName) => {
          showToast('success', `Assigned to ${workerName}`);
          fetchDashboardData();
        }}
      />

      {showDispatchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs" onClick={closeDispatchModal}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                ⚡ Quick {deptMeta.code} Worker Dispatch
              </h3>
              <button type="button" onClick={closeDispatchModal} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            {openComplaintsForDispatch.length === 0 ? (
              <div className="py-5 text-center space-y-3">
                <div className="text-3xl">✅</div>
                <p className="text-sm font-black text-slate-900">
                  No Open {deptMeta.code} Grievances Pending
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All current {deptMeta.code} grievances are already Work Done, Resolved/Closed, or Rejected. New open complaints will appear here automatically.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={closeDispatchModal}
                    className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuickDispatchSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Open Grievance ({openComplaintsForDispatch.length} available)
                  </label>
                  <select
                    value={dispatchComplaintId}
                    onChange={(e) => setDispatchComplaintId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="">-- Choose {deptMeta.code} Grievance --</option>
                    {openComplaintsForDispatch.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.tracking_id} • Ward {c.ward_number} • {c.priority_level} — {c.title} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select {deptMeta.code} Field Worker
                  </label>
                  <select
                    value={dispatchWorkerMobile}
                    onChange={(e) => setDispatchWorkerMobile(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="">-- Choose Field Worker --</option>
                    {sortedDispatchWorkers.map((w) => {
                      const sameWard =
                        selectedDispatchComplaint &&
                        Number(w.ward) === Number(selectedDispatchComplaint.ward_number);
                      return (
                        <option key={w.mobile} value={w.mobile}>
                          {sameWard ? '★ ' : ''}
                          {w.name} — Ward {w.ward} ({w.active_tasks} active){sameWard ? ' [Same Ward]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeDispatchModal} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-600">Cancel</button>
                  <button
                    type="submit"
                    disabled={dispatching || !dispatchComplaintId || !dispatchWorkerMobile}
                    className="px-5 py-2 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
                  >
                    {dispatching ? 'Assigning...' : 'Dispatch Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
