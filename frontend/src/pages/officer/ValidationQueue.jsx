import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { resolveOfficerDept } from '../../utils/officerDeptMeta';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import PriorityBadge from '../../components/PriorityBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';
import ErrorMessage from '../../components/ErrorMessage';
import { NotificationBell } from '../../components/NotificationBell';
import AssignWorker from './AssignWorker';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const REJECTION_REASONS = [
  { id: 'blurry_image', title: 'Unclear or Blurry Photo' },
  { id: 'not_civic', title: 'Not a Municipal / Civic Issue' },
  { id: 'outside_jurisdiction', title: 'Outside Ward / Municipal Boundary' },
  { id: 'duplicate_spam', title: 'Duplicate or Redundant Report' },
  { id: 'already_resolved', title: 'Issue Already Resolved / False Report' },
  { id: 'other', title: 'Other Reason (Specify Below)' },
];

const ValidationQueue = () => {
  const { logout, user } = useAuth();
  const deptMeta = resolveOfficerDept(user);

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedWard, setSelectedWard] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [selectedReasonId, setSelectedReasonId] = useState('blurry_image');
  const [customReasonText, setCustomReasonText] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [assignModalItem, setAssignModalItem] = useState(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);

  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/v1/officer/validation-queue/');
      setQueue(res.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load department validation queue.');
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleApprove = async (item) => {
    setProcessingId(item.id);
    try {
      await api.post(`/v1/officer/complaints/${item.id}/validate/`, { action: 'approve' });
      setQueue((prev) => prev.filter((c) => c.id !== item.id));
      showToast('success', `Complaint #${item.tracking_id} approved & dispatched to Ward ${item.ward_number} field queue!`);
    } catch (err) {
      showToast('danger', err?.response?.data?.detail || 'Failed to approve complaint.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    const selectedObj = REJECTION_REASONS.find((r) => r.id === selectedReasonId);
    let finalReason = selectedObj ? selectedObj.title : 'Invalid submission';
    if (selectedReasonId === 'other') {
      if (!customReasonText.trim()) {
        setRejectError('Please specify a reason for rejecting this complaint.');
        return;
      }
      finalReason = customReasonText.trim();
    } else if (customReasonText.trim()) {
      finalReason = `${finalReason}: ${customReasonText.trim()}`;
    }

    setProcessingId(rejectModalItem.id);
    try {
      await api.post(`/v1/officer/complaints/${rejectModalItem.id}/validate/`, {
        action: 'reject',
        reason: finalReason,
        note: customReasonText.trim(),
      });
      setQueue((prev) => prev.filter((c) => c.id !== rejectModalItem.id));
      showToast('danger', `Complaint #${rejectModalItem.tracking_id} rejected (${finalReason}).`);
      setRejectModalItem(null);
      setCustomReasonText('');
    } catch (err) {
      setRejectError(err?.response?.data?.detail || 'Could not reject complaint.');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      const wNum = String(item.ward_number || item.ward || '');
      const matchWard = selectedWard === 'All' || wNum === String(selectedWard);
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        String(item.tracking_id || '').toLowerCase().includes(q) ||
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.address || '').toLowerCase().includes(q);
      return matchWard && matchSearch;
    });
  }, [queue, selectedWard, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-12">
      <OfficerSidebarDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingValidationCount={queue.length}
      />

      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-xl border font-bold text-xs sm:text-sm ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className={`border-l-4 ${deptMeta.accentBorder} pl-3`}>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${deptMeta.badgeClass}`}>
                {deptMeta.icon} {deptMeta.code} VALIDATION QUEUE
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                AI-Flagged Citizen Grievances
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
            placeholder="Search pending complaints..."
            className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="All">All Wards (1–4)</option>
              <option value="1">Ward 1</option>
              <option value="2">Ward 2</option>
              <option value="3">Ward 3</option>
              <option value="4">Ward 4</option>
            </select>
            <button
              type="button"
              onClick={fetchQueue}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} onRetry={fetchQueue} />}

        {loading ? (
          <LoadingSkeleton variant="card" count={2} message="Loading department validation queue..." />
        ) : filteredQueue.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2 shadow-xs">
            <div className="text-4xl">✅</div>
            <h3 className="text-base font-black text-slate-900">
              No Unvalidated {deptMeta.code} Grievances Pending
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All citizen complaints submitted under {deptMeta.fullTitle} with unclear AI detections have been reviewed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQueue.map((item) => {
              const photoSrc = resolveMediaUrl(item.photo_url || item.image, '');
              return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
                <div
                  className={`relative h-52 bg-slate-100 ${photoSrc ? 'cursor-pointer' : ''}`}
                  onClick={() => photoSrc && setEnlargedPhoto(photoSrc)}
                >
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 bg-slate-50 border-b border-dashed border-slate-200">
                      <span className="text-3xl">📷</span>
                      <span className="text-xs font-semibold">No Photo Attached by Citizen</span>
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white font-mono text-xs font-bold">
                    #{item.tracking_id}
                  </span>
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold">
                    AI Manual Review Needed
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PriorityBadge level={item.priority_level || item.priority} />
                      <WardBadge ward={item.ward_number || item.ward} />
                      <CategoryBadge category={item.category} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                    <p className="text-[11px] text-slate-500">📍 {item.address || item.location}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleApprove(item)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      ✓ Approve &amp; Queue
                    </button>
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => setAssignModalItem(item)}
                      className="py-2.5 px-3 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-bold transition"
                    >
                      👷 Approve &amp; Assign
                    </button>
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => {
                        setRejectModalItem(item);
                        setSelectedReasonId('blurry_image');
                        setCustomReasonText('');
                        setRejectError('');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      {rejectModalItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRejectModalItem(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black text-slate-900">Reject Complaint #{rejectModalItem.tracking_id}</h3>
            {rejectError && <ErrorMessage message={rejectError} />}
            <select
              value={selectedReasonId}
              onChange={(e) => setSelectedReasonId(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50"
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
            <textarea
              rows={3}
              value={customReasonText}
              onChange={(e) => setCustomReasonText(e.target.value)}
              placeholder="Optional explanation for citizen..."
              className="w-full p-3 text-xs rounded-xl border border-slate-200"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectModalItem(null)} className="px-4 py-2 text-xs font-bold bg-slate-100 rounded-xl">Cancel</button>
              <button type="button" onClick={handleConfirmReject} className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      <AssignWorker
        complaint={assignModalItem}
        isOpen={Boolean(assignModalItem)}
        onClose={() => setAssignModalItem(null)}
        onAssigned={(workerName) => {
          setQueue((prev) => prev.filter((c) => c.id !== assignModalItem?.id));
          showToast('success', `Validated & assigned directly to ${workerName}!`);
        }}
      />

      {enlargedPhoto && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setEnlargedPhoto(null)}>
          <img src={enlargedPhoto} alt="Preview" className="max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default ValidationQueue;
