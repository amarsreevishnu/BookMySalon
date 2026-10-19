from rest_framework import serializers
from django.utils import timezone
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display", read_only=True
    )
    time_ago = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "data",
            "is_read",
            "read_at",
            "created_at",
            "time_ago",
            "sender_name",
        ]
        read_only_fields = fields

    def get_time_ago(self, obj):
        now = timezone.now()
        diff = now - obj.created_at

        seconds = int(diff.total_seconds())
        if seconds < 60:
            return "Just now"
        minutes = seconds // 60
        if minutes < 60:
            return f"{minutes}m ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        days = hours // 24
        if days == 1:
            return "Yesterday"
        if days < 7:
            return f"{days}d ago"
        return obj.created_at.strftime("%b %d")

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.get_full_name() or obj.sender.email
        return None

