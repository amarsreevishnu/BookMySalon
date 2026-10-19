from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.authentication import CustomJWTAuthentication as JWTAuthentication
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    """
    GET /api/v1/notifications/
    List notifications for the authenticated user with optional unread_only filtering and pagination.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = Notification.objects.filter(recipient=user)

        unread_count = qs.filter(is_read=False).count()

        unread_only = str(request.query_params.get("unread_only", "")).lower() in ("true", "1")
        if unread_only:
            qs = qs.filter(is_read=False)

        limit = request.query_params.get("limit", 20)
        try:
            limit = min(max(int(limit), 1), 100)
        except (ValueError, TypeError):
            limit = 20

        total_count = qs.count()
        notifications = qs[:limit]

        serializer = NotificationSerializer(notifications, many=True, context={"request": request})

        return Response({
            "count": total_count,
            "unread_count": unread_count,
            "notifications": serializer.data,
        }, status=status.HTTP_200_OK)


class NotificationUnreadCountView(APIView):
    """
    GET /api/v1/notifications/unread-count/
    Lightweight endpoint returning the user's unread notification count for badge display.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count}, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    """
    PATCH /api/v1/notifications/<int:pk>/read/
    Mark a single notification as read.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        notification.mark_as_read(save=True)
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()

        return Response({
            "message": "Notification marked as read.",
            "notification": NotificationSerializer(notification, context={"request": request}).data,
            "unread_count": unread_count,
        }, status=status.HTTP_200_OK)


class NotificationMarkAllReadView(APIView):
    """
    POST /api/v1/notifications/mark-all-read/
    Mark all notifications for the authenticated user as read.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True, read_at=now)

        return Response({
            "message": f"All {updated_count} notifications marked as read.",
            "unread_count": 0,
        }, status=status.HTTP_200_OK)


class NotificationDeleteView(APIView):
    """
    DELETE /api/v1/notifications/<int:pk>/
    Dismiss/delete an individual notification.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        notification.delete()
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()

        return Response({
            "message": "Notification deleted.",
            "unread_count": unread_count,
        }, status=status.HTTP_200_OK)


class NotificationClearReadView(APIView):
    """
    DELETE /api/v1/notifications/clear-read/
    Delete all read notifications for the current user.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        deleted_count, _ = Notification.objects.filter(
            recipient=request.user,
            is_read=True,
        ).delete()

        return Response({
            "message": f"{deleted_count} read notifications cleared.",
        }, status=status.HTTP_200_OK)
