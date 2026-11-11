"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: dashboard/views.py
Description: 100% SQLite-backed Super Admin Command & City Analytics APIs
             covering all 4 Municipal Departments (PWD, SWM, PHE, Electrical)
             and Wards 1-4, strictly guarded by Super Admin JWT verification.
==============================================================================
"""

import datetime
import logging
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from complaints.models import Complaint
from complaints.officer_views import (
    DEPT_CATALOG,
    _find_complaint,
    _load_worker_profiles,
    _extract_worker_info,
    _serialize_officer_complaint,
    _find_matching_active_workers,
    _is_worker_user,
)
from notifications.auth_views import OFFICER_METADATA
from notifications.models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()

WARD_DESCRIPTIONS = {
    1: "Municipal Zone 1",
    2: "Municipal Zone 2",
    3: "Municipal Zone 3",
    4: "Municipal Zone 4",
}


def resolve_admin_context(request):
    """Verify Bearer HS256 JWT belongs strictly to Municipal Super Admin."""
    auth_header = (
        request.headers.get("Authorization")
        or request.META.get("HTTP_AUTHORIZATION")
        or ""
    )
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    try:
        secret = getattr(settings, "SECRET_KEY", "janmitra-secret-key-2026")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None

    user_id = payload.get("user_id")
    mobile = payload.get("mobile")
    user = User.objects.filter(id=user_id).first() if user_id else None
    if not user and mobile:
        user = User.objects.filter(username=mobile).first()
    if not user or not user.is_active:
        return None

    uname = str(user.username).strip()
    if not (user.is_superuser or uname == "9900000000"):
        return None

    return {
        "user": user,
        "mobile": uname,
        "name": user.first_name or "Super Admin (NMC Central Command)",
    }


def normalize_dept_id(raw_val):
    """Map 'all', '1'..'4', 'PWD', 'SWM', 'PHE', 'ELE'/'Electrical' cleanly to int dept_id or None."""
    val = str(raw_val or "").strip().lower()
    if not val or val == "all":
        return None
    if val in ("1", "pwd") or "public works" in val or "road" in val:
        return 1
    if val in ("2", "swm") or "waste" in val or "sanit" in val:
        return 2
    if val in ("3", "phe", "wsd") or "water" in val or "public health" in val:
        return 3
    if val in ("4", "ele", "elec", "electrical") or "light" in val:
        return 4
    return None


def _load_real_workers_queryset():
    """Return QuerySet of canonical 9800* SQLite Field Workers plus Admin-created worker profiles."""
    profiles = _load_worker_profiles()
    worker_q = Q(username__startswith="9800")
    if profiles:
        worker_q = worker_q | Q(username__in=list(profiles.keys()))
    return User.objects.filter(worker_q).order_by("username"), profiles


def _compute_avg_resolution_days(qs):
    diffs = []
    for comp in qs:
        if comp.status in ("Work Done", "Resolved", "Closed"):
            end_dt = comp.verified_at or comp.updated_at
            if end_dt and comp.created_at:
                diffs.append(max((end_dt - comp.created_at).total_seconds() / 86400.0, 0.1))
    return round(sum(diffs) / len(diffs), 1) if diffs else 0.0


def _filter_complaints_qs(request):
    """Build filtered Complaint QuerySet + in-memory serialized matches cleanly."""
    qs = Complaint.objects.select_related("category", "ward", "assigned_worker", "citizen").all()

    range_param = request.query_params.get("range", "all").strip().lower()
    if range_param in ("7d", "30d", "90d"):
        days = int(range_param.replace("d", ""))
        qs = qs.filter(created_at__gte=timezone.now() - datetime.timedelta(days=days))

    dept_id = normalize_dept_id(request.query_params.get("dept") or request.query_params.get("dept_id"))
    if dept_id:
        qs = qs.filter(category__department_id=dept_id)

    ward_param = request.query_params.get("ward", "").strip().lower()
    if ward_param and ward_param != "all":
        digits = "".join(ch for ch in ward_param if ch.isdigit())
        if digits:
            qs = qs.filter(ward__ward_number=int(digits))

    status_param = request.query_params.get("status", "").strip()
    if status_param and status_param.lower() != "all":
        s_low = status_param.lower()
        if s_low in ("pending", "submitted"):
            qs = qs.filter(status__in=["Submitted", "Pending Validation"])
        elif s_low == "open":
            qs = qs.filter(status__in=["Submitted", "Pending Validation", "Validated", "Assigned", "In-Progress"])
        elif s_low == "resolved":
            qs = qs.filter(status__in=["Work Done", "Resolved", "Closed"])
        elif s_low == "closed":
            qs = qs.filter(status__in=["Closed", "Resolved"])
        else:
            qs = qs.filter(status__iexact=status_param)

    prio_param = request.query_params.get("priority", "").strip().lower()
    search_param = request.query_params.get("search", "").strip().lower()

    items = [_serialize_officer_complaint(c, request) for c in qs]
    if prio_param and prio_param != "all":
        items = [
            c for c in items
            if str(c.get("priority_level", "")).lower() == prio_param
            or (prio_param == "critical" and str(c.get("priority_level", "")).lower() == "severe")
        ]

    if search_param:
        items = [
            c for c in items
            if search_param in str(c.get("tracking_id", "")).lower()
            or search_param in str(c.get("title", "")).lower()
            or search_param in str(c.get("address", "")).lower()
            or search_param in str(c.get("worker_name", "")).lower()
            or search_param in str(c.get("citizen_name", "")).lower()
            or search_param in str(c.get("dept", "")).lower()
        ]

    prio_rank = {"Severe": 0, "Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    items.sort(
        key=lambda x: (
            prio_rank.get(x.get("priority_level", "Medium"), 99),
            -int(x.get("priority_score", 0) or 0),
            str(x.get("submitted_at", "")),
        )
    )
    return qs, items


class AdminOverviewView(APIView):
    """
    GET /api/v1/admin/overview/
    Returns real city-wide SQLite KPIs, all-4 department performance breakdown,
    4x4 Ward x Department heatmap, 7-day trends, priority split, Officer roster status,
    and geo-tagged multi-category GIS markers.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        filtered_qs, filtered_items = _filter_complaints_qs(request)
        id_set = {str(c.get("id")) for c in filtered_items}
        final_comps = [c for c in filtered_qs if str(c.id) in id_set]

        workers_qs, profiles = _load_real_workers_queryset()
        worker_infos = [_extract_worker_info(u, profiles) for u in workers_qs]

        # City-wide KPIs from filtered items
        pending_val = sum(1 for c in filtered_items if c["status"] in ("Submitted", "Pending Validation"))
        validated_cnt = sum(1 for c in filtered_items if c["status"] == "Validated")
        assigned_cnt = sum(1 for c in filtered_items if c["status"] == "Assigned")
        in_prog_cnt = sum(1 for c in filtered_items if c["status"] == "In-Progress")
        work_done_cnt = sum(1 for c in filtered_items if c["status"] == "Work Done")
        closed_cnt = sum(1 for c in filtered_items if c["status"] in ("Resolved", "Closed"))
        rejected_cnt = sum(1 for c in filtered_items if c["status"] == "Rejected")
        total_cnt = len(filtered_items)
        resolved_total = work_done_cnt + closed_cnt
        ratings = [int(c.rating) for c in final_comps if c.rating is not None]

        city_kpi = {
            "total": total_cnt,
            "open": pending_val + validated_cnt + assigned_cnt + in_prog_cnt,
            "pending_validation": pending_val,
            "validated": validated_cnt,
            "assigned": assigned_cnt,
            "in_progress": in_prog_cnt,
            "work_done": work_done_cnt,
            "resolved": resolved_total,
            "closed": closed_cnt,
            "rejected": rejected_cnt,
            "sla_at_risk": sum(
                1 for c in filtered_items
                if c.get("priority_level") in ("Severe", "High")
                and c["status"] not in ("Work Done", "Resolved", "Closed", "Rejected")
            ),
            "avg_resolution_days": _compute_avg_resolution_days(final_comps),
            "resolution_rate": round((resolved_total / total_cnt) * 100, 1) if total_cnt else 0.0,
            "avg_citizen_rating": round(sum(ratings) / len(ratings), 1) if ratings else 0.0,
            "total_workers": len(worker_infos),
            "active_workers": sum(1 for w in worker_infos if w.get("is_active")),
        }

        # All 4 departments performance (respects range & ward filters for accurate side-by-side comparison)
        all_qs = Complaint.objects.select_related("category", "ward", "assigned_worker", "citizen").all()
        range_param = request.query_params.get("range", "all").strip().lower()
        if range_param in ("7d", "30d", "90d"):
            days = int(range_param.replace("d", ""))
            all_qs = all_qs.filter(created_at__gte=timezone.now() - datetime.timedelta(days=days))
        ward_param = request.query_params.get("ward", "").strip().lower()
        if ward_param and ward_param != "all":
            w_digits = "".join(ch for ch in ward_param if ch.isdigit())
            if w_digits:
                all_qs = all_qs.filter(ward__ward_number=int(w_digits))
        all_serialized = [_serialize_officer_complaint(c, request) for c in all_qs]

        departments_summary = []
        officers_summary = []
        off_mobile_by_dept = {1: "9900000001", 2: "9900000002", 3: "9900000003", 4: "9900000004"}

        for d_id, info in DEPT_CATALOG.items():
            d_items = [c for c in all_serialized if int(c.get("dept_id") or 1) == d_id]
            d_orm = [c for c in all_qs if (c.category.department_id if c.category else 1) == d_id]
            d_tot = len(d_items)
            d_res = sum(1 for c in d_items if c["status"] in ("Work Done", "Resolved", "Closed"))
            d_pend = sum(1 for c in d_items if c["status"] in ("Submitted", "Pending Validation"))
            d_open = sum(1 for c in d_items if c["status"] in ("Submitted", "Pending Validation", "Validated", "Assigned", "In-Progress"))
            d_inprog = sum(1 for c in d_items if c["status"] == "In-Progress")
            d_workers = [w for w in worker_infos if w["dept_id"] == d_id]
            o_mob = off_mobile_by_dept[d_id]
            o_name = OFFICER_METADATA.get(o_mob, {}).get("name", f"{info['code']} Officer")
            res_rate = round((d_res / d_tot) * 100, 1) if d_tot else 0.0

            departments_summary.append({
                "dept_id": d_id,
                "code": info["code"],
                "title": info["title"],
                "category": info["category"],
                "color": info["color"],
                "total": d_tot,
                "open": d_open,
                "pending_validation": d_pend,
                "in_progress": d_inprog,
                "resolved": d_res,
                "resolution_rate": res_rate,
                "avg_resolution_days": _compute_avg_resolution_days(d_orm),
                "worker_count": len(d_workers),
                "active_workers": sum(1 for w in d_workers if w.get("is_active")),
                "officer_name": o_name,
                "officer_mobile": o_mob,
            })

            officers_summary.append({
                "dept_id": d_id,
                "dept_code": info["code"],
                "name": o_name,
                "mobile": o_mob,
                "pending_validation": d_pend,
                "open_backlog": d_open,
                "resolution_rate": res_rate,
                "active_workers": sum(1 for w in d_workers if w.get("is_active")),
            })

        # 4x4 Ward x Department Matrix (always respects active filter selection)
        ward_matrix = []
        for w_num in range(1, 5):
            w_items = [c for c in filtered_items if int(c.get("ward_number") or 0) == w_num]
            pwd_c = sum(1 for c in w_items if int(c.get("dept_id") or 0) == 1)
            swm_c = sum(1 for c in w_items if int(c.get("dept_id") or 0) == 2)
            phe_c = sum(1 for c in w_items if int(c.get("dept_id") or 0) == 3)
            ele_c = sum(1 for c in w_items if int(c.get("dept_id") or 0) == 4)
            ward_matrix.append({
                "ward": f"Ward {w_num}",
                "wardNum": w_num,
                "description": WARD_DESCRIPTIONS.get(w_num, ""),
                "PWD": pwd_c,
                "SWM": swm_c,
                "PHE": phe_c,
                "Electrical": ele_c,
                "total": len(w_items),
                "open": sum(1 for c in w_items if c["status"] not in ("Work Done", "Resolved", "Closed", "Rejected")),
                "resolved": sum(1 for c in w_items if c["status"] in ("Work Done", "Resolved", "Closed")),
            })

        # Priority 4-tier distribution
        prio_counts = {"Severe": 0, "High": 0, "Medium": 0, "Low": 0}
        for c in filtered_items:
            lvl = c.get("priority_level", "Medium")
            if lvl in prio_counts:
                prio_counts[lvl] += 1

        # 7-day trend
        today = timezone.localdate()
        trends = []
        for offset in range(6, -1, -1):
            d = today - datetime.timedelta(days=offset)
            sub_cnt = 0
            res_cnt = 0
            for comp in final_comps:
                c_date = timezone.localtime(comp.created_at).date() if comp.created_at else None
                if c_date == d:
                    sub_cnt += 1
                if comp.status in ("Work Done", "Resolved", "Closed"):
                    r_dt = comp.verified_at or comp.updated_at
                    if r_dt and timezone.localtime(r_dt).date() == d:
                        res_cnt += 1
            trends.append({"period": d.strftime("%d %b"), "submitted": sub_cnt, "resolved": res_cnt})

        # Multi-category GIS Map Markers (shows PWD, SWM, PHE, Electrical pins cleanly)
        map_markers = [
            {
                "id": c["id"],
                "tracking_id": c["tracking_id"],
                "title": c["title"],
                "category": c.get("dept") or c.get("category") or "PWD",
                "dept_id": c.get("dept_id", 1),
                "dept_code": c.get("dept", "PWD"),
                "ward": c.get("ward_number", 1),
                "priority": c.get("priority_level", "Medium"),
                "priority_score": c.get("priority_score", 50),
                "status": c.get("status", "Submitted"),
                "lat": c.get("latitude", 21.1458),
                "lng": c.get("longitude", 79.0882),
                "address": c.get("address", "Nagpur"),
                "worker_name": c.get("worker_name", "Unassigned"),
            }
            for c in filtered_items
            if c.get("latitude") is not None and c.get("longitude") is not None
        ]

        return Response({
            "admin": {"name": ctx["name"], "mobile": ctx["mobile"]},
            "city_kpi": city_kpi,
            "departments": departments_summary,
            "officers": officers_summary,
            "ward_matrix": ward_matrix,
            "priority_distribution": [
                {"name": "Severe", "value": prio_counts["Severe"], "color": "#DC2626"},
                {"name": "High", "value": prio_counts["High"], "color": "#F97316"},
                {"name": "Medium", "value": prio_counts["Medium"], "color": "#D97706"},
                {"name": "Low", "value": prio_counts["Low"], "color": "#64748B"},
            ],
            "trends": trends,
            "map_markers": map_markers,
            "recent_complaints": filtered_items[:20],
        }, status=status.HTTP_200_OK)


class AdminComplaintsLedgerView(APIView):
    """
    GET /api/v1/admin/complaints/
    City-wide complaints ledger across all 4 departments and 4 wards.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        _, items = _filter_complaints_qs(request)
        return Response({
            "count": len(items),
            "complaints": items,
        }, status=status.HTTP_200_OK)


class AdminComplaintOverrideView(APIView):
    """
    POST /api/v1/admin/complaints/<complaint_id>/override/
    Super Admin command action: approve/validate, reject with reason, or assign/reassign
    any grievance across all 4 departments cleanly in SQLite.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        c_obj = _find_complaint(complaint_id)
        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        action = str(request.data.get("action") or "assign").strip().lower()
        comp_dept = c_obj.category.department_id if c_obj.category else 1
        dept_code = DEPT_CATALOG.get(comp_dept, DEPT_CATALOG[1])["code"]

        if action in ("reject", "rejected"):
            reason = str(request.data.get("reason") or "").strip()
            if not reason:
                return Response({"detail": "Rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)
            c_obj.status = "Rejected"
            c_obj.feedback = f"[Super Admin Override Rejection: {reason}]"
            c_obj.save(update_fields=["status", "feedback", "updated_at"])

            if c_obj.citizen:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Complaint #{c_obj.tracking_id} Rejected by Central Administration",
                    body=f"Reason: {reason}",
                    complaint_id=str(c_obj.id),
                )
            return Response({
                "message": f"Grievance #{c_obj.tracking_id} rejected by Super Admin.",
                "complaint": _serialize_officer_complaint(c_obj, request),
            }, status=status.HTTP_200_OK)

        if action in ("validate", "approve"):
            c_obj.status = "Validated"
            c_obj.save(update_fields=["status", "updated_at"])
            ward_num = c_obj.ward.ward_number if c_obj.ward else 1
            for w_user in _find_matching_active_workers(ward_num, comp_dept):
                Notification.objects.create(
                    recipient=w_user,
                    title=f"Admin-Validated {dept_code} Task: #{c_obj.tracking_id}",
                    body=f"Super Admin validated '{c_obj.title}' in Ward {ward_num}.",
                    complaint_id=str(c_obj.id),
                )
            if c_obj.citizen:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Civic Issue #{c_obj.tracking_id} Approved by Central Admin",
                    body=f"Verified and routed to Ward {ward_num} {dept_code} dispatch queue.",
                    complaint_id=str(c_obj.id),
                )
            return Response({
                "message": f"Grievance #{c_obj.tracking_id} validated by Super Admin.",
                "complaint": _serialize_officer_complaint(c_obj, request),
            }, status=status.HTTP_200_OK)

        # Assign / Reassign Worker (supports Super Admin cross-ward dispatch)
        worker_identifier = str(request.data.get("worker_mobile") or request.data.get("worker_id") or "").strip()
        if not worker_identifier:
            return Response({"detail": "worker_mobile or worker_id is required for assignment."}, status=status.HTTP_400_BAD_REQUEST)

        w_user = User.objects.filter(username=worker_identifier).first()
        if not w_user and worker_identifier.isdigit():
            w_user = User.objects.filter(id=int(worker_identifier)).first()
        if not _is_worker_user(w_user):
            return Response({"detail": f"Active Field Worker '{worker_identifier}' not found."}, status=status.HTTP_404_NOT_FOUND)

        profiles = _load_worker_profiles()
        w_info = _extract_worker_info(w_user, profiles)
        if w_info["dept_id"] != comp_dept and not request.data.get("allow_cross_dept"):
            return Response(
                {"detail": f"Department mismatch: Worker belongs to {w_info['dept_code']} while grievance is under {dept_code}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        c_obj.assigned_worker = w_user
        if c_obj.status in ("Submitted", "Pending Validation", "Validated", "In-Progress", "Work Done"):
            c_obj.status = "Assigned"
        c_obj.save(update_fields=["assigned_worker", "status", "updated_at"])

        Notification.objects.create(
            recipient=w_user,
            title=f"Admin Command Dispatch: #{c_obj.tracking_id}",
            body=f"Super Admin assigned you '{c_obj.title}' ({dept_code} • {c_obj.priority_level}).",
            complaint_id=str(c_obj.id),
        )
        if c_obj.citizen:
            Notification.objects.create(
                recipient=c_obj.citizen,
                title=f"Worker Dispatched by Central Admin: #{c_obj.tracking_id}",
                body=f"Field Worker {w_info['name']} ({dept_code}) assigned to resolve your grievance.",
                complaint_id=str(c_obj.id),
            )
        dept_officer = User.objects.filter(username=f"990000000{comp_dept}").first()
        if dept_officer:
            Notification.objects.create(
                recipient=dept_officer,
                title=f"Admin Dispatch Notice: #{c_obj.tracking_id}",
                body=f"Super Admin assigned {w_info['name']} ({w_info['mobile']}) to #{c_obj.tracking_id}.",
                complaint_id=str(c_obj.id),
            )

        return Response({
            "message": f"Super Admin assigned #{c_obj.tracking_id} to {w_info['name']}.",
            "complaint": _serialize_officer_complaint(c_obj, request),
            "assigned_worker": w_info,
        }, status=status.HTTP_200_OK)


class AdminReportsView(APIView):
    """
    GET /api/v1/admin/reports/
    Returns real SQLite department comparisons, ward breakdowns, and field worker leaderboard.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = resolve_admin_context(request)
        if not ctx:
            return Response({"detail": "Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        all_qs = Complaint.objects.select_related("category", "ward", "assigned_worker", "citizen").all()
        all_ser = [_serialize_officer_complaint(c, request) for c in all_qs]

        dept_report = []
        for d_id, info in DEPT_CATALOG.items():
            d_ser = [c for c in all_ser if int(c.get("dept_id") or 1) == d_id]
            d_orm = [c for c in all_qs if (c.category.department_id if c.category else 1) == d_id]
            tot = len(d_ser)
            res = sum(1 for c in d_ser if c["status"] in ("Work Done", "Resolved", "Closed"))
            pend = sum(1 for c in d_ser if c["status"] in ("Submitted", "Pending Validation", "Validated", "Assigned", "In-Progress"))
            ratings = [int(c.rating) for c in d_orm if c.rating is not None]
            dept_report.append({
                "dept_id": d_id,
                "dept": info["code"],
                "title": info["title"],
                "total": tot,
                "open": pend,
                "resolved": res,
                "rejected": sum(1 for c in d_ser if c["status"] == "Rejected"),
                "resolution_rate": round((res / tot) * 100, 1) if tot else 0.0,
                "avg_resolution_days": _compute_avg_resolution_days(d_orm),
                "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else 0.0,
            })

        workers_qs, profiles = _load_real_workers_queryset()
        leaderboard = []
        for w_user in workers_qs:
            w_info = _extract_worker_info(w_user, profiles)
            w_assigned = Complaint.objects.filter(assigned_worker=w_user)
            completed = w_assigned.filter(status__in=["Work Done", "Resolved", "Closed"])
            active = w_assigned.filter(status__in=["Assigned", "In-Progress"])
            ratings = [int(c.rating) for c in completed if c.rating is not None]
            leaderboard.append({
                "mobile": w_info["mobile"],
                "name": w_info["name"],
                "employee_id": w_info["employee_id"],
                "dept": w_info["dept_code"],
                "ward": w_info["ward"],
                "active_tasks": active.count(),
                "completed_tasks": completed.count(),
                "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
                "reviews": len(ratings),
                "is_active": w_info["is_active"],
            })

        leaderboard.sort(key=lambda x: (-x["completed_tasks"], -(x["avg_rating"] or 0), x["active_tasks"]))

        return Response({
            "generated_at": timezone.now().isoformat(),
            "department_summary": dept_report,
            "worker_leaderboard": leaderboard,
            "complaints": all_ser,
        }, status=status.HTTP_200_OK)


class DashboardKPIView(APIView):
    """GET /api/v1/dashboard/kpi/ — Real SQLite aggregate KPI summary (Staff/Admin)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not (user.is_superuser or user.is_staff or user.username in OFFICER_METADATA):
            return Response({"detail": "Officer or Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        dept_id_param = request.query_params.get("dept_id")
        all_qs = Complaint.objects.select_related("category", "ward").all()

        if dept_id_param:
            d_id = normalize_dept_id(dept_id_param) or 1
            d_qs = all_qs.filter(category__department_id=d_id)
            info = DEPT_CATALOG.get(d_id, DEPT_CATALOG[1])
            tot = d_qs.count()
            res = d_qs.filter(status__in=["Work Done", "Resolved", "Closed"]).count()
            in_prog = d_qs.filter(status="In-Progress").count()
            pend = d_qs.filter(status__in=["Submitted", "Pending Validation", "Validated", "Assigned"]).count()
            return Response({
                "dept_id": d_id,
                "name": info["code"],
                "title": info["title"],
                "category": info["category"],
                "color": info["color"],
                "total": tot,
                "pending": pend,
                "resolved": res,
                "in_progress": in_prog,
                "avg_days": _compute_avg_resolution_days(d_qs),
                "resolution_rate": round((res / tot) * 100, 1) if tot else 0.0,
            }, status=status.HTTP_200_OK)

        dept_breakdown = []
        tot_all = all_qs.count()
        res_all = all_qs.filter(status__in=["Work Done", "Resolved", "Closed"]).count()
        pend_all = all_qs.filter(status__in=["Submitted", "Pending Validation", "Validated", "Assigned"]).count()
        inprog_all = all_qs.filter(status="In-Progress").count()

        for d_id, info in DEPT_CATALOG.items():
            d_qs = all_qs.filter(category__department_id=d_id)
            tot = d_qs.count()
            res = d_qs.filter(status__in=["Work Done", "Resolved", "Closed"]).count()
            dept_breakdown.append({
                "dept_id": d_id,
                "name": info["code"],
                "title": info["title"],
                "color": info["color"],
                "total": tot,
                "pending": d_qs.filter(status__in=["Submitted", "Pending Validation", "Validated", "Assigned"]).count(),
                "resolved": res,
                "in_progress": d_qs.filter(status="In-Progress").count(),
                "resolution_rate": round((res / tot) * 100, 1) if tot else 0.0,
            })

        return Response({
            "city_summary": {
                "total": tot_all,
                "pending": pend_all,
                "resolved": res_all,
                "in_progress": inprog_all,
                "resolution_rate": round((res_all / tot_all) * 100, 1) if tot_all else 0.0,
            },
            "departments": dept_breakdown,
        }, status=status.HTTP_200_OK)


class WardStatsView(APIView):
    """GET /api/v1/dashboard/ward-stats/ — Real SQLite Ward breakdown (Staff/Admin)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not (user.is_superuser or user.is_staff or user.username in OFFICER_METADATA):
            return Response({"detail": "Officer or Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        dept_id = normalize_dept_id(request.query_params.get("dept_id"))
        qs = Complaint.objects.select_related("category", "ward").all()
        if dept_id:
            qs = qs.filter(category__department_id=dept_id)

        wards = []
        for w_num in range(1, 5):
            w_qs = qs.filter(ward__ward_number=w_num)
            tot = w_qs.count()
            res = w_qs.filter(status__in=["Work Done", "Resolved", "Closed"]).count()
            pend = tot - res
            wards.append({
                "ward": w_num,
                "ward_name": f"Ward {w_num}",
                "count": tot,
                "pending": pend,
                "resolved": res,
            })
        return Response({"dept_id": dept_id, "wards": wards}, status=status.HTTP_200_OK)
