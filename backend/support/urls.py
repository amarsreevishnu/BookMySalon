from django.urls import path
from .views import (
    SalonOwnerTicketListCreateView,
    SalonOwnerTicketDetailView,
    SalonOwnerTicketReplyView,
    SalonOwnerTicketReopenView,
    SalonOwnerSupportUnreadCountView,
    AdminTicketListView,
    AdminTicketDetailView,
    AdminTicketReplyView,
    AdminTicketStatusUpdateView,
    AdminTicketPriorityUpdateView,
    AdminTicketStatsView,
    AdminTicketUnreadCountView,
)

urlpatterns = [
    # ── Salon Owner Support Endpoints ──
    path("owner/tickets/", SalonOwnerTicketListCreateView.as_view(), name="owner-ticket-list-create"),
    path("owner/tickets/<int:pk>/", SalonOwnerTicketDetailView.as_view(), name="owner-ticket-detail"),
    path("owner/tickets/<int:pk>/reply/", SalonOwnerTicketReplyView.as_view(), name="owner-ticket-reply"),
    path("owner/tickets/<int:pk>/reopen/", SalonOwnerTicketReopenView.as_view(), name="owner-ticket-reopen"),
    path("owner/unread-count/", SalonOwnerSupportUnreadCountView.as_view(), name="owner-support-unread-count"),

    # ── Super Admin Support Endpoints ──
    path("admin/tickets/", AdminTicketListView.as_view(), name="admin-ticket-list"),
    path("admin/tickets/<int:pk>/", AdminTicketDetailView.as_view(), name="admin-ticket-detail"),
    path("admin/tickets/<int:pk>/reply/", AdminTicketReplyView.as_view(), name="admin-ticket-reply"),
    path("admin/tickets/<int:pk>/status/", AdminTicketStatusUpdateView.as_view(), name="admin-ticket-status-update"),
    path("admin/tickets/<int:pk>/priority/", AdminTicketPriorityUpdateView.as_view(), name="admin-ticket-priority-update"),
    path("admin/stats/", AdminTicketStatsView.as_view(), name="admin-support-stats"),
    path("admin/unread-count/", AdminTicketUnreadCountView.as_view(), name="admin-support-unread-count"),
]
