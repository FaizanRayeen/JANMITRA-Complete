/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/layouts/AdminLayout.jsx
 * Description: Super Admin Portal Layout with Department Filter synced to URL
 *              (?dept=all|PWD|SWM|PHE|Electrical) and responsive Admin Sidebar.
 * ==============================================================================
 */

import React, { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from './Layout';

const DEPARTMENTS = [
  { id: 'all', name: '🏛️ All 4 Departments' },
  { id: 'PWD', name: '🛣️ PWD (Roads & Infra)' },
  { id: 'SWM', name: '🗑️ SWM (Solid Waste)' },
  { id: 'PHE', name: '💧 PHE (Water & Drainage)' },
  { id: 'Electrical', name: '💡 Electrical & Lights' },
];

const ADMIN_NAV_ITEMS = [
  { path: '/admin', label: 'City Overview & GIS', icon: '🏛️' },
  { path: '/admin/complaints', label: 'Complaints Ledger', icon: '📋' },
  { path: '/admin/workers', label: 'Field Workforce', icon: '👷' },
  { path: '/admin/reports', label: 'Reports & Export', icon: '📊' },
  { path: '/admin/settings', label: 'SLA & Broadcasts', icon: '⚙️' },
];

export const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rawDept = searchParams.get('dept') || 'all';
  const selectedDept =
    DEPARTMENTS.find((d) => d.id.toLowerCase() === rawDept.toLowerCase())?.id || 'all';

  const handleDeptChange = (nextDept) => {
    const next = new URLSearchParams(searchParams);
    if (!nextDept || nextDept === 'all') {
      next.delete('dept');
    } else {
      next.set('dept', nextDept);
    }
    const qs = next.toString();
    if (location.pathname.startsWith('/admin/reports') || location.pathname.startsWith('/admin/settings')) {
      navigate(qs ? `/admin?${qs}` : '/admin');
    } else {
      setSearchParams(next, { replace: true });
    }
  };

  const goNav = (path, onItemClick) => {
    const deptSuffix = selectedDept && selectedDept !== 'all' ? `?dept=${selectedDept}` : '';
    navigate(`${path}${deptSuffix}`);
    if (onItemClick) onItemClick();
  };

  const departmentSwitcher = (
    <div className="p-3 bg-slate-50 border-b border-slate-200">
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        Active Department Scope
      </label>
      <select
        value={selectedDept}
        onChange={(e) => handleDeptChange(e.target.value)}
        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0d2a53]"
      >
        {DEPARTMENTS.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>
    </div>
  );

  const renderNavLinks = (onItemClick) => (
    <div className="p-3 space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
        Super Admin Command
      </div>
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive =
          item.path === '/admin'
            ? location.pathname === '/admin' || location.pathname === '/admin/'
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => goNav(item.path, onItemClick)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? 'bg-[#0d2a53] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const desktopSidebar = (
    <div className="hidden md:flex flex-col h-full">
      {departmentSwitcher}
      <div className="flex-1 py-2">{renderNavLinks()}</div>
      <div className="p-4 border-t border-slate-200 text-center">
        <span className="text-[10px] text-slate-400 font-semibold">
          Janmitra Municipal Command
        </span>
      </div>
    </div>
  );

  return (
    <Layout role="admin" sidebar={desktopSidebar}>
      <div className="md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between gap-2 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200"
        >
          <span>☰</span>
          <span>Admin Menu</span>
        </button>

        <select
          value={selectedDept}
          onChange={(e) => handleDeptChange(e.target.value)}
          className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800"
        >
          {DEPARTMENTS.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="w-72 bg-white h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-[#0d2a53] text-white flex items-center justify-between">
              <div className="font-bold text-sm tracking-wide">Super Admin Navigation</div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-white text-xl font-bold p-1 hover:text-slate-300"
              >
                &times;
              </button>
            </div>
            {departmentSwitcher}
            <div className="flex-1 overflow-y-auto">
              {renderNavLinks(() => setMobileMenuOpen(false))}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
    </Layout>
  );
};

export default AdminLayout;
