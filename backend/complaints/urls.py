# complaints/urls.py
from django.urls import path
from .views import (
    ComplaintSummaryView,
    ComplaintListView,
    ComplaintDetailView,
    ComplaintVerifyView,
    ComplaintValidateView,
    ComplaintAssignView,
    ComplaintWorkDoneView,
    WorkerAcceptTaskView,
)

urlpatterns = [
    # GET /api/v1/complaints/summary/
    path('summary/', ComplaintSummaryView.as_view(), name='complaint-summary'),
    path('summary', ComplaintSummaryView.as_view(), name='complaint-summary-notrail'),

    # GET /api/v1/complaints/
    # POST /api/v1/complaints/
    path('', ComplaintListView.as_view(), name='complaint-list'),

    # POST /api/v1/complaints/<id>/accept/ (Worker claims dispatch request)
    path('<str:task_id>/accept/', WorkerAcceptTaskView.as_view(), name='complaint-accept'),
    path('<str:task_id>/accept', WorkerAcceptTaskView.as_view(), name='complaint-accept-notrail'),

    # POST /api/v1/complaints/<id>/validate/ (Step 2: AI YOLOv8 model validation & routing)
    path('<str:complaint_id>/validate/', ComplaintValidateView.as_view(), name='complaint-validate'),
    path('<str:complaint_id>/validate', ComplaintValidateView.as_view(), name='complaint-validate-notrail'),

    # POST /api/v1/complaints/<id>/assign/ (Step 3: Officer assigns field worker)
    path('<str:complaint_id>/assign/', ComplaintAssignView.as_view(), name='complaint-assign'),
    path('<str:complaint_id>/assign', ComplaintAssignView.as_view(), name='complaint-assign-notrail'),

    # POST /api/v1/complaints/<id>/work-done/ (Step 4: Worker uploads proof & marks done)
    path('<str:complaint_id>/work-done/', ComplaintWorkDoneView.as_view(), name='complaint-work-done'),
    path('<str:complaint_id>/work-done', ComplaintWorkDoneView.as_view(), name='complaint-work-done-notrail'),

    # POST /api/v1/complaints/<id>/verify/ (Step 5: Citizen verifies resolution & rates 5-stars)
    path('<str:complaint_id>/verify/', ComplaintVerifyView.as_view(), name='complaint-verify'),
    path('<str:complaint_id>/verify', ComplaintVerifyView.as_view(), name='complaint-verify-notrail'),

    # GET /api/v1/complaints/<id>/
    path('<str:complaint_id>/', ComplaintDetailView.as_view(), name='complaint-detail'),
    path('<str:complaint_id>', ComplaintDetailView.as_view(), name='complaint-detail-notrail'),
]

