"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: dashboard/admin_workers_view.py
Description: 100% SQLite-backed Super Admin Worker Roster CRUD & System Settings
             (SLA Thresholds + Emergency Civic Broadcast) API Views.
==============================================================================
"""

import os
import json
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from complaints.models import Complaint
from complaints.officer_views import DEPT_CATALOG, _load_worker_profiles, _extract_worker_info
from dashboard.views import resolve_admin_context, normalize_dept_id, _load_real_workers_queryset

User = get_user_model()

# Preserved empty compatibility symbol if external seeder imports it
WORKERS_STORE = []

DEFAULT_SYSTEM_SETTINGS = {
    "critical_sla_hours": 24,
    "high_sla_hours": 48,
    "medium_sla_hours": 72,
    "auto_close_window_hours": 72,
    "emergency_broadcast_text": "Municipal Citizen Helpline: Report urgent potholes, waterlogging, waste accumulation, or street light faults for rapid ward dispatch.",
    "emergency_broadcast_active": False,
    "broadcast_severity": "warning",
    "id": "nmc-adv-default",
    "title": "NMC Civic Advisory",
}


def _worker_profiles_path():
    media_dir = os.path.join(settings.BASE_DIR, "media")
    os.makedirs(media_dir, exist_ok=True)
    return os.path.join(media_dir, "worker_profiles.json")


def _save_worker_profiles(data):
    with open(_worker_profiles_path(), "w", encoding="utf-8") as fp:
        json.dump(data, fp, indent=2)


def _settings_path():
    media_dir = os.path.join(settings.BASE_DIR, "media")
    os.makedirs(media_dir, exist_ok=True)
    return os.path.join(media_dir, "admin_system_settings.json")


def _load_system_settings():
    prefs = dict(DEFAULT_SYSTEM_SETTINGS)
    p = _settings_path()
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as fp:
                loaded = json.load(fp)
                if isinstance(loaded, dict):
                    prefs.update(loaded)
        except Exception:
            pass
    # Keep announcement/broadcast compatibility keys in sync for Citizen/Landing widgets
    text = prefs.get("emergency_broadcast_text", "")
    active = bool(prefs.get("emergency_broadcast_active", False))
    prefs["broadcast_message"] = text
    prefs["is_active"] = active
    prefs["announcement"] = {
        "id": prefs.get("id", "nmc-adv-default"),
        "title": prefs.get("title", "NMC Civic Advisory"),
        "text": text,
        "active": active,
        "priority": "high" if prefs.get("broadcast_severity") == "danger" else "normal",
        "severity": prefs.get("broadcast_severity", "warning"),
        "created_at": prefs.get("updated_at") or timezone.now().isoformat(),
    }
    return prefs


def _build_worker_row(w_user, profiles):
    info = _extract_worker_info(w_user, profiles)
    assigned_qs = Complaint.objects.filter(assigned_worker=w_user)
    active_cnt = assigned_qs.filter(status__in=["Assigned", "In-Progress"]).count()
    completed_qs = assigned_qs.filter(status__in=["Work Done", "Resolved", "Closed"])
    ratings = [int(c.rating) for c in completed_qs if c.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None
    return {
        "id": str(w_user.id),
        "employee_id": info["employee_id"],
        "name": info["name"],
        "mobile": info["mobile"],
        "email": info["email"],
        "department": info["department"],
        "dept": info["dept_code"],
        "dept_id": info["dept_id"],
        "ward": info["ward"],
        "designation": info["designation"],
        "active_tasks": active_cnt,
        "completed_tasks": completed_qs.count(),
        "rating": avg_rating if avg_rating is not None else "—",
        "reviews": len(ratings),
        "status": "Active" if info["is_active"] else "Inactive",
        "shift_status": "On Duty" if info.get("is_on_duty", True) else "On Leave",
        "is_active": info["is_active"],
        "is_on_duty": info.get("is_on_duty", True),
        "duty_status": info.get("duty_status", "on_duty"),
    }


class AdminWorkersListCreateView(APIView):
    """
    GET /api/v1/admin/workers/ — List real SQLite workers across all 4 depts & 4 wards.
    POST /api/v1/admin/workers/ — Register a real Field Worker account in SQLite + profile store.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        workers_qs, profiles = _load_real_workers_queryset()
        rows = [_build_worker_row(u, profiles) for u in workers_qs]

        dept_id = normalize_dept_id(request.query_params.get("dept") or request.query_params.get("department"))
        ward = request.query_params.get("ward", "").strip().lower()
        search = request.query_params.get("search", "").strip().lower()
        stat = request.query_params.get("status", "").strip().lower()

        if dept_id:
            rows = [w for w in rows if w["dept_id"] == dept_id]
        if ward and ward != "all":
            w_digits = "".join(ch for ch in ward if ch.isdigit())
            if w_digits:
                rows = [w for w in rows if str(w["ward"]) == w_digits]
        if stat and stat != "all":
            rows = [w for w in rows if w["status"].lower() == stat]
        if search:
            rows = [
                w for w in rows
                if search in w["name"].lower()
                or search in w["mobile"].lower()
                or search in w["employee_id"].lower()
                or search in w["designation"].lower()
            ]

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        page_size = 50
        start = (page - 1) * page_size
        paginated = rows[start:start + page_size]

        return Response({
            "count": len(rows),
            "page": page,
            "total_pages": max(1, (len(rows) + page_size - 1) // page_size),
            "results": paginated,
            "workers": rows,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        mobile = "".join(ch for ch in str(data.get("mobile") or "") if ch.isdigit())
        if len(mobile) == 12 and mobile.startswith("91"):
            mobile = mobile[2:]
        name = str(data.get("name") or "").strip()

        if len(mobile) != 10:
            return Response({"detail": "Valid 10-digit mobile number is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(name) < 2:
            return Response({"detail": "Worker full name is required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=mobile).exists():
            return Response({"detail": f"Account with mobile '{mobile}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        dept_id = normalize_dept_id(data.get("dept_id") or data.get("department") or "PWD") or 1
        dept_info = DEPT_CATALOG.get(dept_id, DEPT_CATALOG[1])
        ward_digits = "".join(ch for ch in str(data.get("ward") or "1") if ch.isdigit()) or "1"
        ward_num = max(1, min(4, int(ward_digits)))

        emp_id = str(data.get("employee_id") or f"NMC-{dept_info['code']}-W{ward_num}-{mobile[-3:]}").strip()
        designation = str(data.get("designation") or f"{dept_info['code']} Field Technician").strip()
        raw_email = str(data.get("email") or "").strip().lower()
        email = raw_email if raw_email else f"{emp_id.lower()}@worker.nmc.gov.in"
        password = str(data.get("password") or "worker123").strip()
        if len(password) < 6:
            return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

        w_user = User.objects.create_user(
            username=mobile,
            password=password,
            email=email,
            first_name=name,
            last_name=f"Ward {ward_num}",
            is_staff=False,
            is_superuser=False,
            is_active=True,
        )

        profiles = _load_worker_profiles()
        profiles[mobile] = {
            "name": name,
            "email": email,
            "dept_id": dept_id,
            "department": dept_info["title"],
            "ward": ward_num,
            "ward_name": f"Ward {ward_num}",
            "employee_id": emp_id,
            "designation": designation,
        }
        _save_worker_profiles(profiles)

        return Response(_build_worker_row(w_user, profiles), status=status.HTTP_201_CREATED)


class AdminWorkerDetailUpdateView(APIView):
    """
    PATCH / DELETE /api/v1/admin/workers/<worker_id>/
    Updates worker status (Active/Inactive), ward, department, designation, or removes test worker.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def _find_worker(self, worker_id):
        w_user = User.objects.filter(username=str(worker_id).strip()).first()
        if not w_user and str(worker_id).isdigit():
            w_user = User.objects.filter(id=int(worker_id)).first()
        return w_user

    def patch(self, request, worker_id):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        w_user = self._find_worker(worker_id)
        if not w_user or w_user.is_superuser or w_user.is_staff:
            return Response({"detail": "Field Worker not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        profiles = _load_worker_profiles()
        cur_info = _extract_worker_info(w_user, profiles)
        entry = profiles.get(w_user.username, {})

        if "name" in data and str(data["name"]).strip():
            new_name = str(data["name"]).strip()
            w_user.first_name = new_name
            entry["name"] = new_name
        if "designation" in data and str(data["designation"]).strip():
            entry["designation"] = str(data["designation"]).strip()
        if "department" in data or "dept_id" in data:
            d_id = normalize_dept_id(data.get("dept_id") or data.get("department")) or cur_info["dept_id"]
            entry["dept_id"] = d_id
            entry["department"] = DEPT_CATALOG.get(d_id, DEPT_CATALOG[1])["title"]
        if "ward" in data:
            w_digits = "".join(ch for ch in str(data["ward"]) if ch.isdigit())
            if w_digits:
                w_num = max(1, min(4, int(w_digits)))
                entry["ward"] = w_num
                entry["ward_name"] = f"Ward {w_num}"
                w_user.last_name = f"Ward {w_num}"
        if "status" in data:
            w_user.is_active = str(data["status"]).strip().lower() == "active"
        elif "is_active" in data:
            w_user.is_active = bool(data["is_active"])

        w_user.save()
        if entry:
            profiles[w_user.username] = entry
            _save_worker_profiles(profiles)

        return Response(_build_worker_row(w_user, profiles), status=status.HTTP_200_OK)

    def delete(self, request, worker_id):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        w_user = self._find_worker(worker_id)
        if not w_user or w_user.is_superuser or w_user.is_staff:
            return Response({"detail": "Field Worker not found."}, status=status.HTTP_404_NOT_FOUND)

        if Complaint.objects.filter(assigned_worker=w_user).exists():
            # Preserve historical referential integrity by deactivating instead of deleting
            w_user.is_active = False
            w_user.save(update_fields=["is_active"])
            return Response({"message": "Worker deactivated (has complaint history).", "deactivated": True}, status=status.HTTP_200_OK)

        profiles = _load_worker_profiles()
        profiles.pop(w_user.username, None)
        _save_worker_profiles(profiles)
        w_user.delete()
        return Response({"message": "Worker removed.", "deleted": True}, status=status.HTTP_200_OK)


class AdminSettingsView(APIView):
    """
    GET /api/v1/admin/settings/ (and /api/v1/announcements/) — Public civic advisory banner read.
    PATCH /api/v1/admin/settings/ — Strict Super Admin persistence of SLA targets & emergency broadcast.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if "/admin/" in request.path and not resolve_admin_context(request):
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(_load_system_settings(), status=status.HTTP_200_OK)

    def patch(self, request):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        prefs = _load_system_settings()
        data = request.data

        for num_key in ("critical_sla_hours", "high_sla_hours", "medium_sla_hours", "auto_close_window_hours"):
            if num_key in data:
                try:
                    prefs[num_key] = max(1, int(data[num_key]))
                except (ValueError, TypeError):
                    return Response({"detail": f"Invalid integer value for {num_key}."}, status=status.HTTP_400_BAD_REQUEST)

        if prefs["critical_sla_hours"] > prefs["high_sla_hours"]:
            return Response({"detail": "Critical SLA hours cannot exceed High SLA hours."}, status=status.HTTP_400_BAD_REQUEST)
        if prefs["high_sla_hours"] > prefs["medium_sla_hours"]:
            return Response({"detail": "High SLA hours cannot exceed Medium SLA hours."}, status=status.HTTP_400_BAD_REQUEST)

        if "emergency_broadcast_text" in data:
            prefs["emergency_broadcast_text"] = str(data["emergency_broadcast_text"]).strip()
        elif "broadcast_message" in data:
            prefs["emergency_broadcast_text"] = str(data["broadcast_message"]).strip()

        if "emergency_broadcast_active" in data:
            prefs["emergency_broadcast_active"] = bool(data["emergency_broadcast_active"])
        elif "is_active" in data:
            prefs["emergency_broadcast_active"] = bool(data["is_active"])

        if "broadcast_severity" in data and data["broadcast_severity"] in ("info", "warning", "danger"):
            prefs["broadcast_severity"] = data["broadcast_severity"]

        if "title" in data:
            prefs["title"] = str(data["title"]).strip() or "NMC Civic Advisory"
        if "id" in data and str(data["id"]).strip():
            prefs["id"] = str(data["id"]).strip()
        elif any(k in data for k in ("emergency_broadcast_text", "broadcast_message", "emergency_broadcast_active", "is_active")):
            prefs["id"] = f"nmc-adv-{int(timezone.now().timestamp())}"

        prefs["updated_at"] = timezone.now().isoformat()
        with open(_settings_path(), "w", encoding="utf-8") as fp:
            json.dump({k: v for k, v in prefs.items() if k not in ("broadcast_message", "is_active", "announcement")}, fp, indent=2)

        return Response(_load_system_settings(), status=status.HTTP_200_OK)
