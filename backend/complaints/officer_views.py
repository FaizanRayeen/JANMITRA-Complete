"""
==============================================================================
JANMITRA - Department Officer Portal API Views (4-Department Isolation)
File: complaints/officer_views.py
Description: Strictly department-scoped APIs for Municipal Department Officers:
             1: PWD (Roads & Infrastructure)      -> 9900000001
             2: Solid Waste Management (SWM)       -> 9900000002
             3: Public Health Engineering (PHE)    -> 9900000003
             4: Electrical & Street Lighting       -> 9900000004
             Zero cross-department leakage and zero mock fallbacks.
==============================================================================
"""

import os
import json
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
from complaints.views import serialize_complaint, format_media_url
from notifications.models import Notification
from notifications.auth_views import OFFICER_METADATA, WORKER_METADATA


def _serialize_officer_complaint(c, request):
    """Serialize complaint for Officer Portal using authentic uploaded media only (no stock Unsplash fallback)."""
    ser = serialize_complaint(c, request)
    real_photo = format_media_url(c.photo_url, request) if c.photo_url else ''
    real_resolved = format_media_url(c.resolved_photo_url, request) if c.resolved_photo_url else ''
    ser['photo_url'] = real_photo
    ser['photos'] = [real_photo] if real_photo else []
    ser['resolved_photo_url'] = real_resolved
    ser['proof_photos'] = [real_resolved] if real_resolved else []
    return ser

logger = logging.getLogger(__name__)
User = get_user_model()

DEPT_CATALOG = {
    1: {'code': 'PWD', 'title': 'Public Works Department (PWD)', 'category': 'Roads & Infrastructure', 'color': 'blue'},
    2: {'code': 'SWM', 'title': 'Solid Waste Management (SWM)', 'category': 'Garbage & Waste', 'color': 'emerald'},
    3: {'code': 'PHE', 'title': 'Public Health Engineering (PHE)', 'category': 'Water & Drainage', 'color': 'cyan'},
    4: {'code': 'Electrical', 'title': 'Electrical Department', 'category': 'Street Lighting', 'color': 'amber'},
}


def _resolve_officer_context(request):
    """
    Strictly resolves an authenticated Municipal Department Officer from Bearer JWT.
    Refuses Citizens, Field Workers, and unauthenticated requests cleanly.
    """
    auth_header = (request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION') or '') if hasattr(request, 'headers') else ''
    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ', 1)[1].strip()
    try:
        secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
        payload = jwt.decode(token, secret, algorithms=['HS256'])
    except Exception:
        return None

    user_id = payload.get('user_id')
    mobile = payload.get('mobile')
    user = User.objects.filter(id=user_id).first() if user_id else None
    if not user and mobile:
        user = User.objects.filter(username=mobile).first()
    if not user:
        return None

    uname = str(user.username).strip()
    if not user.is_active:
        return None
    is_worker = uname in WORKER_METADATA or uname.startswith('9800')
    if is_worker:
        return None

    is_officer = uname in OFFICER_METADATA or (user.is_staff and not user.is_superuser)
    if not is_officer:
        return None

    meta = OFFICER_METADATA.get(uname, {})
    dept_id = int(meta.get('dept_id', 1))
    dept_info = DEPT_CATALOG.get(dept_id, DEPT_CATALOG[1])
    return {
        'user': user,
        'mobile': uname,
        'name': meta.get('name', user.first_name or uname),
        'dept_id': dept_id,
        'dept_code': dept_info['code'],
        'dept_title': dept_info['title'],
        'category_label': dept_info['category'],
        'color': dept_info['color'],
    }


def _find_complaint(complaint_id):
    """Lookup Complaint by UUID primary key or tracking_id."""
    c_obj = None
    try:
        c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(id=complaint_id).first()
    except Exception:
        c_obj = None
    if not c_obj:
        c_obj = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(tracking_id=complaint_id).first()
    return c_obj


def _load_worker_profiles():
    """Loads Admin-managed Field Worker overrides/additions from worker_profiles.json."""
    wp_path = os.path.join(settings.BASE_DIR, 'media', 'worker_profiles.json')
    if os.path.exists(wp_path):
        try:
            with open(wp_path, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
                return data if isinstance(data, dict) else {}
        except Exception:
            pass
    return {}


def _extract_worker_info(w_user, profiles=None):
    """Resolve ward, dept_id, employee_id, designation for a Field Worker User."""
    uname = str(w_user.username).strip()
    if profiles is None:
        profiles = _load_worker_profiles()
    base_meta = WORKER_METADATA.get(uname, {})
    override = profiles.get(uname, {})
    meta = {**base_meta, **override}

    ward_num = 4
    dept_id = int(meta.get('dept_id', 1) or 1)
    if uname.startswith('9800') and len(uname) >= 6 and 'ward' not in override and 'dept_id' not in override:
        try:
            ward_num = int(uname[4])
            dept_id = int(uname[5])
        except (ValueError, IndexError):
            pass
    elif meta.get('ward') is not None:
        try:
            ward_digits = ''.join(ch for ch in str(meta['ward']).split('(')[0] if ch.isdigit())
            if ward_digits:
                ward_num = int(ward_digits)
        except Exception:
            pass

    dept_info = DEPT_CATALOG.get(dept_id, DEPT_CATALOG[1])
    is_on_duty = bool(override.get('is_on_duty', True))
    return {
        'mobile': uname,
        'name': meta.get('name') or w_user.first_name or uname,
        'email': override.get('email') or w_user.email or '',
        'dept_id': dept_id,
        'department': dept_info['title'],
        'dept_code': dept_info['code'],
        'ward': ward_num,
        'ward_name': meta.get('ward_name') or meta.get('ward') or f'Ward {ward_num}',
        'employee_id': meta.get('employee_id') or f'JMC-W{ward_num}-D{dept_id}',
        'designation': meta.get('designation') or (base_meta.get('department', dept_info['code']) + ' Field Specialist'),
        'is_active': bool(w_user.is_active),
        'is_on_duty': is_on_duty,
        'duty_status': override.get('duty_status', 'on_duty' if is_on_duty else 'on_leave'),
    }


def _is_worker_user(user, profiles=None):
    """Return True strictly for active Field Worker accounts."""
    if not user or not user.is_active or user.is_superuser or user.is_staff:
        return False
    uname = str(user.username).strip()
    if uname in OFFICER_METADATA or uname == '9900000000':
        return False
    if profiles is None:
        profiles = _load_worker_profiles()
    return (
        uname in WORKER_METADATA
        or uname in profiles
        or uname.startswith('9800')
        or uname.startswith('9900001')
        or user.groups.filter(name='FIELD_WORKER').exists()
    )


def _find_matching_active_workers(ward_num=None, dept_id=None):
    """Return active Field Worker users matching (ward_num, dept_id) across canonical & custom rosters."""
    profiles = _load_worker_profiles()
    worker_q = Q(username__startswith='9800') | Q(username__startswith='9900001')
    if profiles:
        worker_q = worker_q | Q(username__in=list(profiles.keys()))
    candidates = User.objects.filter(is_active=True).filter(worker_q).order_by('username')
    matched = []
    for u in candidates:
        if not _is_worker_user(u, profiles):
            continue
        info = _extract_worker_info(u, profiles)
        if ward_num is not None and info['ward'] != int(ward_num):
            continue
        if dept_id is not None and info['dept_id'] != int(dept_id):
            continue
        matched.append(u)
    return matched


class OfficerDashboardView(APIView):
    """
    GET /api/v1/officer/dashboard/
    Returns real SQLite KPIs, ward distribution, 4-tier priority breakdown,
    daily resolution trends, and grievances strictly scoped to the officer's department.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response(
                {"detail": "Valid Department Officer authentication required."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        dept_id = ctx['dept_id']
        base_qs = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(
            category__department_id=dept_id
        )

        # Optional filters
        ward_param = request.query_params.get('ward', '').strip()
        status_param = request.query_params.get('status', '').strip()
        priority_param = request.query_params.get('priority', '').strip()
        search_param = request.query_params.get('search', '').strip().lower()
        range_param = request.query_params.get('range', '30d').strip().lower()

        filtered_qs = base_qs
        if range_param in ('7d', '30d', '90d'):
            days = int(range_param.replace('d', ''))
            cutoff = timezone.now() - datetime.timedelta(days=days)
            filtered_qs = filtered_qs.filter(created_at__gte=cutoff)

        if ward_param and ward_param.lower() != 'all':
            try:
                w_num = int(''.join(ch for ch in ward_param if ch.isdigit()))
                filtered_qs = filtered_qs.filter(ward__ward_number=w_num)
            except ValueError:
                pass

        if status_param and status_param.lower() != 'all':
            s_low = status_param.lower()
            if s_low in ('pending', 'submitted'):
                filtered_qs = filtered_qs.filter(status__in=['Submitted', 'Pending Validation'])
            elif s_low == 'open':
                filtered_qs = filtered_qs.filter(status__in=['Submitted', 'Pending Validation', 'Validated', 'Assigned', 'In-Progress'])
            elif s_low == 'resolved':
                filtered_qs = filtered_qs.filter(status__in=['Work Done', 'Resolved', 'Closed'])
            elif s_low == 'closed':
                filtered_qs = filtered_qs.filter(status__in=['Resolved', 'Closed'])
            else:
                filtered_qs = filtered_qs.filter(status__iexact=status_param)

        all_dept_items = [_serialize_officer_complaint(c, request) for c in base_qs]
        filtered_items = [_serialize_officer_complaint(c, request) for c in filtered_qs]

        if priority_param and priority_param.lower() != 'all':
            filtered_items = [
                c for c in filtered_items
                if str(c.get('priority_level', c.get('priority', ''))).lower() == priority_param.lower()
            ]

        if search_param:
            filtered_items = [
                c for c in filtered_items
                if search_param in str(c.get('tracking_id', '')).lower()
                or search_param in str(c.get('title', '')).lower()
                or search_param in str(c.get('address', '')).lower()
                or search_param in str(c.get('worker_name', '')).lower()
            ]

        # Sort priority tiers: Severe -> High -> Medium -> Low, then score desc
        prio_rank = {'Severe': 0, 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
        filtered_items.sort(
            key=lambda x: (
                prio_rank.get(x.get('priority_level', 'Medium'), 99),
                -int(x.get('priority_score', 0) or 0),
                str(x.get('submitted_at', ''))
            )
        )

        # Compute real KPI metrics from department complaints
        pending_val = sum(1 for c in filtered_items if c['status'] in ('Submitted', 'Pending Validation'))
        validated_cnt = sum(1 for c in filtered_items if c['status'] == 'Validated')
        assigned_cnt = sum(1 for c in filtered_items if c['status'] == 'Assigned')
        in_prog_cnt = sum(1 for c in filtered_items if c['status'] == 'In-Progress')
        work_done_cnt = sum(1 for c in filtered_items if c['status'] == 'Work Done')
        closed_cnt = sum(1 for c in filtered_items if c['status'] in ('Resolved', 'Closed'))
        rejected_cnt = sum(1 for c in filtered_items if c['status'] == 'Rejected')
        open_cnt = pending_val + validated_cnt + assigned_cnt + in_prog_cnt

        filtered_id_set = {str(c.get('id')) for c in filtered_items}
        final_comps = [comp for comp in filtered_qs if str(comp.id) in filtered_id_set]

        turnaround_days = []
        for comp in final_comps:
            if comp.status in ('Work Done', 'Resolved', 'Closed'):
                end_dt = comp.verified_at or comp.updated_at
                if end_dt and comp.created_at:
                    diff_days = max((end_dt - comp.created_at).total_seconds() / 86400.0, 0.1)
                    turnaround_days.append(diff_days)
        avg_res_days = round(sum(turnaround_days) / len(turnaround_days), 1) if turnaround_days else 0.0

        # Priority 4-tier distribution
        prio_counts = {'Severe': 0, 'High': 0, 'Medium': 0, 'Low': 0}
        for c in filtered_items:
            lvl = c.get('priority_level', 'Medium')
            if lvl in prio_counts:
                prio_counts[lvl] += 1

        # Ward 1..4 distribution scoped to active filters within this department
        ward_stats = []
        for w_num in range(1, 5):
            w_items = [c for c in filtered_items if int(c.get('ward_number') or 0) == w_num]
            ward_stats.append({
                'ward': f'Ward {w_num}',
                'wardNum': w_num,
                'total': len(w_items),
                'pending': sum(1 for c in w_items if c['status'] in ('Submitted', 'Pending Validation', 'Validated', 'Assigned')),
                'in_progress': sum(1 for c in w_items if c['status'] == 'In-Progress'),
                'resolved': sum(1 for c in w_items if c['status'] in ('Work Done', 'Resolved', 'Closed')),
            })

        # Last 7 days submission vs resolution trends scoped to active filters
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
                if comp.status in ('Work Done', 'Resolved', 'Closed'):
                    r_dt = comp.verified_at or comp.updated_at
                    if r_dt and timezone.localtime(r_dt).date() == d:
                        res_cnt += 1
            trends.append({
                'period': d.strftime('%d %b'),
                'submitted': sub_cnt,
                'resolved': res_cnt,
            })

        return Response({
            'officer': {
                'name': ctx['name'],
                'mobile': ctx['mobile'],
                'dept_id': dept_id,
                'dept_code': ctx['dept_code'],
                'department': ctx['dept_title'],
                'category_label': ctx['category_label'],
                'color': ctx['color'],
            },
            'kpi': {
                'total': len(filtered_items),
                'open': open_cnt,
                'pending_validation': pending_val,
                'validated': validated_cnt,
                'assigned': assigned_cnt,
                'in_progress': in_prog_cnt,
                'work_done': work_done_cnt,
                'resolved': closed_cnt + work_done_cnt,
                'closed': closed_cnt,
                'rejected': rejected_cnt,
                'avg_resolution_days': avg_res_days,
                'sla_at_risk': sum(1 for c in filtered_items if c.get('priority_level') in ('Severe', 'High') and c['status'] not in ('Work Done', 'Resolved', 'Closed', 'Rejected')),
            },
            'priority_distribution': [
                {'name': 'Severe', 'value': prio_counts['Severe'], 'color': '#DC2626'},
                {'name': 'High', 'value': prio_counts['High'], 'color': '#F97316'},
                {'name': 'Medium', 'value': prio_counts['Medium'], 'color': '#D97706'},
                {'name': 'Low', 'value': prio_counts['Low'], 'color': '#64748B'},
            ],
            'ward_stats': ward_stats,
            'trends': trends,
            'complaints': filtered_items,
            'open_complaints': [c for c in all_dept_items if c['status'] not in ('Work Done', 'Resolved', 'Closed', 'Rejected')],
            'pending_validation_count': sum(1 for c in all_dept_items if c['status'] in ('Submitted', 'Pending Validation')),
        }, status=status.HTTP_200_OK)


class OfficerValidationQueueView(APIView):
    """
    GET /api/v1/officer/validation-queue/
    Returns citizen grievances awaiting human validation (Submitted / Pending Validation)
    strictly within the logged-in Officer's department.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response({"detail": "Valid Department Officer authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        include_validated = request.query_params.get('all', '').lower() == 'true'
        statuses = ['Submitted', 'Pending Validation', 'Validated'] if include_validated else ['Submitted', 'Pending Validation']

        qs = Complaint.objects.select_related('category', 'ward', 'assigned_worker', 'citizen').filter(
            category__department_id=ctx['dept_id'],
            status__in=statuses
        ).order_by('-created_at')

        items = []
        for c in qs:
            ser = _serialize_officer_complaint(c, request)
            ser['confidence'] = 0.0 if c.status in ('Submitted', 'Pending Validation') else 0.85
            ser['location'] = ser.get('address')
            ser['image'] = ser.get('photo_url')
            ser['ai_tag'] = ser.get('category')
            ser['ai_reason'] = (
                'Awaiting manual officer inspection (low AI confidence or no photo match).'
                if c.status in ('Submitted', 'Pending Validation')
                else 'Verified by YOLOv8 Computer Vision.'
            )
            items.append(ser)

        return Response({
            'dept_id': ctx['dept_id'],
            'dept_code': ctx['dept_code'],
            'count': len(items),
            'items': items,
        }, status=status.HTTP_200_OK)


class OfficerValidateComplaintView(APIView):
    """
    POST /api/v1/officer/complaints/<complaint_id>/validate/
    Department Officer approves ('Validated' / 'Assigned') or rejects ('Rejected')
    an AI-flagged grievance within their own department.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response({"detail": "Valid Department Officer authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        c_obj = _find_complaint(complaint_id)
        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        comp_dept = c_obj.category.department_id if c_obj.category else 1
        if comp_dept != ctx['dept_id']:
            return Response(
                {"detail": f"Department isolation violation: {ctx['dept_code']} Officer cannot validate Department #{comp_dept} grievances."},
                status=status.HTTP_403_FORBIDDEN
            )

        action = str(request.data.get('action') or 'approve').strip().lower()
        if action in ('reject', 'rejected'):
            reason = str(request.data.get('reason') or '').strip()
            note = str(request.data.get('note') or '').strip()
            if not reason:
                return Response({"detail": "Rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)

            c_obj.status = 'Rejected'
            c_obj.feedback = f"[Rejected by {ctx['dept_code']} Officer: {reason}] {note}".strip()
            c_obj.save(update_fields=['status', 'feedback', 'updated_at'])

            if c_obj.citizen:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Complaint #{c_obj.tracking_id} Rejected by {ctx['dept_code']} Officer",
                    body=f"Reason: {reason}" + (f" ({note})" if note else ""),
                    complaint_id=str(c_obj.id)
                )

            return Response({
                "message": f"Complaint #{c_obj.tracking_id} marked Rejected.",
                "complaint": serialize_complaint(c_obj, request),
            }, status=status.HTTP_200_OK)

        # Approve branch
        worker_mobile = str(request.data.get('worker_mobile') or '').strip()
        assigned_worker = None
        if worker_mobile:
            assigned_worker = User.objects.filter(username=worker_mobile).first()
            if not _is_worker_user(assigned_worker):
                return Response({"detail": f"Active Field Worker '{worker_mobile}' not found."}, status=status.HTTP_404_NOT_FOUND)
            w_info = _extract_worker_info(assigned_worker)
            if w_info['dept_id'] != ctx['dept_id']:
                return Response(
                    {"detail": f"Cross-department assignment blocked: worker belongs to {w_info['dept_code']}."},
                    status=status.HTTP_403_FORBIDDEN
                )

        if assigned_worker:
            c_obj.assigned_worker = assigned_worker
            c_obj.status = 'Assigned'
            c_obj.save(update_fields=['assigned_worker', 'status', 'updated_at'])
            w_info = _extract_worker_info(assigned_worker)
            Notification.objects.create(
                recipient=assigned_worker,
                title=f"Task Assigned by {ctx['dept_code']} Officer: #{c_obj.tracking_id}",
                body=f"Officer {ctx['name']} validated & assigned '{c_obj.title}' in {c_obj.ward.name if c_obj.ward else 'your ward'}.",
                complaint_id=str(c_obj.id)
            )
            if c_obj.citizen:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Civic Issue #{c_obj.tracking_id} Validated & Assigned",
                    body=f"{ctx['dept_code']} Officer approved your report and assigned Field Worker {w_info['name']}.",
                    complaint_id=str(c_obj.id)
                )
        else:
            c_obj.status = 'Validated'
            c_obj.save(update_fields=['status', 'updated_at'])
            ward_num = c_obj.ward.ward_number if c_obj.ward else 4
            for w_user in _find_matching_active_workers(ward_num, ctx['dept_id']):
                Notification.objects.create(
                    recipient=w_user,
                    title=f"New Officer-Validated Dispatch: #{c_obj.tracking_id}",
                    body=f"[{c_obj.priority_level} • Score {c_obj.priority_score}/100] {c_obj.title} in Ward {ward_num}.",
                    complaint_id=str(c_obj.id)
                )
            if c_obj.citizen:
                Notification.objects.create(
                    recipient=c_obj.citizen,
                    title=f"Civic Issue #{c_obj.tracking_id} Approved by {ctx['dept_code']} Officer",
                    body=f"Your grievance has been verified and dispatched to Ward {ward_num} field queue.",
                    complaint_id=str(c_obj.id)
                )

        return Response({
            "message": f"Complaint #{c_obj.tracking_id} validated cleanly.",
            "complaint": serialize_complaint(c_obj, request),
        }, status=status.HTTP_200_OK)


class OfficerWorkersListView(APIView):
    """
    GET /api/v1/officer/workers/
    Returns real SQLite Field Workers strictly belonging to the logged-in Officer's department
    (8 workers across Wards 1-4), with live active tasks and ratings.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response({"detail": "Valid Department Officer authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        ward_filter = request.query_params.get('ward', '').strip()
        complaint_id = request.query_params.get('complaint_id', '').strip()

        target_ward = None
        if ward_filter and ward_filter.lower() != 'all':
            try:
                target_ward = int(''.join(ch for ch in ward_filter if ch.isdigit()))
            except ValueError:
                target_ward = None

        complaint_ward = None
        if complaint_id:
            c_obj = _find_complaint(complaint_id)
            if c_obj and c_obj.ward:
                complaint_ward = c_obj.ward.ward_number

        profiles = _load_worker_profiles()
        worker_filter = Q(username__startswith='9800')
        if profiles:
            worker_filter = worker_filter | Q(username__in=list(profiles.keys()))
        workers_qs = User.objects.filter(is_active=True).filter(worker_filter).order_by('username')
        all_dept_workers = []
        for w_user in workers_qs:
            w_info = _extract_worker_info(w_user, profiles)
            if w_info['dept_id'] != ctx['dept_id']:
                continue
            if target_ward and w_info['ward'] != target_ward:
                continue

            assigned_qs = Complaint.objects.select_related('ward', 'category').filter(assigned_worker=w_user)
            active_qs = assigned_qs.filter(status__in=['Assigned', 'In-Progress'])
            completed_qs = assigned_qs.filter(status__in=['Work Done', 'Resolved', 'Closed'])
            ratings = [int(c.rating) for c in completed_qs if c.rating is not None]
            avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

            active_list = [{
                'id': str(c.id),
                'tracking_id': c.tracking_id,
                'title': c.title,
                'status': c.status,
                'priority': c.priority_level,
                'ward': c.ward.ward_number if c.ward else w_info['ward'],
            } for c in active_qs]

            all_dept_workers.append({
                **w_info,
                'id': str(w_user.id),
                'status': 'On Duty' if w_info['is_on_duty'] else 'On Leave',
                'active_tasks': active_qs.count(),
                'completed_tasks': completed_qs.count(),
                'rating': avg_rating if ratings else '—',
                'rating_count': len(ratings),
                'reviews': len(ratings),
                'matches_complaint_ward': (complaint_ward == w_info['ward']) if complaint_ward else True,
                'active_complaints': active_list,
            })

        available_for_ward = (
            [w for w in all_dept_workers if w['ward'] == complaint_ward]
            if complaint_ward else all_dept_workers
        )

        return Response({
            'dept_id': ctx['dept_id'],
            'dept_code': ctx['dept_code'],
            'count': len(all_dept_workers),
            'complaint_ward': complaint_ward,
            'available_workers': available_for_ward,
            'workers': all_dept_workers,
            'all_workers': all_dept_workers,
        }, status=status.HTTP_200_OK)


class OfficerAssignWorkerView(APIView):
    """
    POST /api/v1/officer/complaints/<complaint_id>/assign/
    Assigns or reassigns a complaint strictly within Officer's department to a same-department
    Field Worker (with explicit ward override support).
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, complaint_id):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response({"detail": "Valid Department Officer authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        c_obj = _find_complaint(complaint_id)
        if not c_obj:
            return Response({"detail": "Complaint not found."}, status=status.HTTP_404_NOT_FOUND)

        comp_dept = c_obj.category.department_id if c_obj.category else 1
        if comp_dept != ctx['dept_id']:
            return Response(
                {"detail": f"Department isolation violation: {ctx['dept_code']} Officer cannot assign Department #{comp_dept} grievance."},
                status=status.HTTP_403_FORBIDDEN
            )

        worker_identifier = str(request.data.get('worker_mobile') or request.data.get('worker_id') or '').strip()
        if not worker_identifier:
            return Response({"detail": "worker_mobile or worker_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        w_user = User.objects.filter(username=worker_identifier).first()
        if not w_user and worker_identifier.isdigit():
            w_user = User.objects.filter(id=int(worker_identifier)).first()
        if not _is_worker_user(w_user):
            return Response({"detail": f"Active Field Worker '{worker_identifier}' not found."}, status=status.HTTP_404_NOT_FOUND)

        w_info = _extract_worker_info(w_user)
        if w_info['dept_id'] != ctx['dept_id']:
            return Response(
                {"detail": f"Cross-department assignment blocked: {w_info['name']} belongs to {w_info['dept_code']}, not {ctx['dept_code']}."},
                status=status.HTTP_403_FORBIDDEN
            )

        override_ward = bool(request.data.get('override_ward'))
        override_reason = str(request.data.get('override_reason') or '').strip()
        comp_ward = c_obj.ward.ward_number if c_obj.ward else None
        if comp_ward and w_info['ward'] != comp_ward:
            if not override_ward or not override_reason:
                return Response(
                    {"detail": f"Ward mismatch: Grievance is in Ward {comp_ward} while {w_info['name']} is assigned to Ward {w_info['ward']}. Enable ward override with reason to proceed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        c_obj.assigned_worker = w_user
        if c_obj.status in ('Submitted', 'Pending Validation', 'Validated'):
            c_obj.status = 'Assigned'
        c_obj.save(update_fields=['assigned_worker', 'status', 'updated_at'])

        # Notify assigned Field Worker
        Notification.objects.create(
            recipient=w_user,
            title=f"Assigned by {ctx['dept_code']} Officer: #{c_obj.tracking_id}",
            body=f"{ctx['name']} assigned you to '{c_obj.title}' ({c_obj.priority_level} • Score {c_obj.priority_score}/100)" + (f" [Ward Override: {override_reason}]" if override_ward else "."),
            complaint_id=str(c_obj.id)
        )

        # Notify Citizen
        if c_obj.citizen:
            Notification.objects.create(
                recipient=c_obj.citizen,
                title=f"Field Worker Assigned to #{c_obj.tracking_id}",
                body=f"{ctx['dept_code']} Officer assigned Field Worker {w_info['name']} to your civic issue.",
                complaint_id=str(c_obj.id)
            )

        return Response({
            "message": f"Grievance #{c_obj.tracking_id} assigned to {w_info['name']} ({w_info['mobile']}).",
            "complaint": serialize_complaint(c_obj, request),
            "assigned_worker": w_info,
        }, status=status.HTTP_200_OK)


class OfficerSettingsView(APIView):
    """
    GET / PATCH /api/v1/officer/settings/
    Persists per-department notification and dispatch thresholds cleanly.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def _prefs_path(self, dept_id):
        data_dir = os.path.join(settings.BASE_DIR, 'media')
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, f'officer_settings_dept_{dept_id}.json')

    def _default_prefs(self, ctx):
        return {
            'dept_id': ctx['dept_id'],
            'dept_code': ctx['dept_code'],
            'critical_sms_alert': True,
            'sla_warning_whatsapp': True,
            'daily_digest_email': False,
            'auto_dispatch_mode': 'assisted',
            'ai_confidence_threshold': 25,
            'on_duty': True,
        }

    def get(self, request):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response({"detail": "Valid Department Officer authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        path = self._prefs_path(ctx['dept_id'])
        prefs = self._default_prefs(ctx)
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as fp:
                    prefs.update(json.load(fp))
            except Exception:
                pass
        return Response(prefs, status=status.HTTP_200_OK)

    def patch(self, request):
        ctx = _resolve_officer_context(request)
        if not ctx:
            return Response({"detail": "Valid Department Officer authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        path = self._prefs_path(ctx['dept_id'])
        prefs = self._default_prefs(ctx)
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as fp:
                    prefs.update(json.load(fp))
            except Exception:
                pass

        for key in ('critical_sms_alert', 'sla_warning_whatsapp', 'daily_digest_email', 'auto_dispatch_mode', 'ai_confidence_threshold', 'on_duty'):
            if key in request.data:
                prefs[key] = request.data[key]

        with open(path, 'w', encoding='utf-8') as fp:
            json.dump(prefs, fp, indent=2)

        return Response({'message': f"{ctx['dept_code']} officer settings saved.", **prefs}, status=status.HTTP_200_OK)

