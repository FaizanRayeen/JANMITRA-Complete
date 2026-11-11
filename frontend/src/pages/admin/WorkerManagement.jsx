import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { OFFICER_DEPT_META } from '../../utils/officerDeptMeta';
import WardBadge from '../../components/WardBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';

const INITIAL_NEW_FORM = {
  name: '',
  mobile: '',
  dept_id: '1',
  ward: '1',
  designation: '',
  password: '',
};

const WorkerManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deptFilter, setDeptFilter] = useState(searchParams.get('dept') || 'all');
  const [wardFilter, setWardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState(INITIAL_NEW_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [editingWorker, setEditingWorker] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', dept_id: '1', ward: '1', designation: '' });

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const d = searchParams.get('dept');
    if (d !== null) setDeptFilter(d || 'all');
  }, [searchParams]);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/v1/admin/workers/', {
        params: {
          dept: deptFilter,
          ward: wardFilter,
          status: statusFilter,
          search: searchQuery,
        },
      });
      setWorkers(res.data?.workers || res.data?.results || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load municipal workforce from database.');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [deptFilter, wardFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/v1/admin/workers/', {
        name: newForm.name.trim(),
        mobile: newForm.mobile.trim(),
        dept_id: Number(newForm.dept_id),
        ward: Number(newForm.ward),
        designation: newForm.designation.trim() || undefined,
        password: newForm.password.trim() || 'worker123',
      });
      showToast('success', `Registered Field Worker ${res.data?.name} (${res.data?.mobile}).`);
      setShowAddModal(false);
      setNewForm(INITIAL_NEW_FORM);
      fetchWorkers();
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Could not create worker account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (w) => {
    const nextStatus = w.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/v1/admin/workers/${w.mobile}/`, { status: nextStatus });
      showToast('success', `${w.name} marked ${nextStatus}.`);
      fetchWorkers();
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Failed to update worker status.');
    }
  };

  const openEditModal = (w) => {
    setEditingWorker(w);
    setEditForm({
      name: w.name || '',
      dept_id: String(w.dept_id || 1),
      ward: String(w.ward || 1),
      designation: w.designation || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingWorker) return;
    setSubmitting(true);
    try {
      await api.patch(`/v1/admin/workers/${editingWorker.mobile}/`, {
        name: editForm.name.trim(),
        dept_id: Number(editForm.dept_id),
        ward: Number(editForm.ward),
        designation: editForm.designation.trim(),
      });
      showToast('success', `Updated worker profile for ${editForm.name}.`);
      setEditingWorker(null);
      fetchWorkers();
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Failed to update worker.');
    } finally {
      setSubmitting(false);
    }
  };

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
            City Field Workforce Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {workers.length} Technicians across PWD, SWM, PHE &amp; Electrical (Wards 1–4)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          + Register Field Worker
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, mobile, employee ID..."
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
          <option value="PWD">PWD</option>
          <option value="SWM">SWM</option>
          <option value="PHE">PHE</option>
          <option value="Electrical">Electrical</option>
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
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchWorkers} />}

      {loading ? (
        <LoadingSkeleton variant="card" count={4} message="Loading municipal technicians..." />
      ) : workers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          No field workers match the selected filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Employee &amp; Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Ward</th>
                  <th className="px-4 py-3 text-center">Workload</th>
                  <th className="px-4 py-3 text-center">Rating</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w) => {
                  const meta = OFFICER_DEPT_META[w.dept_id] || OFFICER_DEPT_META[1];
                  return (
                    <tr key={w.mobile} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900">{w.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {w.employee_id} &bull; 📱 {w.mobile} &bull; {w.designation}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${meta.badgeClass}`}>
                          {meta.icon} {meta.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <WardBadge ward={w.ward} />
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold mr-1">
                          {w.active_tasks} active
                        </span>
                        <span className="text-slate-500">{w.completed_tasks} done</span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap font-bold text-amber-600">
                        {w.rating !== '—' ? `${w.rating} ★ (${w.reviews})` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            w.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(w)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(w)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                            w.status === 'Active'
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {w.status === 'Active' ? 'Deactivate' : 'Activate'}
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

      {/* Add Worker Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900">Register New Field Worker</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateWorker} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newForm.name}
                  onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Rajesh Meshram"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">10-Digit Mobile *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={newForm.mobile}
                  onChange={(e) => setNewForm((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, '') }))}
                  placeholder="e.g. 9800510001"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={newForm.dept_id}
                    onChange={(e) => setNewForm((p) => ({ ...p, dept_id: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="1">PWD</option>
                    <option value="2">SWM</option>
                    <option value="3">PHE</option>
                    <option value="4">Electrical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ward</label>
                  <select
                    value={newForm.ward}
                    onChange={(e) => setNewForm((p) => ({ ...p, ward: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="1">Ward 1</option>
                    <option value="2">Ward 2</option>
                    <option value="3">Ward 3</option>
                    <option value="4">Ward 4</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={newForm.designation}
                  onChange={(e) => setNewForm((p) => ({ ...p, designation: e.target.value }))}
                  placeholder="Field Technician (default)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="text"
                  value={newForm.password}
                  onChange={(e) => setNewForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="worker123 (default)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-600">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-primary text-white font-bold">
                  {submitting ? 'Saving...' : 'Create Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {editingWorker && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingWorker(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900">Edit Technician ({editingWorker.mobile})</h2>
              <button type="button" onClick={() => setEditingWorker(null)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={editForm.dept_id}
                    onChange={(e) => setEditForm((p) => ({ ...p, dept_id: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="1">PWD</option>
                    <option value="2">SWM</option>
                    <option value="3">PHE</option>
                    <option value="4">Electrical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ward</label>
                  <select
                    value={editForm.ward}
                    onChange={(e) => setEditForm((p) => ({ ...p, ward: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="1">Ward 1</option>
                    <option value="2">Ward 2</option>
                    <option value="3">Ward 3</option>
                    <option value="4">Ward 4</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm((p) => ({ ...p, designation: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingWorker(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-600">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-primary text-white font-bold">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerManagement;
