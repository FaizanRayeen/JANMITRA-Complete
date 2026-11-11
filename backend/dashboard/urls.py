"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: janmitra-backend/dashboard/urls.py
Author: Team ResolveIT
Description: Dashboard URL routes for /api/v1/dashboard/
==============================================================================
"""

from django.urls import path
from .views import DashboardKPIView, WardStatsView

urlpatterns = [
    # GET /api/v1/dashboard/kpi/ and GET /api/v1/dashboard/kpi/?dept_id=X
    path('kpi/', DashboardKPIView.as_view(), name='dashboard-kpi'),
    path('kpi', DashboardKPIView.as_view(), name='dashboard-kpi-notrail'),

    # GET /api/v1/dashboard/ward-stats/ and GET /api/v1/dashboard/ward-stats/?dept_id=X
    path('ward-stats/', WardStatsView.as_view(), name='dashboard-ward-stats'),
    path('ward-stats', WardStatsView.as_view(), name='dashboard-ward-stats-notrail'),
]
