import math
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from salons.views import get_owner_salon
from .models import SupportTicket, TicketMessage, TicketActivity
from .permissions import IsSalonOwner, IsSuperAdmin
from .serializers import (
    SupportTicketListSerializer,
    SupportTicketDetailSerializer,
    SupportTicketCreateSerializer,
    TicketMessageSerializer,
    TicketMessageCreateSerializer,
    TicketStatusUpdateSerializer,
    TicketPriorityUpdateSerializer,
    TicketReopenSerializer,
)
from .services import (
    log_ticket_activity,
    send_ticket_created_emails,
    send_admin_reply_email,
    send_owner_reply_email,
    send_status_update_email,
)


# ==============================================================================
# SALON OWNER TICKET VIEWS
# ==============================================================================

class SalonOwnerTicketListCreateView(APIView):
    """
    GET: List tickets belonging strictly to the authenticated salon owner's salon.
    POST: Create a new support ticket for the owner's salon.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No registered or approved salon found for your account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = SupportTicket.objects.filter(salon=salon).select_related(
            "salon", "created_by"
        ).prefetch_related("messages")

        # Filters
        ticket_status = request.query_params.get("status")
        if ticket_status and ticket_status.upper() != "ALL":
            queryset = queryset.filter(status=ticket_status.upper())

        category = request.query_params.get("category")
        if category and category.upper() != "ALL":
            queryset = queryset.filter(category=category.upper())

        priority = request.query_params.get("priority")
        if priority and priority.upper() != "ALL":
            queryset = queryset.filter(priority=priority.upper())

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(ticket_number__icontains=search)
                | Q(subject__icontains=search)
                | Q(description__icontains=search)
            )

        # Pagination
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        try:
            page_size = max(1, min(50, int(request.query_params.get("page_size", 10))))
        except ValueError:
            page_size = 10

        total_count = queryset.count()
        total_pages = max(1, math.ceil(total_count / page_size))
        start = (page - 1) * page_size
        paged_tickets = queryset[start : start + page_size]

        serializer = SupportTicketListSerializer(
            paged_tickets, many=True, context={"request": request}
        )

        return Response(
            {
                "tickets": serializer.data,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page,
                "page_size": page_size,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No registered or approved salon found for your account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SupportTicketCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        ticket = SupportTicket.objects.create(
            salon=salon,
            created_by=request.user,
            subject=validated_data["subject"],
            category=validated_data.get("category", SupportTicket.Category.TECHNICAL),
            priority=validated_data.get("priority", SupportTicket.Priority.MEDIUM),
            description=validated_data["description"],
            attachment=validated_data.get("attachment"),
            status=SupportTicket.Status.OPEN,
        )

        # Log creation activity
        log_ticket_activity(
            ticket=ticket,
            user=request.user,
            activity_type=TicketActivity.ActivityType.CREATED,
            details=f"Ticket #{ticket.ticket_number} created with priority '{ticket.get_priority_display()}'.",
        )

        # Send notifications asynchronously / safely
        send_ticket_created_emails(ticket)

        detail_serializer = SupportTicketDetailSerializer(
            ticket, context={"request": request}
        )
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class SalonOwnerTicketDetailView(APIView):
    """
    GET: Retrieve ticket details, conversation messages, and activities.
    Only allows access to the ticket if it belongs to the authenticated user's salon.
    Automatically marks unread admin messages as read for this ticket.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]

    def get(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No registered salon found for your account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ticket = get_object_or_404(
            SupportTicket.objects.select_related("salon", "created_by", "assigned_to"),
            pk=pk,
            salon=salon,  # Enforces salon-level isolation
        )

        # Mark unread admin messages as read
        unread_admin_msgs = ticket.messages.filter(
            sender_type=TicketMessage.SenderType.SUPER_ADMIN,
            is_read=False,
        )
        if unread_admin_msgs.exists():
            now = timezone.now()
            unread_admin_msgs.update(is_read=True, read_at=now)

        serializer = SupportTicketDetailSerializer(
            ticket, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class SalonOwnerTicketReplyView(APIView):
    """
    POST: Post a conversation reply from the salon owner to Super Admin.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No registered salon found for your account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ticket = get_object_or_404(SupportTicket, pk=pk, salon=salon)

        if ticket.status == SupportTicket.Status.CLOSED:
            return Response(
                {"error": "This ticket is closed. Please reopen it to post a reply."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TicketMessageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message_text = serializer.validated_data["message"]
        attachment = serializer.validated_data.get("attachment")

        # Create message
        message_obj = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_type=TicketMessage.SenderType.SALON_OWNER,
            message=message_text,
            attachment=attachment,
            is_read=False,
        )

        # Status transition: if ticket was WAITING_FOR_CUSTOMER or RESOLVED, transition to IN_PROGRESS
        status_changed = False
        old_status = ticket.status
        if ticket.status in [
            SupportTicket.Status.WAITING_FOR_CUSTOMER,
            SupportTicket.Status.RESOLVED,
        ]:
            ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.save(update_fields=["status", "updated_at"])
            status_changed = True
            log_ticket_activity(
                ticket=ticket,
                user=request.user,
                activity_type=TicketActivity.ActivityType.STATUS_CHANGED,
                details=f"Status auto-transitioned from {old_status} to In Progress after owner reply.",
                old_value=old_status,
                new_value="IN_PROGRESS",
            )
        else:
            ticket.save(update_fields=["updated_at"])

        # Log activity
        log_ticket_activity(
            ticket=ticket,
            user=request.user,
            activity_type=TicketActivity.ActivityType.OWNER_REPLIED,
            details=f"Salon Owner replied: '{message_text[:60]}...'",
        )

        # Send notification to admin
        send_owner_reply_email(ticket, message_obj)

        msg_serializer = TicketMessageSerializer(
            message_obj, context={"request": request}
        )
        return Response(
            {
                "message": msg_serializer.data,
                "ticket_status": ticket.status,
                "ticket_status_display": ticket.get_status_display(),
                "status_changed": status_changed,
            },
            status=status.HTTP_201_CREATED,
        )


class SalonOwnerTicketReopenView(APIView):
    """
    POST: Reopen a resolved or closed ticket if the salon owner feels the issue is not fixed.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No registered salon found for your account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ticket = get_object_or_404(SupportTicket, pk=pk, salon=salon)

        if ticket.status not in [
            SupportTicket.Status.RESOLVED,
            SupportTicket.Status.CLOSED,
        ]:
            return Response(
                {
                    "error": f"Ticket #{ticket.ticket_number} is currently '{ticket.get_status_display()}'. Only Resolved or Closed tickets can be reopened."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TicketReopenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data["reason"]
        attachment = serializer.validated_data.get("attachment")
        old_status = ticket.status

        # Transition to OPEN
        ticket.status = SupportTicket.Status.OPEN
        ticket.resolved_at = None
        ticket.closed_at = None
        ticket.save(update_fields=["status", "resolved_at", "closed_at", "updated_at"])

        # Add message in conversation
        message_obj = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_type=TicketMessage.SenderType.SALON_OWNER,
            message=f"🔄 TICKET REOPENED BY SALON OWNER:\n\n{reason}",
            attachment=attachment,
            is_read=False,
        )

        # Log activity
        log_ticket_activity(
            ticket=ticket,
            user=request.user,
            activity_type=TicketActivity.ActivityType.REOPENED,
            details=f"Ticket reopened by salon owner. Reason: {reason[:120]}",
            old_value=old_status,
            new_value="OPEN",
        )

        send_owner_reply_email(ticket, message_obj)

        detail_serializer = SupportTicketDetailSerializer(
            ticket, context={"request": request}
        )
        return Response(detail_serializer.data, status=status.HTTP_200_OK)


class SalonOwnerSupportUnreadCountView(APIView):
    """
    GET: Returns total count of unread messages sent by admin across the salon owner's tickets.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]

    def get(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"unread_count": 0, "open_tickets_count": 0})

        unread_count = TicketMessage.objects.filter(
            ticket__salon=salon,
            sender_type=TicketMessage.SenderType.SUPER_ADMIN,
            is_read=False,
        ).count()

        open_tickets = SupportTicket.objects.filter(
            salon=salon,
            status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.IN_PROGRESS],
        ).count()

        return Response(
            {
                "unread_count": unread_count,
                "open_tickets_count": open_tickets,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# SUPER ADMIN TICKET VIEWS
# ==============================================================================

class AdminTicketListView(APIView):
    """
    GET: List tickets from all registered salons with filters, search, and pagination.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        queryset = SupportTicket.objects.all().select_related(
            "salon", "created_by", "assigned_to"
        ).prefetch_related("messages")

        # Filters
        ticket_status = request.query_params.get("status")
        if ticket_status and ticket_status.upper() != "ALL":
            queryset = queryset.filter(status=ticket_status.upper())

        category = request.query_params.get("category")
        if category and category.upper() != "ALL":
            queryset = queryset.filter(category=category.upper())

        priority = request.query_params.get("priority")
        if priority and priority.upper() != "ALL":
            queryset = queryset.filter(priority=priority.upper())

        salon_id = request.query_params.get("salon_id")
        if salon_id and salon_id.isdigit():
            queryset = queryset.filter(salon_id=int(salon_id))

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(ticket_number__icontains=search)
                | Q(subject__icontains=search)
                | Q(salon__name__icontains=search)
                | Q(created_by__email__icontains=search)
                | Q(description__icontains=search)
            )

        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        # Pagination
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        try:
            page_size = max(1, min(100, int(request.query_params.get("page_size", 10))))
        except ValueError:
            page_size = 10

        total_count = queryset.count()
        total_pages = max(1, math.ceil(total_count / page_size))
        start = (page - 1) * page_size
        paged_tickets = queryset[start : start + page_size]

        serializer = SupportTicketListSerializer(
            paged_tickets, many=True, context={"request": request}
        )

        return Response(
            {
                "tickets": serializer.data,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page,
                "page_size": page_size,
            },
            status=status.HTTP_200_OK,
        )


class AdminTicketDetailView(APIView):
    """
    GET: Retrieve ticket details, complete messages, and activities across any salon.
    Marks all unread messages from the salon owner as read for admin.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, pk):
        ticket = get_object_or_404(
            SupportTicket.objects.select_related("salon", "created_by", "assigned_to"),
            pk=pk,
        )

        # Mark salon owner messages as read
        unread_owner_msgs = ticket.messages.filter(
            sender_type=TicketMessage.SenderType.SALON_OWNER,
            is_read=False,
        )
        if unread_owner_msgs.exists():
            now = timezone.now()
            unread_owner_msgs.update(is_read=True, read_at=now)

        serializer = SupportTicketDetailSerializer(
            ticket, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminTicketReplyView(APIView):
    """
    POST: Super Admin reply to a salon's support ticket, with optional status update.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)

        serializer = TicketMessageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message_text = serializer.validated_data["message"]
        attachment = serializer.validated_data.get("attachment")
        status_update = serializer.validated_data.get("status_update")

        # Create message
        message_obj = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_type=TicketMessage.SenderType.SUPER_ADMIN,
            message=message_text,
            attachment=attachment,
            is_read=False,
        )

        # Check for status update
        old_status = ticket.status
        if status_update and status_update != ticket.status:
            ticket.status = status_update
            if status_update == SupportTicket.Status.RESOLVED:
                ticket.resolved_at = timezone.now()
            elif status_update == SupportTicket.Status.CLOSED:
                ticket.closed_at = timezone.now()

            ticket.save(update_fields=["status", "resolved_at", "closed_at", "updated_at"])
            log_ticket_activity(
                ticket=ticket,
                user=request.user,
                activity_type=TicketActivity.ActivityType.STATUS_CHANGED,
                details=f"Admin replied and updated status to '{ticket.get_status_display()}'.",
                old_value=old_status,
                new_value=status_update,
            )
            send_status_update_email(ticket, old_status, status_update)
        elif ticket.status == SupportTicket.Status.OPEN:
            # Auto update open ticket to WAITING_FOR_CUSTOMER on reply
            ticket.status = SupportTicket.Status.WAITING_FOR_CUSTOMER
            ticket.save(update_fields=["status", "updated_at"])
            log_ticket_activity(
                ticket=ticket,
                user=request.user,
                activity_type=TicketActivity.ActivityType.STATUS_CHANGED,
                details="Status moved to 'Waiting for Customer' following Admin response.",
                old_value=old_status,
                new_value="WAITING_FOR_CUSTOMER",
            )
        else:
            ticket.save(update_fields=["updated_at"])

        # Log admin reply activity
        log_ticket_activity(
            ticket=ticket,
            user=request.user,
            activity_type=TicketActivity.ActivityType.ADMIN_REPLIED,
            details=f"Admin replied: '{message_text[:60]}...'",
        )

        # Send notification to salon owner
        send_admin_reply_email(ticket, message_obj)

        msg_serializer = TicketMessageSerializer(
            message_obj, context={"request": request}
        )
        return Response(
            {
                "message": msg_serializer.data,
                "ticket_status": ticket.status,
                "ticket_status_display": ticket.get_status_display(),
            },
            status=status.HTTP_201_CREATED,
        )


class AdminTicketStatusUpdateView(APIView):
    """
    PATCH: Change ticket status (Open, In Progress, Waiting for Customer, Resolved, Closed).
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)

        serializer = TicketStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data["status"]
        note = serializer.validated_data.get("note", "").strip()
        old_status = ticket.status

        if new_status == old_status:
            return Response(
                {"message": f"Ticket status is already {ticket.get_status_display()}."},
                status=status.HTTP_200_OK,
            )

        ticket.status = new_status
        if new_status == SupportTicket.Status.RESOLVED:
            ticket.resolved_at = timezone.now()
        elif new_status == SupportTicket.Status.CLOSED:
            ticket.closed_at = timezone.now()
        elif old_status in [SupportTicket.Status.RESOLVED, SupportTicket.Status.CLOSED]:
            ticket.resolved_at = None
            ticket.closed_at = None

        ticket.save(update_fields=["status", "resolved_at", "closed_at", "updated_at"])

        detail_text = f"Status changed from '{old_status}' to '{ticket.get_status_display()}'."
        if note:
            detail_text += f" Note: {note}"

        log_ticket_activity(
            ticket=ticket,
            user=request.user,
            activity_type=TicketActivity.ActivityType.STATUS_CHANGED,
            details=detail_text,
            old_value=old_status,
            new_value=new_status,
        )

        send_status_update_email(ticket, old_status, new_status)

        detail_serializer = SupportTicketDetailSerializer(
            ticket, context={"request": request}
        )
        return Response(detail_serializer.data, status=status.HTTP_200_OK)


class AdminTicketPriorityUpdateView(APIView):
    """
    PATCH: Update priority (Low, Medium, High, Urgent).
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)

        serializer = TicketPriorityUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_priority = serializer.validated_data["priority"]
        note = serializer.validated_data.get("note", "").strip()
        old_priority = ticket.priority

        if new_priority == old_priority:
            return Response(
                {"message": f"Ticket priority is already {ticket.get_priority_display()}."},
                status=status.HTTP_200_OK,
            )

        ticket.priority = new_priority
        ticket.save(update_fields=["priority", "updated_at"])

        detail_text = f"Priority adjusted from '{old_priority}' to '{ticket.get_priority_display()}'."
        if note:
            detail_text += f" Note: {note}"

        log_ticket_activity(
            ticket=ticket,
            user=request.user,
            activity_type=TicketActivity.ActivityType.PRIORITY_CHANGED,
            details=detail_text,
            old_value=old_priority,
            new_value=new_priority,
        )

        detail_serializer = SupportTicketDetailSerializer(
            ticket, context={"request": request}
        )
        return Response(detail_serializer.data, status=status.HTTP_200_OK)


class AdminTicketStatsView(APIView):
    """
    GET: Aggregated ticket statistics for Super Admin dashboard.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        total_tickets = SupportTicket.objects.count()
        status_counts = SupportTicket.objects.values("status").annotate(count=Count("id"))
        status_map = {row["status"]: row["count"] for row in status_counts}

        urgent_active = SupportTicket.objects.filter(
            priority=SupportTicket.Priority.URGENT,
            status__in=[
                SupportTicket.Status.OPEN,
                SupportTicket.Status.IN_PROGRESS,
                SupportTicket.Status.WAITING_FOR_CUSTOMER,
            ],
        ).count()

        unread_messages = TicketMessage.objects.filter(
            sender_type=TicketMessage.SenderType.SALON_OWNER,
            is_read=False,
        ).count()

        return Response(
            {
                "total_tickets": total_tickets,
                "open_tickets": status_map.get(SupportTicket.Status.OPEN, 0),
                "in_progress_tickets": status_map.get(SupportTicket.Status.IN_PROGRESS, 0),
                "waiting_customer_tickets": status_map.get(
                    SupportTicket.Status.WAITING_FOR_CUSTOMER, 0
                ),
                "resolved_tickets": status_map.get(SupportTicket.Status.RESOLVED, 0),
                "closed_tickets": status_map.get(SupportTicket.Status.CLOSED, 0),
                "urgent_tickets": urgent_active,
                "unread_messages_count": unread_messages,
            },
            status=status.HTTP_200_OK,
        )


class AdminTicketUnreadCountView(APIView):
    """
    GET: Quick unread count for Admin badge.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        unread_count = TicketMessage.objects.filter(
            sender_type=TicketMessage.SenderType.SALON_OWNER,
            is_read=False,
        ).count()
        open_tickets = SupportTicket.objects.filter(
            status=SupportTicket.Status.OPEN
        ).count()
        return Response(
            {
                "unread_count": unread_count,
                "open_tickets_count": open_tickets,
            },
            status=status.HTTP_200_OK,
        )
