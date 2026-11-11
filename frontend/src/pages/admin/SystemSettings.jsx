import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';

const DEFAULT_SETTINGS = {
  critical_sla_hours: 24,
  high_sla_hours: 48,
  medium_sla_hours: 72,
  auto_close_window_hours: 72,
  emergency_broadcast_text: '',
  emergency_broadcast_active: false,
  broadcast_severity: 'warning',
};

const SystemSettings = () => {
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const [initialData, setInitialData] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/v1/admin/settings/');
      const d = res.data || {};
      const merged = {
        critical_sla_hours: Number(d.critical_sla_hours) || 24,
        high_sla_hours: Number(d.high_sla_hours) || 48,
        medium_sla_hours: Number(d.medium_sla_hours) || 72,
        auto_close_window_hours: Number(d.auto_close_window_hours) || 72,
        emergency_broadcast_text: d.emergency_broadcast_text ?? d.broadcast_message ?? '',
        emergency_broadcast_active: Boolean(d.emergency_broadcast_active ?? d.is_active),
        broadcast_severity: d.broadcast_severity || 'warning',
      };
      setFormData(merged);
      setInitialData(merged);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to load municipal SLA configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessToast('');

    if (formData.critical_sla_hours > formData.high_sla_hours) {
      setErrorMsg('Critical SLA hours cannot exceed High SLA hours.');
      return;
    }
    if (formData.high_sla_hours > formData.medium_sla_hours) {
      setErrorMsg('High SLA hours cannot exceed Medium SLA hours.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch('/v1/admin/settings/', formData);
      const saved = {
        critical_sla_hours: Number(res.data?.critical_sla_hours) || formData.critical_sla_hours,
        high_sla_hours: Number(res.data?.high_sla_hours) || formData.high_sla_hours,
        medium_sla_hours: Number(res.data?.medium_sla_hours) || formData.medium_sla_hours,
        auto_close_window_hours: Number(res.data?.auto_close_window_hours) || formData.auto_close_window_hours,
        emergency_broadcast_text: res.data?.emergency_broadcast_text ?? formData.emergency_broadcast_text,
        emergency_broadcast_active: Boolean(res.data?.emergency_broadcast_active),
        broadcast_severity: res.data?.broadcast_severity || formData.broadcast_severity,
      };
      setFormData(saved);
      setInitialData(saved);
      setSuccessToast('Municipal SLA thresholds & civic broadcast updated on server.');
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to save system settings.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Municipal SLA &amp; Civic Broadcast Control
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure global grievance turnaround SLAs and publish city-wide emergency citizen advisories.
        </p>
      </div>

      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
          ✓ {successToast}
        </div>
      )}
      {errorMsg && <ErrorMessage message={errorMsg} onRetry={fetchSettings} />}

      {loading ? (
        <LoadingSkeleton variant="card" count={2} message="Loading server settings..." />
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">
              Global Priority SLA Targets (Hours)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {[
                { key: 'critical_sla_hours', label: 'Severe / Critical SLA (h)' },
                { key: 'high_sla_hours', label: 'High Priority SLA (h)' },
                { key: 'medium_sla_hours', label: 'Medium Priority SLA (h)' },
                { key: 'auto_close_window_hours', label: 'Citizen Verify Window (h)' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block font-bold text-slate-700 mb-1">{item.label}</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={formData[item.key]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [item.key]: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <h2 className="text-sm font-black text-slate-900">
                City-Wide Emergency Citizen Broadcast Banner
              </h2>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emergency_broadcast_active}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, emergency_broadcast_active: e.target.checked }))
                  }
                  className="h-4 w-4 text-primary rounded"
                />
                <span>Broadcast Active on Citizen Portal</span>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Alert Severity</label>
                <select
                  value={formData.broadcast_severity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, broadcast_severity: e.target.value }))}
                  className="w-full sm:w-64 p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  <option value="info">Civic Notice (Blue)</option>
                  <option value="warning">Monsoon / Service Advisory (Amber)</option>
                  <option value="danger">Urgent Emergency Alert (Red)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Broadcast Message</label>
                <textarea
                  rows={3}
                  value={formData.emergency_broadcast_text}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, emergency_broadcast_text: e.target.value }))
                  }
                  placeholder="Enter public municipal advisory for citizens..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              {formData.emergency_broadcast_active && formData.emergency_broadcast_text && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    formData.broadcast_severity === 'danger'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : formData.broadcast_severity === 'info'
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  Live Citizen Preview: {formData.emergency_broadcast_text}
                </div>
              )}
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={() => setFormData(initialData)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Revert Unsaved
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-bold shadow cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Admin Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SystemSettings;
