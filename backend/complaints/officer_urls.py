# complaints/officer_urls.py
from django.urls import path
from .officer_views import (
    OfficerDashboardView,
    OfficerValidationQueueView,
    OfficerValidateComplaintView,
    OfficerWorkersListView,
    OfficerAssignWorkerView,
    OfficerSettingsView,
)

urlpatterns = [
    path('dashboard/', OfficerDashboardView.as_view(), name='officer-dashboard'),
    path('dashboard', OfficerDashboardView.as_view(), name='officer-dashboard-notrail'),

    path('validation-queue/', OfficerValidationQueueView.as_view(), name='officer-validation-queue'),
    path('validation-queue', OfficerValidationQueueView.as_view(), name='officer-validation-queue-notrail'),

    path('complaints/<str:complaint_id>/validate/', OfficerValidateComplaintView.as_view(), name='officer-complaint-validate'),
    path('complaints/<str:complaint_id>/validate', OfficerValidateComplaintView.as_view(), name='officer-complaint-validate-notrail'),

    path('complaints/<str:complaint_id>/assign/', OfficerAssignWorkerView.as_view(), name='officer-complaint-assign'),
    path('complaints/<str:complaint_id>/assign', OfficerAssignWorkerView.as_view(), name='officer-complaint-assign-notrail'),

    path('workers/', OfficerWorkersListView.as_view(), name='officer-workers'),
    path('workers', OfficerWorkersListView.as_view(), name='officer-workers-notrail'),

    path('settings/', OfficerSettingsView.as_view(), name='officer-settings'),
    path('settings', OfficerSettingsView.as_view(), name='officer-settings-notrail'),
]

