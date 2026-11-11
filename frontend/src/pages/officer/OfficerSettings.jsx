import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { resolveOfficerDept } from '../../utils/officerDeptMeta';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';
import { NotificationBell } from '../../components/NotificationBell';

const OfficerSettings = () => {
  const { user, logout } = useAuth();
  const deptMeta = resolveOfficerDept(user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [criticalSmsAlert, setCriticalSmsAlert] = useState(true);
  const [slaWarningWhatsapp, setSlaWarningWhatsapp] = useState(true);
  const [dailyDigestEmail, setDailyDigestEmail] = useState(false);
  const [autoDispatchMode, setAutoDispatchMode] = useState('assisted');
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(25);
  const [onDutyStatus, setOnDutyStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    api
      .get('/v1/officer/settings/')
      .then((res) => {
        const d = res.data || {};
        if (d.critical_sms_alert !== undefined) setCriticalSmsAlert(Boolean(d.critical_sms_alert));
        if (d.sla_warning_whatsapp !== undefined) setSlaWarningWhatsapp(Boolean(d.sla_warning_whatsapp));
        if (d.daily_digest_email !== undefined) setDailyDigestEmail(Boolean(d.daily_digest_email));
        if (d.auto_dispatch_mode) setAutoDispatchMode(d.auto_dispatch_mode);
        if (d.ai_confidence_threshold !== undefined) setAiConfidenceThreshold(Number(d.ai_confidence_threshold));
        if (d.on_duty !== undefined) setOnDutyStatus(Boolean(d.on_duty));
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/v1/officer/settings/', {
        critical_sms_alert: criticalSmsAlert,
        sla_warning_whatsapp: slaWarningWhatsapp,
        daily_digest_email: dailyDigestEmail,
        auto_dispatch_mode: autoDispatchMode,
        ai_confidence_threshold: aiConfidenceThreshold,
        on_duty: onDutyStatus,
      });
      setSuccessToast(`${deptMeta.code} preferences saved to server.`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch {
      setSuccessToast('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-16">
      <OfficerSidebarDrawer isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className={`border-l-4 ${deptMeta.accentBorder} pl-3`}>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${deptMeta.badgeClass}`}>
                {deptMeta.icon} {deptMeta.code} SETTINGS
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {deptMeta.fullTitle} Dispatch Preferences
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <Link to="/officer" className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
              &larr; Dashboard
            </Link>
            <button
              type="button"
              onClick={() => logout('/login?role=officer')}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-danger text-xs font-bold rounded-xl border border-red-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {successToast && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
            ✓ {successToast}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white font-black text-2xl flex items-center justify-center shadow-md">
              {deptMeta.icon}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{user?.name || 'Department Officer'}</h2>
              <p className="text-xs text-slate-500">
                {deptMeta.fullTitle} &bull; Mobile: {user?.mobile || user?.username}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onDutyStatus}
              onChange={(e) => setOnDutyStatus(e.target.checked)}
              className="h-4 w-4 text-emerald-600 rounded"
            />
            <span>Officer Command Active</span>
          </label>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">
            SLA Alerts &amp; AI Routing Controls
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700">Severe/High Priority Escalation SMS Alert</span>
              <input type="checkbox" checked={criticalSmsAlert} onChange={(e) => setCriticalSmsAlert(e.target.checked)} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700">SLA Deadline Warning Notifications</span>
              <input type="checkbox" checked={slaWarningWhatsapp} onChange={(e) => setSlaWarningWhatsapp(e.target.checked)} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700">Daily Departmental Digest Summary</span>
              <input type="checkbox" checked={dailyDigestEmail} onChange={(e) => setDailyDigestEmail(e.target.checked)} className="h-4 w-4" />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dispatch Mode</label>
                <select
                  value={autoDispatchMode}
                  onChange={(e) => setAutoDispatchMode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  <option value="assisted">AI-Validated + Worker Self-Claim + Officer Override</option>
                  <option value="manual">Strict Officer Manual Assignment Only</option>
                  <option value="auto">Automatic Ward Dispatch</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  YOLOv8 Confidence Threshold ({aiConfidenceThreshold}%)
                </label>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={aiConfidenceThreshold}
                  onChange={(e) => setAiConfidenceThreshold(Number(e.target.value))}
                  className="w-full mt-2"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-bold shadow transition cursor-pointer"
            >
              {saving ? 'Saving...' : `Save ${deptMeta.code} Settings`}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default OfficerSettings;
