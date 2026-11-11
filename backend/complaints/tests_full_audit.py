import io
import json
import os
import tempfile
from PIL import Image

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from complaints.models import Category, Complaint, Ward
from notifications.auth_views import WORKER_METADATA
from notifications.models import Notification

User = get_user_model()


def _make_jpeg_bytes(color=(120, 90, 80)):
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color=color)
    img.save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "evidence.jpg"
    return buf


class FullSystemAuditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self._media_backup_files = []
        self._orig_wp_path = os.path.join(settings.BASE_DIR, "media", "worker_profiles.json")
        self._orig_set_path = os.path.join(settings.BASE_DIR, "media", "admin_system_settings.json")
        self._saved_wp = open(self._orig_wp_path, "rb").read() if os.path.exists(self._orig_wp_path) else None
        self._saved_set = open(self._orig_set_path, "rb").read() if os.path.exists(self._orig_set_path) else None
        if os.path.exists(self._orig_wp_path):
            os.remove(self._orig_wp_path)
        if os.path.exists(self._orig_set_path):
            os.remove(self._orig_set_path)

        # Seed canonical wards & 4 departments
        for w in range(1, 5):
            Ward.objects.get_or_create(ward_number=w, defaults={"name": f"Ward {w}"})
        for dept_id, name, sla in [
            (1, "Roads & Infrastructure", 48),
            (2, "Garbage & Solid Waste", 24),
            (3, "Water Pipeline Leakage", 24),
            (4, "Street Lighting", 36),
        ]:
            Category.objects.get_or_create(name=name, defaults={"department_id": dept_id, "sla_hours": sla})

        # Create Admin, Officers, Workers, Citizens with PBKDF2 hashes
        self.admin = User.objects.create_user(
            username="9900000000", password="Admin@123", first_name="Super Admin",
            email="admin@nmc.gov.in", is_staff=True, is_superuser=True,
        )
        self.pwd_officer = User.objects.create_user(
            username="9900000001", password="Officer@123", first_name="PWD Officer",
            email="pwd@nmc.gov.in", is_staff=True,
        )
        self.swm_officer = User.objects.create_user(
            username="9900000002", password="Officer@123", first_name="SWM Officer",
            email="swm@nmc.gov.in", is_staff=True,
        )
        self.swm_worker_w2 = User.objects.create_user(
            username="9800220001", password="worker123", first_name="Sunita Deshmukh",
            last_name="Ward 2", email="swmw2@worker.nmc.gov.in",
        )
        self.swm_worker_w4 = User.objects.create_user(
            username="9800420001", password="worker123", first_name="Pooja Kohale",
            last_name="Ward 4", email="swmw4@worker.nmc.gov.in",
        )
        self.pwd_worker_w2 = User.objects.create_user(
            username="9800210001", password="worker123", first_name="Nitin Bawankar",
            last_name="Ward 2", email="pwdw2@worker.nmc.gov.in",
        )
        self.citizen_a = User.objects.create_user(
            username="8888800001", password="CitUser@123", first_name="Citizen A", last_name="Ward 2",
        )
        self.citizen_b = User.objects.create_user(
            username="8888800002", password="CitUser@123", first_name="Citizen B", last_name="Ward 2",
        )

    def tearDown(self):
        for path, data in [(self._orig_wp_path, self._saved_wp), (self._orig_set_path, self._saved_set)]:
            if data is not None:
                with open(path, "wb") as fp:
                    fp.write(data)
            elif os.path.exists(path):
                os.remove(path)
        for p in self._media_backup_files:
            if os.path.exists(p):
                os.remove(p)

    def _login(self, mobile, password, portal=None):
        payload = {"mobile": mobile, "password": password}
        if portal:
            payload["portal"] = portal
        res = self.client.post("/api/v1/auth/login/", payload, format="json")
        return res

    def _auth_headers(self, token):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_01_security_rbac_and_bypass_fixes(self):
        # 1. Reserved registration blocked
        for bad_mob, bad_email in [("9800999999", "a@test.com"), ("9123456789", "evil@worker.com")]:
            r = self.client.post("/api/v1/auth/register/", {
                "name": "Bad Actor", "mobile": bad_mob, "email": bad_email,
                "ward": "Ward 1", "password": "Password@123",
            }, format="json")
            self.assertEqual(r.status_code, 400)

        # 2. Hardcoded plaintext bypass passwords strictly rejected
        self.assertEqual(self._login("8888800001", "password123", "citizen").status_code, 401)
        self.assertEqual(self._login("9800220001", "janmitra2026", "worker").status_code, 401)
        self.assertEqual(self._login("9900000000", "Admin@123", "citizen").status_code, 403)

        # 3. Unauthenticated endpoints return 401 (no ?mobile= bypass, no open KPI dump)
        for ep in [
            "/api/v1/complaints/",
            "/api/v1/complaints/summary/",
            "/api/v1/notifications/?mobile=9900000000",
            "/api/v1/auth/profile/?mobile=9900000000",
            "/api/v1/worker/tasks/?mobile=9800220001",
            "/api/v1/officer/dashboard/",
            "/api/v1/admin/overview/",
            "/api/v1/admin/settings/",
            "/api/v1/dashboard/kpi/",
            "/api/v1/dashboard/ward-stats/",
        ]:
            self.assertEqual(self.client.get(ep).status_code, 401, f"Expected 401 on {ep}")

        # 4. Profile password backdoor via 'admin@123' blocked cleanly
        r_patch_anon = self.client.patch("/api/v1/auth/profile/", {
            "mobile": "9900000000", "old_password": "admin@123", "new_password": "Hacked@123"
        }, format="json")
        self.assertEqual(r_patch_anon.status_code, 401)

        admin_tok = self._login("9900000000", "Admin@123", "admin").json()["access"]
        r_patch_wrong = self.client.patch(
            "/api/v1/auth/profile/",
            {"old_password": "admin@123", "new_password": "Hacked@123"},
            format="json", **self._auth_headers(admin_tok)
        )
        self.assertEqual(r_patch_wrong.status_code, 400)

        # 5. Internal JSON files under /media/ return 403
        self.assertEqual(self.client.get("/media/worker_profiles.json").status_code, 403)

        # 6. Token refresh succeeds for active users and public announcements stay readable
        ref_res = self.client.post("/api/v1/auth/token/refresh/", {"refresh": admin_tok}, format="json")
        self.assertEqual(ref_res.status_code, 200)
        self.assertTrue(ref_res.json().get("access"))
        self.assertEqual(self.client.get("/api/v1/announcements/").status_code, 200)

    def test_02_full_cross_portal_lifecycle_and_sync(self):
        cit_a_tok = self._login("8888800001", "CitUser@123", "citizen").json()["access"]
        cit_b_tok = self._login("8888800002", "CitUser@123", "citizen").json()["access"]
        swm_off_tok = self._login("9900000002", "Officer@123", "officer").json()["access"]
        pwd_off_tok = self._login("9900000001", "Officer@123", "officer").json()["access"]
        w4_tok = self._login("9800420001", "worker123", "worker").json()["access"]
        w2_tok = self._login("9800220001", "worker123", "worker").json()["access"]
        admin_tok = self._login("9900000000", "Admin@123", "admin").json()["access"]

        # 1. Citizen A submits SWM complaint in Ward 2 without photo + verifies duplicate detection without photo
        c1_res = self.client.post("/api/v1/complaints/", {
            "category": "SWM", "department_id": 2, "ward": "Ward 2", "ward_number": 2,
            "description": "Large overflowing garbage dump near market intersection blocking footpath.",
            "landmark": "Main Market", "lat": 21.1420, "lng": 79.0620, "address": "Market Square"
        }, format="json", **self._auth_headers(cit_a_tok))
        self.assertEqual(c1_res.status_code, 201)
        c1 = c1_res.json()
        c1_id = c1["id"]
        c1_track = c1["tracking_id"]
        orig_score = c1["priority_score"]
        self.assertEqual(c1["photo_url"], "")  # zero fake Unsplash stock photo

        # Citizen B cannot inspect Citizen A's complaint
        self.assertEqual(
            self.client.get(f"/api/v1/complaints/{c1_id}/", **self._auth_headers(cit_b_tok)).status_code,
            403,
        )

        # Duplicate 20m away without photo boosts parent score +15
        c2_res = self.client.post("/api/v1/complaints/", {
            "category": "SWM", "department_id": 2, "ward": "Ward 2", "ward_number": 2,
            "description": "Same garbage mound overflowing onto main street near market stall.",
            "lat": 21.1421, "lng": 79.0620, "address": "Market Square East"
        }, format="json", **self._auth_headers(cit_b_tok))
        self.assertEqual(c2_res.status_code, 201)
        self.assertTrue(c2_res.json()["is_duplicate"])
        parent_db = Complaint.objects.get(id=c1_id)
        self.assertEqual(parent_db.duplicate_count, 1)
        self.assertEqual(parent_db.priority_score, min(orig_score + 15, 100))

        # Citizen A passing ?all=true still receives ONLY own complaint
        cit_list = self.client.get("/api/v1/complaints/?all=true", **self._auth_headers(cit_a_tok)).json()
        self.assertEqual(cit_list["count"], 1)

        # 2. PWD Officer blocked from SWM complaint; SWM Officer approves + Cross-Ward assigns Ward 4 worker!
        self.assertEqual(
            self.client.post(f"/api/v1/officer/complaints/{c1_id}/validate/", {"action": "approve"}, format="json", **self._auth_headers(pwd_off_tok)).status_code,
            403,
        )
        # Worker toggles Duty Status -> Officer Roster & Admin reflect 'On Leave' then back to 'On Duty'
        self.assertEqual(
            self.client.patch("/api/v1/worker/profile/", {"is_on_duty": False, "duty_status": "on_leave"}, format="json", **self._auth_headers(w4_tok)).status_code,
            200,
        )
        off_roster = self.client.get("/api/v1/officer/workers/", **self._auth_headers(swm_off_tok)).json()["workers"]
        w4_row = [w for w in off_roster if w["mobile"] == "9800420001"][0]
        self.assertEqual(w4_row["status"], "On Leave")
        adm_workers = self.client.get("/api/v1/admin/workers/", **self._auth_headers(admin_tok)).json()["workers"]
        adm_w4 = [w for w in adm_workers if w["mobile"] == "9800420001"][0]
        self.assertEqual(adm_w4["status"], "Active")
        self.assertEqual(adm_w4["shift_status"], "On Leave")
        self.client.patch("/api/v1/worker/profile/", {"is_on_duty": True, "duty_status": "on_duty"}, format="json", **self._auth_headers(w4_tok))

        # Assign Ward 2 task to Ward 4 worker (Cross-Ward Emergency Dispatch)
        assign_res = self.client.post(f"/api/v1/officer/complaints/{c1_id}/assign/", {
            "worker_mobile": "9800420001", "override_ward": True, "override_reason": "Emergency cross-ward support"
        }, format="json", **self._auth_headers(swm_off_tok))
        self.assertEqual(assign_res.status_code, 200)

        # Ward 4 worker sees Cross-Ward task in queue & claims it
        w4_tasks = self.client.get("/api/v1/worker/tasks/", **self._auth_headers(w4_tok)).json()["tasks"]
        self.assertTrue(any(t["id"] == c1_id for t in w4_tasks))
        acc_res = self.client.post(f"/api/v1/worker/tasks/{c1_id}/accept/", {}, format="json", **self._auth_headers(w4_tok))
        self.assertEqual(acc_res.status_code, 200)

        # Same-ward SWM teammate (w2) CANNOT hijack w4's assigned task
        hijack = self.client.post(
            f"/api/v1/worker/tasks/{c1_id}/proof/",
            {"proof_photos": _make_jpeg_bytes(), "repair_notes": "Hijack"},
            format="multipart", **self._auth_headers(w2_tok)
        )
        self.assertEqual(hijack.status_code, 403)

        # w4 cannot mark Work Done without proof photo
        self.assertEqual(
            self.client.post(f"/api/v1/worker/tasks/{c1_id}/proof/", {"repair_notes": "No photo"}, format="json", **self._auth_headers(w4_tok)).status_code,
            400,
        )

        # w4 uploads 2 live proof photos -> status Work Done, Citizen & Officer notified!
        p1, p2 = _make_jpeg_bytes((10, 200, 10)), _make_jpeg_bytes((20, 180, 40))
        p2.name = "evidence2.jpg"
        proof_res = self.client.post(
            f"/api/v1/worker/tasks/{c1_id}/proof/",
            {"proof_photos": [p1, p2], "repair_notes": "Cleared entire site cleanly."},
            format="multipart", **self._auth_headers(w4_tok)
        )
        self.assertEqual(proof_res.status_code, 200)
        proof_data = proof_res.json()
        self.assertEqual(proof_data["status"], "Work Done")
        self.assertEqual(len(proof_data["proof_photos"]), 2)
        for u in proof_data["proof_photos"]:
            fname = os.path.basename(u)
            self._media_backup_files.append(os.path.join(settings.BASE_DIR, "media", "complaints", fname))

        # SWM Officer received Work Done notification
        swm_notifs = self.client.get("/api/v1/notifications/?all=true", **self._auth_headers(swm_off_tok)).json()["results"]
        self.assertTrue(any(c1_track in n["title"] for n in swm_notifs))

        # 3. Citizen B cannot verify Citizen A's ticket; Citizen A rejects -> In-Progress -> Worker re-submits -> Citizen A closes with 4 stars!
        self.assertEqual(
            self.client.post(f"/api/v1/complaints/{c1_id}/verify/", {"accepted": True, "rating": 5}, format="json", **self._auth_headers(cit_b_tok)).status_code,
            403,
        )
        rej_res = self.client.post(f"/api/v1/complaints/{c1_id}/verify/", {
            "accepted": False, "action": "reject", "reason": "Still dirty", "note": "Corner needs sweeping"
        }, format="json", **self._auth_headers(cit_a_tok))
        self.assertEqual(rej_res.status_code, 200)
        self.assertEqual(rej_res.json()["status"], "In-Progress")

        # Both Worker and SWM Officer received rejection/escalation notifications
        swm_esc_notifs = self.client.get("/api/v1/notifications/?all=true", **self._auth_headers(swm_off_tok)).json()["results"]
        self.assertTrue(any("Citizen Escalation" in n["title"] and c1_track in n["title"] for n in swm_esc_notifs))
        w4_notifs = self.client.get("/api/v1/notifications/?all=true", **self._auth_headers(w4_tok)).json()["results"]
        self.assertTrue(any("Re-Inspection Needed" in n["title"] and c1_track in n["title"] for n in w4_notifs))

        # Worker uploads updated proof
        p3 = _make_jpeg_bytes((50, 210, 50))
        p3.name = "rework.jpg"
        rework_res = self.client.post(
            f"/api/v1/worker/tasks/{c1_id}/proof/",
            {"proof_photos": p3, "repair_notes": "Corner swept cleanly."},
            format="multipart", **self._auth_headers(w4_tok)
        )
        self.assertEqual(rework_res.status_code, 200)
        self._media_backup_files.append(os.path.join(settings.BASE_DIR, "media", "complaints", os.path.basename(rework_res.json()["proof_photos"][0])))

        # Citizen A accepts with 4 stars
        acc_cit = self.client.post(f"/api/v1/complaints/{c1_id}/verify/", {
            "accepted": True, "action": "accept", "rating": 4, "feedback": "Good rework!"
        }, format="json", **self._auth_headers(cit_a_tok))
        self.assertEqual(acc_cit.status_code, 200)
        self.assertEqual(acc_cit.json()["status"], "Closed")

        # Citizen Profile shows authentic 4.0 rating (and unrated ticket in Profile does NOT fabricate 5 stars)
        prof = self.client.get("/api/v1/auth/profile/", **self._auth_headers(cit_a_tok)).json()
        self.assertEqual(prof["stats"]["avg_rating"], 4.0)
        self.assertEqual(prof["stats"]["rating_count"], 1)

        # Admin Settings update propagates SLA hours to PriorityEngine
        set_res = self.client.patch("/api/v1/admin/settings/", {
            "critical_sla_hours": 12, "high_sla_hours": 36, "medium_sla_hours": 72,
            "emergency_broadcast_text": "Test City Broadcast", "emergency_broadcast_active": True,
        }, format="json", **self._auth_headers(admin_tok))
        self.assertEqual(set_res.status_code, 200)
        from ai_pipeline.priority_engine import get_priority_level_and_sla
        lvl, sla_txt = get_priority_level_and_sla(85)
        self.assertEqual((lvl, sla_txt), ("Severe", "12h"))
