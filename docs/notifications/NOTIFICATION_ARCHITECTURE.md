# JANMITRA — Notification System Architecture & Handler Specification

> **Lead Architect & Developer**: Faizan Rayeen (Citizen Portal & Push Notifications Lead)  
> **Team**: ResolveIT (B.Tech Final Year)  
> **Target Civic Body**: Nagpur Municipal Corporation (NMC)  
> **Status**: **Phase 3 Audit Finalised & Certified (100% PASS)**

---

## 1. System Architecture Overview

JANMITRA uses a **dual-channel synchronized notification model** to keep citizens, department officers, and field workers informed in real time across desktop, tablet, and mobile interfaces:

```
                               ┌──────────────────────────────────┐
                               │   Civic Event (Submit/Assign/    │
                               │        Work Done/Close)          │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ Django Backend: triggers.py      │
                               └────────┬─────────────────┬───────┘
                                        │                 │
                ┌───────────────────────┘                 └───────────────────────┐
                ▼                                                                 ▼
┌───────────────────────────────┐                                 ┌───────────────────────────────┐
│ In-App Database Channel       │                                 │ FCM Web Push Channel          │
│ (Table: notifications)        │                                 │ (notifications/tasks.py)      │
└───────────────┬───────────────┘                                 └───────────────┬───────────────┘
                │                                                                 │
                │ Polling Sync                                                    ▼
                ▼                                                 ┌───────────────────────────────┐
┌───────────────────────────────┐                                 │ Firebase Admin Cloud Gateway  │
│ NotificationBell Component    │                                 └───────────────┬───────────────┘
│ - 60s Periodic Polling        │                                                 │
│ - Unread Badge Pulse          │                                                 ▼
│ - Item Click & Mark All Read  │                                 ┌───────────────────────────────┐
└───────────────────────────────┘                                 │ Web Browser Client Environment│
                                                                  └───────┬───────────────┬───────┘
                                                                          │               │
                                           Tab Open (Foreground)          ▼               ▼  Tab Closed (Background)
                                      ┌─────────────────────────────┐           ┌─────────────────────────────┐
                                      │ Foreground Toast Manager    │           │ Service Worker Handler      │
                                      │ - In-app banner alert       │           │ (firebase-messaging-sw.js)  │
                                      │ - 'View' action navigation  │           │ - OS System Tray Popup      │
                                      │ - Auto-dismiss after 6s     │           │ - Window Focus/Deep-Link    │
                                      └─────────────────────────────┘           └─────────────────────────────┘
```

---

## 2. Notification Handlers Specification

### 2.1 Backend Lifecycle Event Handlers (`notifications/triggers.py`)

All lifecycle events pass through standard trigger functions with defensive user resolution, Celery async queueing, and automatic synchronous fallback:

| Lifecycle Trigger | Trigger Event | Target Recipient | Notification Headline & Message | Target Deep-Link |
| :--- | :--- | :--- | :--- | :--- |
| **`trigger_complaint_submitted`** | Citizen submits new grievance | Reporting Citizen (`complaint.citizen`) | **Complaint Received**: *"Your complaint #ID is being reviewed."* | `/citizen/complaint/:id` |
| **`trigger_complaint_validated`** | AI or Officer approves complaint | Reporting Citizen (`complaint.citizen`) | **Complaint Validated**: *"Your complaint has been verified and routed."* | `/citizen/complaint/:id` |
| **`trigger_task_assigned`** | Officer allocates field worker | Assigned Worker (`complaint.worker`) | **New Task Assigned**: *"You have a new complaint to handle in [ward]."* | `/worker/task/:id` |
| **`trigger_work_done`** | Worker uploads proof photo | Reporting Citizen (`complaint.citizen`) | **Issue Resolved?**: *"Please verify if the issue has been resolved."* | `/citizen/complaint/:id` |
| **`trigger_complaint_closed`** | Citizen accepts resolution | Reporting Citizen & Worker | **Complaint Closed**: *"Thank you for your report."* | `/citizen/complaint/:id` |

#### Central Dispatch Logic:
```python
def _dispatch_trigger(user_id, title, body, click_action, data, trigger_name):
    # 1. Probe broker: If Redis is online, queue Celery async task
    if _is_celery_broker_reachable():
        return send_push_notification.delay(
            user_id=str(user_id),
            title=title,
            body=body,
            data=data,
            click_action=click_action
        )
    # 2. Synchronous fallback for local dev & serverless environments
    return dispatch_push_notification(
        user_id=str(user_id),
        title=title,
        body=body,
        data=data,
        click_action=click_action
    )
```

---

### 2.2 Background Service Worker Handler (`public/firebase-messaging-sw.js`)

Handles incoming push messages when the browser is minimized, closed, or running on another tab:

- **Background Listener**: `messaging.onBackgroundMessage((payload) => { ... })`
- **Deep-Link Extraction**: Prioritizes `payload.fcmOptions.link` &bull; fallback to `click_action` &bull; fallback to `/citizen/complaint/:id`.
- **System Notification Builder**:
  ```javascript
  const notificationOptions = {
    body: notificationBody,
    icon: '/icons/janmitra-logo-192.png',
    badge: '/icons/badge-72.png',
    tag: `complaint-${complaintId}`,
    vibrate: [200, 100, 200],
    data: { url: targetUrl, complaintId: complaintId, fcmOptions: payload.fcmOptions },
    actions: [
      { action: 'view-complaint', title: 'View Details' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
  ```
- **Notification Click Navigation (`notificationclick`)**:
  - Focuses existing open JANMITRA tab via `client.focus()` and navigates via `client.navigate(destinationUrl)`.
  - If no tab is open, opens a fresh window directly to target URL via `clients.openWindow(destinationUrl)`.

---

### 2.3 Foreground Toast Alert Manager (`src/firebase.js` & `FirebaseProvider.jsx`)

When the user is actively viewing any portal page:

- **Listener Registration**: `onForegroundMessage((payload) => { ... })`
- **Reactive Alert Banner**:
  - Top-right slide-in card (`z-index: 10000`) styled with Nagpur Municipal blue gradient (`#0d2a53` &rarr; `#1a365d`).
  - Contains **Title**, **Body**, **Tracking ID**, and dismiss `&times;` button.
- **Prominent 'View' Button**:
  - Includes interactive **View &rarr;** button (`#1a56db`).
  - Clicking **View** smoothly navigates via React Router's `useNavigate` to `/citizen/complaint/:id` without page refresh.
  - Auto-dismisses after 6 seconds if not manually interacted with.

---

### 2.4 NotificationBell Unread Decrement & Synchronization (`src/components/NotificationBell.jsx`)

- **Polling Interval**: Periodic 60-second background fetch to `GET /api/v1/notifications/?all=true`.
- **Badge Counter**: Displays pulse animated red badge (`.pulse-badge`) whenever `unreadCount > 0`.
- **Single-Item Click Handler**:
  - Optimistically decrements local counter by 1:
    ```javascript
    setUnreadCount((prev) => Math.max(0, prev - 1));
    ```
  - Sends `PATCH /api/v1/notifications/mark-read/?id=:id` to update record in SQLite/Postgres.
  - Deep-links directly to complaint details.
- **Mark All Read Header Action**:
  - Resets unread count to 0:
    ```javascript
    setUnreadCount(0);
    ```
  - Sends `PATCH /api/v1/notifications/mark-read/` to mark all recipient items `is_read=True`.

---

## 3. Phase 3 Audit Results Summary

| Audit Item | Test Description | Verification Method | Result |
| :---: | :--- | :--- | :---: |
| **AUD-01** | Background push receipt when browser tab is closed | `firebase-messaging-sw.js` listener, payload link parsing, and OS tray options | ✅ **PASS** |
| **AUD-02** | Foreground toast display with 'View' button | `showForegroundToast` and `FirebaseProvider.jsx` reactive DOM and `onView` routing | ✅ **PASS** |
| **AUD-03** | Unread count badge decrement on notification read | Single item click decrements count (-1); 'Mark all read' clears count (0) | ✅ **PASS** |
| **AUD-04** | Dual-channel database audit persistence | All records saved to `Notification` table with `recipient`, `is_read`, and foreign keys | ✅ **PASS** |
| **AUD-05** | Production Frontend Build | Vite 5.4 compilation of all 924 modules | ✅ **PASS** |

---

## 4. Verification Suites

To execute the automated notification verification suites:

```bash
# 1. Run Complete Cross-Role Notification Flow Test (Submit -> Assign -> Work Done -> Close)
python c:\Users\Asus\Downloads\janmitra-backend\verify_notification_flow.py

# 2. Run Phase 3 Notification & Service Worker Audit
python c:\Users\Asus\Downloads\janmitra-backend\audit_notifications.py
```

---
*Certified by Faizan Rayeen & Team ResolveIT — Nagpur Municipal Corporation JANMITRA Initiative.*
