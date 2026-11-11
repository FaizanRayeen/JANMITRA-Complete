import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import api from '../../api/client';
import { OFFICER_DEPT_META } from '../../utils/officerDeptMeta';
import KPICard from '../../components/KPICard';
import LeafletMap from '../../components/LeafletMap';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import WardBadge from '../../components/WardBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';

const DEPT_ACCENT_STYLES = {
  1: { border: 'border-l-blue-600', bar: 'bg-blue-600', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  2: { border: 'border-l-emerald-600', bar: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  3: { border: 'border-l-cyan-600', bar: 'bg-cyan-600', chip: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  4: { border: 'border-l-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
};

const getHeatmapCellStyle = (count) => {
  const n = Number(count) || 0;
  if (n >= 10) return 'bg-rose-200 text-rose-950 border border-rose-400 hover:bg-rose-300 font-black';
  if (n >= 6) return 'bg-orange-200 text-orange-950 border border-orange-400 hover:bg-orange-300 font-black';
  if (n >= 3) return 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200 font-extrabold';
  if (n >= 1) return 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 font-extrabold';
  return 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100 font-bold';
};

const CrossDeptDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeDept = searchParams.get('dept') || 'all';
  const [wardFilter, setWardFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedPin(null);
    try {
      const res = await api.get('/v1/admin/overview/', {
        params: { dept: activeDept, ward: wardFilter, range: dateRange },
      });
      setData(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Unable to load city-wide analytics. Ensure you are signed in as Super Admin.'
      );
    } finally {
      setLoading(false);
    }
  }, [activeDept, wardFilter, dateRange]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const setDeptFilter = (code) => {
    const next = new URLSearchParams(searchParams);
    if (!code || code === 'all') next.delete('dept');
    else next.set('dept', code);
    setSearchParams(next, { replace: true });
  };

  const cityKpi = data?.city_kpi || {};
  const departments = data?.departments || [];
  const wardMatrix = data?.ward_matrix || [];
  const prioDist = data?.priority_distribution || [];
  const trends = data?.trends || [];
  const mapMarkers = data?.map_markers || [];
  const officers = data?.officers || [];
  const recent = data?.recent_complaints || [];

  return (
    <div className="space-y-6">
      {/* Command Header */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d2a53] to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/30 uppercase tracking-wider">
              👑 Municipal Super Admin
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              4 Departments • Wards 1–4
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
            Executive Civic Governance Overview
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
          >
            <option value="all" className="text-slate-900">All Wards (1–4)</option>
            <option value="1" className="text-slate-900">Ward 1</option>
            <option value="2" className="text-slate-900">Ward 2</option>
            <option value="3" className="text-slate-900">Ward 3</option>
            <option value="4" className="text-slate-900">Ward 4</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
          >
            <option value="7d" className="text-slate-900">Last 7 Days</option>
            <option value="30d" className="text-slate-900">Last 30 Days</option>
            <option value="90d" className="text-slate-900">Last 90 Days</option>
            <option value="all" className="text-slate-900">All Time</option>
          </select>

          <button
            type="button"
            onClick={fetchOverview}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold border border-white/20 transition cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchOverview} />}

      {loading && !data ? (
        <LoadingSkeleton variant="card" count={4} message="Loading department analytics..." />
      ) : (
        <>
          {/* City-wide KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <KPICard
              title="City Grievances"
              value={cityKpi.total ?? 0}
              subtitle={activeDept === 'all' ? 'All 4 departments' : `Filtered: ${activeDept}`}
              color="blue"
              icon="🏛️"
            />
            <KPICard
              title="Open Backlog"
              value={cityKpi.open ?? 0}
              subtitle={`${cityKpi.pending_validation ?? 0} awaiting validation`}
              color="purple"
              icon="⏳"
            />
            <KPICard
              title="Resolved / Closed"
              value={cityKpi.resolved ?? 0}
              subtitle={`${cityKpi.resolution_rate ?? 0}% resolution rate`}
              color="green"
              icon="✅"
            />
            <KPICard
              title="Severe / High Risk"
              value={cityKpi.sla_at_risk ?? 0}
              subtitle={`Avg ${cityKpi.avg_resolution_days ?? 0}d turnaround`}
              color="red"
              icon="🚨"
            />
            <KPICard
              title="Active Workforce"
              value={`${cityKpi.active_workers ?? 0}/${cityKpi.total_workers ?? 0}`}
              subtitle={cityKpi.avg_citizen_rating ? `Citizen avg ${cityKpi.avg_citizen_rating}★` : 'On-duty technicians'}
              color="amber"
              icon="👷"
            />
          </div>

          {/* 4 Department Scorecards */}
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                4 Municipal Departments Performance Comparison
              </h2>
              {activeDept !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDeptFilter('all')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Clear Department Filter ({activeDept}) &rarr; Show All 4
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {departments.map((d) => {
                const meta = OFFICER_DEPT_META[d.dept_id] || OFFICER_DEPT_META[1];
                const styles = DEPT_ACCENT_STYLES[d.dept_id] || DEPT_ACCENT_STYLES[1];
                const isSelected = activeDept.toLowerCase() === d.code.toLowerCase();
                return (
                  <div
                    key={d.dept_id}
                    onClick={() => setDeptFilter(isSelected ? 'all' : d.code)}
                    className={`bg-white rounded-2xl border p-4 shadow-2xs border-l-4 ${styles.border} cursor-pointer transition hover:shadow-md ${
                      isSelected ? 'ring-2 ring-primary/40 border-primary/50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${styles.chip}`}>
                          {meta.icon} {d.code}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 mt-1.5 leading-snug">
                          {d.title}
                        </h3>
                      </div>
                      <span className="text-lg font-black text-slate-900">{d.total}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-2 text-[11px]">
                      <div>
                        <div className="font-black text-amber-700">{d.pending_validation}</div>
                        <div className="text-[10px] text-slate-500">Review</div>
                      </div>
                      <div>
                        <div className="font-black text-blue-700">{d.open}</div>
                        <div className="text-[10px] text-slate-500">Open</div>
                      </div>
                      <div>
                        <div className="font-black text-emerald-700">{d.resolved}</div>
                        <div className="text-[10px] text-slate-500">Resolved</div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span>SLA Completion</span>
                        <span>{d.resolution_rate}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${d.resolution_rate}%` }} />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">{d.officer_name}</span>
                      <span className="font-bold shrink-0">{d.active_workers} Staff</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* City-Wide Multi-Category GIS Map + Spatial Heatmap + Priority / Trends Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Live GIS Heatmap
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setHeatmapEnabled((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      heatmapEnabled
                        ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {heatmapEnabled ? '🔥 Spatial Heatmap: ON' : '🔥 Spatial Heatmap: OFF'}
                  </button>
                  <Link
                    to="/admin/complaints"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Open Ledger &rarr;
                  </Link>
                </div>
              </div>

              <LeafletMap
                markers={mapMarkers}
                activeMarkerId={selectedPin?.id}
                onMarkerClick={(m) => setSelectedPin(m)}
                showLegend={true}
                showHeatmap={heatmapEnabled}
                readonly={true}
                className="h-72 w-full rounded-2xl"
              />

              {selectedPin && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-primary">#{selectedPin.tracking_id}</span>
                      <PriorityBadge level={selectedPin.priority} />
                      <StatusBadge status={selectedPin.status} />
                      <WardBadge ward={selectedPin.ward} />
                    </div>
                    <p className="font-bold text-slate-800 truncate">{selectedPin.title}</p>
                    <p className="text-[11px] text-slate-500">📍 {selectedPin.address} &bull; Worker: {selectedPin.worker_name}</p>
                  </div>
                  <Link
                    to={`/admin/complaints?search=${encodeURIComponent(selectedPin.tracking_id)}`}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white font-bold text-xs shrink-0"
                  >
                    Manage Issue &rarr;
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <h2 className="text-sm font-black text-slate-900 mb-2">4-Tier AI Priority Split</h2>
                <div className="h-44">
                  {prioDist.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prioDist.filter((d) => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
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
                      No grievances in current scope.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <h2 className="text-sm font-black text-slate-900 mb-2">7-Day City Volume vs Resolution</h2>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#1A56DB" strokeWidth={2.5} />
                      <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* 4x4 Ward x Department Heatmap Matrix */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Ward &times; Department Grievance Heatmap Matrix (Wards 1–4)
                </h2>
                <p className="text-xs text-slate-500">
                  Thermal density shading per ward/department &bull; Click any cell to inspect in Ledger.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">0 None</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">1–2 Low</span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">3–5 Mod</span>
                <span className="px-2 py-0.5 rounded bg-orange-200 text-orange-950 border border-orange-400">6–9 High</span>
                <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 border border-rose-400">10+ Hotspot</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Municipal Ward</th>
                    <th className="px-4 py-3 text-center">🛣️ PWD</th>
                    <th className="px-4 py-3 text-center">🗑️ SWM</th>
                    <th className="px-4 py-3 text-center">💧 PHE</th>
                    <th className="px-4 py-3 text-center">💡 Electrical</th>
                    <th className="px-4 py-3 text-center">Resolved</th>
                    <th className="px-4 py-3 text-center">Ward Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wardMatrix.map((row) => (
                    <tr key={row.wardNum} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900">{row.ward}</div>
                        <div className="text-[11px] text-slate-500">{row.description}</div>
                      </td>
                      {[
                        { code: 'PWD', val: row.PWD },
                        { code: 'SWM', val: row.SWM },
                        { code: 'PHE', val: row.PHE },
                        { code: 'Electrical', val: row.Electrical },
                      ].map((cell) => (
                        <td key={cell.code} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/complaints?dept=${cell.code}&ward=${row.wardNum}`)}
                            className={`min-w-[44px] px-3 py-1.5 rounded-xl transition cursor-pointer ${getHeatmapCellStyle(cell.val)}`}
                          >
                            {cell.val}
                          </button>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{row.resolved}</td>
                      <td className="px-4 py-3 text-center font-black text-slate-900">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Department Officers Command Strip */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Department Officers Command Roster (4 Nodal Officers)
              </h2>
              <Link to="/admin/workers" className="text-xs font-bold text-primary hover:underline">
                Manage 32+ Field Technicians &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {officers.map((off) => {
                const meta = OFFICER_DEPT_META[off.dept_id] || OFFICER_DEPT_META[1];
                return (
                  <div key={off.mobile} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${meta.badgeClass}`}>
                        {meta.icon} {off.dept_code}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{off.mobile}</span>
                    </div>
                    <div className="font-bold text-slate-900 truncate">{off.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Open: <strong>{off.open_backlog}</strong></span>
                      <span>Review: <strong>{off.pending_validation}</strong></span>
                      <span>Staff: <strong>{off.active_workers}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent City-Wide Grievances */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Recent Priority Grievances ({recent.length})</h2>
              <Link to="/admin/complaints" className="text-xs font-bold text-primary hover:underline">
                Full Ledger &amp; Override Actions &rarr;
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No complaints matching current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Tracking ID</th>
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5">Ward</th>
                      <th className="px-4 py-2.5">Priority</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Assigned Worker</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent.slice(0, 8).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/admin/complaints?search=${encodeURIComponent(c.tracking_id)}`)}>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary">#{c.tracking_id}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{c.dept}</td>
                        <td className="px-4 py-2.5"><WardBadge ward={c.ward_number} /></td>
                        <td className="px-4 py-2.5"><PriorityBadge level={c.priority_level} /></td>
                        <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-2.5 text-slate-600">{c.worker_name || 'Unassigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default CrossDeptDashboard;
