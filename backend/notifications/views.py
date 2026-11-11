"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/views.py
Developer: Faizan Rayeen (Notifications Lead)
Description: API views for listing notifications, marking notifications read,
              and updating user FCM push registration tokens.
==============================================================================
"""

import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model
from .models import Notification
from .serializers import NotificationSerializer, FCMTokenUpdateSerializer
from .fcm_service import register_user_fcm_token
from .auth_views import get_authenticated_user_from_request

User = get_user_model()
logger = logging.getLogger(__name__)


class NotificationListView(APIView):
    """
    GET /api/v1/notifications/
    Lists notifications strictly from the database for the requesting user.
    Returns empty results list if no complaints/alerts exist.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        include_all = request.query_params.get('all', 'false').lower() == 'true'

        queryset = Notification.objects.filter(recipient=user)
        if not include_all:
            queryset = queryset.filter(is_read=False)
        notifications = queryset[:30]
        serializer = NotificationSerializer(notifications, many=True)
        unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
        return Response({
            'unread_count': unread_count,
            'count': len(serializer.data),
            'results': serializer.data
        }, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    """
    PATCH /api/v1/notifications/mark-read/
    Marks all unread notifications as read for recipient user and persists in SQLite.
    Can also pass optional ?id=<uuid> or body {id} to mark a specific notification as read.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def patch(self, request):
        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        notification_id = (
            (request.data.get('id') if isinstance(request.data, dict) else None)
            or request.query_params.get('id')
        )

        if notification_id:
            updated_count = Notification.objects.filter(
                recipient=user,
                id=notification_id
            ).update(is_read=True)
            unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
            return Response({
                'message': 'Notification marked as read.',
                'updated_count': updated_count,
                'unread_count': unread_count
            }, status=status.HTTP_200_OK)

        # Mark all unread as read
        updated_count = Notification.objects.filter(
            recipient=user,
            is_read=False
        ).update(is_read=True)

        return Response({
            'message': 'All notifications marked as read.',
            'updated_count': updated_count,
            'unread_count': 0
        }, status=status.HTTP_200_OK)


class FCMTokenRegisterView(APIView):
    """
    POST /api/v1/auth/fcm-token/
    Registers or updates the user's FCM device push token.
    Called automatically by the React frontend on user login / permission grant.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        return self._save_token(request)

    def patch(self, request):
        return self._save_token(request)

    def _save_token(self, request):
        serializer = FCMTokenUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        fcm_token = serializer.validated_data['fcm_token']
        device_type = serializer.validated_data.get('device_type', 'web')

        user = get_authenticated_user_from_request(request)
        if not user:
            return Response({"detail": "Authentication required to register push token."}, status=status.HTTP_401_UNAUTHORIZED)

        user_id = str(user.pk)
        register_user_fcm_token(user_id, fcm_token, device_type)
        if user and getattr(user, 'username', None):
            register_user_fcm_token(user.username, fcm_token, device_type)

        logger.info("[FCM] Registered token for user %s (%s)", user_id, device_type)

        return Response({
            'message': 'FCM token registered successfully.',
            'device_type': device_type,
            'user_id': user_id,
            'fcm_token': fcm_token
        }, status=status.HTTP_200_OK)
