import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { OFFICER_DEPT_META } from '../../utils/officerDeptMeta';
import LeafletMap from '../../components/LeafletMap';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import WardBadge from '../../components/WardBadge';
import CategoryBadge from '../../components/CategoryBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const escapeCsv = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const ComplaintsLedger = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deptFilter, setDeptFilter] = useState(searchParams.get('dept') || 'all');
  const [wardFilter, setWardFilter] = useState(searchParams.get('ward') || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [selected, setSelected] = useState(null);
  const [overrideWorker, setOverrideWorker] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [mutating, setMutating] = useState(false);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const d = searchParams.get('dept');
    const w = searchParams.get('ward');
    const q = searchParams.get('search');
    if (d !== null) setDeptFilter(d || 'all');
    if (w !== null) setWardFilter(w || 'all');
    if (q !== null) setSearchQuery(q || '');
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, wRes] = await Promise.all([
        api.get('/v1/admin/complaints/', {
          params: {
            dept: deptFilter,
            ward: wardFilter,
            status: statusFilter,
            priority: priorityFilter,
            search: searchQuery,
          },
        }),
        api.get('/v1/admin/workers/', { params: { status: 'Active' } }),
      ]);
      setComplaints(cRes.data?.complaints || []);
      setWorkers(wRes.data?.workers || wRes.data?.results || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load city-wide complaints ledger.');
    } finally {
      setLoading(false);
    }
  }, [deptFilter, wardFilter, statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenInspect = (item) => {
    setSelected(item);
    setOverrideWorker(item.assigned_worker_mobile || '');
    setRejectReason('');
    setShowRejectBox(false);
  };

  const handleOverrideAction = async (action) => {
    if (!selected) return;
    if (action === 'assign' && !overrideWorker) {
      showToast('danger', 'Please select a Field Worker to assign.');
      return;
    }
    if (action === 'reject' && !rejectReason.trim()) {
      showToast('danger', 'Please enter a rejection reason.');
      return;
    }

    setMutating(true);
    try {
      const res = await api.post(`/v1/admin/complaints/${selected.id}/override/`, {
        action,
        worker_mobile: action === 'assign' ? overrideWorker : undefined,
        reason: action === 'reject' ? rejectReason.trim() : undefined,
      });
      showToast('success', res.data?.message || 'Admin override saved.');
      setSelected(res.data?.complaint || null);
      if (action === 'reject') setShowRejectBox(false);
      fetchData();
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Admin override action failed.');
    } finally {
      setMutating(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Tracking ID',
      'Department',
      'Category',
      'Ward',
      'Priority',
      'Score',
      'Status',
      'Assigned Worker',
      'Address',
      'Citizen',
      'Rating',
      'Feedback',
      'Submitted At',
    ];
    const lines = [
      headers.map(escapeCsv).join(','),
      ...complaints.map((c) =>
        [
          c.tracking_id,
          c.dept,
          c.category,
          `Ward ${c.ward_number}`,
          c.priority_level,
          c.priority_score,
          c.status,
          c.worker_name || 'Unassigned',
          c.address,
          c.citizen_name,
          c.rating ?? '',
          c.feedback || '',
          c.submitted_at,
        ]
          .map(escapeCsv)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `janmitra-complaints-${deptFilter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deptWorkersForSelected = selected
    ? workers.filter((w) => Number(w.dept_id) === Number(selected.dept_id || 1))
    : [];

  return (
    <div className="space-y-5">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-xl border font-bold text-xs sm:text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            City-Wide Complaints Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect, validate, reassign workers, or export grievances across all 4 departments and 4 wards.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={complaints.length === 0}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs disabled:opacity-40 cursor-pointer"
        >
          ⬇ Export CSV ({complaints.length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ID, title, address, worker..."
          className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs"
        />
        <select
          value={deptFilter}
          onChange={(e) => {
            const val = e.target.value;
            setDeptFilter(val);
            const next = new URLSearchParams(searchParams);
            if (val === 'all') next.delete('dept');
            else next.set('dept', val);
            setSearchParams(next, { replace: true });
          }}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
        >
          <option value="all">All 4 Departments</option>
          <option value="PWD">PWD (Roads)</option>
          <option value="SWM">SWM (Waste)</option>
          <option value="PHE">PHE (Water)</option>
          <option value="Electrical">Electrical (Lights)</option>
        </select>
        <select
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
        >
          <option value="all">All Wards (1–4)</option>
          <option value="1">Ward 1</option>
          <option value="2">Ward 2</option>
          <option value="3">Ward 3</option>
          <option value="4">Ward 4</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
        >
          <option value="all">All Statuses</option>
          <option value="Submitted">Submitted</option>
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
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
        >
          <option value="all">All Priorities</option>
          <option value="Severe">Severe</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchData} />}

      {loading ? (
        <LoadingSkeleton variant="card" count={3} message="Loading city complaints ledger..." />
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-3">
          <p>No civic grievances match your current filters.</p>
          <button
            type="button"
            onClick={() => {
              setDeptFilter('all');
              setWardFilter('all');
              setStatusFilter('all');
              setPriorityFilter('all');
              setSearchQuery('');
              setSearchParams({}, { replace: true });
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tracking ID</th>
                  <th className="px-4 py-3">Dept &amp; Category</th>
                  <th className="px-4 py-3">Ward</th>
                  <th className="px-4 py-3">Priority &amp; Score</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => {
                  const meta = OFFICER_DEPT_META[c.dept_id] || OFFICER_DEPT_META[1];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenInspect(c)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-primary whitespace-nowrap">
                        #{c.tracking_id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${meta.badgeClass}`}>
                          {meta.icon} {meta.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <WardBadge ward={c.ward_number} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge level={c.priority_level} />
                          <span className="font-mono text-[10px] text-slate-500">{c.priority_score}/100</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-bold text-slate-800 truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{c.address}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">
                        {c.worker_name && c.worker_name !== 'Unassigned' ? c.worker_name : 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenInspect(c)}
                          className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Super Admin Complaint Inspect & Override Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-primary">#{selected.tracking_id}</span>
                <h2 className="text-lg font-black text-slate-900">{selected.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <PriorityBadge level={selected.priority_level} />
              <CategoryBadge category={selected.category} />
              <WardBadge ward={selected.ward_number} />
              <span className="text-[11px] font-mono bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-700">
                Score {selected.priority_score}/100 &bull; Citizen: {selected.citizen_name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Citizen Evidence</div>
                {resolveMediaUrl(selected.photo_url, '') ? (
                  <img
                    src={resolveMediaUrl(selected.photo_url, '')}
                    alt="Citizen submission"
                    className="w-full h-36 object-cover rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="h-36 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No citizen photo attached
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Resolution Camera Proof</div>
                {resolveMediaUrl(selected.resolved_photo_url, '') ? (
                  <img
                    src={resolveMediaUrl(selected.resolved_photo_url, '')}
                    alt="Worker proof"
                    className="w-full h-36 object-cover rounded-lg border border-emerald-200"
                  />
                ) : (
                  <div className="h-36 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No completion proof uploaded yet
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <p className="text-slate-800 leading-relaxed">{selected.description}</p>
              <p className="text-slate-500">📍 {selected.address}</p>
              {selected.feedback && (
                <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 italic">
                  <strong>{selected.rating ? `Citizen Feedback (${selected.rating}★):` : 'Remarks / Status Note:'}</strong>{' '}
                  &ldquo;{selected.feedback}&rdquo;
                </p>
              )}
            </div>

            <LeafletMap
              lat={selected.latitude ?? 21.1458}
              lng={selected.longitude ?? 79.0882}
              category={selected.dept || selected.category}
              showLegend={false}
              readonly={true}
              className="h-40 w-full rounded-2xl"
            />

            {/* Super Admin Command Override Actions */}
            {!['Closed', 'Resolved'].includes(selected.status) && (
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 text-xs">
                <div className="font-black uppercase tracking-wider text-rose-300 text-[11px]">
                  👑 Super Admin Command Override ({selected.dept} Sector)
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={overrideWorker}
                    onChange={(e) => setOverrideWorker(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-white text-slate-900 font-semibold"
                  >
                    <option value="">-- Select {selected.dept} Worker to Dispatch / Reassign --</option>
                    {deptWorkersForSelected.map((w) => (
                      <option key={w.mobile} value={w.mobile}>
                        {w.name} — Ward {w.ward} ({w.active_tasks} active)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={mutating || !overrideWorker}
                    onClick={() => handleOverrideAction('assign')}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-blue-600 font-bold disabled:opacity-50"
                  >
                    {mutating ? 'Saving...' : 'Assign / Override'}
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {['Submitted', 'Pending Validation'].includes(selected.status) && (
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleOverrideAction('validate')}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold"
                    >
                      ✓ Validate Queue
                    </button>
                  )}
                  {selected.status !== 'Rejected' && (
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => setShowRejectBox((v) => !v)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-bold"
                    >
                      ✕ Reject Issue
                    </button>
                  )}
                </div>

                {showRejectBox && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Official Admin rejection reason..."
                      className="flex-1 px-3 py-2 rounded-lg text-slate-900 bg-white"
                    />
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleOverrideAction('reject')}
                      className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 font-bold"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsLedger;
