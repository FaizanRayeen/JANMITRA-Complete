# JANMITRA — Complete Notification System Testing & Debugging Guide

> **Module Lead**: Faizan Rayeen (Citizen Portal & Notifications Lead)  
> **Team**: ResolveIT (B.Tech Final Year)  
> **Target Municipal Corporation**: Nagpur Municipal Corporation (NMC)  
> **Document Version**: v3.3.0 (Day 33)  
> **Last Updated**: October 2026  

---

## Table of Contents
1. [Architecture & Notification Pipeline](#1-architecture--notification-pipeline)
2. [Step-by-Step Notification Tests](#2-step-by-step-notification-tests)
   - [Test 1: Complaint Submitted Notification](#test-1-complaint-submitted-notification)
   - [Test 2: Complaint Validated Notification](#test-2-complaint-validated-notification)
   - [Test 3: Worker Assigned Notification](#test-3-worker-assigned-notification)
   - [Test 4: Background Notification (App Closed)](#test-4-background-notification-app-closed)
3. [Dedicated Management Commands & Diagnostic Tools](#3-dedicated-management-commands--diagnostic-tools)
4. [Common FCM Issues and Fixes](#4-common-fcm-issues-and-fixes)
   - [Issue 1: VAPID Key Missing or Invalid](#issue-1-vapid-key-missing-or-invalid)
   - [Issue 2: Service Worker Not Registered (`firebase-messaging-sw.js`)](#issue-2-service-worker-not-registered-firebase-messaging-swjs)
   - [Issue 3: Notification Permission Blocked (Browser Reset Guide)](#issue-3-notification-permission-blocked-browser-reset-guide)
   - [Issue 4: FCM Token Not Saved (`PATCH /api/v1/auth/fcm-token/`)](#issue-4-fcm-token-not-saved-patch-apiv1authfcm-token)
5. [Debugging Decision Tree](#5-debugging-decision-tree)
6. [Summary Verification Matrix](#6-summary-verification-matrix)

---

## 1. Architecture & Notification Pipeline

JANMITRA employs a resilient **dual-channel notification pipeline** synchronizing Citizens, Field Workers, Department Officers, and Municipal Administrators across all civic grievance events:

```mermaid
flowchart TD
    A[Civic Grievance Event] --> B[Django Triggers: notifications/triggers.py]
    B --> C[In-App Notification DB Record]
    B --> D[Celery Task: send_push_notification]
    D --> E[Firebase Admin SDK]
    E --> F[Google FCM Web Push Servers]
    
    C --> G[NotificationBell Component]
    G --> H[Dropdown UI & Unread Badge Counter]
    
    F --> I{Browser State?}
    I -- Tab Active / Foreground -- --> J[Firebase onMessage Listener]
    J --> K[Navy-Blue Styled Toast with 'View' Button]
    
    I -- Tab Closed / Minimized -- --> L[public/firebase-messaging-sw.js]
    L --> M[OS Native System Tray Banner with Logo & Badge]
    M --> N[Click Action: Focus / Navigate to Complaint URL]
```

### Notification Delivery Modes
1. **Foreground Delivery (App Open)**: Intercepted by `onMessage()` in [`src/firebase.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/src/firebase.js); renders a custom in-app toast with sound/vibration and navigation deep-link without generating intrusive system tray duplicates.
2. **Background Delivery (App Closed / Minimized)**: Intercepted by `messaging.onBackgroundMessage()` in [`public/firebase-messaging-sw.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/public/firebase-messaging-sw.js); displays an OS desktop banner with Nagpur Municipal Corporation branding, action buttons, and click handlers.
3. **In-App Persistent History**: Stored in SQLite/PostgreSQL `notifications_notification` table, accessible via `/api/v1/notifications/` and managed by the [`NotificationBell`](file:///c:/Users/Asus/Downloads/janmitra-frontend/src/components/common/NotificationBell.jsx) component.

---

## 2. Step-by-Step Notification Tests

### Test 1: Complaint Submitted Notification

* **Objective**: Confirm that when a Citizen files a civic complaint, they receive instant confirmation both as an in-browser alert and inside their notification bell.
* **Target Audience**: Citizen (`/citizen`).
* **Trigger Mechanism**: `POST /api/v1/complaints/` &rarr; `trigger_complaint_submitted(complaint)`.

#### Test Procedure:
1. Log in as a **Citizen** (e.g., `9900002001` / `citizen@123` via `/login`).
2. Navigate to **Report New Issue** (`/citizen/submit`).
3. Fill out the complaint form:
   - **Category**: *Roads & Infrastructure (PWD)*
   - **Ward**: *Ward 2 - Sitabuldi / Dharampeth*
   - **Title/Description**: *"Large deep pothole near Great Nag Road junction posing accident hazard."*
   - **Coordinates**: Lat: `21.1458`, Lng: `79.0882` (or click *Detect Location*).
4. Click **Submit Complaint**.

#### Expected Verification:
* **Foreground Toast Alert**:
  - Displays at the top-right of the screen within 1.5 seconds.
  - **Badge/Header**: `JANMITRA Civic Alert`
  - **Title**: `Complaint Received: NMC-2026-XXXX`
  - **Body**: `Your civic complaint has been submitted and queued for triage.`
  - **Action Button**: `View →` (routes to `/citizen/complaint/:id`).
* **Notification Bell**:
  - Red counter badge in navbar increments by `+1`.
  - Opening the bell shows the new complaint submission item with timestamp and blue "Unread" indicator dot.
* **Database Check**:
  ```bash
  python manage.py shell -c "from notifications.models import Notification; print(Notification.objects.latest('created_at').title)"
  # Output: Complaint Received: NMC-2026-XXXX
  ```

---

### Test 2: Complaint Validated Notification

* **Objective**: Verify that when AI validation passes or a Department Officer approves a complaint, the citizen receives a status update notification.
* **Target Audience**: Citizen who filed the complaint.
* **Trigger Mechanism**: `PATCH /api/v1/complaints/:id/` (status `VALIDATED`) &rarr; `trigger_complaint_validated(complaint)`.

#### Test Procedure:
1. Log in as a **Department Officer** (e.g., PWD Officer `9900000001` / `officer@123` via `/login`).
2. Navigate to **Pending Human Validation** (`/officer/validation`) or the Department Complaint List.
3. Select the complaint submitted in Test 1.
4. Click **Validate / Approve Issue** (or execute API `PATCH /api/v1/complaints/:id/` with `{"status": "VALIDATED"}`).

#### Expected Verification:
* **Citizen's Active Window**:
  - The citizen's browser displays a validation alert toast:
    - **Title**: `Complaint Validated: NMC-2026-XXXX`
    - **Body**: `Your issue has been verified by PWD and forwarded to the field team.`
  - The in-app Notification Bell shows the item with an amber/blue verification badge.
* **Backend Verification**:
  ```bash
  python manage.py shell -c "from notifications.models import Notification; n = Notification.objects.filter(title__contains='Validated').latest('created_at'); print(n.recipient.username, n.title)"
  # Output: 9900002001 Complaint Validated: NMC-2026-XXXX
  ```

---

### Test 3: Worker Assigned Notification

* **Objective**: Verify that when a Department Officer assigns a field worker, that specific worker receives a push notification on their device/browser.
* **Target Audience**: Field Worker assigned to the task (`/worker`).
* **Trigger Mechanism**: `POST /api/v1/tasks/assign/` or Officer UI assignment &rarr; `trigger_task_assigned(complaint, worker_user)`.

#### Test Procedure:
1. Ensure the assigned Field Worker (e.g., `9900001101` / `worker@123`) is logged in on Browser Window A (`/worker`).
2. On Browser Window B, log in as the **Department Officer** (`/officer`).
3. Select the validated complaint and assign it to Field Worker `9900001101` (NMC-PWD-W1).
4. Click **Confirm Assignment**.

#### Expected Verification:
* **Worker's Browser Window**:
  - An audible alert sounds, and a high-priority toast banner pops up:
    - **Title**: `New Task Assigned: NMC-2026-XXXX`
    - **Body**: `You have been allocated a repair task in Ward 2. Please inspect site.`
    - **Action**: Clicking **View** routes directly to the worker task dashboard (`/worker`).
* **Worker Dashboard UI**:
  - The worker's active task list increments, and the task status transitions from *Unassigned* to *Pending Field Inspection*.
* **Backend Verification**:
  ```bash
  python manage.py shell -c "from notifications.models import Notification; n = Notification.objects.filter(recipient__username='9900001101').latest('created_at'); print(n.recipient.username, n.title)"
  # Output: 9900001101 New Task Assigned: NMC-2026-XXXX
  ```

---

### Test 4: Background Notification (App Closed)

* **Objective**: Confirm that Web Push notifications wake up the OS system tray when JANMITRA is **not active**, minimized, or completely closed.
* **Target Audience**: Any registered user (Citizen, Officer, Worker).
* **Trigger Mechanism**: `messaging.onBackgroundMessage` in [`public/firebase-messaging-sw.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/public/firebase-messaging-sw.js).

#### Test Procedure:
1. Open JANMITRA in Google Chrome or Microsoft Edge (`http://localhost:5173` or your HTTPS staging domain).
2. Log in and confirm notification permission is set to **Allow** (the green bell is active).
3. **Close all JANMITRA browser tabs** (or minimize the browser completely and navigate to an unrelated website like `google.com`).
4. Dispatch a background notification using the backend management command:
   ```bash
   python manage.py send_test_notification \
     --user-id=9900002001 \
     --title="Urgent Civic Alert: Water Pipeline Repair" \
     --body="Excavation in progress on Ward 2 Main Road. Expect minor traffic diversions." \
     --complaint-id="NMC-2026-TEST"
   ```

#### Expected Verification:
* **OS Desktop System Tray**:
  - Within 2-3 seconds, a native system banner slides into view (Windows Action Center bottom-right, or macOS Notification Center top-right).
  - **Branding**: Displays the NMC logo icon (`/icons/janmitra-logo-192.png`) and the high-contrast badge (`/icons/badge-72.png`).
  - **Action Buttons**: Displays `View Details` and `Dismiss`.
* **Click Interaction**:
  - Clicking `View Details` or the notification banner body:
    1. Wakes and brings the browser window to the foreground.
    2. Deep-links directly to `/citizen/complaint/NMC-2026-TEST`.
    3. Dismisses the OS notification banner.

---

## 3. Dedicated Management Commands & Diagnostic Tools

JANMITRA includes automated CLI tools to test notification dispatch without requiring manual database alterations:

### CLI Command Options
```bash
# 1. Send test push by Mobile Number / Username
python manage.py send_test_notification --user-id=9900002001

# 2. Send custom push notification with deep-linked complaint
python manage.py send_test_notification \
  --user-id=9900002001 \
  --title="Garbage Cleared in Ward 3" \
  --body="Field team SWM-02 has cleared the waste pile. Please inspect." \
  --complaint-id="NMC-2026-088"

# 3. Dry-run mode (verifies database token and Firebase Admin SDK credentials without dispatching)
python manage.py send_test_notification --user-id=9900002001 --dry-run
```

### Diagnostic CLI Output Sample:
```text
======================================================================
  JANMITRA - FCM Push Notification Diagnostic Dispatcher
======================================================================
Target User ID       : 9900002001
Username / Mobile    : 9900002001
FCM Token Status     : [REGISTERED] (eXxZ89qa...190aaKz)
Device Type          : web (Chrome 122)

Initializing Firebase Admin SDK...
[+] Firebase Admin SDK is READY and connected.

Dispatch Metadata:
  Title              : Urgent Civic Alert: Water Pipeline Repair
  Body               : Excavation in progress on Ward 2 Main Road.
  Linked Complaint   : NMC-2026-TEST

Sending FCM Push Notification...
[+] In-app notification record created (ID: 7a82...3ef).
----------------------------------------------------------------------
[SUCCESS] Test push notification delivered to user 9900002001!
----------------------------------------------------------------------
```

---

## 4. Common FCM Issues and Fixes

### Issue 1: VAPID Key Missing or Invalid

#### Symptom:
Console error: `messaging/invalid-vapid-key` or `FirebaseError: getToken failed: Missing required VAPID key`.

#### Root Cause:
Web Push requires an Elliptic Curve P-256 (VAPID) key pair to cryptographically prove frontend sender identity to Google's FCM servers.

#### Fix:
1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`janmitra-nagpur`).
2. Navigate to **Project Settings (⚙️)** &rarr; **Cloud Messaging** tab.
3. Scroll to **Web configuration** &rarr; **Web Push certificates**.
4. If no key pair exists, click **Generate key pair**.
5. Copy the public key string (e.g., `BEl5...`) and configure it in your frontend environment:
   - In [`janmitra-frontend/src/firebase.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/src/firebase.js):
     ```javascript
     export const VAPID_KEY = "BEl5...YOUR_VAPID_PUBLIC_KEY_HERE...";
     ```
   - In `.env`:
     ```env
     VITE_FIREBASE_VAPID_KEY=BEl5...YOUR_VAPID_PUBLIC_KEY_HERE...
     ```

---

### Issue 2: Service Worker Not Registered (`firebase-messaging-sw.js`)

#### Symptom:
Console warning: `Failed to register a ServiceWorker for scope...` or background notifications do not arrive when tabs are closed.

#### Root Causes & Diagnostics:
1. **Wrong File Directory**: Service Workers must reside in the web root (`public/firebase-messaging-sw.js`), so they are served at `http://domain/firebase-messaging-sw.js`. If placed inside `src/`, Vite does not expose it at the root scope.
2. **Insecure Origin (Non-HTTPS)**: Modern browsers block Service Workers on non-HTTPS origins, except for `localhost` and `127.0.0.1`.
3. **Stale / Broken Cache**: Old service worker stuck in `waiting` state.

#### Fix:
1. **Check File Placement**:
   ```
   janmitra-frontend/
   ├── public/
   │   ├── firebase-messaging-sw.js   <-- MUST BE AT ROOT SCOPE
   │   └── icons/
   │       ├── janmitra-logo-192.png  <-- Pre-cached icon asset
   │       └── badge-72.png           <-- Pre-cached badge asset
   ```
2. **Verify in Chrome DevTools**:
   - Press `F12` &rarr; Go to the **Application** tab &rarr; Click **Service Workers** in the left sidebar.
   - Look for `/firebase-messaging-sw.js`.
   - The status must show **Activated and is running** with a green circle.
   - If an old worker is stuck, click **Unregister** and refresh the page.
3. **Bypass for Local Network IP Testing**:
   If testing on a physical mobile device over a local Wi-Fi IP (e.g., `http://192.168.1.15:5173`), open Chrome on the device and navigate to:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
   Add `http://192.168.1.15:5173` to the list and relaunch Chrome.

---

### Issue 3: Notification Permission Blocked (Browser Reset Guide)

#### Symptom:
`Notification.permission` returns `'denied'`. The browser suppresses all native permission prompt dialogs permanently.

#### In-App User Experience:
JANMITRA automatically detects this state and displays a **Gentle In-App Prompt Banner**:
> *"⚠️ Notifications Are Blocked: Click the lock icon (🔒) in your address bar → Set Notifications to Allow → Refresh."*

#### Browser Reset Step-by-Step:

##### 1. Google Chrome & Microsoft Edge (Desktop)
1. Click the **Padlock / Site Info icon (🔒)** or **View site information icon** on the left side of the address bar.
2. Locate **Notifications** in the permission list.
3. Toggle the dropdown from **Block** to **Allow** (or click **Reset permissions**).
4. Click **Reload** (`Ctrl + R` / `F5`) to re-initialize notification registration.

##### 2. Mozilla Firefox (Desktop)
1. Click the **Permissions Speech Bubble / Lock icon** to the left of the URL.
2. Next to *Send Notifications*, click the **Cross (✕)** icon next to *Blocked*.
3. Refresh the page; when JANMITRA loads, click **Allow** on the native prompt.

##### 3. Brave Browser
1. Click the **Brave Shields icon (🦁)** or the **Site Settings icon (🔒)** in the URL bar.
2. Toggle Notifications to **Allow**.

##### 4. Mobile Chrome (Android)
1. Tap the **Lock icon (🔒)** to the left of `http://...` in Chrome's mobile URL bar.
2. Tap **Permissions** &rarr; Tap **Notifications**.
3. Toggle to **Allow**.

---

### Issue 4: FCM Token Not Saved (`PATCH /api/v1/auth/fcm-token/`)

#### Symptom:
Push notifications fail with the error: `No FCM token found for user` or `Recipient has no device registered`. In the database, `user.fcm_token` is `NULL`.

#### Root Causes:
1. Token generated on the frontend was never synchronized to the backend database.
2. Authorization header was missing or JWT token expired.
3. Endpoint rejected HTTP method (e.g., frontend sent `PATCH` while backend only allowed `POST`).

#### Backend Implementation & Supported Endpoints:
JANMITRA's [`notifications/views.py`](file:///c:/Users/Asus/Downloads/janmitra-backend/notifications/views.py) supports both `POST` and `PATCH` methods on `/api/v1/auth/fcm-token/`.

#### API Specification:
* **Endpoint**: `PATCH /api/v1/auth/fcm-token/` (or `POST /api/v1/auth/fcm-token/`)
* **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <jwt_access_token>
  ```
* **Payload**:
  ```json
  {
    "fcm_token": "eXxZ89qa...your_device_token...190aaKz",
    "device_type": "web"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "message": "FCM token registered successfully.",
    "device_type": "web",
    "user_id": "9900002001",
    "fcm_token": "eXxZ89qa..."
  }
  ```

#### cURL Verification Commands:

```bash
# 1. Test token update with JWT authentication
curl -X PATCH http://localhost:8000/api/v1/auth/fcm-token/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"fcm_token": "eXxZ89qa_test_token_123", "device_type": "web"}'

# 2. Test token update by mobile number (for demo/development)
curl -X POST http://localhost:8000/api/v1/auth/fcm-token/ \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9900002001", "fcm_token": "eXxZ89qa_test_token_123", "device_type": "web"}'
```

#### Frontend Auto-Retry & Simulation Mode:
If offline or running without internet during local evaluation, [`src/firebase.js`](file:///c:/Users/Asus/Downloads/janmitra-frontend/src/firebase.js) automatically caches a fallback development token (`fcm_dev_token_...`), ensuring user workflows and complaint reporting never crash.

---

## 5. Debugging Decision Tree

Use this diagnostic flow when a notification does not appear:

```mermaid
graph TD
    A[Notification Not Received] --> B{Is User Logged In?}
    B -- No -- --> C[Log in user and verify JWT in localStorage]
    B -- Yes -- --> D{Notification.permission?}
    
    D -- denied -- --> E[Follow Issue 3: Browser Reset Guide]
    D -- default -- --> F[Click Bell Icon or Request Permission Banner]
    D -- granted -- --> G{Is FCM Token in Backend DB?}
    
    G -- No -- --> H[Follow Issue 4: Check PATCH /api/v1/auth/fcm-token/]
    G -- Yes -- --> I{Is Browser Tab Active?}
    
    I -- Active / Foreground -- --> J{Toast Visible?}
    J -- No -- --> K[Check Console for Firebase onMessage errors]
    J -- Yes -- --> L[Check NotificationBell dropdown and unread counter]
    
    I -- Closed / Minimized -- --> M{Is Service Worker Active?}
    M -- No -- --> N[Follow Issue 2: Check DevTools Application -> Service Workers]
    M -- Yes -- --> O{OS Focus Assist / Do Not Disturb on?}
    O -- Yes -- --> P[Turn off Windows Focus Assist or macOS Do Not Disturb]
    O -- No -- --> Q[Check manage.py send_test_notification CLI output]
```

---

## 6. Summary Verification Matrix

| Test Case / Verification Item | Target File / Component | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **Test 1: Complaint Submitted** | `notifications/triggers.py` | Citizen files issue &rarr; Toast + Bell increment | ✅ Verified |
| **Test 2: Complaint Validated** | `officer/validation` | Officer validates &rarr; Citizen receives status toast | ✅ Verified |
| **Test 3: Worker Assigned** | `worker/TaskDashboard` | Officer assigns &rarr; Worker gets alert + task card | ✅ Verified |
| **Test 4: Background Notification** | `public/firebase-messaging-sw.js` | Tab closed &rarr; OS native banner + deep-link click | ✅ Verified |
| **VAPID Key Verification** | `src/firebase.js` | VAPID key configured without `invalid-vapid-key` | ✅ Verified |
| **Service Worker Registration** | `public/firebase-messaging-sw.js` | DevTools: *Activated and is running* (Green) | ✅ Verified |
| **Blocked Permission Reset** | `src/firebase.js` | Gentle in-app prompt banner displayed | ✅ Verified |
| **FCM Token Sync Endpoint** | `notifications/views.py` | `POST` & `PATCH /api/v1/auth/fcm-token/` (200 OK) | ✅ Verified |
| **Offline Background Sync** | `firebase-messaging-sw.js` | IndexedDB `pending_notifications` queue replay | ✅ Verified |
| **Zero-Reload SW Update** | `firebase-messaging-sw.js` | `skipWaiting` + `clients.claim` broadcast | ✅ Verified |
