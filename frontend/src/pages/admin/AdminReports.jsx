import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import api from '../../api/client';
import { OFFICER_DEPT_META } from '../../utils/officerDeptMeta';
import WardBadge from '../../components/WardBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';

const escapeCsv = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename, headers, rows) => {
  const lines = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminReports = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/v1/admin/reports/');
      setReport(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to generate municipal reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const deptSummary = report?.department_summary || [];
  const leaderboard = report?.worker_leaderboard || [];
  const allComplaints = report?.complaints || [];

  const handleExportDeptCsv = () => {
    downloadCsv(
      `janmitra-department-sla-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Department', 'Title', 'Total', 'Open', 'Resolved', 'Rejected', 'Resolution Rate (%)', 'Avg Turnaround (Days)', 'Avg Citizen Rating'],
      deptSummary.map((d) => [
        d.dept,
        d.title,
        d.total,
        d.open,
        d.resolved,
        d.rejected,
        d.resolution_rate,
        d.avg_resolution_days,
        d.avg_rating,
      ])
    );
  };

  const handleExportLedgerCsv = () => {
    downloadCsv(
      `janmitra-city-complaints-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Tracking ID', 'Department', 'Category', 'Ward', 'Priority', 'Score', 'Status', 'Worker', 'Rating', 'Submitted At'],
      allComplaints.map((c) => [
        c.tracking_id,
        c.dept,
        c.category,
        `Ward ${c.ward_number}`,
        c.priority_level,
        c.priority_score,
        c.status,
        c.worker_name || 'Unassigned',
        c.rating ?? '',
        c.submitted_at,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Civic Analytics &amp; Municipal SLA Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Department SLA metrics and field technician leaderboard.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportDeptCsv}
            disabled={deptSummary.length === 0}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold shadow-2xs cursor-pointer"
          >
            ⬇ Dept Summary CSV
          </button>
          <button
            type="button"
            onClick={handleExportLedgerCsv}
            disabled={allComplaints.length === 0}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs disabled:opacity-40 cursor-pointer"
          >
            ⬇ City Complaints CSV ({allComplaints.length})
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchReport} />}

      {loading ? (
        <LoadingSkeleton variant="card" count={3} message="Loading municipal reports..." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h2 className="text-sm font-black text-slate-900 mb-4">
              Department Grievance Load vs Resolution Comparison
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptSummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dept" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved / Closed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900">Department SLA Scorecard</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Open</th>
                    <th className="px-4 py-3 text-center">Resolved</th>
                    <th className="px-4 py-3 text-center">SLA Rate</th>
                    <th className="px-4 py-3 text-center">Avg Turnaround</th>
                    <th className="px-4 py-3 text-center">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptSummary.map((d) => {
                    const meta = OFFICER_DEPT_META[d.dept_id] || OFFICER_DEPT_META[1];
                    return (
                      <tr key={d.dept} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${meta.badgeClass} mr-2`}>
                            {meta.icon} {d.dept}
                          </span>
                          <span className="font-bold text-slate-800">{d.title}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-black">{d.total}</td>
                        <td className="px-4 py-3 text-center font-bold text-amber-700">{d.open}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700">{d.resolved}</td>
                        <td className="px-4 py-3 text-center font-black text-primary">{d.resolution_rate}%</td>
                        <td className="px-4 py-3 text-center">{d.avg_resolution_days}d</td>
                        <td className="px-4 py-3 text-center font-bold text-amber-600">
                          {d.avg_rating ? `${d.avg_rating} ★` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900">
                Field Technician Resolution Leaderboard ({leaderboard.length} Technicians)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Technician</th>
                    <th className="px-4 py-3">Dept</th>
                    <th className="px-4 py-3">Ward</th>
                    <th className="px-4 py-3 text-center">Completed</th>
                    <th className="px-4 py-3 text-center">Active</th>
                    <th className="px-4 py-3 text-center">Citizen Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaderboard.slice(0, 12).map((w) => (
                    <tr key={w.mobile} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-slate-900">{w.name}</div>
                        <div className="text-[11px] text-slate-500">{w.employee_id} &bull; {w.mobile}</div>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-700">{w.dept}</td>
                      <td className="px-4 py-2.5"><WardBadge ward={w.ward} /></td>
                      <td className="px-4 py-2.5 text-center font-black text-emerald-700">{w.completed_tasks}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-blue-700">{w.active_tasks}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-amber-600">
                        {w.avg_rating ? `${w.avg_rating} ★ (${w.reviews})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReports;

