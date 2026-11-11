/**
 * ==============================================================================
 * JANMITRA - Example App Integration
 * File: src/App.example.jsx
 * Author: Faizan Rayeen
 * Description: Demonstrates how to wrap your root React component with
 *              <FirebaseProvider> and use <NotificationBell /> inside your Navbar.
 * ==============================================================================
 */

import React from 'react';
import { FirebaseProvider } from './context/FirebaseProvider';
import { NotificationBell } from './components/NotificationBell';

// Example Navigation Bar component
const Navbar = () => {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      backgroundColor: '#0d2a53',
      color: '#ffffff',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '0.5px' }}>
          🏛️ JANMITRA
        </span>
        <span style={{
          fontSize: '11px',
          background: '#1a56db',
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: '600'
        }}>
          Municipal Corporation
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <a href="/complaints" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>
          My Complaints
        </a>
        <a href="/report" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>
          Report Issue
        </a>

        {/* 🔔 Notification Bell mounted in Header */}
        <NotificationBell
          onComplaintClick={(id) => {
            console.log('Navigating to complaint:', id);
            window.location.href = `/complaints/${id}`;
          }}
        />

        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#1a56db',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          FR
        </div>
      </div>
    </nav>
  );
};

export default function App() {
  return (
    <FirebaseProvider
      onNotificationClick={(complaintId) => {
        window.location.href = `/complaints/${complaintId}`;
      }}
    >
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', sans-serif" }}>
        <Navbar />
        <main style={{ padding: '32px 28px', maxWidth: '1100px', margin: '0 auto' }}>
          <h1 style={{ color: '#0d2a53', marginBottom: '8px' }}>Welcome back, Faizan!</h1>
          <p style={{ color: '#64748b' }}>
            JANMITRA Civic Issue Reporting & Management System (Citizen Dashboard)
          </p>
        </main>
      </div>
    </FirebaseProvider>
  );
}
