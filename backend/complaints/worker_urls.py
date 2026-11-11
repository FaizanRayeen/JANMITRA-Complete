"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: complaints/worker_urls.py
Developer: Anas Shaikh & Faizan Rayeen
Description: Field Worker dispatch APIs (Uber/Ola architecture)
             - GET   /api/v1/worker/tasks/
             - GET   /api/v1/worker/tasks/<task_id>/
             - POST  /api/v1/worker/tasks/<task_id>/accept/
             - POST  /api/v1/worker/tasks/<task_id>/proof/
             - PATCH /api/v1/worker/tasks/<task_id>/status/
==============================================================================
"""

from django.urls import path
from .views import (
    WorkerTasksView,
    WorkerAcceptTaskView,
    WorkerProofUploadView,
    WorkerTaskDetailView,
    WorkerTaskStatusView,
    WorkerProfileView,
)

urlpatterns = [
    # Worker Profile & Real Stats
    path('profile/', WorkerProfileView.as_view(), name='worker-profile'),
    path('profile', WorkerProfileView.as_view(), name='worker-profile-notrail'),

    # Task listing (incoming, in-progress, completed)
    path('tasks/', WorkerTasksView.as_view(), name='worker-tasks'),
    path('tasks', WorkerTasksView.as_view(), name='worker-tasks-notrail'),

    # Task detail
    path('tasks/<str:task_id>/', WorkerTaskDetailView.as_view(), name='worker-task-detail'),
    path('tasks/<str:task_id>', WorkerTaskDetailView.as_view(), name='worker-task-detail-notrail'),

    # Accept incoming dispatch task
    path('tasks/<str:task_id>/accept/', WorkerAcceptTaskView.as_view(), name='worker-task-accept'),
    path('tasks/<str:task_id>/accept', WorkerAcceptTaskView.as_view(), name='worker-task-accept-notrail'),

    # Upload live camera proof of resolution
    path('tasks/<str:task_id>/proof/', WorkerProofUploadView.as_view(), name='worker-task-proof'),
    path('tasks/<str:task_id>/proof', WorkerProofUploadView.as_view(), name='worker-task-proof-notrail'),

    # Status update helper
    path('tasks/<str:task_id>/status/', WorkerTaskStatusView.as_view(), name='worker-task-status'),
    path('tasks/<str:task_id>/status', WorkerTaskStatusView.as_view(), name='worker-task-status-notrail'),
]

