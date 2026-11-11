/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/App.jsx
 * Developer: Faizan Rayeen (Notifications & Portal Layouts Lead)
 * Description: Master Application router wiring all 4 portal layouts:
 *              - Citizen Portal wrapped in CitizenLayout
 *              - Worker Portal wrapped in WorkerLayout
 *              - Department Officer Portal wrapped in OfficerLayout
 *              - Super Admin Portal wrapped in AdminLayout
 *              Fully wrapped in AuthProvider and FirebaseProvider.
 * ==============================================================================
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { FirebaseProvider } from './context/FirebaseProvider';
import { getRoleSession, normalizePortalRole } from './utils/authSession';

// Portal Role Guard: Ensures a portal only renders with its own verified role session
const RequireRole = ({ allowedRole, children }) => {
  const session = getRoleSession(allowedRole);
  const resolvedRole = normalizePortalRole(session?.user?.role || session?.role);
  if (!session?.token || !session?.user || resolvedRole !== allowedRole) {
    return <Navigate to={`/login?role=${allowedRole}`} replace />;
  }
  return children;
};

// Layouts
import CitizenLayout from './layouts/CitizenLayout';
import WorkerLayout from './layouts/WorkerLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import LandingHome from './pages/LandingHome';
import LoginPage from './pages/LoginPage';
import CitizenHome from './pages/citizen/Home';
import MyComplaints from './pages/citizen/MyComplaints';
import ComplaintDetail from './pages/citizen/ComplaintDetail';
import CitizenProfile from './pages/citizen/Profile';
import CitizenHelp from './pages/citizen/Help';
import CitizenSubmit from './pages/citizen/Submit';
import WorkerManagement from './pages/admin/WorkerManagement';
import CrossDeptDashboard from './pages/admin/CrossDeptDashboard';
import ComplaintsLedger from './pages/admin/ComplaintsLedger';
import AdminReports from './pages/admin/AdminReports';
import SystemSettings from './pages/admin/SystemSettings';
import OfficerDashboard from './pages/officer/Dashboard';
import OfficerValidationQueue from './pages/officer/ValidationQueue';
import OfficerWorkerRoster from './pages/officer/WorkerRoster';
import OfficerSettings from './pages/officer/OfficerSettings';
import TaskList from './pages/worker/TaskList';
import TaskDetail from './pages/worker/TaskDetail';
import CompletedTasks from './pages/worker/CompletedTasks';
import WorkerProfile from './pages/worker/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FirebaseProvider>
          <Routes>
            {/* ================= PUBLIC AUTH ROUTES ================= */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />

            {/* ================= PUBLIC TRANSPARENCY HOME PAGE ================= */}
            <Route path="/" element={<LandingHome />} />

            {/* ================= 1. CITIZEN PORTAL ================= */}
            <Route
              path="/citizen"
              element={
                <RequireRole allowedRole="citizen">
                  <CitizenLayout>
                    <CitizenHome />
                  </CitizenLayout>
                </RequireRole>
              }
            />
            <Route
              path="/citizen/complaints"
              element={
                <RequireRole allowedRole="citizen">
                  <CitizenLayout>
                    <MyComplaints />
                  </CitizenLayout>
                </RequireRole>
              }
            />
            <Route
              path="/citizen/complaint/:id"
              element={
                <RequireRole allowedRole="citizen">
                  <CitizenLayout>
                    <ComplaintDetail />
                  </CitizenLayout>
                </RequireRole>
              }
            />
            <Route
              path="/citizen/submit"
              element={
                <RequireRole allowedRole="citizen">
                  <CitizenLayout>
                    <CitizenSubmit />
                  </CitizenLayout>
                </RequireRole>
              }
            />
            <Route
              path="/citizen/profile"
              element={
                <RequireRole allowedRole="citizen">
                  <CitizenLayout>
                    <CitizenProfile />
                  </CitizenLayout>
                </RequireRole>
              }
            />
            <Route
              path="/citizen/help"
              element={
                <RequireRole allowedRole="citizen">
                  <CitizenLayout>
                    <CitizenHelp />
                  </CitizenLayout>
                </RequireRole>
              }
            />

            {/* ================= 2. FIELD WORKER PORTAL ================= */}
            <Route path="/worker" element={<RequireRole allowedRole="worker"><TaskList /></RequireRole>} />
            <Route path="/worker/tasks" element={<RequireRole allowedRole="worker"><TaskList /></RequireRole>} />
            <Route path="/worker/task/:id" element={<RequireRole allowedRole="worker"><TaskDetail /></RequireRole>} />
            <Route path="/worker/completed" element={<RequireRole allowedRole="worker"><CompletedTasks /></RequireRole>} />
            <Route path="/worker/profile" element={<RequireRole allowedRole="worker"><WorkerProfile /></RequireRole>} />

            {/* ================= 3. DEPARTMENT OFFICER PORTAL ================= */}
            <Route
              path="/officer"
              element={
                <RequireRole allowedRole="officer">
                  <OfficerDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/officer/validation"
              element={
                <RequireRole allowedRole="officer">
                  <OfficerValidationQueue />
                </RequireRole>
              }
            />
            <Route
              path="/officer/workers"
              element={
                <RequireRole allowedRole="officer">
                  <OfficerWorkerRoster />
                </RequireRole>
              }
            />
            <Route
              path="/officer/roster"
              element={
                <RequireRole allowedRole="officer">
                  <OfficerWorkerRoster />
                </RequireRole>
              }
            />
            <Route
              path="/officer/settings"
              element={
                <RequireRole allowedRole="officer">
                  <OfficerSettings />
                </RequireRole>
              }
            />

            {/* ================= 4. SUPER ADMIN PORTAL ================= */}
            <Route
              path="/admin"
              element={
                <RequireRole allowedRole="admin">
                  <AdminLayout>
                    <CrossDeptDashboard />
                  </AdminLayout>
                </RequireRole>
              }
            />
            <Route
              path="/admin/workers"
              element={
                <RequireRole allowedRole="admin">
                  <AdminLayout>
                    <WorkerManagement />
                  </AdminLayout>
                </RequireRole>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <RequireRole allowedRole="admin">
                  <AdminLayout>
                    <ComplaintsLedger />
                  </AdminLayout>
                </RequireRole>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <RequireRole allowedRole="admin">
                  <AdminLayout>
                    <AdminReports />
                  </AdminLayout>
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RequireRole allowedRole="admin">
                  <AdminLayout>
                    <SystemSettings />
                  </AdminLayout>
                </RequireRole>
              }
            />

            {/* Portal-scoped & global fallback redirects */}
            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
            <Route path="/officer/*" element={<Navigate to="/officer" replace />} />
            <Route path="/worker/*" element={<Navigate to="/worker" replace />} />
            <Route path="*" element={<Navigate to="/citizen" replace />} />
          </Routes>
        </FirebaseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
