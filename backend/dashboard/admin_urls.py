"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: dashboard/admin_urls.py
Description: Super Admin Portal API routes (/api/v1/admin/* & /api/v1/announcements/)
==============================================================================
"""

from django.urls import path
from .views import (
    AdminOverviewView,
    AdminComplaintsLedgerView,
    AdminComplaintOverrideView,
    AdminReportsView,
)
from .admin_workers_view import (
    AdminWorkersListCreateView,
    AdminWorkerDetailUpdateView,
    AdminSettingsView,
)

urlpatterns = [
    path('overview/', AdminOverviewView.as_view(), name='admin-overview'),
    path('overview', AdminOverviewView.as_view(), name='admin-overview-notrail'),
    path('complaints/', AdminComplaintsLedgerView.as_view(), name='admin-complaints-ledger'),
    path('complaints', AdminComplaintsLedgerView.as_view(), name='admin-complaints-ledger-notrail'),
    path('complaints/<str:complaint_id>/override/', AdminComplaintOverrideView.as_view(), name='admin-complaint-override'),
    path('complaints/<str:complaint_id>/override', AdminComplaintOverrideView.as_view(), name='admin-complaint-override-notrail'),
    path('reports/', AdminReportsView.as_view(), name='admin-reports'),
    path('reports', AdminReportsView.as_view(), name='admin-reports-notrail'),
    path('workers/', AdminWorkersListCreateView.as_view(), name='admin-workers-list-create'),
    path('workers', AdminWorkersListCreateView.as_view(), name='admin-workers-list-create-notrail'),
    path('workers/<str:worker_id>/', AdminWorkerDetailUpdateView.as_view(), name='admin-worker-detail-update'),
    path('workers/<str:worker_id>', AdminWorkerDetailUpdateView.as_view(), name='admin-worker-detail-update-notrail'),
    path('settings/', AdminSettingsView.as_view(), name='admin-settings'),
    path('settings', AdminSettingsView.as_view(), name='admin-settings-notrail'),
    path('announcements/', AdminSettingsView.as_view(), name='admin-announcements'),
    path('announcements', AdminSettingsView.as_view(), name='admin-announcements-notrail'),
]
