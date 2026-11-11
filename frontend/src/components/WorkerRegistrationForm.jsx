/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/components/WorkerRegistrationForm.jsx
 * Developer: Faizan Rayeen (Citizen & Push Notifications Lead)
 * Description: Modal form for registering new field workers and editing existing
 *              worker profiles. Handles:
 *              1. Mode: Create new worker (POST) or Edit existing worker (PATCH).
 *              2. Input fields with validation:
 *                 - Employee ID (required, NMC format e.g. NMC-PWD-101)
 *                 - Full Name (required, min 3 chars)
 *                 - Mobile Number (required, 10 digits)
 *                 - Department dropdown (locked if logged-in user is officer)
 *                 - Ward dropdown (Ward 1 to 4)
 *                 - Designation text input with quick suggestion chips
 *                 - Initial Password & Confirm Password (show/hide toggle)
 *              3. On submit: Call API, show success toast, refresh worker list.
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// 4 Canonical Departments
export const DEPARTMENTS = [
  { value: 'PWD', label: 'PWD (Roads & Infrastructure)', code: 'PWD' },
  { value: 'Solid Waste Management', label: 'Solid Waste Management (SWM)', code: 'SWM' },
  { value: 'Public Health Engineering', label: 'Public Health Engineering (Water Works)', code: 'PHE' },
  { value: 'Electrical', label: 'Electrical Department (Street Lighting)', code: 'ELE' }
];

// 4 Canonical Wards in Nagpur
export const WARDS = [
  { value: 'Ward 1', label: 'Ward 1 (Dharampeth / West Nagpur)' },
  { value: 'Ward 2', label: 'Ward 2 (Dhantoli / Central Nagpur)' },
  { value: 'Ward 3', label: 'Ward 3 (Nehru Nagar / East Nagpur)' },
  { value: 'Ward 4', label: 'Ward 4 (Mangalwari / North Nagpur)' }
];

// Common designation suggestion chips
const DESIGNATION_SUGGESTIONS = [
  'Field Inspector',
  'Sanitation Supervisor',
  'Pothole Repair Technician',
  'Water Pipeline Fitter',
  'Streetlight Lineman'
];

/**
 * Generate a standard NMC Employee ID suggestion based on Department
 * Format: NMC-<DEPT>-<3-digit rand>
 */
const generateNmcId = (deptValue = 'PWD') => {
  const dept = DEPARTMENTS.find((d) => d.value === deptValue) || DEPARTMENTS[0];
  const rand = Math.floor(100 + Math.random() * 900);
  return `NMC-${dept.code}-${rand}`;
};

export const WorkerRegistrationForm = ({
  isOpen = true,
  onClose,
  onSuccess,
  worker = null,              // If passed, operates in Edit (PATCH) mode
  officerDepartment = null    // If passed or user is officer, locks department
}) => {
  const { user } = useAuth();
  const isEditMode = Boolean(worker && (worker.id || worker.employee_id));

  // Determine if department should be locked to officer's division
  const isOfficer =
    Boolean(officerDepartment) ||
    user?.role === 'dept_officer' ||
    user?.role === 'officer';

  const lockedDepartment = officerDepartment || (isOfficer ? user?.department : null);

  // Form State
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    mobile: '',
    email: '',
    department: lockedDepartment || 'PWD',
    ward: 'Ward 1',
    designation: 'Field Inspector',
    status: 'Active',
    password: '',
    confirm_password: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localSuccessToast, setLocalSuccessToast] = useState(null);

  // Initialize or reset form state when modal opens or worker changes
  useEffect(() => {
    if (!isOpen) {
      setLocalSuccessToast(null);
      return;
    }

    if (isEditMode && worker) {
      // Edit Mode
      setFormData({
        employee_id: worker.employee_id || worker.username || '',
        name: worker.name || worker.full_name || '',
        mobile: worker.mobile || '',
        email: worker.email || '',
        department: worker.department || lockedDepartment || 'PWD',
        ward: typeof worker.ward === 'number' ? `Ward ${worker.ward}` : worker.ward || 'Ward 1',
        designation: worker.designation || 'Field Inspector',
        status: worker.status || (worker.is_active ? 'Active' : 'Inactive'),
        password: '',
        confirm_password: ''
      });
    } else {
      // Create Mode
      const initialDept = lockedDepartment || 'PWD';
      setFormData({
        employee_id: generateNmcId(initialDept),
        name: '',
        mobile: '',
        email: '',
        department: initialDept,
        ward: 'Ward 1',
        designation: 'Field Inspector',
        status: 'Active',
        password: '',
        confirm_password: ''
      });
    }

    setErrors({});
    setServerError('');
    setLocalSuccessToast(null);
  }, [worker, isEditMode, lockedDepartment, isOpen]);

  // Handle department change & update employee ID suggestion if untouched in Create mode
  const handleDepartmentChange = (newDept) => {
    setFormData((prev) => {
      const isAutoGenerated = prev.employee_id.startsWith('NMC-');
      return {
        ...prev,
        department: newDept,
        employee_id: isAutoGenerated && !isEditMode ? generateNmcId(newDept) : prev.employee_id
      };
    });
    if (errors.department) {
      setErrors((prev) => ({ ...prev, department: '' }));
    }
  };

  // Keyboard navigation: Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  // Form Validation Logic
  const validateForm = () => {
    const err = {};

    // 1. Employee ID (required, NMC format)
    const empId = formData.employee_id.trim();
    if (!empId) {
      err.employee_id = 'Employee ID is required';
    } else {
      // Validates NMC format e.g. NMC-PWD-101, NMC-SWM-204, NMC-W-1042
      const nmcPattern = /^NMC-[A-Z0-9]{1,6}-\d{2,5}$/i;
      if (!nmcPattern.test(empId)) {
        err.employee_id = 'Employee ID must follow NMC format (e.g. NMC-PWD-101 or NMC-SWM-204)';
      }
    }

    // 2. Full Name (required, min 3 characters)
    const name = formData.name.trim();
    if (!name) {
      err.name = 'Full name is required';
    } else if (name.length < 3) {
      err.name = 'Full name must be at least 3 characters long';
    }

    // 3. Mobile Number (required, 10 digits starting with 6-9)
    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!cleanMobile) {
      err.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      err.mobile = 'Enter a valid 10-digit Indian mobile number (e.g. 9822345671)';
    }

    // 4. Designation (required)
    if (!formData.designation.trim()) {
      err.designation = 'Designation is required';
    }

    // 5. Initial Password & Confirm Password
    if (!isEditMode) {
      // Required in Create Mode
      if (!formData.password) {
        err.password = 'Initial password is required';
      } else if (formData.password.length < 8) {
        err.password = 'Password must be at least 8 characters long';
      }

      if (!formData.confirm_password) {
        err.confirm_password = 'Confirm password is required';
      } else if (formData.password !== formData.confirm_password) {
        err.confirm_password = 'Passwords do not match';
      }
    } else if (formData.password) {
      // Optional in Edit Mode, but validate if entered
      if (formData.password.length < 8) {
        err.password = 'New password must be at least 8 characters long';
      }
      if (formData.password !== formData.confirm_password) {
        err.confirm_password = 'Passwords do not match';
      }
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        // ================= PATCH: EDIT EXISTING WORKER =================
        const payload = {
          name: formData.name.trim(),
          ward: formData.ward,
          designation: formData.designation.trim(),
          status: formData.status
        };

        // If not locked by officer, allow department updates
        if (!lockedDepartment) {
          payload.department = formData.department;
        }

        if (formData.password) {
          payload.password = formData.password;
        }

        const res = await api.patch(`/api/v1/admin/workers/${worker.id}/`, payload);
        const updatedWorker = res.data || { ...worker, ...payload };

        setLocalSuccessToast(`✓ Worker ${payload.name} updated successfully!`);

        // Refresh list and notify parent
        setTimeout(() => {
          if (onSuccess) onSuccess(updatedWorker, 'updated');
          if (onClose) onClose();
        }, 600);
      } else {
        // ================= POST: CREATE NEW WORKER =================
        const cleanMobile = formData.mobile.replace(/\D/g, '');
        const payload = {
          employee_id: formData.employee_id.trim().toUpperCase(),
          name: formData.name.trim(),
          mobile: cleanMobile,
          email: formData.email.trim() || undefined,
          department: lockedDepartment || formData.department,
          ward: formData.ward,
          designation: formData.designation.trim(),
          password: formData.password,
          role: 'worker',
          status: 'Active'
        };

        const res = await api.post('/api/v1/admin/workers/', payload);
        const createdWorker = res.data || { id: Date.now().toString(), ...payload };

        setLocalSuccessToast(`✓ Worker ${payload.name} registered with ID ${payload.employee_id}!`);

        // Refresh list and notify parent
        setTimeout(() => {
          if (onSuccess) onSuccess(createdWorker, 'created');
          if (onClose) onClose();
        }, 600);
      }
    } catch (err) {
      console.error('[WorkerRegistrationForm Error]', err);
      const data = err.response?.data;
      const msg =
        data?.detail ||
        data?.error ||
        data?.message ||
        (data?.mobile && (Array.isArray(data.mobile) ? data.mobile[0] : data.mobile)) ||
        (data?.employee_id && (Array.isArray(data.employee_id) ? data.employee_id[0] : data.employee_id)) ||
        'Failed to save worker record. Please check details and try again.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="worker-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 my-8 relative transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">👷‍♂️</span>
              <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {isEditMode ? 'Worker Profile Edit' : 'NMC Field Worker Registration'}
              </span>
            </div>
            <h2 id="worker-modal-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {isEditMode ? `Edit Worker: ${worker?.name || formData.name}` : 'Register New Field Worker'}
            </h2>
            <p className="text-xs text-slate-500">
              {lockedDepartment
                ? `Division Locked: ${lockedDepartment} (Officer Authority)`
                : 'Nagpur Municipal Corporation Administration Portal'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xl transition-colors cursor-pointer select-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* In-Modal Success Banner */}
        {localSuccessToast && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <span>🎉</span>
            <span>{localSuccessToast}</span>
          </div>
        )}

        {/* Server Error Alert */}
        {serverError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span>⚠️</span>
            <span>{serverError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3.5">
          
          {/* Row 1: Employee ID & Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Employee ID (Required, NMC format) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Employee ID <span className="text-rose-500">*</span>
                </label>
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        employee_id: generateNmcId(prev.department)
                      }))
                    }
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Regenerate
                  </button>
                )}
              </div>
              <input
                type="text"
                disabled={isEditMode}
                placeholder="e.g. NMC-PWD-101"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value.toUpperCase() })}
                className={`w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border ${
                  isEditMode
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                    : 'bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-blue-100'
                } ${errors.employee_id ? 'border-rose-500' : 'border-slate-300 focus:border-[#1A56DB]'} outline-none transition-all`}
              />
              {errors.employee_id && (
                <p className="text-rose-600 text-[10px] font-semibold mt-1">{errors.employee_id}</p>
              )}
            </div>

            {/* Designation */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Designation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Field Inspector"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-blue-100 ${
                  errors.designation ? 'border-rose-500' : 'border-slate-300 focus:border-[#1A56DB]'
                } outline-none transition-all`}
              />
              {errors.designation && (
                <p className="text-rose-600 text-[10px] font-semibold mt-1">{errors.designation}</p>
              )}
            </div>
          </div>

          {/* Quick Designation Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-bold text-slate-400">Quick Fill:</span>
            {DESIGNATION_SUGGESTIONS.map((desig) => (
              <button
                key={desig}
                type="button"
                onClick={() => setFormData({ ...formData, designation: desig })}
                className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                  formData.designation === desig
                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
              >
                {desig}
              </button>
            ))}
          </div>

          {/* Row 2: Full Name & Mobile Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Patil"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-blue-100 ${
                  errors.name ? 'border-rose-500' : 'border-slate-300 focus:border-[#1A56DB]'
                } outline-none transition-all`}
              />
              {errors.name && (
                <p className="text-rose-600 text-[10px] font-semibold mt-1">{errors.name}</p>
              )}
            </div>

            {/* Mobile Number (10 Digits) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 select-none pointer-events-none">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9822345671"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                  className={`w-full pl-11 pr-3 py-2.5 text-xs font-mono font-bold rounded-xl border bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-blue-100 ${
                    errors.mobile ? 'border-rose-500' : 'border-slate-300 focus:border-[#1A56DB]'
                  } outline-none transition-all`}
                />
              </div>
              {errors.mobile && (
                <p className="text-rose-600 text-[10px] font-semibold mt-1">{errors.mobile}</p>
              )}
            </div>
          </div>

          {/* Row 3: Department & Ward */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Department (Locked if logged-in user is officer) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Department <span className="text-rose-500">*</span>
                </label>
                {lockedDepartment && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                    <span>🔒</span>
                    <span>Officer Locked</span>
                  </span>
                )}
              </div>
              <select
                disabled={Boolean(lockedDepartment)}
                value={formData.department}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className={`w-full px-3 py-2.5 text-xs font-medium rounded-xl border ${
                  lockedDepartment
                    ? 'bg-slate-100 text-slate-600 font-bold cursor-not-allowed border-slate-200'
                    : 'bg-slate-50 focus:bg-white text-slate-900 border-slate-300 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100'
                } outline-none transition-all`}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.value} value={dept.value}>
                    {dept.label}
                  </option>
                ))}
              </select>
              {lockedDepartment && (
                <p className="text-[10px] text-blue-600 font-semibold mt-1">
                  Department locked to your assigned division
                </p>
              )}
            </div>

            {/* Ward Dropdown (Ward 1 to 4) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assigned Municipal Ward <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                className="w-full px-3 py-2.5 text-xs font-medium rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              >
                {WARDS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Status (Edit Mode) & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="worker@nmc.gov.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-[#1A56DB] outline-none transition-all"
              />
            </div>

            {isEditMode ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Worker Duty Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-[#1A56DB] outline-none"
                >
                  <option value="Active">Active (On Duty & Available)</option>
                  <option value="On Leave">On Leave (Suspended Assignments)</option>
                  <option value="Inactive">Inactive / Retired</option>
                </select>
              </div>
            ) : (
              <div className="flex flex-col justify-end pb-1 text-[11px] text-slate-500">
                <span>Default status for new registrations is <strong>Active</strong>.</span>
              </div>
            )}
          </div>

          {/* Row 5: Initial Password & Confirm Password */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {isEditMode ? 'Change Password (Optional)' : 'Worker Account Credentials'}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
              >
                <span>{showPassword ? '👁️ Hide' : '👁️‍🗨️ Show'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {isEditMode ? 'New Password' : 'Initial Password'}{' '}
                  {!isEditMode && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEditMode ? 'Leave blank to retain current' : 'Min 8 characters'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-blue-100 ${
                    errors.password ? 'border-rose-500' : 'border-slate-300 focus:border-[#1A56DB]'
                  } outline-none transition-all`}
                />
                {errors.password && (
                  <p className="text-rose-600 text-[10px] font-semibold mt-1">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Confirm Password {!isEditMode && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-blue-100 ${
                    errors.confirm_password ? 'border-rose-500' : 'border-slate-300 focus:border-[#1A56DB]'
                  } outline-none transition-all`}
                />
                {errors.confirm_password && (
                  <p className="text-rose-600 text-[10px] font-semibold mt-1">{errors.confirm_password}</p>
                )}
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-black text-white bg-[#0d2a53] hover:bg-[#153e75] active:scale-[0.98] rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Worker Record' : 'Register Field Worker'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerRegistrationForm;
