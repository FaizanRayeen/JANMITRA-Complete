# JANMITRA — 3-Minute Master Demonstration Video Script & Recording Guide

> **Project Title**: JANMITRA — Civic Issue Reporting & Management System  
> **Target Municipal Corporation**: Nagpur Municipal Corporation (NMC)  
> **Presenter & Producer**: Faizan Rayeen (Citizen Portal & Push Notifications Lead)  
> **Engineering Team**: ResolveIT (Anas Shaikh · Anurag Deshmukh · Om Gadekar · Faizan Rayeen)  
> **Target Video Duration**: Exactly 3 Minutes (180 Seconds)  
> **Document Version**: v3.9.0 (Day 39 Master Video Guide)  

---

## Production Guidelines & Image Authenticity Directives

> [!IMPORTANT]
> **STRICT MANDATE: REAL MUNICIPAL IMAGES ONLY (NO AI-GENERATED ASSETS)**  
> JANMITRA's computer vision engine (engineered by Anurag Deshmukh) actively validates image authenticity, metadata, and artifact consistency to detect and flag synthetic, stock, or AI-generated imagery.  
> **For this demonstration video, only real, authentic photographs of Nagpur infrastructure and civic issues must be utilized:**  
> - **Roads / Potholes**: Real photographs of asphalt craters and road settling along West High Court (WHC) Road, Great Nag Road, or Medical Square junction.  
> - **Proof of Work**: Authentic municipal before/after road resurfacing and cold-mix asphalt compaction photos executed by Nagpur Municipal Corporation (NMC) field crews.  
> - **Solid Waste**: Real community dustbin sites near Cotton Market or Sitabuldi.  
> - **Water / Drainage**: Real pipeline repair excavation photos from Dharampeth.  
> **Never use AI-generated or synthetic mock images in this demo.**

---

## Video Scene Timeline Overview

```
0:00 ─── 0:25 │ Scene 1: Introduction & Civic Problem Context in Nagpur
0:25 ─── 0:55 │ Scene 2: Citizen Mobile Submission & 100m Duplicate Flag [CALLOUT]
0:55 ─── 1:25 │ Scene 3: AI Fake Check & Departmental Triage [CALLOUT]
1:25 ─── 1:55 │ Scene 4: Department Officer Dashboard & Push Notification Toast [CALLOUT]
1:55 ─── 2:30 │ Scene 5: Field Worker On-Site Execution & Proof of Work [CALLOUT]
2:30 ─── 3:00 │ Scene 6: 6-Step Stepper, Citizen 5-Star Rating & Conclusion [CALLOUT]
```

---

## Scene-by-Scene Production Script

---

### Scene 1: Introduction & Civic Problem Context in Nagpur (0:00 – 0:25)
* **Duration**: 25 Seconds  
* **Target Audience**: University Examiners, Smart City Evaluators, Municipal Commissioners  
* **Visual Tone**: Professional, energetic, modern civic technology showcase  

#### Visual Directives:
- **0:00 – 0:08**: Dramatic opening shot. Nagpur Municipal Corporation (NMC) headquarters building followed by a montage of busy Nagpur corridors (Sitabuldi, West High Court Road, Zero Mile Stone).
- **0:08 – 0:16**: Quick split-screen illustrating the traditional municipal breakdown: paper registers overflowing with handwritten complaints, long queues at zonal ward offices, and frustrated citizens.
- **0:16 – 0:25**: Smooth zoom into the animated **JANMITRA** emblem with the tagline: *"Empowering Citizens, Enabling Nagpur Municipal Corporation."* Title card displays: *Team ResolveIT — Final Year Capstone Project*.

#### Audio Voiceover (Spoken Pacing: Steady, Confident):
> *"Nagpur is expanding rapidly, but our urban grievance redressal remains trapped in paper files, unmonitored call centers, and opaque administrative black boxes. When citizens report a broken road or overflowing garbage, complaints vanish without spatial tracking or verifiable proof of work. Introducing **JANMITRA**—the next-generation crowdsourced civic grievance and automated resolution platform engineered specifically for the Nagpur Municipal Corporation."*

#### Subtitles / Closed Captions (CC):
`[00:01] Nagpur's urban growth demands responsive municipal governance.`  
`[00:07] Traditional civic grievance redressal suffers from manual paper delays and zero accountability.`  
`[00:16] Introducing JANMITRA: Closed-loop civic issue resolution for Nagpur Municipal Corporation.`

---

### Scene 2: Citizen Mobile Submission & The 100m Duplicate Flag (0:25 – 0:55)
* **Duration**: 30 Seconds  
* **Active Screen**: Mobile Screen Recording (Pixel / iPhone in hands of citizen)  
* **Persona**: Priya Sharma (Citizen Ward 2 - Dharampeth)  
* **Featured Callout**: **`[CALLOUT 1: 100m DUPLICATE FLAG]`**

#### Visual Directives:
- **0:25 – 0:32**: Screen shows the Citizen Home (`/citizen`). Point out the **NMC Civic Advisory Broadcast Banner** at the top. Citizen taps the prominent **Report New Issue** button.
- **0:32 – 0:40**: Citizen selects Category: *Roads & Infrastructure &rarr; Pothole Repair*. Taps **Use Live Location**; GPS instantly locks onto `21.1448° N, 79.0682° E` (West High Court Road, Dharampeth).
- **0:40 – 0:48**: Citizen uploads a **real photograph** of a deep asphalt pothole on WHC Road.
- **0:48 – 0:55**: **[CALLOUT 1 TRIGGER]**: As the location is pinned, an animated amber radar wave scans a 100-meter radius on the Leaflet map. A glowing badge pops up:  
  **`⚠️ 100m DUPLICATE DETECTED: 2 nearby complaints found. Issue automatically upvoted.`**

#### Screen Callout Graphic:
```
┌──────────────────────────────────────────────────────────────┐
│  📍 CALLOUT: 100m GEOSPATIAL DUPLICATE MITIGATION            │
│  "Spatial radius clustering prevents department queue spam   │
│   by linking multi-citizen reports to a single ticket."      │
└──────────────────────────────────────────────────────────────┘
```

#### Audio Voiceover:
> *"Filing a civic grievance takes under 60 seconds on our mobile Progressive Web App. Here in Dharampeth, a citizen reports a hazardous asphalt pothole on West High Court Road using live GPS coordinates and an authentic camera capture. Watch closely: our spatial clustering engine instantly scans a 100-meter radius. If neighbors have already reported the same pothole, JANMITRA flags the duplicate and upvotes the existing ticket—eliminating queue flooding before it reaches city engineers."*

#### Subtitles / Closed Captions (CC):
`[00:26] Citizen opens JANMITRA PWA and captures real photo with high-precision GPS coordinates.`  
`[00:36] Automated spatial detection identifies Ward 2 - Dharampeth in under one second.`  
`[00:44] [CALLOUT: 100m DUPLICATE FLAG] Spatial clustering prevents redundant complaints.`

---

### Scene 3: AI Fake Check & Departmental Triage (0:55 – 1:25)
* **Duration**: 30 Seconds  
* **Active Screen**: Split view (Mobile submission & Backend AI processing console)  
* **Featured Callout**: **`[CALLOUT 2: AI FAKE CHECK & VALIDATION]`**

#### Visual Directives:
- **0:55 – 1:04**: Citizen hits **Submit Complaint**. A sleek scanning laser animation sweeps across the real pothole image.
- **1:04 – 1:15**: **[CALLOUT 2 TRIGGER]**: An AI diagnostic HUD displays real-time computer vision inferences:
  - *Defect Detection*: `Pothole / Roadway Distress [Confidence: 96.4%]`
  - *Authenticity Verification*: `Real Camera Sensor Capture [PASSED]`
  - *Synthetic / AI Image Artifacts*: `None Detected [0.0%]`
  - *Severity Assessment*: `Critical (Depth > 8cm, High-Traffic Corridor)`
- **1:15 – 1:25**: Instant routing animation: Complaint is automatically tagged with Tracking ID `NMC-2026-A4829`, assigned a 48-Hour SLA, and routed directly to the **Public Works Department (PWD)** database.

#### Screen Callout Graphic:
```
┌──────────────────────────────────────────────────────────────┐
│  🧠 CALLOUT: AI COMPUTER VISION & AUTHENTICITY VALIDATION     │
│  "Verifies authentic civic defects, calculates severity,     │
│   and rejects fraudulent, stock, or AI-generated uploads."   │
└──────────────────────────────────────────────────────────────┘
```

#### Audio Voiceover:
> *"Behind the scenes, our AI Computer Vision pipeline evaluates the upload in real time. It confirms that the image depicts genuine roadway distress, verifies physical camera sensor metadata, and certifies that no synthetic or AI-generated imagery is being submitted. The system automatically categorizes defect severity and routes the ticket directly to the Public Works Department with an enforceable 48-hour Service Level Agreement."*

#### Subtitles / Closed Captions (CC):
`[00:56] AI validation analyzes camera metadata and defect contours in real time.`  
`[01:06] [CALLOUT: AI FAKE CHECK] Confirms real physical damage and rejects fake or AI uploads.`  
`[01:17] Automated routing dispatches ticket to PWD with a 48-hour SLA timeline.`

---

### Scene 4: Department Officer Dashboard & Push Notification Toast (1:25 – 1:55)
* **Duration**: 30 Seconds  
* **Active Screen**: Screen B (Laptop — NMC PWD Executive Engineer Portal `/officer`)  
* **Persona**: Shri V. R. Sharma (Executive Engineer, PWD Nagpur)  
* **Featured Callout**: **`[CALLOUT 3: PUSH NOTIFICATION TOAST]`**

#### Visual Directives:
- **1:25 – 1:35**: Screen B shows the Officer Dashboard on a laptop. Suddenly, an audible two-tone chime rings out.  
  **[CALLOUT 3 TRIGGER]**: A navy-blue floating toast banner glides in at the top-right corner with a 6-second countdown bar:  
  **`🔔 NMC ALERT: New Grievance Submitted: NMC-2026-A4829 | Ward 2 PWD`**  
  Clicking the **View &rarr;** CTA opens the complaint details.
- **1:35 – 1:45**: Officer inspects the high-resolution photo of WHC Road, verifies the GPS coordinates, and reviews the AI confidence breakdown.
- **1:45 – 1:55**: Officer clicks **Assign Field Worker**, selects certified technician **Nitin Bawankar (NMC-PWD-W2)**, and confirms allocation.

#### Screen Callout Graphic:
```
┌──────────────────────────────────────────────────────────────┐
│  🔔 CALLOUT: REAL-TIME PUSH NOTIFICATION PIPELINE            │
│  "Dual-channel delivery: interactive foreground toast with   │
│   'View' CTA and background OS alerts when tabs are closed." │
└──────────────────────────────────────────────────────────────┘
```

#### Audio Voiceover:
> *"On Screen B, PWD Executive Engineer Shri V. R. Sharma receives an instant real-time alert through our dual-channel Firebase notification pipeline. The styled navy toast provides an immediate 'View' call-to-action without requiring a manual page refresh. The engineer reviews the spatial coordinates, verifies the photographic evidence, and allocates certified Ward 2 field technician Nitin Bawankar to execute site repairs."*

#### Subtitles / Closed Captions (CC):
`[01:26] Dual-channel notification delivers instant alert to Officer workstation.`  
`[01:34] [CALLOUT: PUSH NOTIFICATION TOAST] Styled banner with audio chime and 'View' CTA.`  
`[01:46] Officer validates grievance and assigns Ward 2 technician Nitin Bawankar.`

---

### Scene 5: Field Worker On-Site Execution & Proof of Work (1:55 – 2:30)
* **Duration**: 35 Seconds  
* **Active Screen**: Mobile Screen Recording (Field Technician View `/worker`)  
* **Persona**: Nitin Bawankar (PWD Technician, Ward 2)  
* **Featured Callout**: **`[CALLOUT 4: PROOF OF WORK VERIFICATION]`**

#### Visual Directives:
- **1:55 – 2:05**: Technician's phone receives an OS notification banner while locked: `NMC Field Alert: New Task Allocated in Ward 2`. Tapping the banner deep-links directly into the **Field Worker Dashboard** (`/worker`).
- **2:05 – 2:15**: Technician taps **Start Work** (status transitions to *In-Progress*). The app records on-site GPS arrival verification.
- **2:15 – 2:30**: **[CALLOUT 4 TRIGGER]**: Physical roadwork is completed. Technician taps **Upload Resolution Proof** and attaches a **real photograph** showing hot-mix asphalt compaction and smooth road resurfacing at the exact same landmark on WHC Road.  
  Screen displays side-by-side **BEFORE** and **AFTER** photographs with green validation checkmarks. Technician submits remarks: *"Asphalt filled and roller compacted. Road cleared for traffic."*

#### Screen Callout Graphic:
```
┌──────────────────────────────────────────────────────────────┐
│  📸 CALLOUT: MANDATORY PROOF-OF-WORK AUDIT TRAIL             │
│  "Side-by-side Before/After spatial photography prevents     │
│   ghost closures and guarantees physical work verification." │
└──────────────────────────────────────────────────────────────┘
```

#### Audio Voiceover:
> *"Even with his phone locked, the field technician receives a background OS push notification. Upon arrival at West High Court Road, the technician initiates work and carries out repairs. Crucially, JANMITRA completely eliminates 'Ghost Resolutions.' A ticket cannot be closed without uploading real, verifiable Proof of Work. The system mandates a side-by-side Before-and-After photograph at the same coordinates, ensuring complete accountability before municipal funds are disbursed."*

#### Subtitles / Closed Captions (CC):
`[01:56] Background push alerts technician on mobile device even with browser closed.`  
`[02:08] Technician marks issue In-Progress and executes on-site asphalt repair.`  
`[02:18] [CALLOUT: PROOF OF WORK] Side-by-side Before/After verification prevents ghost closures.`

---

### Scene 6: 6-Step Stepper, Citizen 5-Star Rating & Conclusion (2:30 – 3:00)
* **Duration**: 30 Seconds  
* **Active Screen**: Citizen Tracking View (`/citizen/complaint/NMC-2026-A4829`) & NMC Admin Portal (`/admin`)  
* **Featured Callout**: **`[CALLOUT 5: 6-STEP VISUAL LIFECYCLE STEPPER]`**

#### Visual Directives:
- **2:30 – 2:40**: **[CALLOUT 5 TRIGGER]**: Citizen Priya Sharma opens her phone. The complaint tracking interface displays our interactive **6-Step Stepper**:  
  `[1. Submitted] ── [2. Validated] ── [3. Assigned] ── [4. In-Progress] ── [5. Work Done] ── [6. Closed]`  
  All steps illuminate in vibrant emerald green.
- **2:40 – 2:48**: Citizen inspects the worker's resolution photo, smiles, selects **5 Stars (★★★★★)**, and submits the remark: *"Repaired within 24 hours. Excellent work by NMC PWD!"*
- **2:48 – 2:54**: Fast cut to Central Command (`/admin`): The NMC Citizen Satisfaction Score increments to `4.9 / 5.0`, and the Dharampeth Ward pin transitions from Red to Green on the live citywide heatmap.
- **2:54 – 3:00**: Grand closing card: Logo, GitHub repository link, and team credits: *Faizan Rayeen (Citizen & Push Leads) · Anas Shaikh (Backend) · Anurag Deshmukh (AI/ML) · Om Gadekar (Dashboard)*.

#### Screen Callout Graphic:
```
┌──────────────────────────────────────────────────────────────┐
│  📊 CALLOUT: 6-STEP LIFECYCLE STEPPER & CITIZEN RATING       │
│  "Full-loop citizen sign-off and 5-star rating feeds into    │
│   the citywide NMC Citizen Satisfaction Score."              │
└──────────────────────────────────────────────────────────────┘
```

#### Audio Voiceover:
> *"The citizen follows every milestone through our clear 6-Step Lifecycle Stepper. Once satisfied with the resolution proof, the citizen awards a 5-star rating, closing the feedback loop and boosting Nagpur's Citizen Satisfaction Index. Engineered by Team ResolveIT, JANMITRA transforms civic grievance management from an administrative burden into transparent, accountable, and responsive urban governance."*

#### Subtitles / Closed Captions (CC):
`[02:31] [CALLOUT: 6-STEP STEPPER] Transparent visual lifecycle tracking from report to resolution.`  
`[02:42] Citizen verifies proof-of-work, awards 5-star rating, and provides qualitative feedback.`  
`[02:52] JANMITRA: Making municipal governance accountable, transparent, and citizen-first.`

---

## Technical Recording Directives & Asset Checklist

### 1. Screen Capture Settings
- **Resolution**: 1920 × 1080 (1080p Full HD) at 60 FPS.
- **Mobile Aspect Ratio**: Center-framed in a sleek 9:16 mobile frame mockup with subtle shadow on a clean dark slate background (`#0f172a`).
- **Desktop Aspect Ratio**: 16:9 full-width browser view with Chrome UI hidden (F11 or Frameless).

### 2. Audio & Voiceover Directives
- **Microphone**: Condenser or high-quality lapel mic with pop filter.
- **Voiceover Tone**: Enthusiastic, articulate, professional, engineering-focused.
- **Background Score**: Minimalist, rhythmic, corporate tech ambient track at -22 dB beneath voiceover.
- **Sound Effects (SFX)**:
  - `0:48`: Subtle radar sonar ping for the 100m duplicate check.
  - `1:04`: High-tech digital data sweep for the AI Fake Check.
  - `1:26`: Two-tone web audio chime for the Push Notification Toast.
  - `2:18`: Satisfying mechanical shutter click for the Proof of Work upload.
  - `2:42`: Soft chime sweep for the 5-star citizen rating.

### 3. Authentic Nagpur Photo Asset Sourcing Guide (NO AI IMAGES)

| Demonstration Milestone | Scene Location | Required Real Image Asset Description | Approved Real Source Examples |
| :--- | :--- | :--- | :--- |
| **Initial Pothole Defect** | Scene 2 & 3 | Severe real asphalt pothole / crater on an Indian urban road with asphalt texture. | Real photograph from West High Court Road or Great Nag Road roadwork archives. |
| **Resolution Proof Photo** | Scene 5 | Smooth, compacted dark bitumen/asphalt patch after roller compaction. | Authentic NMC PWD cold-patch / hot-mix road resurfacing completion photograph. |
| **Garbage Overflow (Backup)** | Scene 1 | Real community bin with dry/wet waste in urban Indian setting. | Real photograph from Cotton Market / Sitabuldi sanitation dumps. |
| **Water Pipe Repair (Backup)** | Scene 1 | Real excavation trench showing municipal water pipeline repair. | Real photograph from NMC Water Works pipeline replacement works. |

---

## Team Integration & Project Roadmap Note

> **Engineering Status Update**:  
> - **Faizan Rayeen (Citizen Portal Lead & Push Notifications Lead)**: The entire Citizen PWA interface, NotificationBell component, Firebase Cloud Messaging v10 integration, hardened Service Worker caching, and full testing documentation are 100% complete and validated.  
> - **Anas Shaikh (Backend Lead)** & **Anurag Deshmukh (AI/ML Lead)**: Backend database models and AI computer vision integration modules are actively connecting to these endpoints, ensuring that when their final modules link up, the entire platform functions as a seamless, unified, production-grade municipal system.

---

```
                       END OF DEMO VIDEO SCRIPT GUIDE
================================================================================
```
