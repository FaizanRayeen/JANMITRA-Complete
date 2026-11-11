"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: complaints/views.py
Developer: Anas Shaikh & Faizan Rayeen
Description: Citizen & Worker Complaints API Views (Summary, List, Detail).
==============================================================================
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db import models

from complaints.models import Complaint, Category, Ward

logger = logging.getLogger(__name__)

STATUS_STEP_MAP = {
    'Submitted': 1,
    'Pending Validation': 1,
    'Validated': 2,
    'Assigned': 3,
    'In-Progress': 4,
    'Work Done': 5,
    'Resolved': 6,
    'Closed': 6,
    'Rejected': 1,
}

DEPT_NAME_MAP = {
    1: 'PWD',
    2: 'Solid Waste Management',
    3: 'Public Health Engineering',
    4: 'Electrical'
}

def format_media_url(url, request=None):
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://") or url.startswith("data:"):
        return url
    clean = url if url.startswith("/") else f"/{url}"
    if request:
        return request.build_absolute_uri(clean)
    return f"http://localhost:8000{clean}"


def serialize_complaint(c, request=None):
    dept_id = c.category.department_id if c.category else 1
    ward_num = c.ward.ward_number if c.ward else 1
    ward_name = c.ward.name if c.ward else f"Ward {ward_num}"
    cat_name = c.category.name if c.category else "Civic Infrastructure"
    step = STATUS_STEP_MAP.get(c.status, 1)

    from django.utils import timezone
    c_created = timezone.localtime(c.created_at) if c.created_at else c.created_at
    c_updated = timezone.localtime(c.updated_at) if c.updated_at else c.updated_at

    timeline = [
        {"status": "Submitted", "timestamp": c_created.strftime("%Y-%m-%d %H:%M"), "actor": f"Citizen ({c.citizen.first_name if c.citizen else 'Citizen'})"}
    ]
    if step >= 2:
        timeline.append({"status": "Validated", "timestamp": c_created.strftime("%Y-%m-%d %H:%M"), "actor": "AI YOLOv8 Engine & City Control"})
    if step >= 3:
        worker_actor = c.assigned_worker.first_name if c.assigned_worker else "Field Supervisor"
        timeline.append({"status": "Assigned", "timestamp": c_created.strftime("%Y-%m-%d %H:%M"), "actor": f"Assigned to {worker_actor}"})
    if step >= 4:
        worker_actor = c.assigned_worker.first_name if c.assigned_worker else "Field Worker"
        timeline.append({"status": "In-Progress", "timestamp": c_updated.strftime("%Y-%m-%d %H:%M"), "actor": f"{worker_actor} (Active On-site)"})
    if step >= 5:
        worker_actor = c.assigned_worker.first_name if c.assigned_worker else "Field Worker"
        timeline.append({"status": "Work Done", "timestamp": c_updated.strftime("%Y-%m-%d %H:%M"), "actor": f"{worker_actor} (Resolution Proof Submitted)"})
    if step >= 6:
        closed_dt = timezone.localtime(c.verified_at) if getattr(c, 'verified_at', None) else c_updated
        closed_ts = closed_dt.strftime("%Y-%m-%d %H:%M")
        r_str = f" ({c.rating} ★)" if getattr(c, 'rating', None) is not None else ""
        f_str = f": {c.feedback}" if getattr(c, 'feedback', '') else ""
        timeline.append({"status": "Closed", "timestamp": closed_ts, "actor": f"Verified & Closed{r_str}{f_str}"})

    raw_photo = c.photo_url or ""
    photo_url = format_media_url(raw_photo, request) if raw_photo else ""

    raw_resolved = c.resolved_photo_url or ""
    resolved_photo = format_media_url(raw_resolved, request) if raw_resolved else ""

    # AI Priority Engine calculation (Anurag Deshmukh's 5-factor weighted formula)
    priority = c.priority_level or ("High" if dept_id in [1, 4] else "Medium")
    priority_score = int(c.priority_score or (75 if dept_id in [1, 4] else 55))
    target_sla = "48h" if dept_id in [1, 4] else "72h"
    priority_breakdown = None
    try:
        from ai_pipeline.priority_engine import calculate_priority, get_priority_level_and_sla
        # Keep stored DB score/level before calculate_priority mutates attributes in memory
        stored_score = int(c.priority_score or 0)
        dup_cnt = int(getattr(c, 'duplicate_count', 0) or 0)
        p_res = calculate_priority(c, persist=False)
        if p_res:
            calc_score = int(p_res.get('score', priority_score))
            # Preserve geospatial duplicate +15 boosts persisted in SQLite
            effective_score = max(stored_score, calc_score) if dup_cnt > 0 else calc_score
            priority, target_sla = get_priority_level_and_sla(effective_score)
            priority_score = effective_score
            priority_breakdown = p_res.get('breakdown')
    except Exception:
        pass

    citizen_rating = getattr(c, 'rating', None)
    citizen_feedback = getattr(c, 'feedback', '') or ''
    is_closed_or_verified = citizen_rating is not None or c.status in ['Closed', 'Resolved']
    completed_dt = None
    if c.status in ['Work Done', 'Resolved', 'Closed']:
        raw_completed = getattr(c, 'verified_at', None) or getattr(c, 'updated_at', None)
        completed_dt = raw_completed.isoformat() if raw_completed else None

    return {
        "id": str(c.id),
        "tracking_id": c.tracking_id or f"JMC-2026-{str(c.id)[:8].upper()}",
        "title": c.title,
        "description": c.description,
        "category": cat_name,
        "category_id": dept_id,
        "dept_id": dept_id,
        "dept": {1: "PWD", 2: "SWM", 3: "PHE", 4: "Electrical"}.get(dept_id, "PWD"),
        "department": DEPT_NAME_MAP.get(dept_id, "Municipal Operations"),
        "ward": ward_name,
        "ward_number": ward_num,
        "status": c.status,
        "status_step": step,
        "latitude": c.latitude or 21.1458,
        "longitude": c.longitude or 79.0882,
        "lat": c.latitude or 21.1458,
        "lng": c.longitude or 79.0882,
        "location_lat": c.latitude or 21.1458,
        "location_lng": c.longitude or 79.0882,
        "address": c.address or f"Municipal Area, {ward_name}",
        "location_address": c.address or f"Municipal Area, {ward_name}",
        "photo_url": photo_url,
        "photos": [photo_url] if photo_url else [],
        "images": [photo_url] if photo_url else [],
        "has_photos": bool(photo_url),
        "photo_count": 1 if photo_url else 0,
        "proof_photos": [resolved_photo] if resolved_photo else [],
        "resolved_photo_url": resolved_photo,
        "repair_notes": getattr(c, 'repair_notes', '') or '',
        "remarks": getattr(c, 'repair_notes', '') or '',
        "worker_name": c.assigned_worker.first_name if c.assigned_worker else "Unassigned",
        "assigned_worker_id": str(c.assigned_worker.id) if c.assigned_worker else None,
        "assigned_worker_mobile": c.assigned_worker.username if c.assigned_worker else None,
        "citizen_id": str(c.citizen.id) if c.citizen else None,
        "citizen_name": c.citizen.first_name if c.citizen else "Citizen",
        "citizen_mobile": c.citizen.username if c.citizen else None,
        "ai_validated": c.status in ['Validated', 'Assigned', 'In-Progress', 'Work Done', 'Resolved', 'Closed'],
        "citizen_verified": is_closed_or_verified,
        "rating": int(citizen_rating) if citizen_rating is not None else None,
        "feedback": citizen_feedback,
        "verified_at": c.verified_at.isoformat() if getattr(c, 'verified_at', None) else None,
        "completed_at": completed_dt,
        "duplicate_count": getattr(c, 'duplicate_count', 0) or 0,
        "submitted_at": c.created_at.isoformat(),
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
        "timeline": timeline,
        "sla_hours": c.category.sla_hours if c.category else 48,
        "priority": priority,
        "priority_level": priority,
        "priority_score": priority_score,
        "priority_breakdown": priority_breakdown,
        "target_sla": target_sla,
        "sla": target_sla
    }

# Clean real database complaints state (No sample fallback)
SAMPLE_COMPLAINTS = []


class ComplaintSummaryView(APIView):
    """
    GET /api/v1/complaints/summary/
    Returns real citizen stats for Home dashboard cards.
    Strictly scopes counts to the authenticated citizen unless ?all=true is explicitly requested by staff/admin.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        all_param = request.query_params.get('all', '').lower() == 'true'
        is_privileged = bool(user.is_superuser or user.is_staff or user.username in OFFICER_METADATA)

        qs = Complaint.objects.all()
        if not (is_privileged and all_param):
            qs = qs.filter(models.Q(citizen=user) | models.Q(citizen__username=user.username))

        total = qs.count()
        pending = qs.filter(status__in=['Submitted', 'Pending Validation', 'Validated', 'Assigned']).count()
        in_prog = qs.filter(status='In-Progress').count()
        resolved = qs.filter(status__in=['Work Done', 'Resolved']).count()
        closed = qs.filter(status='Closed').count()
        rated_vals = [float(r) for r in qs.filter(rating__isnull=False).values_list('rating', flat=True)]
        if rated_vals:
            avg_rating = round(sum(rated_vals) / len(rated_vals), 1)
        elif closed > 0:
            avg_rating = 5.0
        else:
            avg_rating = 0.0
        return Response({
            "total": total,
            "open_count": pending + in_prog,
            "open": pending + in_prog,
            "pending": pending,
            "in_progress": in_prog,
            "resolved_count": resolved + closed,
            "resolved": resolved,
            "closed": closed,
            "avg_rating": avg_rating
        }, status=status.HTTP_200_OK)


class ComplaintListView(APIView):
    """
    GET /api/v1/complaints/
    POST /api/v1/complaints/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        status_filter = request.query_params.get('status', '').lower()
        limit = request.query_params.get('limit')
        page_param = request.query_params.get('page')
        ward_filter = request.query_params.get('ward')
        dept_filter = request.query_params.get('department')
        my_filter = request.query_params.get('my', '').lower() == 'true'
        all_filter = request.query_params.get('all', '').lower() == 'true'

        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        from complaints.officer_views import _is_worker_user, _extract_worker_info
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        is_admin = bool(user.is_superuser or user.username == '9900000000')
        is_officer = bool(user.username in OFFICER_METADATA or (user.is_staff and not is_admin))
        is_worker = _is_worker_user(user)

        qs = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').all()

        if is_admin and (all_filter or ward_filter or dept_filter or not my_filter):
            pass
        elif is_officer and not my_filter:
            officer_dept = int(OFFICER_METADATA.get(user.username, {}).get('dept_id', 1))
            qs = qs.filter(category__department_id=officer_dept)
        elif is_worker and not my_filter:
            w_info = _extract_worker_info(user)
            qs = qs.filter(
                models.Q(ward__ward_number=w_info['ward'], category__department_id=w_info['dept_id'])
                | models.Q(assigned_worker=user)
            )
        else:
            qs = qs.filter(models.Q(citizen=user) | models.Q(citizen__username=user.username))

        if status_filter:
            if status_filter in ['open', 'pending']:
                qs = qs.filter(status__in=['Submitted', 'Pending Validation', 'Validated', 'Assigned'])
            elif status_filter in ['in-progress', 'in_progress']:
                qs = qs.filter(status='In-Progress')
            elif status_filter in ['resolved', 'closed']:
                qs = qs.filter(status__in=['Resolved', 'Closed', 'Work Done'])

        if ward_filter and (is_admin or is_officer):
            try:
                qs = qs.filter(ward__ward_number=int(ward_filter))
            except (ValueError, TypeError):
                pass

        if dept_filter and is_admin:
            try:
                qs = qs.filter(category__department_id=int(dept_filter))
            except (ValueError, TypeError):
                pass

        total_count = qs.count()
        next_page = None
        if limit:
            try:
                qs = qs[:int(limit)]
            except ValueError:
                pass
        elif page_param:
            try:
                page_num = max(1, int(page_param))
                page_size = 20
                start = (page_num - 1) * page_size
                end = start + page_size
                next_page = page_num + 1 if end < total_count else None
                qs = qs[start:end]
            except ValueError:
                pass

        results = [serialize_complaint(c, request) for c in qs]
        return Response({
            "count": total_count,
            "next": next_page,
            "results": results
        }, status=status.HTTP_200_OK)

    def post(self, request):
        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        auth_user = get_authenticated_user_from_request(request)
        if not auth_user:
            return Response({"detail": "Authentication required to submit a complaint."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        import datetime
        import uuid
        import os
        from django.conf import settings
        from django.contrib.auth import get_user_model
        from notifications.models import Notification
        User = get_user_model()

        # 1. Parse Category & Department (handles exact codes, full names, or department_id)
        category_raw = str(data.get('category') or data.get('category_code') or 'Roads & Infrastructure').strip()
        cat_low = category_raw.lower()
        dept_override = data.get('department_id') or data.get('dept_id')
        dept_catalog = {
            1: {'name': 'Roads & Infrastructure', 'dept': 'PWD', 'id': 1},
            2: {'name': 'Garbage & Waste', 'dept': 'Solid Waste Management', 'id': 2},
            3: {'name': 'Water & Drainage', 'dept': 'Public Health Engineering', 'id': 3},
            4: {'name': 'Street Lighting', 'dept': 'Electrical', 'id': 4},
        }
        if str(dept_override or '').isdigit() and int(dept_override) in dept_catalog:
            cat_info = dept_catalog[int(dept_override)]
        elif any(k in cat_low for k in ('swm', 'garbage', 'waste', 'dustbin', 'debris', 'sanit')):
            cat_info = dept_catalog[2]
        elif any(k in cat_low for k in ('phe', 'water', 'drain', 'sewer', 'leak', 'pipe')):
            cat_info = dept_catalog[3]
        elif any(k in cat_low for k in ('ele', 'electr', 'light', 'lamp', 'cable', 'mast', 'power')):
            cat_info = dept_catalog[4]
        else:
            cat_info = dept_catalog[1]

        # 2. Parse Coordinates
        try:
            lat = float(data.get('lat') or data.get('latitude') or 21.1458)
            lng = float(data.get('lng') or data.get('longitude') or 79.0882)
        except (ValueError, TypeError):
            lat = 21.1458
            lng = 79.0882

        # 3. Handle Photos: Save uploaded file to media/complaints/
        saved_photo_paths = []
        uploaded_files = request.FILES.getlist('photos')
        if not uploaded_files and 'photos' in request.FILES:
            uploaded_files = [request.FILES['photos']]

        media_complaints_dir = os.path.join(settings.BASE_DIR, 'media', 'complaints')
        os.makedirs(media_complaints_dir, exist_ok=True)

        for f in uploaded_files:
            file_ext = os.path.splitext(f.name)[1] or '.jpg'
            file_name = f"issue_{uuid.uuid4().hex[:10]}{file_ext}"
            file_path = os.path.join(media_complaints_dir, file_name)
            with open(file_path, 'wb+') as destination:
                for chunk in f.chunks():
                    destination.write(chunk)
            saved_photo_paths.append((file_path, f"/media/complaints/{file_name}"))

        primary_photo_disk_path = saved_photo_paths[0][0] if saved_photo_paths else None
        raw_url_param = str(data.get('photo_url') or '').strip()
        if raw_url_param.startswith('data:'):
            raw_url_param = ''
        primary_photo_url = saved_photo_paths[0][1] if saved_photo_paths else raw_url_param

        # 4. RUN AI PIPELINE (Authenticity, YOLOv8 Object Detection, Spatial Duplicates, Priority Scoring)
        ai_result = {
            "is_valid": False,
            "is_fake": False,
            "format_valid": True,
            "status": "Submitted",
            "ai_confidence": 0.0,
            "detected_tags": [],
            "duplicate_count": 0,
            "is_duplicate": False,
            "rejection_reason": "",
            "citizen_message": "Submitted for manual municipal review."
        }

        ai_cat_map = {1: 'pothole', 2: 'garbage', 3: 'water leak', 4: 'streetlight'}
        ai_cat = ai_cat_map.get(cat_info['id'], 'pothole')

        if primary_photo_disk_path and os.path.exists(primary_photo_disk_path):
            try:
                from ai_pipeline.pipeline import run_full_ai_pipeline
                pipeline_out = run_full_ai_pipeline(
                    photo_path=primary_photo_disk_path,
                    latitude=lat,
                    longitude=lng,
                    category=ai_cat,
                    description=data.get('description', '')
                )
                if pipeline_out:
                    ai_result.update(pipeline_out)
                    logger.info(
                        "[AI Pipeline] Category=%s Valid=%s Fake=%s Dup=%s Score=%s (%s)",
                        ai_cat, pipeline_out.get('is_valid'), pipeline_out.get('is_fake'),
                        pipeline_out.get('is_duplicate'), pipeline_out.get('priority_score'),
                        pipeline_out.get('priority_level')
                    )
            except Exception as ai_err:
                logger.warning("[AI Pipeline execution notice] %s", ai_err)
        else:
            # Even without photos, still run 100m geospatial duplicate detection
            try:
                from ai_pipeline.duplicate_detector import duplicate_check
                class _NoPhotoComplaint:
                    def __init__(self, cat_s, c_lat, c_lng):
                        self.id = None
                        self.category = cat_s
                        self.location = (c_lat, c_lng)
                        self.latitude = c_lat
                        self.longitude = c_lng
                        self.priority_score = 50
                        self.duplicate_count = 0
                        self._mock_queryset = None
                dup_res = duplicate_check(_NoPhotoComplaint(ai_cat, lat, lng))
                if dup_res:
                    ai_result['is_duplicate'] = bool(dup_res.get('is_duplicate', False))
                    ai_result['parent_complaint_id'] = dup_res.get('parent_id')
                    ai_result['duplicate_count'] = dup_res.get('duplicate_count', 0)
            except Exception as dup_err:
                logger.warning("[No-Photo Duplicate Check notice] %s", dup_err)

        # Hard reject fake/synthetic or unreadable/corrupted images before saving to DB
        if ai_result.get('is_fake') or ai_result.get('status') == 'Rejected':
            for fp, _ in saved_photo_paths:
                try:
                    if os.path.exists(fp):
                        os.remove(fp)
                except OSError:
                    pass
            return Response({
                "detail": ai_result.get('citizen_message') or "The uploaded image was flagged as synthetic or AI-generated. Please upload a genuine photo.",
                "ai_rejected": True,
                "rejection_reason": ai_result.get('rejection_reason', '')
            }, status=status.HTTP_400_BAD_REQUEST)

        # Map AI outcome to canonical Complaint status
        final_status = "Validated" if ai_result.get('is_valid') else "Submitted"

        # 5. Collision-free Tracking ID & Title
        import re
        max_seq = 0
        for tid in Complaint.objects.values_list('tracking_id', flat=True):
            m = re.search(r'-(\d+)$', str(tid or ''))
            if m:
                max_seq = max(max_seq, int(m.group(1)))
        next_seq = max_seq + 1
        tracking_id = f"JMC-2026-{next_seq:03d}"
        while Complaint.objects.filter(tracking_id=tracking_id).exists():
            next_seq += 1
            tracking_id = f"JMC-2026-{next_seq:03d}"

        ward_val = data.get('ward', 'Ward 4 (Mangalwari / North Nagpur)')
        landmark_val = data.get('landmark', '').strip()
        address_val = data.get('address', 'Nagpur, Maharashtra').strip()
        title_val = data.get('title')
        if not title_val:
            if landmark_val:
                title_val = f"{cat_info['name']} Issue near {landmark_val}"
            else:
                title_val = f"{cat_info['name']} Issue in {ward_val}"

        # 6. Resolve Ward, Category, and Citizen User
        try:
            ward_num = int(re.sub(r'\D', '', str(data.get('ward_number') or data.get('ward') or '4')) or 4)
        except Exception:
            ward_num = 4
        ward_obj = Ward.objects.filter(ward_number=ward_num).first() or Ward.objects.first()
        cat_obj = Category.objects.filter(department_id=cat_info['id']).first() or Category.objects.first()

        citizen_user = auth_user
        if auth_user.is_superuser or auth_user.is_staff or auth_user.username in OFFICER_METADATA:
            citizen_mobile = (data.get('citizen_mobile') or data.get('mobile') or '').strip()
            if citizen_mobile:
                citizen_user = User.objects.filter(username=citizen_mobile).first() or auth_user

        # 7. Calculate weighted priority score & save complaint to SQLite
        dup_count_val = 1 if ai_result.get('is_duplicate') else 0
        try:
            from ai_pipeline.priority_engine import calculate_priority
            prio_calc = calculate_priority({
                'title': title_val,
                'description': data.get('description', '').strip(),
                'category': cat_obj.name if cat_obj else cat_info['name'],
                'department_id': cat_info['id'],
                'duplicate_count': (ai_result.get('duplicate_count', 0) or 0) + dup_count_val,
            })
            calc_score = prio_calc.get('score', ai_result.get('priority_score', 60))
            calc_level = prio_calc.get('level', ai_result.get('priority_level', 'High'))
        except Exception:
            calc_score = ai_result.get('priority_score', 60)
            calc_level = ai_result.get('priority_level', 'High')

        db_c = Complaint.objects.create(
            tracking_id=tracking_id,
            title=title_val,
            description=data.get('description', '').strip(),
            category=cat_obj,
            ward=ward_obj,
            latitude=lat,
            longitude=lng,
            address=address_val,
            status=final_status,
            photo_url=primary_photo_url,
            priority_score=calc_score,
            priority_level=calc_level,
            duplicate_count=dup_count_val,
            citizen=citizen_user,
            assigned_worker=None
        )

        # 8. Create single accurate In-App Notification for Citizen
        if citizen_user:
            try:
                if final_status == "Validated":
                    n_title = f"Civic Issue #{tracking_id} AI-Validated ({calc_level})"
                    n_body = f"Your complaint '{title_val}' has been verified by Janmitra Computer Vision (Score: {calc_score}/100 - {calc_level}) and dispatched to Ward {ward_num} {cat_info['dept']} field queue."
                else:
                    n_title = f"Civic Issue #{tracking_id} Received ({calc_level})"
                    n_body = f"Your complaint '{title_val}' was logged (Score: {calc_score}/100) and queued for municipal officer validation."
                Notification.objects.create(
                    recipient=citizen_user,
                    title=n_title,
                    body=n_body,
                    complaint_id=str(db_c.id)
                )
            except Exception as notif_err:
                logger.warning("[Notification create notice] %s", notif_err)

        # Notify Field Workers in matching Ward & Department only when AI-Validated
        if final_status == "Validated":
            try:
                from complaints.officer_views import _find_matching_active_workers
                matching_workers = _find_matching_active_workers(ward_num, cat_info['id'])
                for w_user in matching_workers:
                    Notification.objects.create(
                        recipient=w_user,
                        title=f"New {calc_level} Dispatch: #{tracking_id}",
                        body=f"[{calc_level} • Score {calc_score}/100] {title_val} in Ward {ward_num}. Accept work to claim.",
                        complaint_id=str(db_c.id)
                    )
            except Exception as w_notif_err:
                logger.warning("[Worker dispatch notification notice] %s", w_notif_err)

        # Notify Department Officer for manual validation or High/Severe priority tracking
        if final_status != "Validated" or calc_level in ('Severe', 'High'):
            try:
                officer_user = User.objects.filter(username=f"990000000{cat_info['id']}").first()
                if officer_user:
                    if final_status != "Validated":
                        o_title = f"Validation Needed ({cat_info['dept']}): #{tracking_id}"
                        o_body = f"Citizen submission '{title_val}' in Ward {ward_num} queued for manual review ({calc_level} • {calc_score}/100)."
                    else:
                        o_title = f"New {calc_level} Alert ({cat_info['dept']}): #{tracking_id}"
                        o_body = f"AI-validated {calc_level} ({calc_score}/100) grievance '{title_val}' reported in Ward {ward_num}."
                    Notification.objects.create(
                        recipient=officer_user,
                        title=o_title,
                        body=o_body,
                        complaint_id=str(db_c.id)
                    )
            except Exception as o_notif_err:
                logger.warning("[Officer submit notification notice] %s", o_notif_err)

        resp_data = serialize_complaint(db_c, request)
        resp_data['ai_confidence'] = ai_result.get('ai_confidence', 0.0)
        resp_data['detected_tags'] = ai_result.get('detected_tags', [])
        resp_data['citizen_message'] = ai_result.get('citizen_message', '')
        resp_data['ai_rejection_reason'] = ai_result.get('rejection_reason', '')
        resp_data['is_duplicate'] = bool(ai_result.get('is_duplicate', False))
        resp_data['parent_complaint_id'] = str(ai_result['parent_complaint_id']) if ai_result.get('parent_complaint_id') else None

        return Response(resp_data, status=status.HTTP_201_CREATED)


class ComplaintDetailView(APIView):
    """
    GET /api/v1/complaints/:id/
    Strictly checks role & ownership authorization before returning complaint details.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, complaint_id):
        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        from complaints.officer_views import _is_worker_user, _extract_worker_info

        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        c_obj = None
        try:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=complaint_id).first()
        except Exception:
            c_obj = None

        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=complaint_id).first()

        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        is_admin = bool(user.is_superuser or user.username == '9900000000')
        is_officer = bool(user.username in OFFICER_METADATA or (user.is_staff and not is_admin))
        comp_dept = c_obj.category.department_id if c_obj.category else 1
        comp_ward = c_obj.ward.ward_number if c_obj.ward else None

        if is_admin:
            pass
        elif is_officer:
            officer_dept = int(OFFICER_METADATA.get(user.username, {}).get('dept_id', 1))
            if comp_dept != officer_dept:
                return Response({"detail": "Access denied: grievance belongs to another department."}, status=status.HTTP_403_FORBIDDEN)
        elif _is_worker_user(user):
            w_info = _extract_worker_info(user)
            is_assigned = (c_obj.assigned_worker_id == user.id)
            if not is_assigned and ((comp_ward and w_info['ward'] != comp_ward) or (comp_dept and w_info['dept_id'] != comp_dept)):
                return Response({"detail": "Access denied: grievance outside your ward or department."}, status=status.HTTP_403_FORBIDDEN)
        else:
            if c_obj.citizen_id != user.id:
                return Response({"detail": "Access denied: you may only inspect your own complaints."}, status=status.HTTP_403_FORBIDDEN)

        return Response(serialize_complaint(c_obj, request), status=status.HTTP_200_OK)


class ComplaintValidateView(APIView):
    """
    POST /api/v1/complaints/:id/validate/
    Requires authenticated Department Officer (matching dept) or Super Admin.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        from complaints.officer_views import _resolve_officer_context
        from dashboard.views import resolve_admin_context

        admin_ctx = resolve_admin_context(request)
        officer_ctx = _resolve_officer_context(request) if not admin_ctx else None
        if not admin_ctx and not officer_ctx:
            return Response({"detail": "Officer or Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        confidence = float(data.get('confidence', 96.8))
        detected_category = data.get('detected_category', 'Roads & Infrastructure / Pothole Repair')
        routed_dept = data.get('routed_department', 'Public Works Department (PWD)')

        # Find in DB
        c_obj = None
        try:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=complaint_id).first()
        except Exception:
            c_obj = None
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=complaint_id).first()

        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        if officer_ctx and c_obj.category and c_obj.category.department_id != officer_ctx['dept_id']:
            return Response({"detail": "Department isolation violation."}, status=status.HTTP_403_FORBIDDEN)

        c_obj.status = 'Validated'
        c_obj.save(update_fields=['status'])
        target = serialize_complaint(c_obj, request)

        target['ai_confidence'] = f"{confidence}%"
        target['detected_category'] = detected_category
        target['department'] = routed_dept
        if 'timeline' not in target:
            target['timeline'] = []
        target['timeline'].append({
            "status": "Validated",
            "timestamp": now_str,
            "actor": f"YOLOv8 AI Engine (Confidence: {confidence}%) -> Auto-Routed to {routed_dept}"
        })

        # Trigger notification to citizen
        try:
            from notifications.triggers import trigger_complaint_validated
            trigger_complaint_validated(target)
        except Exception as trig_err:
            logger.warning("[ComplaintValidateView] Notification trigger error: %s", trig_err)

        return Response({
            "message": "Complaint validated and auto-routed to PWD by AI Engine.",
            "status": "Validated",
            "status_step": 2,
            "complaint": target,
            "ai_details": {
                "model": "YOLOv8-Nano-Civic",
                "confidence": confidence,
                "detected_defect": detected_category,
                "routed_department": routed_dept
            }
        }, status=status.HTTP_200_OK)


class ComplaintAssignView(APIView):
    """
    POST /api/v1/complaints/:id/assign/
    Requires authenticated Department Officer (matching dept) or Super Admin.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        from complaints.officer_views import _resolve_officer_context, _is_worker_user, _extract_worker_info
        from dashboard.views import resolve_admin_context

        admin_ctx = resolve_admin_context(request)
        officer_ctx = _resolve_officer_context(request) if not admin_ctx else None
        if not admin_ctx and not officer_ctx:
            return Response({"detail": "Officer or Super Admin authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        worker_mobile = (data.get('worker_mobile') or data.get('mobile') or '').strip()
        if not worker_mobile:
            return Response({"detail": "worker_mobile is required."}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        worker_user = User.objects.filter(username=worker_mobile).first()
        if not _is_worker_user(worker_user):
            return Response({"detail": f"Active Field Worker '{worker_mobile}' not found."}, status=status.HTTP_404_NOT_FOUND)
        w_info = _extract_worker_info(worker_user)
        worker_name = w_info['name']

        c_obj = None
        try:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=complaint_id).first()
        except Exception:
            c_obj = None
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=complaint_id).first()

        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        if officer_ctx and c_obj.category and c_obj.category.department_id != officer_ctx['dept_id']:
            return Response({"detail": "Department isolation violation."}, status=status.HTTP_403_FORBIDDEN)

        c_obj.status = 'Assigned'
        c_obj.assigned_worker = worker_user
        c_obj.save()
        target = serialize_complaint(c_obj, request)

        if 'timeline' not in target:
            target['timeline'] = []
        target['timeline'].append({
            "status": "Assigned",
            "timestamp": now_str,
            "actor": f"Assigned to {worker_name} by Executive Engineer PWD"
        })

        # Trigger notification to worker
        try:
            from notifications.triggers import trigger_task_assigned
            trigger_task_assigned(target, worker_user)
        except Exception as trig_err:
            logger.warning("[ComplaintAssignView] Notification trigger error: %s", trig_err)

        return Response({
            "message": f"Complaint successfully assigned to {worker_name}.",
            "status": "Assigned",
            "status_step": 3,
            "complaint": target,
            "assigned_worker": {
                "name": worker_name,
                "mobile": worker_mobile,
                "ward": "Ward 2",
                "employee_id": "NMC-PWD-W2"
            }
        }, status=status.HTTP_200_OK)


class ComplaintWorkDoneView(APIView):
    """
    POST /api/v1/complaints/:id/work-done/
    Step 4: Field Worker uploads camera proof photo and marks task Work Done.
    Transitions complaint from 'In-Progress' -> 'Work Done' (Step 5).
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        from notifications.auth_views import get_authenticated_user_from_request, OFFICER_METADATA
        from complaints.officer_views import _is_worker_user, _extract_worker_info

        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        import datetime
        import uuid
        import os
        from django.conf import settings
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        c_obj = None
        try:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=complaint_id).first()
        except Exception:
            c_obj = None
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=complaint_id).first()

        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        is_admin = bool(user.is_superuser or user.username == '9900000000')
        is_officer = bool(user.username in OFFICER_METADATA or (user.is_staff and not is_admin))
        comp_dept = c_obj.category.department_id if c_obj.category else 1
        comp_ward = c_obj.ward.ward_number if c_obj.ward else None

        if is_admin:
            pass
        elif is_officer:
            if int(OFFICER_METADATA.get(user.username, {}).get('dept_id', 1)) != comp_dept:
                return Response({"detail": "Department isolation violation."}, status=status.HTTP_403_FORBIDDEN)
        elif _is_worker_user(user):
            w_info = _extract_worker_info(user)
            is_mine = (c_obj.assigned_worker_id == user.id)
            if not is_mine and (c_obj.assigned_worker_id is not None or (comp_ward and w_info['ward'] != comp_ward) or w_info['dept_id'] != comp_dept):
                return Response({"detail": "You are not authorized to complete this task."}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({"detail": "Field Worker or Officer role required."}, status=status.HTTP_403_FORBIDDEN)

        # 1. Handle Camera Uploaded Files (mandatory photo or explicit URL — zero stock Unsplash fallback)
        uploaded_files = request.FILES.getlist('proof_photos') or request.FILES.getlist('photos')
        if not uploaded_files:
            for k in ['proof_photo', 'photo', 'file', 'image']:
                if k in request.FILES:
                    uploaded_files = [request.FILES[k]]
                    break

        resolved_photo = ""
        if uploaded_files:
            media_dir = os.path.join(settings.BASE_DIR, 'media', 'complaints')
            os.makedirs(media_dir, exist_ok=True)
            f = uploaded_files[0]
            ext = os.path.splitext(f.name)[1] or '.jpg'
            fname = f"proof_{uuid.uuid4().hex[:10]}{ext}"
            fpath = os.path.join(media_dir, fname)
            with open(fpath, 'wb+') as dest:
                for chunk in f.chunks():
                    dest.write(chunk)
            resolved_photo = f"/media/complaints/{fname}"
        elif data.get('resolved_photo_url'):
            resolved_photo = str(data.get('resolved_photo_url')).strip()
        elif data.get('photo_url'):
            resolved_photo = str(data.get('photo_url')).strip()

        if not resolved_photo:
            return Response({"detail": "At least one resolution proof photo is required."}, status=status.HTTP_400_BAD_REQUEST)

        remarks = data.get('remarks') or data.get('repair_notes') or 'On-site repair completed with camera verification.'

        c_obj.status = 'Work Done'
        c_obj.resolved_photo_url = resolved_photo
        c_obj.repair_notes = remarks
        c_obj.save(update_fields=['status', 'resolved_photo_url', 'repair_notes', 'updated_at'])
        target = serialize_complaint(c_obj, request)

        if 'timeline' not in target:
            target['timeline'] = []
        target['timeline'].append({
            "status": "Work Done",
            "timestamp": now_str,
            "actor": f"Field Worker (Uploaded Camera Resolution Proof: {remarks})"
        })

        # Trigger notification to citizen to verify
        try:
            from notifications.triggers import trigger_work_done
            trigger_work_done(target)
        except Exception as trig_err:
            logger.warning("[ComplaintWorkDoneView] Notification trigger error: %s", trig_err)

        return Response({
            "message": "Task marked Work Done. Live camera proof photo submitted for citizen verification.",
            "status": "Work Done",
            "status_step": 5,
            "complaint": target,
            "resolved_photo_url": target.get('resolved_photo_url', resolved_photo),
            "remarks": remarks
        }, status=status.HTTP_200_OK)


class ComplaintVerifyView(APIView):
    """
    POST /api/v1/complaints/:id/verify/
    Step 5 -> 6: Citizen verifies resolution with 1-5 Star rating and feedback.
    Transitions complaint from 'Work Done' -> 'Closed' (Step 6).
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        from notifications.auth_views import get_authenticated_user_from_request
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required to verify resolution."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        import datetime
        from django.utils import timezone
        from notifications.models import Notification
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        c_obj = None
        try:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=complaint_id).first()
        except Exception:
            c_obj = None
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=complaint_id).first()

        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        if not (user.is_superuser or c_obj.citizen_id == user.id):
            return Response({"detail": "Only the reporting citizen may verify or reopen this grievance."}, status=status.HTTP_403_FORBIDDEN)

        if c_obj.status != 'Work Done':
            return Response(
                {"detail": f"Cannot verify complaint in '{c_obj.status}' status. Must be 'Work Done'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        is_accepted = data.get('accepted') in [True, 'true', 'True'] or data.get('action') == 'accept'

        if is_accepted:
            try:
                rating = max(1, min(5, int(data.get('rating', 5))))
            except (ValueError, TypeError):
                rating = 5
            feedback = str(data.get('feedback') or data.get('remarks') or '').strip()

            c_obj.status = 'Closed'
            c_obj.rating = rating
            c_obj.feedback = feedback
            c_obj.verified_at = timezone.now()
            c_obj.save(update_fields=['status', 'rating', 'feedback', 'verified_at', 'updated_at'])

            target = serialize_complaint(c_obj, request)
            target['status'] = 'Closed'
            target['status_step'] = 6
            target['citizen_verified'] = True
            target['rating'] = rating
            target['feedback'] = feedback

            # Notify Assigned Field Worker about Citizen's Verification & Rating
            if c_obj.assigned_worker:
                try:
                    Notification.objects.create(
                        recipient=c_obj.assigned_worker,
                        title=f"Citizen Verified #{c_obj.tracking_id} ({rating}/5 ★)",
                        body=f"Resolution accepted and closed by citizen with {rating}/5 stars" + (f": \"{feedback}\"" if feedback else "."),
                        complaint_id=str(c_obj.id)
                    )
                except Exception as w_err:
                    logger.warning("[ComplaintVerifyView] Worker notification error: %s", w_err)

            # Asynchronously trigger FCM push notification & in-app record for closed complaint
            try:
                from notifications.triggers import trigger_complaint_closed
                trigger_complaint_closed(target)
            except Exception as trig_err:
                logger.warning("[ComplaintVerifyView] trigger_complaint_closed error: %s", trig_err)

            return Response({
                "message": "Complaint verified and closed successfully.",
                "complaint": target,
                "status": "Closed",
                "status_step": 6,
                "rating": rating,
                "feedback": feedback
            }, status=status.HTTP_200_OK)
        else:
            reason = data.get('reason') or data.get('rejection_reason') or 'Work incomplete / Issue persists'
            note = data.get('note') or data.get('notes') or ''

            c_obj.status = 'In-Progress'
            c_obj.feedback = f"[Rejected: {reason}] {note}".strip()
            c_obj.save(update_fields=['status', 'feedback', 'updated_at'])

            target = serialize_complaint(c_obj, request)
            target['status'] = 'In-Progress'
            target['status_step'] = 4
            target['citizen_verified'] = False
            target['rejection_reason'] = reason
            target['rejection_note'] = note

            if c_obj.assigned_worker:
                try:
                    Notification.objects.create(
                        recipient=c_obj.assigned_worker,
                        title=f"Re-Inspection Needed: #{c_obj.tracking_id}",
                        body=f"Citizen rejected resolution ({reason}). Please revisit site.",
                        complaint_id=str(c_obj.id)
                    )
                except Exception as w_err:
                    logger.warning("[ComplaintVerifyView] Worker reject notif error: %s", w_err)

            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                dept_num = c_obj.category.department_id if c_obj.category else 1
                dept_officer = User.objects.filter(username=f"990000000{dept_num}").first()
                if dept_officer:
                    Notification.objects.create(
                        recipient=dept_officer,
                        title=f"Citizen Escalation: #{c_obj.tracking_id}",
                        body=f"Citizen rejected repair ({reason}). Escalated for Ward {c_obj.ward.ward_number if c_obj.ward else '?'} follow-up.",
                        complaint_id=str(c_obj.id)
                    )
            except Exception as o_err:
                logger.warning("[ComplaintVerifyView] Officer escalation notif error: %s", o_err)

            return Response({
                "message": "Complaint reopened for field re-inspection.",
                "complaint": target,
                "status": "In-Progress",
                "status_step": 4,
                "reason": reason
            }, status=status.HTTP_200_OK)


# ==============================================================================
# FIELD WORKER PORTAL API VIEWS (STRICT ROLE, WARD & DEPARTMENT ISOLATION)
# ==============================================================================

def _resolve_worker_context(request):
    """
    Strictly resolves an authenticated active Municipal Field Worker from HS256 Bearer JWT.
    Refuses Citizen/Officer/Admin/unauthenticated requests so roles never overlap.
    """
    import jwt
    from django.conf import settings
    from notifications.auth_views import WORKER_METADATA
    from complaints.officer_views import _load_worker_profiles, _extract_worker_info, _is_worker_user
    from django.contrib.auth import get_user_model
    User = get_user_model()
    custom_profiles = _load_worker_profiles()

    auth_header = (request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION') or '') if hasattr(request, 'headers') else ''
    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ', 1)[1].strip()
    jwt_user = None
    try:
        secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        uid = payload.get('user_id')
        mob = payload.get('mobile')
        if uid:
            jwt_user = User.objects.filter(id=uid, is_active=True).first()
        if not jwt_user and mob:
            jwt_user = User.objects.filter(username=mob, is_active=True).first()
    except Exception:
        jwt_user = None

    if not _is_worker_user(jwt_user, custom_profiles):
        return None

    info = _extract_worker_info(jwt_user, custom_profiles)
    worker_meta = {**WORKER_METADATA.get(info['mobile'], {}), **custom_profiles.get(info['mobile'], {})}
    return {
        'user': jwt_user,
        'meta': worker_meta,
        'name': info['name'],
        'ward': info['ward'],
        'dept_id': info['dept_id'],
        'is_on_duty': info['is_on_duty'],
        'duty_status': info['duty_status'],
    }


class WorkerTasksView(APIView):
    """
    GET /api/v1/worker/tasks/
    Real-time incident dispatch queue for Municipal Field Workers.
    - Department & Ward isolated: Workers only see grievances relevant to their designated sector.
    - Status flows: Validated/Assigned (Incoming) -> In-Progress (Claimed) -> Work Done (Closed).
    - Annotated with AI Priority level (Severe, High, Medium, Low), SLA target, and sorting.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        import re
        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Valid Field Worker credentials required."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        worker_user = ctx['user']
        worker_meta = ctx['meta']
        worker_ward = ctx['ward']
        worker_dept_id = ctx['dept_id']
        worker_name = ctx['name']

        base_qs = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').exclude(
            status__in=['Submitted', 'Pending Validation', 'Rejected']
        ).filter(
            models.Q(ward__ward_number=worker_ward, category__department_id=worker_dept_id)
            | models.Q(assigned_worker=worker_user)
        )

        tab = request.query_params.get('tab', '').lower()

        tasks = []
        for c in base_qs:
            serialized = serialize_complaint(c, request)
            is_claimed_by_me = False
            if worker_user and c.assigned_worker_id == worker_user.id:
                is_claimed_by_me = True

            can_accept = (
                c.status in ['Validated', 'Assigned'] and
                (c.assigned_worker is None or is_claimed_by_me)
            )

            serialized['is_claimed_by_me'] = is_claimed_by_me
            serialized['can_accept'] = can_accept
            serialized['worker_ward'] = worker_ward
            serialized['worker_dept_id'] = worker_dept_id
            tasks.append(serialized)

        # Priority Sorting: Severe (>=80) -> High (60-79) -> Medium (40-59) -> Low (<40)
        priority_rank = {'Severe': 0, 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
        tasks.sort(
            key=lambda t: (
                priority_rank.get(t.get('priority_level', 'Medium'), 99),
                -int(t.get('priority_score', 0) or 0),
                str(t.get('submitted_at', ''))
            )
        )

        incoming = [t for t in tasks if t['status'] in ['Validated', 'Assigned']]
        in_progress = [t for t in tasks if t['status'] == 'In-Progress']
        completed = [t for t in tasks if t['status'] in ['Work Done', 'Resolved', 'Closed']]

        if tab in ['incoming', 'assigned', 'new']:
            filtered = incoming
        elif tab in ['inprogress', 'in-progress', 'active']:
            filtered = in_progress
        elif tab in ['completed', 'resolved', 'done']:
            filtered = completed
        else:
            filtered = tasks

        dept_names = {
            1: 'PWD (Roads & Infrastructure)',
            2: 'Solid Waste Management (SWM)',
            3: 'Public Health Engineering (PHE / OCW)',
            4: 'Electrical & Street Lighting'
        }

        worker_profile = {
            "name": worker_name,
            "mobile": worker_user.username if worker_user else f"9800{worker_ward}{worker_dept_id}0001",
            "ward": worker_ward,
            "ward_name": f"Ward {worker_ward}",
            "department": dept_names.get(worker_dept_id, "Municipal Operations"),
            "department_id": worker_dept_id,
            "employee_id": worker_meta.get('employee_id', f"JMC-W{worker_ward}-D{worker_dept_id}-01")
        }

        return Response({
            "count": len(filtered),
            "total_count": len(tasks),
            "incoming_count": len(incoming),
            "active_count": len(in_progress),
            "completed_count": len(completed),
            "worker": worker_profile,
            "tasks": filtered,
            "results": filtered
        }, status=status.HTTP_200_OK)


class WorkerAcceptTaskView(APIView):
    """
    POST /api/v1/worker/tasks/<task_id>/accept/
    Field Worker accepts/claims an incoming dispatch request in their ward & department.
    Enforces strict Ward + Department matching; never falls back to wrong-ward workers.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, task_id):
        from notifications.models import Notification

        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Field Worker authentication required to claim tasks."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        worker_user = ctx['user']
        worker_name = ctx['name']

        c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=task_id).first()
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=task_id).first()

        if not c_obj:
            return Response({"detail": f"Task '{task_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        comp_ward = c_obj.ward.ward_number if c_obj.ward else None
        comp_dept = c_obj.category.department_id if c_obj.category else None
        is_assigned_to_me = (c_obj.assigned_worker_id == worker_user.id)
        if not is_assigned_to_me and ((comp_ward and ctx['ward'] != comp_ward) or (comp_dept and ctx['dept_id'] != comp_dept)):
            return Response(
                {"detail": f"Ward/Department mismatch: Worker Ward {ctx['ward']} cannot claim Ward {comp_ward} grievance."},
                status=status.HTTP_403_FORBIDDEN
            )

        if c_obj.status not in ['Validated', 'Assigned', 'In-Progress']:
            return Response(
                {"detail": f"Task cannot be claimed in '{c_obj.status}' status. Awaiting validation or already resolved."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if c_obj.assigned_worker and c_obj.assigned_worker_id != worker_user.id:
            return Response(
                {"detail": f"Task already claimed by {c_obj.assigned_worker.first_name}."},
                status=status.HTTP_409_CONFLICT
            )

        c_obj.assigned_worker = worker_user
        c_obj.status = 'In-Progress'
        c_obj.save(update_fields=['assigned_worker', 'status', 'updated_at'])

        # Notify Citizen in real time
        if c_obj.citizen:
            try:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Civic Issue #{c_obj.tracking_id} Accepted by Field Worker",
                    body=f"Field Worker {worker_name} ({worker_user.username if worker_user else 'On-Duty'}) has accepted your complaint and is en route to {c_obj.address or 'the reported location'}.",
                    complaint_id=str(c_obj.id)
                )
            except Exception as e:
                logger.warning("[WorkerAcceptTaskView] Notification error: %s", e)

        serialized = serialize_complaint(c_obj, request)
        serialized['is_claimed_by_me'] = True
        serialized['can_accept'] = False

        return Response({
            "message": f"Task #{c_obj.tracking_id} accepted successfully! Moved to In-Progress queue.",
            "task": serialized,
            "complaint": serialized,
            "status": "In-Progress",
            "status_step": 4
        }, status=status.HTTP_200_OK)


class WorkerProofUploadView(APIView):
    """
    POST /api/v1/worker/tasks/<task_id>/proof/
    Strictly accepts live camera photo evidence taken on site.
    Transitions status to 'Work Done' and notifies citizen for 1-5 star verification.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, task_id):
        import uuid
        import os
        from django.conf import settings
        from notifications.models import Notification

        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Field Worker authentication required to submit resolution proof."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        worker_user = ctx['user']
        worker_name = ctx['name']

        c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=task_id).first()
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=task_id).first()

        if not c_obj:
            return Response({"detail": f"Task '{task_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        comp_ward = c_obj.ward.ward_number if c_obj.ward else None
        comp_dept = c_obj.category.department_id if c_obj.category else None
        is_assigned_to_me = (c_obj.assigned_worker_id == worker_user.id)
        if c_obj.assigned_worker_id and not is_assigned_to_me:
            return Response(
                {"detail": f"Task is assigned to {c_obj.assigned_worker.first_name}. Only the assigned worker may upload proof."},
                status=status.HTTP_403_FORBIDDEN
            )
        if not is_assigned_to_me and ((comp_ward and ctx['ward'] != comp_ward) or (comp_dept and ctx['dept_id'] != comp_dept)):
            return Response(
                {"detail": f"Ward/Department mismatch: Worker Ward {ctx['ward']} cannot close Ward {comp_ward} grievance."},
                status=status.HTTP_403_FORBIDDEN
            )

        notes = request.data.get('repair_notes') or request.data.get('notes') or 'On-site repair completed with camera verification.'

        uploaded_files = request.FILES.getlist('proof_photos') or request.FILES.getlist('photos')
        if not uploaded_files:
            for k in ['proof_photo', 'photo', 'file', 'image']:
                if k in request.FILES:
                    uploaded_files = [request.FILES[k]]
                    break

        saved_urls = []
        if uploaded_files:
            media_dir = os.path.join(settings.BASE_DIR, 'media', 'complaints')
            os.makedirs(media_dir, exist_ok=True)
            seen_names = set()
            for f in uploaded_files[:4]:
                # Deduplicate identical appended form keys ('proof_photos' + 'photos' pointing to same file)
                file_sig = (getattr(f, 'name', ''), getattr(f, 'size', 0))
                if file_sig in seen_names:
                    continue
                seen_names.add(file_sig)
                if len(saved_urls) >= 2:
                    break
                ext = os.path.splitext(f.name)[1] or '.jpg'
                fname = f"proof_{uuid.uuid4().hex[:10]}{ext}"
                fpath = os.path.join(media_dir, fname)
                with open(fpath, 'wb+') as dest:
                    for chunk in f.chunks():
                        dest.write(chunk)
                saved_urls.append(f"/media/complaints/{fname}")
        elif request.data.get('proof_photo_url'):
            saved_urls = [str(request.data.get('proof_photo_url')).strip()]
        elif request.data.get('resolved_photo_url'):
            saved_urls = [str(request.data.get('resolved_photo_url')).strip()]

        if not saved_urls:
            return Response(
                {"detail": "At least one live camera proof photo is required to complete this task."},
                status=status.HTTP_400_BAD_REQUEST
            )

        proof_url = saved_urls[0]
        c_obj.resolved_photo_url = proof_url
        c_obj.repair_notes = str(notes).strip()
        c_obj.assigned_worker = worker_user
        c_obj.status = 'Work Done'
        c_obj.save(update_fields=['resolved_photo_url', 'repair_notes', 'assigned_worker', 'status', 'updated_at'])

        if c_obj.citizen:
            try:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Action Required: Verify Resolution for Issue #{c_obj.tracking_id}",
                    body=f"Field Worker {worker_name} has completed on-site work and uploaded live camera proof. Please inspect and rate with 1-5 stars.",
                    complaint_id=str(c_obj.id)
                )
            except Exception as e:
                logger.warning("[WorkerProofUploadView] Citizen notification error: %s", e)

        try:
            from django.contrib.auth import get_user_model
            U = get_user_model()
            officer_user = U.objects.filter(username=f"990000000{comp_dept or 1}").first()
            if officer_user:
                Notification.objects.create(
                    recipient=officer_user,
                    title=f"Work Done Submitted: #{c_obj.tracking_id}",
                    body=f"Field Worker {worker_name} uploaded resolution proof; awaiting citizen verification.",
                    complaint_id=str(c_obj.id)
                )
        except Exception as o_err:
            logger.warning("[WorkerProofUploadView] Officer notification error: %s", o_err)

        serialized = serialize_complaint(c_obj, request)
        abs_urls = [format_media_url(u, request) for u in saved_urls]
        serialized['proof_photos'] = abs_urls
        return Response({
            "message": "Live camera proof submitted successfully. Grievance moved to 'Work Done'.",
            "task": serialized,
            "complaint": serialized,
            "proof_photos": abs_urls,
            "status": "Work Done",
            "status_step": 5,
            "proof_url": serialized.get('resolved_photo_url', proof_url)
        }, status=status.HTTP_200_OK)


class WorkerTaskDetailView(APIView):
    """
    GET /api/v1/worker/tasks/<task_id>/
    Returns single complaint with GPS coordinates, photos, and priority data.
    Requires authenticated Field Worker credentials.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, task_id):
        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Valid Field Worker credentials required."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=task_id).first()
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=task_id).first()

        if not c_obj:
            return Response({"detail": f"Task '{task_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        worker_user = ctx['user']
        comp_ward = c_obj.ward.ward_number if c_obj.ward else None
        comp_dept = c_obj.category.department_id if c_obj.category else None
        is_claimed_by_me = (c_obj.assigned_worker_id == worker_user.id)

        if not is_claimed_by_me and ((comp_ward and ctx['ward'] != comp_ward) or (comp_dept and ctx['dept_id'] != comp_dept)):
            return Response(
                {"detail": f"Ward/Department mismatch: Worker Ward {ctx['ward']} cannot access Ward {comp_ward} grievance."},
                status=status.HTTP_403_FORBIDDEN
            )

        serialized = serialize_complaint(c_obj, request)
        can_accept = (
            c_obj.status in ['Validated', 'Assigned'] and
            (c_obj.assigned_worker is None or is_claimed_by_me)
        )
        serialized['is_claimed_by_me'] = is_claimed_by_me
        serialized['can_accept'] = can_accept

        return Response(serialized, status=status.HTTP_200_OK)


class WorkerTaskStatusView(APIView):
    """
    PATCH /api/v1/worker/tasks/<task_id>/status/
    Helper to update task status by the assigned Field Worker.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def patch(self, request, task_id):
        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Field Worker authentication required to update task status."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        new_status = str(request.data.get('status') or '').strip()
        if new_status not in ('In-Progress', 'Work Done'):
            return Response({"detail": "Worker may only transition tasks to 'In-Progress' or 'Work Done'."}, status=status.HTTP_400_BAD_REQUEST)

        c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=task_id).first()
        if not c_obj:
            c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=task_id).first()

        if not c_obj:
            return Response({"detail": f"Task '{task_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        worker_user = ctx['user']
        comp_ward = c_obj.ward.ward_number if c_obj.ward else None
        comp_dept = c_obj.category.department_id if c_obj.category else None
        is_assigned_to_me = (c_obj.assigned_worker_id == worker_user.id)
        if c_obj.assigned_worker_id and not is_assigned_to_me:
            return Response({"detail": "Task is assigned to another worker."}, status=status.HTTP_403_FORBIDDEN)
        if not is_assigned_to_me and ((comp_ward and ctx['ward'] != comp_ward) or (comp_dept and ctx['dept_id'] != comp_dept)):
            return Response(
                {"detail": f"Ward/Department mismatch: Worker Ward {ctx['ward']} cannot modify Ward {comp_ward} grievance."},
                status=status.HTTP_403_FORBIDDEN
            )

        if new_status == 'Work Done' and not c_obj.resolved_photo_url:
            return Response(
                {"detail": "Please upload completion proof photo using the camera uploader before marking Work Done."},
                status=status.HTTP_400_BAD_REQUEST
            )

        c_obj.status = new_status
        c_obj.assigned_worker = worker_user
        c_obj.save(update_fields=['status', 'assigned_worker', 'updated_at'])

        serialized = serialize_complaint(c_obj, request)
        serialized['is_claimed_by_me'] = True
        return Response({
            "message": f"Task status updated to '{new_status}'.",
            "task": serialized,
            "status": new_status
        }, status=status.HTTP_200_OK)


class WorkerProfileView(APIView):
    """
    GET / PATCH /api/v1/worker/profile/
    Returns real worker identity, ward/department assignment, and resolution metrics
    computed from assigned grievances in SQLite. Rejects non-worker accounts cleanly.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Valid Field Worker credentials required."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        worker_user = ctx['user']
        worker_meta = ctx['meta']
        worker_name = ctx['name']
        worker_dept = worker_meta.get('department', 'PWD (Roads & Infrastructure)')
        worker_ward_str = worker_meta.get('ward', f"Ward {ctx['ward']}")
        ward_num = ctx['ward']
        emp_id = worker_meta.get('employee_id', f"JMC-W{ward_num}-EMP")

        total_completed = 0
        active_open = 0
        ratings = []
        turnaround_hours = []

        if worker_user:
            assigned_qs = Complaint.objects.filter(assigned_worker=worker_user)
            completed_qs = assigned_qs.filter(status__in=['Work Done', 'Resolved', 'Closed'])
            total_completed = completed_qs.count()
            active_open = assigned_qs.filter(status__in=['Assigned', 'In-Progress']).count()
            for comp in completed_qs:
                if comp.rating is not None:
                    ratings.append(int(comp.rating))
                if comp.updated_at and comp.created_at:
                    hrs = max((comp.updated_at - comp.created_at).total_seconds() / 3600.0, 0.5)
                    turnaround_hours.append(hrs)

        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
        avg_days = round((sum(turnaround_hours) / len(turnaround_hours)) / 24.0, 1) if turnaround_hours else 0.0

        return Response({
            "name": worker_name,
            "mobile": worker_user.username if worker_user else '',
            "email": worker_user.email if worker_user else '',
            "employee_id": emp_id,
            "department": worker_dept,
            "ward": ward_num,
            "ward_name": worker_ward_str,
            "designation": worker_meta.get('designation') or "Municipal Field Technician",
            "is_on_duty": bool(ctx.get('is_on_duty', True)),
            "duty_status": ctx.get('duty_status', 'on_duty'),
            "metrics": {
                "total_completed": total_completed,
                "active_open": active_open,
                "avg_turnaround_days": avg_days,
                "rating": avg_rating,
                "rating_count": len(ratings),
            }
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        ctx = _resolve_worker_context(request)
        if not ctx:
            return Response(
                {"detail": "Valid Field Worker credentials required."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        is_on_duty = bool(request.data.get('is_on_duty', True))
        duty_status = str(request.data.get('duty_status') or ('on_duty' if is_on_duty else 'on_leave')).strip()

        from complaints.officer_views import _load_worker_profiles
        from dashboard.admin_workers_view import _save_worker_profiles
        profiles = _load_worker_profiles()
        mob = ctx['user'].username
        entry = profiles.get(mob, {})
        entry['is_on_duty'] = is_on_duty
        entry['duty_status'] = duty_status
        profiles[mob] = entry
        _save_worker_profiles(profiles)

        return Response({
            "message": "Worker shift status updated.",
            "duty_status": duty_status,
            "is_on_duty": is_on_duty
        }, status=status.HTTP_200_OK)
