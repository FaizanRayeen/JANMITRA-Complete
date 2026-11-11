"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/profile_view.py
Author: Team ResolveIT
Description: Citizen Profile & Password Management View (GET, PATCH)
==============================================================================
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from django.db import models
from .auth_views import get_authenticated_user_from_request

User = get_user_model()

# Generic clean profile fallback
DEFAULT_CITIZEN_PROFILE = {
    "name": "Citizen",
    "full_name": "Citizen",
    "mobile": "",
    "email": "",
    "ward": 4,
    "ward_name": "Ward 4 (Mangalwari / North Nagpur)",
    "account_status": "Active Citizen",
    "member_since": "March 2026",
    "stats": {
        "total": 0,
        "resolved": 0,
        "pending": 0,
        "in_progress": 0,
        "avg_rating": 0,
        "rating_count": 0,
        "satisfaction_score": 0,
        "satisfaction_grade": "No complaints resolved yet",
        "rating_breakdown": {
            "5": 0,
            "4": 0,
            "3": 0,
            "2": 0,
            "1": 0
        }
    },
    "reviews": []
}


class UserProfileView(APIView):
    """
    GET   /api/v1/auth/profile/
    PATCH /api/v1/auth/profile/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        name = getattr(user, 'first_name', '') or getattr(user, 'name', '') or user.username
        mobile = user.username
        email = user.email or ""
        ward = user.last_name or DEFAULT_CITIZEN_PROFILE["ward_name"]

        # Query real complaints & reviews filed by this specific citizen in SQLite database
        total, resolved, pending, active_in_progress = 0, 0, 0, 0
        reviews = []
        breakdown = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
        rating_sum = 0
        rating_count = 0

        try:
            from complaints.models import Complaint
            DEPT_NAMES = {
                1: 'PWD (Roads)',
                2: 'Solid Waste Management',
                3: 'Public Health Engineering',
                4: 'Electrical'
            }
            qs = Complaint.objects.select_related('category', 'ward', 'assigned_worker').filter(
                models.Q(citizen=user) | models.Q(citizen__username=mobile)
            )
            total = qs.count()
            resolved = qs.filter(status__in=['Resolved', 'Closed', 'Work Done']).count()
            pending = qs.filter(status__in=['Submitted', 'Pending Validation', 'Validated', 'Assigned', 'In-Progress']).count()
            active_in_progress = qs.filter(status='In-Progress').count()

            rated_qs = qs.filter(rating__isnull=False).order_by('-verified_at', '-updated_at')

            for comp in rated_qs:
                r_val = max(1, min(5, int(comp.rating)))
                breakdown[str(r_val)] += 1
                rating_sum += r_val
                rating_count += 1

                dept_id = comp.category.department_id if comp.category else 1
                remarks_text = (comp.feedback or '').strip()

                dt_obj = comp.verified_at or comp.updated_at or comp.created_at
                if dt_obj:
                    from django.utils import timezone
                    dt_obj = timezone.localtime(dt_obj)
                reviews.append({
                    "id": str(comp.id),
                    "tracking_id": comp.tracking_id or f"JMC-2026-{str(comp.id)[:8].upper()}",
                    "department": DEPT_NAMES.get(dept_id, "Municipal Operations"),
                    "rating": r_val,
                    "remarks": remarks_text,
                    "title": comp.title,
                    "resolved_at": dt_obj.strftime("%d %b %Y, %I:%M %p") if dt_obj else "Resolved",
                    "worker_name": comp.assigned_worker.first_name if comp.assigned_worker else "Municipal Field Team",
                })
        except Exception as err:
            print(f"[UserProfileView] Error aggregating reviews: {err}", flush=True)

        avg_rating = round(rating_sum / rating_count, 1) if rating_count > 0 else 0
        satisfaction_score = round((avg_rating / 5.0) * 100) if rating_count > 0 else 0
        if avg_rating >= 4.5:
            grade = "Grade A+ (Verified Civic Feedback)"
        elif avg_rating >= 3.5:
            grade = "Grade A (Satisfactory Redressal)"
        elif avg_rating > 0:
            grade = "Needs Improvement"
        else:
            grade = "No complaints rated yet"

        return Response({
            "name": name,
            "full_name": name,
            "mobile": mobile,
            "email": email,
            "ward": ward,
            "ward_name": ward,
            "account_status": "Active Citizen",
            "member_since": DEFAULT_CITIZEN_PROFILE["member_since"],
            "stats": {
                "total": total,
                "resolved": resolved,
                "pending": pending,
                "in_progress": pending,
                "active_in_progress": active_in_progress,
                "avg_rating": avg_rating,
                "rating_count": rating_count,
                "satisfaction_score": satisfaction_score,
                "satisfaction_grade": grade,
                "rating_breakdown": breakdown
            },
            "reviews": reviews
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        data = request.data
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required. Please log in."}, status=status.HTTP_401_UNAUTHORIZED)

        updated_name = (data.get("name") or data.get("full_name") or "").strip()
        if updated_name:
            user.first_name = updated_name
            user.save(update_fields=['first_name'])
            print(f"👤 [AUTH PROFILE] User '{user.username}' name updated to: '{updated_name}'", flush=True)

        new_password = data.get("new_password")
        if new_password:
            old_password = data.get("old_password")
            if not old_password:
                return Response({"detail": "Current password is required to change password."}, status=status.HTTP_400_BAD_REQUEST)

            if not user.check_password(old_password):
                print(f"❌ [AUTH PASSWORD CHANGE REJECTED] Incorrect old password entered for user '{user.username}'", flush=True)
                return Response({
                    "detail": "Current password is incorrect. Please check and try again.",
                    "old_password": ["Current password is incorrect."]
                }, status=status.HTTP_400_BAD_REQUEST)

            if len(new_password) < 6:
                return Response({"detail": "New password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

            # Apply new hashed password strictly to SQLite User table
            user.set_password(new_password)
            user.save()
            print(f"🔒 [JANMITRA BACKEND] PASSWORD SUCCESSFULLY UPDATED IN SQLITE DATABASE FOR USER '{user.username}' ({user.first_name})", flush=True)

            return Response({
                "message": "Password changed successfully in database.",
                "status": "success",
                "profile": {
                    "name": user.first_name or user.username,
                    "mobile": user.username,
                    "email": user.email
                }
            }, status=status.HTTP_200_OK)

        return Response({
            "message": "Profile updated successfully.",
            "profile": {
                "name": user.first_name or user.username,
                "mobile": user.username,
                "email": user.email
            }
        }, status=status.HTTP_200_OK)
