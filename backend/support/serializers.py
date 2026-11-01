from rest_framework import serializers
from .models import SupportTicket, TicketMessage, TicketActivity


class TicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_email = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = [
            "id",
            "ticket",
            "sender",
            "sender_name",
            "sender_email",
            "sender_type",
            "message",
            "attachment",
            "attachment_url",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "ticket",
            "sender",
            "sender_name",
            "sender_email",
            "sender_type",
            "attachment_url",
            "is_read",
            "read_at",
            "created_at",
        ]

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.get_full_name() or obj.sender.email.split("@")[0]
        return "System"

    def get_sender_email(self, obj):
        return obj.sender.email if obj.sender else ""

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class TicketActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    activity_type_display = serializers.CharField(source="get_activity_type_display", read_only=True)

    class Meta:
        model = TicketActivity
        fields = [
            "id",
            "activity_type",
            "activity_type_display",
            "details",
            "old_value",
            "new_value",
            "user_name",
            "created_at",
        ]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email.split("@")[0]
        return "System"


class SupportTicketListSerializer(serializers.ModelSerializer):
    salon_name = serializers.CharField(source="salon.name", read_only=True)
    salon_id = serializers.IntegerField(source="salon.id", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    unread_count = serializers.SerializerMethodField()
    messages_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "ticket_number",
            "salon_id",
            "salon_name",
            "created_by_name",
            "created_by_email",
            "subject",
            "category",
            "category_display",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "unread_count",
            "messages_count",
            "last_message",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.email.split("@")[0]

    def get_unread_count(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not user or not user.is_authenticated:
            return 0
        role = str(getattr(user, "role", "")).upper()
        if user.is_superuser or role == "ADMIN":
            return obj.unread_count_for_admin
        return obj.unread_count_for_owner

    def get_messages_count(self, obj):
        return obj.messages.count()

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        if last_msg:
            return {
                "message": (last_msg.message[:80] + "...") if len(last_msg.message) > 80 else last_msg.message,
                "sender_type": last_msg.sender_type,
                "created_at": last_msg.created_at,
            }
        return None


class SupportTicketDetailSerializer(serializers.ModelSerializer):
    salon_details = serializers.SerializerMethodField()
    created_by_details = serializers.SerializerMethodField()
    assigned_to_details = serializers.SerializerMethodField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    attachment_url = serializers.SerializerMethodField()
    messages = TicketMessageSerializer(many=True, read_only=True)
    activities = TicketActivitySerializer(many=True, read_only=True)
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "ticket_number",
            "salon",
            "salon_details",
            "created_by",
            "created_by_details",
            "assigned_to",
            "assigned_to_details",
            "subject",
            "category",
            "category_display",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "description",
            "attachment",
            "attachment_url",
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
            "unread_count",
            "messages",
            "activities",
        ]

    def get_salon_details(self, obj):
        return {
            "id": obj.salon.id,
            "name": obj.salon.name,
            "city": obj.salon.city,
            "phone": obj.salon.phone,
            "email": obj.salon.email,
        }

    def get_created_by_details(self, obj):
        return {
            "id": obj.created_by.id,
            "name": obj.created_by.get_full_name() or obj.created_by.email.split("@")[0],
            "email": obj.created_by.email,
        }

    def get_assigned_to_details(self, obj):
        if obj.assigned_to:
            return {
                "id": obj.assigned_to.id,
                "name": obj.assigned_to.get_full_name() or obj.assigned_to.email.split("@")[0],
                "email": obj.assigned_to.email,
            }
        return None

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not user or not user.is_authenticated:
            return 0
        role = str(getattr(user, "role", "")).upper()
        if user.is_superuser or role == "ADMIN":
            return obj.unread_count_for_admin
        return obj.unread_count_for_owner


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = [
            "subject",
            "category",
            "priority",
            "description",
            "attachment",
        ]

    def validate_subject(self, value):
        val = value.strip()
        if len(val) < 5:
            raise serializers.ValidationError("Subject must be at least 5 characters long.")
        if len(val) > 255:
            raise serializers.ValidationError("Subject cannot exceed 255 characters.")
        return val

    def validate_description(self, value):
        val = value.strip()
        if len(val) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long to provide sufficient detail.")
        return val


class TicketMessageCreateSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=10000)
    attachment = serializers.FileField(required=False, allow_null=True)
    status_update = serializers.ChoiceField(
        choices=SupportTicket.Status.choices,
        required=False,
        allow_blank=True,
    )


class TicketStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SupportTicket.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class TicketPriorityUpdateSerializer(serializers.Serializer):
    priority = serializers.ChoiceField(choices=SupportTicket.Priority.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class TicketReopenSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=2000)
    attachment = serializers.FileField(required=False, allow_null=True)

