"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: config/urls.py
Author: Team ResolveIT
Description: Root URL Configuration with Notifications, Dashboard, and Admin.
==============================================================================
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponseForbidden, JsonResponse
from dashboard.admin_workers_view import AdminSettingsView


def _root_health(_request):
    """Return a clean service status payload on root `/` instead of Django's 404 page."""
    return JsonResponse({
        "service": "JANMITRA Civic Redressal API",
        "status": "online",
        "api_base": "/api/v1/",
        "frontend_url": "http://localhost:5173",
    })


def _forbid_internal_json(_request, path=""):
    return HttpResponseForbidden("Access denied.")

urlpatterns = [
    path('', _root_health, name='api-root-health'),
    path('admin/', admin.site.urls),

    # Notifications API: /api/v1/notifications/
    path('api/v1/notifications/', include('notifications.urls')),

    # Auth APIs (register, login, me, fcm-token, profile): /api/v1/auth/
    path('api/v1/auth/', include('notifications.urls')),

    # Complaints APIs: /api/v1/complaints/
    path('api/v1/complaints/', include('complaints.urls')),

    # Field Worker APIs: /api/v1/worker/ (Uber/Ola dispatch queue, accept task, proof of work)
    path('api/v1/worker/', include('complaints.worker_urls')),

    # Department Officer APIs: /api/v1/officer/ (Strictly dept-isolated command & dispatch)
    path('api/v1/officer/', include('complaints.officer_urls')),

    # Dashboard APIs: /api/v1/dashboard/
    path('api/v1/dashboard/', include('dashboard.urls')),

    # Admin APIs: /api/v1/admin/
    path('api/v1/admin/', include('dashboard.admin_urls')),

    # Announcements API: /api/v1/announcements/
    path('api/v1/announcements/', AdminSettingsView.as_view(), name='public-announcements'),
    path('api/v1/announcements', AdminSettingsView.as_view(), name='public-announcements-notrail'),

    # Never expose internal JSON settings/profile files under /media/
    re_path(r'^media/.*\.json$', _forbid_internal_json),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
