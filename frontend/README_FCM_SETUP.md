# JANMITRA - Firebase Cloud Messaging (FCM) Push Notifications Setup Guide
**Author:** Faizan Rayeen (Citizen Portal & Push Notifications Lead)  
**SDK Version:** Firebase SDK v10 (Modular Web API)

---

## 📁 Generated Files Overview

| File Path | Purpose |
|---|---|
| `src/firebase.js` | Firebase v10 initialization, `requestFCMPermission()`, token sync to backend, `onForegroundMessage()` |
| `public/firebase-messaging-sw.js` | Background service worker displaying system notifications when app is minimized/closed |
| `src/context/FirebaseProvider.jsx` | React context provider wrapping app, handles login auto-request, real-time toast alert, notification state |
| `src/components/NotificationBell.jsx` | Interactive Bell icon, unread counter badge, 10 recent notifications dropdown, click-to-view complaint link |
| `src/components/notifications.css` | Keyframes for pulse badge animations, slide-in toasts, and smooth dropdown animations |
| `src/App.example.jsx` | Complete working example showing `<FirebaseProvider>` and `<NotificationBell>` integration in Navbar |

---

## 🛠️ Step 1: Install Firebase v10 in React App

Run the following command in your React project root directory:

```bash
npm install firebase
```

---

## 🔑 Step 2: Obtain Firebase Configuration & VAPID Key

### 1. Web App Credentials
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (or create `janmitra-nagpur`).
3. Click the **Settings Gear (⚙️)** in the sidebar &rarr; **Project settings**.
4. In the **General** tab, scroll down to **Your apps**.
5. Click the Web icon (`</>`), give it an app nickname (e.g., `janmitra-web`), and click **Register app**.
6. Copy the values from `firebaseConfig` and replace them in both:
   - `src/firebase.js`
   - `public/firebase-messaging-sw.js`

### 2. Web Push Certificate (VAPID Key)
1. In Firebase Console, go to **Project settings** &rarr; **Cloud Messaging** tab.
2. Scroll down to the **Web configuration** card &rarr; **Web Push certificates**.
3. Click **Generate key pair**.
4. Copy the generated public key string and paste it into `VAPID_KEY` in `src/firebase.js`.

---

## 🌐 Step 3: Backend Token Endpoint Verification

When `requestFCMPermission()` runs, it sends a POST request:
- **URL:** `POST /api/v1/auth/fcm-token/`
- **Headers:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`, `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "fcm_token": "fXyZ...device_registration_token...",
    "device_type": "web",
    "browser": "Mozilla/5.0..."
  }
  ```

---

## 🔔 Step 4: Testing Push Notifications

### Test Foreground Notification:
1. Start your React app (`npm start` or `npm run dev`).
2. Login to your account & allow notification permission when prompted.
3. Keep the tab open.
4. Send a test message via Firebase Console &rarr; **Messaging** &rarr; **Create campaign** &rarr; **Firebase Notification messages**.
5. You will see the **in-app Toast notification** slide in at the top right!

### Test Background Notification:
1. Minimize your browser tab or switch to another tab.
2. Send another test notification from Firebase Console.
3. A native OS system tray notification will pop up. Clicking it opens/focuses your JANMITRA complaint page!
