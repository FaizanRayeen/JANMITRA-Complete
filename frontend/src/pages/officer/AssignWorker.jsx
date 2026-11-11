import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

/**
 * AssignWorker modal component:
 * Strictly loads real Field Workers from GET /api/v1/officer/workers/ belonging
 * to the logged-in Officer's department and submits POST /api/v1/officer/complaints/:id/assign/.
 */
const AssignWorker = ({ complaint, isOpen, onClose, onAssigned }) => {
  const { role } = useAuth();
  const canOverrideWard = ['admin', 'dept_officer', 'officer'].includes(String(role || '').toLowerCase());

  const [workers, setWorkers] = useState([]);
  const [allWorkers, setAllWorkers] = useState([]);
  const [selectedWorkerMobile, setSelectedWorkerMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (!isOpen || !complaint) return;
    setSelectedWorkerMobile('');
    setOverrideEnabled(false);
    setOverrideReason('');

    const fetchWorkers = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/v1/officer/workers/`, {
          params: { complaint_id: complaint.id },
        });
        const avail = res.data?.available_workers || [];
        const all = res.data?.workers || avail;
        setWorkers(avail);
        setAllWorkers(all);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Could not load department field workers.');
        setWorkers([]);
        setAllWorkers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkers();
  }, [isOpen, complaint]);

  if (!isOpen || !complaint) return null;

  const activeWorkerList = overrideEnabled ? allWorkers : workers;

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedWorkerMobile) {
      setError('Please select a field worker to assign.');
      return;
    }
    if (overrideEnabled && !overrideReason.trim()) {
      setError('Please enter a reason to override the Ward boundary rule.');
      return;
    }

    setAssigning(true);
    setError('');

    try {
      const payload = {
        worker_mobile: selectedWorkerMobile,
        override_ward: overrideEnabled,
        override_reason: overrideEnabled ? overrideReason.trim() : undefined,
      };
      const res = await api.post(`/v1/officer/complaints/${complaint.id}/assign/`, payload);
      const assignedObj =
        res.data?.assigned_worker ||
        activeWorkerList.find((w) => w.mobile === selectedWorkerMobile);

      if (onAssigned) {
        onAssigned(assignedObj?.name || selectedWorkerMobile, res.data?.complaint);
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to assign field worker.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Assign Field Worker</h2>
            <p className="text-xs text-slate-500">
              Select an on-duty technician from your department
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none p-1"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-primary">
              #{complaint.tracking_id || complaint.id}
            </span>
            <div className="flex items-center gap-1.5">
              <CategoryBadge category={complaint.category} />
              <WardBadge ward={complaint.ward_number || complaint.ward} />
            </div>
          </div>
          <p className="text-xs text-slate-700 line-clamp-2 italic">
            &ldquo;{complaint.description || complaint.title}&rdquo;
          </p>
        </div>

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <div className="py-8">
            <LoadingSpinner message="Loading matching department workers..." size="sm" />
          </div>
        ) : (
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {overrideEnabled
                    ? 'All Department Workers (Wards 1–4)'
                    : 'Ward + Department Matched Workers'}
                </label>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {activeWorkerList.length} found
                </span>
              </div>

              {activeWorkerList.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                  No matching field workers found in this ward. Enable Ward Override below to assign from another ward in your department.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {activeWorkerList.map((worker) => (
                    <label
                      key={worker.mobile}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 transition cursor-pointer ${
                        selectedWorkerMobile === worker.mobile
                          ? 'border-primary bg-blue-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="workerSelection"
                          value={worker.mobile}
                          checked={selectedWorkerMobile === worker.mobile}
                          onChange={(e) => setSelectedWorkerMobile(e.target.value)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            <span>{worker.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              ({worker.mobile})
                            </span>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                              Ward {worker.ward}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {worker.designation} &bull; {worker.employee_id}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          worker.active_tasks > 3
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {worker.active_tasks} active
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {canOverrideWard && (
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-purple-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={overrideEnabled}
                    onChange={(e) => setOverrideEnabled(e.target.checked)}
                    className="h-4 w-4 text-purple-700 rounded border-slate-300"
                  />
                  <span>Ward Override: Assign worker from another ward in your department</span>
                </label>

                {overrideEnabled && (
                  <textarea
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Reason for cross-ward override (required)..."
                    className="w-full text-xs p-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedWorkerMobile || assigning}
                className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-md transition flex items-center gap-2 ${
                  !selectedWorkerMobile || assigning
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-primary hover:bg-blue-700'
                }`}
              >
                {assigning ? 'Assigning...' : 'Assign Worker'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AssignWorker;
