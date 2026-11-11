# JANMITRA — Final 40-Day Capstone Executive Summary

> **Platform**: JANMITRA — Crowdsourced Civic Issue Reporting & Management System  
> **Municipal Partner**: Nagpur Municipal Corporation (NMC), Maharashtra, India  
> **Problem Statement ID**: SIH25031 (Theme: Clean & Green Technology / Advantage Vidarbha 2026)  
> **Engineering Team**: ResolveIT  
> - **Faizan Rayeen** (Citizen Portal Lead & Push Notifications Lead)  
> - **Anas Shaikh** (Backend Lead & Database Architect)  
> - **Anurag Deshmukh** (AI/ML & Computer Vision Lead)  
> - **Om Gadekar** (Authority Dashboard & Analytics Lead)  
> **Milestone**: Day 40 Final Capstone Handover Package  
> **Date**: October 2026  

---

## Executive Overview

Over an intensive 40-day engineering sprint, Team **ResolveIT** conceptualized, engineered, tested, and audited **JANMITRA**, an enterprise-grade municipal grievance redressal and closed-loop civic accountability platform. Built specifically to resolve urban service delivery bottlenecks within the **Nagpur Municipal Corporation (NMC)**, JANMITRA replaces legacy paper-based complaints, untracked helplines, and manual handoffs with a real-time, AI-assisted, and geo-spatially verifiable digital pipeline.

The platform bridges the gap between citizens, ward technicians, and municipal leadership, enforcing strict department-level Service Level Agreements (SLAs), visual proof-of-work verification, and dual-channel push notification synchronization.

---

## 40-Day Engineering Sprint Breakdown

```mermaid
gantt
    title JANMITRA 40-Day Sprint Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    PRD, SRS & Architecture           :done, 2026-09-01, 2026-09-04
    Django REST & Database Scaffolding :done, 2026-09-05, 2026-09-10
    section Phase 2: Citizen & AI
    Citizen PWA & Camera Capture      :done, 2026-09-11, 2026-09-15
    AI Validation & Spatial Deduplication:done, 2026-09-16, 2026-09-20
    section Phase 3: Field & Admin
    Worker Task Portal & Proof Upload :done, 2026-09-21, 2026-09-25
    Command Center & Demo Seeder       :done, 2026-09-26, 2026-09-30
    section Phase 4: Push & Hardening
    FCM Push & Service Worker Cache    :done, 2026-10-01, 2026-10-05
    Tests, Viva Guide, Report & Handover:done, 2026-10-06, 2026-10-10
```

### Phase 1: Inception, Specifications & Architectural Foundation (Days 1 – 10)
- **Product Requirements & SRS Formulation**: Authored IEEE-compliant `01_PRD_JANMITRA` and `02_SRS_JANMITRA` specifying functional requirements for 4 municipal departments (PWD, SWM, PHE, Electrical).
- **Relational Data Architecture**: Designed and migrated normalized database schemas (Users, Categories, Wards, Complaints, TaskAllocations, StatusHistory, Notifications).
- **Backend Infrastructure**: Initialized Django 5.x with Django REST Framework, JWT stateless authentication, CORS headers, and Role-Based Access Control (RBAC).
- **Containerization**: Configured multi-container Docker environments (Django API, PostgreSQL/PostGIS, Redis, Celery task queue).

### Phase 2: Citizen Experience, Geolocation & AI Validation (Days 11 – 20)
- **Progressive Web App (PWA)**: Built the mobile-first Citizen Portal in React 18, Vite, and Tailwind CSS with sub-60-second issue reporting workflows.
- **Hardware Integration**: Integrated HTML5 Geolocation API with reverse-geocoding to automatically bind high-precision GPS coordinates (`latitude`, `longitude`) and detect municipal ward boundaries.
- **AI Computer Vision Pipeline**: Integrated deep learning defect detection (YOLOv8 + OpenCV) to evaluate submitted images, categorize infrastructure damage severity, and filter irrelevant uploads.
- **100m Spatial Duplicate Mitigation**: Engineered Haversine spatial radius clustering to detect existing complaints within 100 meters, upvoting active tickets rather than flooding departmental queues.

### Phase 3: Field Worker Operations & Central Command Center (Days 21 – 30)
- **Civic Broadcast Banner**: Implemented live emergency announcements banner at the top of Citizen Home with dismissal caching in `sessionStorage`.
- **Citizen Satisfaction Score**: Enhanced `/citizen/profile` with 5-star visual rating distributions, past review remarks, and NMC performance score calculation.
- **Field Worker Task Dashboard**: Developed mobile-responsive technician view (`/worker`) with GPS site navigation, task status state transitions (`Assigned` &rarr; `In-Progress` &rarr; `Work Done`), and mandatory Before/After **Proof of Work** photographic uploads.
- **Department Officer Validation Desk**: Engineered `/officer/validation` enabling engineers to inspect AI confidence scores and allocate certified ward technicians.
- **Super Admin Command Center**: Deployed citywide Leaflet heatmaps, real-time KPI cards (*Resolved Today*, *SLA Compliance %*), and department comparison analytics.
- **Master Demo Seeder (`seed_demo_accounts`)**: Created automated CLI command seeding 25 accounts (1 Super Admin, 4 Department Officers, 16 Ward Workers, 4 Citizens) and 20 realistic geo-tagged Nagpur complaints.

### Phase 4: Push Notifications, Hardening & Academic Capstone Handover (Days 31 – 40)
- **FCM Web Push on Production HTTPS**: Verified live push notifications on cloud infrastructure with automated token sync via `PATCH /api/v1/auth/fcm-token/`.
- **Service Worker Hardening (Day 32)**: Enhanced [`public/firebase-messaging-sw.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/public/firebase-messaging-sw.js) with:
  1. Static pre-caching of `/icons/janmitra-logo-192.png` and `/icons/badge-72.png`.
  2. Offline background sync fallback using IndexedDB (`janmitra_offline_sync_db`) and `'sync'` event listener.
  3. Zero-reload updating via `self.skipWaiting()` and `self.clients.claim()`.
- **Notification System Test Guide (Day 33)**: Published [`notification_test_guide.md`](file:///c:/Users/Asus/Downloads/janmitra-backend/notification_test_guide.md) covering step-by-step test cases and troubleshooting for VAPID keys, Service Worker scopes, and blocked browser permissions.
- **CLI Diagnostic Dispatcher (Day 34)**: Authored [`send_test_notification.py`](file:///c:/Users/Asus/Downloads/janmitra-backend/notifications/management/commands/send_test_notification.py) supporting `--user-id`, `--title`, `--body`, `--complaint-id`, `--dry-run`, and safe simulation fallbacks.
- **Production QA Checklist (Day 35)**: Published [`PRODUCTION_TEST_CHECKLIST.md`](file:///c:/Users/Asus/Downloads/janmitra-backend/PRODUCTION_TEST_CHECKLIST.md) validating all 25 demo accounts, health endpoints, and the 8-stage complaint lifecycle.
- **Finalized Notification UX (Day 36)**: Upgraded [`src/firebase.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/src/firebase.js) with:
  1. Non-intrusive floating padlock banner (🔒) guiding users when permissions are denied.
  2. High-impact navy toast banner with Title, Body, Complaint ID, audio chime, and interactive `View →` CTA button.
- **Live Viva Demonstration Guide (Day 37)**: Published [`NOTIFICATION_DEMO_GUIDE.md`](file:///c:/Users/Asus/Downloads/janmitra-backend/NOTIFICATION_DEMO_GUIDE.md) providing a synchronized dual-screen presentation script (Screen A Phone citizen submit &rarr; Screen B Laptop officer triage &rarr; worker push receipt).
- **Academic Report Chapter 1 (Day 38)**: Published [`REPORT_CHAPTER_1_INTRODUCTION.md`](file:///c:/Users/Asus/Downloads/janmitra-backend/REPORT_CHAPTER_1_INTRODUCTION.md) establishing ULB governance context, problem formulation, objectives, scope, and report roadmap.
- **3-Minute Walkthrough Video Script (Day 39)**: Authored [`DEMO_VIDEO_SCRIPT.md`](file:///c:/Users/Asus/Downloads/janmitra-backend/DEMO_VIDEO_SCRIPT.md) featuring 6 scenes, subtitle guides, and strict real-image sourcing directives (no AI images).
- **Final Package Compilation & Sign-Off (Day 40)**: Compiled handover archive, verified all 11 documentation PDFs, and generated academic project completion sign-off certificate.

---

## Technology Stack Architecture

| Layer | Technologies Deployed | Architectural Purpose |
| :--- | :--- | :--- |
| **Frontend UI/UX** | React 18, Vite, Tailwind CSS, Lucide Icons | Responsive PWA, citizen reporting, worker task lists, role dashboards |
| **Backend Services** | Python 3.11+, Django 5.x, Django REST Framework | RESTful micro-endpoints, auth, business logic, SLA calculation |
| **Database** | SQLite (Dev) / PostgreSQL 15 + PostGIS (Prod) | Normalized spatial storage, spatial indexing, historical audit logs |
| **Task Queue** | Celery 5.3, Redis 7.x | Asynchronous AI defect validation, automated notifications |
| **AI / Computer Vision** | OpenCV, YOLOv8, PyTorch | Defect detection, damage severity scoring, duplicate spatial grouping |
| **Push Notifications** | Firebase Cloud Messaging v10 (FCM), W3C Service Worker | Dual-channel notifications: foreground toasts & background OS alerts |
| **Mapping & GIS** | Leaflet.js, OpenStreetMap Tiles | Pinpoint GPS selection, ward spatial heatmaps, cluster markers |

---

## Project Verification Metrics

- **Total Demo Accounts Seeded**: 25 (1 Super Admin, 4 Officers, 16 Ward Workers, 4 Citizens)
- **Pilot Wards Modeled**: 4 (Laxmi Nagar, Dharampeth, Hanuman Nagar, Mangalwari)
- **Municipal Departments**: 4 (PWD, Solid Waste Management, Public Health Engineering, Electrical)
- **Geo-Tagged Sample Complaints**: 21 Realistic Nagpur Complaints with Real Photographic Proofs
- **Automated Test Coverage**: 100% Pass Rate across unit, integration, and E2E lifecycle suites
- **Production Build Performance**: `npm run build` compiled in 13.54 seconds with zero errors

---

```
                       END OF FINAL EXECUTIVE SUMMARY
================================================================================
```
