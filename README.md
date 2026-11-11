# JANMITRA — Civic Grievance Redressal & AI Verification Ecosystem

**JANMITRA** is an end-to-end civic issue reporting, AI verification, dispatch, and accountability platform featuring **4 isolated role portals** powered by a Django REST backend, YOLOv8s + Vision Transformer AI validation pipeline, interactive Leaflet GIS maps, and React + Vite frontend.

---

## Core Architecture & Features

### 1. Four Role-Isolated Portals (`frontend/src/pages/`)
- **Citizen Portal (`/citizen`)**: GPS + Leaflet doorstep map pinpointing, search autocomplete, 4-department reporting (`PWD`, `SWM`, `PHE`, `Electrical`), camera photo upload, AI feedback, live timeline tracking (`Submitted -> Validated -> Assigned -> In-Progress -> Work Done -> Closed`), Citizen accept/reject verification with star rating, and Profile management.
- **Field Worker Portal (`/worker`)**: Queue filtered by Worker Department & Ward plus Cross-Ward emergency assignments, task acceptance, Leaflet route map navigation, camera proof-of-work photo capture (up to 2 photos), completed task archive, and persistent `Active On-Duty` / `On Leave` status toggle synced across portals.
- **Department Officer Portal (`/officer`)**: Strictly isolated per department (`PWD`, `SWM`, `PHE`, `Electrical`) with validation queue, priority-sorted ledger, Cross-Ward/Intra-Ward worker assignment, live Ward breakdown & 7-day trend analytics, workforce roster, and notifications.
- **Super Admin Portal (`/admin`)**: Cross-department command center, multi-department live GIS & 4x4 Ward x Department thermal heatmap, city-wide complaints ledger with overrides, full worker CRUD management, SLA scorecard reports, system SLA thresholds, and public civic broadcast controls.

### 2. 4-Stage AI Verification & Scoring Pipeline (`backend/ai_pipeline/`)
1. **Image Forensics & Anti-Spoofing**:
   - **EXIF Checker** (`exif_checker.py`) — hardware/camera metadata inspection.
   - **ELA Checker** (`ela_checker.py`) — Error Level Analysis for tampered/edited images.
   - **ViT Fake Detector** (`fake_detector.py`) — Vision Transformer AI-generated image detection.
2. **YOLOv8s Civic Defect Detection** (`yolo_validator.py`):
   - Pre-trained weights (`backend/ai_pipeline/weights/janmitra_civic_yolov8s.pt` and `.onnx`).
   - Detects civic defects and matches submission category.
3. **100m Geospatial Duplicate Detection** (`duplicate_detector.py`):
   - Haversine distance check (`<= 100m`) across active statuses including `Pending Validation`, incrementing `duplicate_count` and boosting priority.
4. **Dynamic AHP Priority & SLA Engine** (`priority_engine.py`):
   - Computes severity score (`Critical`, `High`, `Medium`, `Low`) and resolves SLA hours synced with `admin_system_settings.json`.

### 3. Security, RBAC & Real-Time Notifications
- HS256 JWT authentication + `/api/v1/auth/token/refresh/` and PBKDF2 password verification (`notifications/auth_views.py`).
- Role-isolated session storage (`frontend/src/utils/authSession.js`) allowing concurrent Citizen/Worker/Officer/Admin sessions without cross-role leakage.
- Strict endpoint ownership/role enforcement across Citizen, Worker, Officer, and Admin APIs (`complaints/views.py`, `complaints/officer_views.py`, `dashboard/views.py`), blocked `/media/*.json` direct web access (`config/urls.py`), and database-backed notifications + optional Firebase Cloud Messaging (FCM).

---

## Repository Directory Structure

```text
JANMITRA-Complete/
├── backend/
│   ├── accounts/               # Setup & demo seed management commands
│   ├── ai_pipeline/            # 4-stage AI pipeline, weights (.pt/.onnx), geospatial data & docs
│   ├── complaints/             # Models, migrations, Citizen/Worker/Officer APIs & audit test suite
│   ├── config/                 # Django settings, root URLs, WSGI/ASGI, Firebase JSON template
│   ├── dashboard/              # Admin & Officer analytics, worker CRUD, SLA & broadcast APIs
│   ├── notifications/          # JWT auth, profiles, notifications CRUD & FCM dispatch tasks
│   ├── media/                  # Local uploaded evidence root (.gitkeep tracked; uploads gitignored)
│   ├── .env.example            # Safe backend environment template
│   ├── manage.py
│   └── requirements.txt        # Full Python dependency manifest
├── frontend/
│   ├── public/                 # Branding seals, civic assets, icons & FCM Service Worker
│   ├── src/
│   │   ├── api/                # Axios client with JWT auto-refresh
│   │   ├── components/         # Shared UI badges, maps, NotificationBell, BroadcastBanner, WorkerLayout
│   │   ├── context/            # AuthContext & FirebaseProvider
│   │   ├── layouts/            # Layout, CitizenLayout, OfficerLayout, AdminLayout
│   │   ├── pages/              # LandingHome, LoginPage, citizen/, worker/, officer/, admin/
│   │   ├── utils/              # authSession, offlineStorage, mediaUrl, mapIcons, etc.
│   │   ├── App.jsx
│   │   └── firebase.js
│   ├── .env.example            # Safe frontend environment template
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── algorithm/              # Algorithm design report (Markdown, PDF & generator script)
│   ├── notifications/          # Notification architecture, integration & audit docs
│   ├── reports/                # Engineering reports, viva guides & production checklists
│   └── specs/                  # PRD, SRS, UI/UX, Architecture & Tech Stack PDFs
├── screenshots/                # Desktop & mobile UI screenshots
├── .gitignore
└── README.md
```

---

## Quickstart: Clone & Run Locally

### Prerequisites
- **Python** `3.11+`
- **Node.js** `18+` & **npm**

### 1. Clone the Repository
```bash
git clone https://github.com/FaizanRayeen/JANMITRA-Complete.git
cd JANMITRA-Complete
```
*(Model weights in `backend/ai_pipeline/weights/` are ~21.5 MB each and are included directly via standard Git — no separate `git-lfs` download needed.)*

### 2. Backend Setup (Django + AI Pipeline)
```bash
cd backend
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

# Copy environment template (optional for local dev defaults)
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Apply database schemas & bootstrap Wards, 4 Departments, Admin, Officers, and 32 Workers
python manage.py migrate
python manage.py setup_janmitra

# Verify configuration
python manage.py check

# Start backend server on port 8000
python manage.py runserver 0.0.0.0:8000
```

> **Optional Firebase Push Notifications:** Copy `backend/config/firebase-service-account.example.json` to `backend/config/firebase-service-account.json` and fill in your Firebase Admin SDK credentials, and update `frontend/.env` from `frontend/.env.example`.

### 3. Frontend Setup (React + Vite)
Open a new terminal from the repository root:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Portal URLs & Verified Credentials

Once both servers are running:

- **Public Home:** http://localhost:5173/
- **Citizen Sign In / Register:** http://localhost:5173/login?role=citizen
- **Field Worker Sign In:** http://localhost:5173/login?role=worker
- **Department Officer Sign In (Direct URL):** http://localhost:5173/login?role=officer
- **Super Admin Sign In (Direct URL):** http://localhost:5173/login?role=admin
- **Backend API Root Health:** http://localhost:8000/
- **Django Admin:** http://localhost:8000/admin/

| Portal / Role | Mobile Number | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `9900000000` | `Admin@123` | Cross-department command center & settings |
| **PWD Officer** | `9900000001` | `Officer@123` | Roads & Infrastructure (Wards 1–4) |
| **SWM Officer** | `9900000002` | `Officer@123` | Solid Waste Management (Wards 1–4) |
| **PHE Officer** | `9900000003` | `Officer@123` | Public Health Engineering (Wards 1–4) |
| **Electrical Officer** | `9900000004` | `Officer@123` | Electrical & Street Lighting (Wards 1–4) |
| **32 Field Workers** | `9800{ward}{dept}0001`..`2` (e.g. `9800410001`) | `worker123` | Ward `1..4`, Dept `1..4` (`notifications/auth_views.py`) |
| **Citizens** | Self-register at `/login?role=citizen&tab=register` | User-chosen | Own submitted complaints & verification |

---

## Automated Verification & Testing

From `backend/`:
```bash
# Run Django check & full security/RBAC/cross-portal lifecycle suite
python manage.py check
python manage.py test complaints.tests_full_audit -v 2

# Run AI pipeline smoke check
cd ai_pipeline
python test_ai_pipeline.py
```

From `frontend/`:
```bash
npm run build
```
