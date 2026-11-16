import datetime
from decimal import Decimal
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import (
    Count,
    Sum,
    Avg,
    Q,
    F,
    Case,
    When,
    IntegerField,
    DecimalField,
    Value,
)
from django.db.models.functions import (
    TruncDate,
    TruncDay,
    TruncMonth,
    TruncYear,
    ExtractHour,
    ExtractWeekDay,
)
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, CustomerProfile
from salons.models import Salon, WorkerProfile
from bookings.models import Booking
from subscriptions.models import (
    SubscriptionPlan,
    SalonSubscription,
    SubscriptionPayment,
    SubscriptionHistory,
    SuperAdminWallet,
    SuperAdminWalletTransaction,
)
from support.models import SupportTicket
from reviews.models import SalonReview
from offers.models import Offer, OfferRedemption
from payments.models import Payment

class IsAdminUserRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "role", None) == "ADMIN"
                or request.user.is_superuser
                or request.user.is_staff
            )
        )


def _calc_growth(current_val, prev_val):
    curr = float(current_val or 0)
    prev = float(prev_val or 0)
    if prev > 0:
        return round(((curr - prev) / prev) * 100, 1)
    elif prev == 0 and curr > 0:
        return 100.0
    return 0.0


def _parse_timeframe(request):
    timeframe = request.query_params.get("timeframe", "30d").lower()
    now = timezone.now()

    if timeframe == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now
        delta = datetime.timedelta(days=1)
        prev_start = start_date - delta
        prev_end = start_date
        group_by = "hour"
        period_label = "vs. yesterday"

    elif timeframe == "7d":
        delta = datetime.timedelta(days=7)
        start_date = now - delta
        end_date = now
        prev_start = start_date - delta
        prev_end = start_date
        group_by = "day"
        period_label = "vs. previous 7 days"

    elif timeframe == "3m":
        delta = datetime.timedelta(days=90)
        start_date = now - delta
        end_date = now
        prev_start = start_date - delta
        prev_end = start_date
        group_by = "month"
        period_label = "vs. previous 3 months"

    elif timeframe == "year":
        delta = datetime.timedelta(days=365)
        start_date = now - delta
        end_date = now
        prev_start = start_date - delta
        prev_end = start_date
        group_by = "month"
        period_label = "vs. previous year"

    elif timeframe == "custom":
        raw_start = request.query_params.get("start_date")
        raw_end = request.query_params.get("end_date")
        try:
            parsed_start = datetime.datetime.strptime(raw_start, "%Y-%m-%d")
            parsed_end = datetime.datetime.strptime(raw_end, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59
            )
            start_date = timezone.make_aware(parsed_start)
            end_date = timezone.make_aware(parsed_end)
        except Exception:
            delta = datetime.timedelta(days=30)
            start_date = now - delta
            end_date = now

        delta = end_date - start_date
        prev_start = start_date - delta
        prev_end = start_date
        group_by = "day" if delta.days <= 45 else "month"
        period_label = "vs. previous period"

    else:  # default 30d
        delta = datetime.timedelta(days=30)
        start_date = now - delta
        end_date = now
        prev_start = start_date - delta
        prev_end = start_date
        group_by = "day"
        period_label = "vs. previous 30 days"

    return {
        "timeframe": timeframe,
        "start_date": start_date,
        "end_date": end_date,
        "prev_start": prev_start,
        "prev_end": prev_end,
        "delta_days": delta.days,
        "group_by": group_by,
        "period_label": period_label,
    }


class AdminAnalyticsDashboardView(APIView):
    """
    Comprehensive Analytics Engine for BookMySalon Super Admin.
    Delivers intelligence across all 9 requested business domains and the Platform Overview.
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        now = timezone.now()
        tf = _parse_timeframe(request)
        start = tf["start_date"]
        end = tf["end_date"]
        prev_start = tf["prev_start"]
        prev_end = tf["prev_end"]
        period_label = tf["period_label"]

      
        # 1. PLATFORM OVERVIEW (EXACTLY 7 CARDS + 7 CHARTS)
    
        # 1.1 Total Platform Revenue (Strictly Subscriptions)
        all_time_sub_rev = float(
            SubscriptionPayment.objects.filter(status=SubscriptionPayment.Status.SUCCESS).aggregate(
                total=Sum("amount")
            )["total"]
            or 0.0
        )
        curr_sub_rev = float(
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS,
                created_at__gte=start,
                created_at__lte=end,
            ).aggregate(total=Sum("amount"))["total"]
            or 0.0
        )
        prev_sub_rev = float(
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS,
                created_at__gte=prev_start,
                created_at__lt=start,
            ).aggregate(total=Sum("amount"))["total"]
            or 0.0
        )

        # 1.2 Total Bookings
        total_bookings = Booking.objects.count()
        curr_bookings = Booking.objects.filter(created_at__gte=start, created_at__lte=end).count()
        prev_bookings = Booking.objects.filter(created_at__gte=prev_start, created_at__lt=start).count()

        # 1.3 Total Salons
        total_salons = Salon.objects.count()
        curr_salons_added = Salon.objects.filter(created_at__gte=start, created_at__lte=end).count()
        prev_salons_added = Salon.objects.filter(created_at__gte=prev_start, created_at__lt=start).count()

        # 1.4 Total Customers (CUSTOMERS ONLY, EXCLUDE OWNERS & WORKERS)
        total_customers = User.objects.filter(role=User.Role.CUSTOMER).count()
        curr_customers_joined = User.objects.filter(
            role=User.Role.CUSTOMER, date_joined__gte=start, date_joined__lte=end
        ).count()
        prev_customers_joined = User.objects.filter(
            role=User.Role.CUSTOMER, date_joined__gte=prev_start, date_joined__lt=start
        ).count()

        # 1.5 Total Reviews
        total_reviews = SalonReview.objects.count()
        curr_reviews = SalonReview.objects.filter(created_at__gte=start, created_at__lte=end).count()
        prev_reviews = SalonReview.objects.filter(created_at__gte=prev_start, created_at__lt=start).count()

        # 1.6 Total Offers
        total_offers = Offer.objects.count()
        curr_offers = Offer.objects.filter(created_at__gte=start, created_at__lte=end).count()
        prev_offers = Offer.objects.filter(created_at__gte=prev_start, created_at__lt=start).count()

        # 1.7 Total Support Tickets
        total_tickets = SupportTicket.objects.count()
        curr_tickets = SupportTicket.objects.filter(created_at__gte=start, created_at__lte=end).count()
        prev_tickets = SupportTicket.objects.filter(created_at__gte=prev_start, created_at__lt=start).count()

        # Auxiliary counts for legacy compatibility
        total_users = User.objects.count()
        curr_users_joined = User.objects.filter(date_joined__gte=start, date_joined__lte=end).count()
        prev_users_joined = User.objects.filter(date_joined__gte=prev_start, date_joined__lt=start).count()
        total_owners = User.objects.filter(role=User.Role.OWNER).count()
        curr_owners_joined = User.objects.filter(role=User.Role.OWNER, date_joined__gte=start, date_joined__lte=end).count()
        prev_owners_joined = User.objects.filter(role=User.Role.OWNER, date_joined__gte=prev_start, date_joined__lt=start).count()

        active_salons_count = Salon.objects.filter(approval_status=Salon.ApprovalStatus.APPROVED).count()
        pending_salons_count = Salon.objects.filter(approval_status=Salon.ApprovalStatus.PENDING).count()

        overview = {
            # EXACT 7 REQUESTED CARDS
            "total_revenue": {
                "value": all_time_sub_rev,
                "period_value": curr_sub_rev,
                "growth": _calc_growth(curr_sub_rev, prev_sub_rev),
                "label": "Total Platform Revenue",
                "period_label": period_label,
            },
            "total_bookings": {
                "value": total_bookings,
                "period_value": curr_bookings,
                "growth": _calc_growth(curr_bookings, prev_bookings),
                "label": "Total Bookings",
                "period_label": period_label,
            },
            "total_salons": {
                "value": total_salons,
                "period_value": curr_salons_added,
                "growth": _calc_growth(curr_salons_added, prev_salons_added),
                "label": "Total Salons",
                "period_label": period_label,
            },
            "total_customers": {
                "value": total_customers,
                "period_value": curr_customers_joined,
                "growth": _calc_growth(curr_customers_joined, prev_customers_joined),
                "label": "Total Customers",
                "period_label": period_label,
            },
            "total_reviews": {
                "value": total_reviews,
                "period_value": curr_reviews,
                "growth": _calc_growth(curr_reviews, prev_reviews),
                "label": "Total Reviews",
                "period_label": period_label,
            },
            "total_offers": {
                "value": total_offers,
                "period_value": curr_offers,
                "growth": _calc_growth(curr_offers, prev_offers),
                "label": "Total Offers",
                "period_label": period_label,
            },
            "total_support_tickets": {
                "value": total_tickets,
                "period_value": curr_tickets,
                "growth": _calc_growth(curr_tickets, prev_tickets),
                "label": "Total Support Tickets",
                "period_label": period_label,
            },
            # Compatibility Aliases
            "platform_revenue": {
                "value": all_time_sub_rev,
                "period_value": curr_sub_rev,
                "growth": _calc_growth(curr_sub_rev, prev_sub_rev),
                "label": "Platform Revenue (Subscriptions)",
                "period_label": period_label,
            },
            "total_users": {
                "value": total_users,
                "period_value": curr_users_joined,
                "growth": _calc_growth(curr_users_joined, prev_users_joined),
                "label": "Total Users",
                "period_label": period_label,
            },
            "active_salons": {
                "value": active_salons_count,
                "label": "Active Salons",
            },
            "pending_salons": {
                "value": pending_salons_count,
                "label": "Pending Salons",
            },
            "total_owners": {
                "value": total_owners,
                "label": "Salon Owners",
            },
            "period_label": period_label,
        }

        # ---------------------------------------------------------------------
        # PLATFORM OVERVIEW CHARTS (7 REQUESTED OVERVIEW CHARTS)
        # ---------------------------------------------------------------------

        # 1. Monthly platform revenue trends
        rev_trend_qs = (
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS,
                created_at__gte=now - datetime.timedelta(days=365),
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("amount"))
            .order_by("month")
        )
        overview_revenue_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "revenue": float(entry["revenue"] or 0.0),
            }
            for entry in rev_trend_qs
        ]

        # 2. Monthly booking trends
        booking_trend_qs = (
            Booking.objects.filter(created_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        overview_booking_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in booking_trend_qs
        ]

        # 3. Salon registration growth
        salon_growth_qs = (
            Salon.objects.filter(created_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        overview_salon_growth = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in salon_growth_qs
        ]

        # 4. Customer registration growth (CUSTOMERS ONLY)
        customer_growth_qs = (
            User.objects.filter(
                role=User.Role.CUSTOMER,
                date_joined__gte=now - datetime.timedelta(days=365),
            )
            .annotate(month=TruncMonth("date_joined"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        overview_customer_growth = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in customer_growth_qs
        ]

        # 5. Review trends
        review_trend_qs = (
            SalonReview.objects.filter(created_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        overview_review_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in review_trend_qs
        ]

        # 6. Offer usage statistics
        offer_usage_qs = (
            OfferRedemption.objects.filter(redeemed_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("redeemed_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        overview_offer_usage = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in offer_usage_qs
        ]

        # 7. Support ticket status distribution
        ticket_open = SupportTicket.objects.filter(status=SupportTicket.Status.OPEN).count()
        ticket_prog = SupportTicket.objects.filter(status=SupportTicket.Status.IN_PROGRESS).count()
        ticket_wait = SupportTicket.objects.filter(status=SupportTicket.Status.WAITING_FOR_CUSTOMER).count()
        ticket_res = SupportTicket.objects.filter(status=SupportTicket.Status.RESOLVED).count()
        ticket_closed = SupportTicket.objects.filter(status=SupportTicket.Status.CLOSED).count()

        overview_ticket_distribution = [
            {"label": "Open", "name": "Open", "count": ticket_open, "color": "#f59e0b"},
            {"label": "In Progress", "name": "In Progress", "count": ticket_prog, "color": "#0284c7"},
            {"label": "Waiting", "name": "Waiting", "count": ticket_wait, "color": "#8b5cf6"},
            {"label": "Resolved", "name": "Resolved", "count": ticket_res, "color": "#16a34a"},
            {"label": "Closed", "name": "Closed", "count": ticket_closed, "color": "#64748b"},
        ]

        overview_charts = {
            "revenue_trends": overview_revenue_trends,
            "booking_trends": overview_booking_trends,
            "salon_growth": overview_salon_growth,
            "customer_growth": overview_customer_growth,
            "review_trends": overview_review_trends,
            "offer_usage": overview_offer_usage,
            "ticket_distribution": overview_ticket_distribution,
        }

        # =====================================================================
        # 2. USER ANALYTICS (CUSTOMERS FOCUSED)
        # =====================================================================
        active_customers_count = User.objects.filter(role=User.Role.CUSTOMER, is_active=True).count()
        blocked_customers_count = User.objects.filter(role=User.Role.CUSTOMER, is_active=False).count()

        # Customer retention: customers who booked 2 or more times
        booking_customers_total = (
            Booking.objects.filter(customer__isnull=False)
            .values("customer")
            .distinct()
            .count()
        )
        repeat_customers_count = (
            Booking.objects.filter(customer__isnull=False)
            .values("customer")
            .annotate(b_count=Count("id"))
            .filter(b_count__gte=2)
            .count()
        )
        retention_rate = (
            round((repeat_customers_count / booking_customers_total) * 100, 1)
            if booking_customers_total > 0
            else 0.0
        )

        # Most active customers
        active_customers_qs = (
            Booking.objects.filter(customer__isnull=False)
            .values(
                "customer__id",
                "customer__first_name",
                "customer__last_name",
                "customer__email",
            )
            .annotate(
                booking_count=Count("id"),
                completed_count=Count("id", filter=Q(status=Booking.Status.COMPLETED)),
                total_spend=Sum("total_amount"),
            )
            .order_by("-booking_count")[:6]
        )
        most_active_customers = [
            {
                "id": c["customer__id"],
                "name": f"{c['customer__first_name'] or ''} {c['customer__last_name'] or ''}".strip()
                or c["customer__email"].split("@")[0],
                "email": c["customer__email"],
                "booking_count": c["booking_count"],
                "completed_count": c["completed_count"],
                "total_spend": float(c["total_spend"] or 0.0),
                "total_spent": float(c["total_spend"] or 0.0),
            }
            for c in active_customers_qs
        ]

        # Customer registration trends
        customer_reg_qs = (
            User.objects.filter(
                role=User.Role.CUSTOMER,
                date_joined__gte=now - datetime.timedelta(days=365)
            )
            .annotate(month=TruncMonth("date_joined"))
            .values("month")
            .annotate(total=Count("id"))
            .order_by("month")
        )
        customer_registration_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["total"],
                "total": entry["total"],
            }
            for entry in customer_reg_qs
        ]

        user_analytics = {
            "total_customers": total_customers,
            "new_customers": curr_customers_joined,
            "active_customers": active_customers_count,
            "blocked_customers": blocked_customers_count,
            "customer_growth_pct": _calc_growth(curr_customers_joined, prev_customers_joined),
            "retention_rate": retention_rate,
            "retention_rate_pct": retention_rate,
            "active_vs_blocked_distribution": [
                {"label": "Active Customers", "name": "Active", "count": active_customers_count, "color": "#16a34a"},
                {"label": "Blocked Customers", "name": "Blocked", "count": blocked_customers_count, "color": "#dc2626"},
            ],
            "registration_trends": customer_registration_trends,
            "most_active_customers": most_active_customers,
            # Legacy fields for backward compatibility
            "total_owners": total_owners,
            "new_registrations": curr_users_joined,
            "active_users": User.objects.filter(is_active=True).count(),
            "blocked_users": User.objects.filter(is_active=False).count(),
        }

        # =====================================================================
        # 3. SALON ANALYTICS
        # =====================================================================
        approved_salons = Salon.objects.filter(approval_status=Salon.ApprovalStatus.APPROVED).count()
        pending_salons = Salon.objects.filter(approval_status=Salon.ApprovalStatus.PENDING).count()
        rejected_salons = Salon.objects.filter(approval_status=Salon.ApprovalStatus.REJECTED).count()
        blocked_salons = Salon.objects.filter(approval_status=Salon.ApprovalStatus.BLOCKED).count()

        expired_sub_salons = SalonSubscription.objects.filter(
            Q(status=SalonSubscription.Status.EXPIRED) | Q(end_date__lt=now)
        ).count()

        top_salons_qs = (
            Salon.objects.annotate(
                bookings_count=Count("bookings"),
                completed_count=Count("bookings", filter=Q(bookings__status=Booking.Status.COMPLETED)),
                booking_revenue=Sum("bookings__total_amount", filter=Q(bookings__status=Booking.Status.COMPLETED)),
            )
            .order_by("-bookings_count")[:6]
        )
        top_salons = [
            {
                "id": s.id,
                "name": s.name,
                "city": s.city,
                "cover_image": s.cover_image or "",
                "bookings_count": s.bookings_count,
                "booking_count": s.bookings_count,
                "completed_count": s.completed_count,
                "booking_revenue": float(s.booking_revenue or 0.0),
                "revenue": float(s.booking_revenue or 0.0),
                "approval_status": s.approval_status,
            }
            for s in top_salons_qs
        ]

        salon_reg_qs = (
            Salon.objects.filter(created_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(
                total=Count("id"),
                approved=Count("id", filter=Q(approval_status=Salon.ApprovalStatus.APPROVED)),
                pending=Count("id", filter=Q(approval_status=Salon.ApprovalStatus.PENDING)),
            )
            .order_by("month")
        )
        salon_registration_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["total"],
                "total": entry["total"],
                "approved": entry["approved"],
                "pending": entry["pending"],
            }
            for entry in salon_reg_qs
        ]

        salon_analytics = {
            "total_salons": total_salons,
            "approved_salons": approved_salons,
            "approved": approved_salons,
            "pending_salons": pending_salons,
            "pending": pending_salons,
            "rejected_salons": rejected_salons,
            "rejected": rejected_salons,
            "blocked_salons": blocked_salons,
            "blocked": blocked_salons,
            "active_salons": active_salons_count,
            "active_subscriptions": active_salons_count,
            "expired_subs_salons": expired_sub_salons,
            "expired_subscriptions": expired_sub_salons,
            "top_salons": top_salons,
            "approval_status_distribution": [
                {"label": "Approved", "name": "Approved", "count": approved_salons, "color": "#16a34a"},
                {"label": "Pending", "name": "Pending", "count": pending_salons, "color": "#eab308"},
                {"label": "Rejected", "name": "Rejected", "count": rejected_salons, "color": "#dc2626"},
                {"label": "Blocked", "name": "Blocked", "count": blocked_salons, "color": "#64748b"},
            ],
            "registration_trends": salon_registration_trends,
        }

        # =====================================================================
        # 4. BOOKING ANALYTICS
        # =====================================================================
        bookings_in_period = Booking.objects.filter(created_at__gte=start, created_at__lte=end)
        total_p_bookings = bookings_in_period.count()

        completed_b = bookings_in_period.filter(status=Booking.Status.COMPLETED).count()
        confirmed_b = bookings_in_period.filter(status=Booking.Status.CONFIRMED).count()
        pending_b = bookings_in_period.filter(status=Booking.Status.PENDING).count()
        cancelled_b = bookings_in_period.filter(status=Booking.Status.CANCELLED).count()
        noshow_b = bookings_in_period.filter(status=Booking.Status.NO_SHOW).count()

        cancellation_rate = (
            round((cancelled_b / total_p_bookings) * 100, 1)
            if total_p_bookings > 0
            else 0.0
        )

        if tf["group_by"] == "hour":
            trend_qs = (
                bookings_in_period.annotate(slot=TruncDay("created_at"))
                .values("slot")
                .annotate(
                    count=Count("id"),
                    completed=Count("id", filter=Q(status=Booking.Status.COMPLETED)),
                    cancelled=Count("id", filter=Q(status=Booking.Status.CANCELLED)),
                )
                .order_by("slot")
            )
        elif tf["group_by"] == "day":
            trend_qs = (
                bookings_in_period.annotate(slot=TruncDate("created_at"))
                .values("slot")
                .annotate(
                    count=Count("id"),
                    completed=Count("id", filter=Q(status=Booking.Status.COMPLETED)),
                    cancelled=Count("id", filter=Q(status=Booking.Status.CANCELLED)),
                )
                .order_by("slot")
            )
        else:
            trend_qs = (
                bookings_in_period.annotate(slot=TruncMonth("created_at"))
                .values("slot")
                .annotate(
                    count=Count("id"),
                    completed=Count("id", filter=Q(status=Booking.Status.COMPLETED)),
                    cancelled=Count("id", filter=Q(status=Booking.Status.CANCELLED)),
                )
                .order_by("slot")
            )

        booking_trends = [
            {
                "label": entry["slot"].strftime("%d %b") if entry["slot"] else "",
                "count": entry["count"],
                "total": entry["count"],
                "completed": entry["completed"],
                "cancelled": entry["cancelled"],
            }
            for entry in trend_qs
        ]

        day_counts = {name: 0 for name in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
        for b in bookings_in_period.only("booking_date"):
            if b.booking_date:
                w_day = b.booking_date.strftime("%A")
                day_counts[w_day] = day_counts.get(w_day, 0) + 1

        peak_days = [
            {"label": day[:3], "day": day, "count": count}
            for day, count in day_counts.items()
        ]

        hour_counts = {f"{h:02d}:00": 0 for h in range(8, 22)}
        for b in bookings_in_period.only("booking_time", "created_at"):
            time_str = b.booking_time or ""
            parsed_hour = None
            if ":" in time_str:
                try:
                    parts = time_str.split(":")
                    h_val = int(parts[0].strip()[-2:])
                    if "PM" in time_str.upper() and h_val < 12:
                        h_val += 12
                    elif "AM" in time_str.upper() and h_val == 12:
                        h_val = 0
                    parsed_hour = f"{h_val:02d}:00"
                except Exception:
                    pass
            if not parsed_hour:
                parsed_hour = f"{b.created_at.hour:02d}:00"

            if parsed_hour in hour_counts:
                hour_counts[parsed_hour] += 1

        peak_hours = [{"label": hour, "hour": hour, "count": count} for hour, count in hour_counts.items()]

        booking_analytics = {
            "total_bookings": total_p_bookings,
            "completed_bookings": completed_b,
            "completed": completed_b,
            "confirmed_bookings": confirmed_b,
            "confirmed": confirmed_b,
            "pending_bookings": pending_b,
            "pending": pending_b,
            "cancelled_bookings": cancelled_b,
            "cancelled": cancelled_b,
            "no_show_bookings": noshow_b,
            "no_show": noshow_b,
            "cancellation_rate_pct": cancellation_rate,
            "cancellation_rate": cancellation_rate,
            "status_distribution": [
                {"label": "Completed", "name": "Completed", "count": completed_b, "color": "#16a34a"},
                {"label": "Confirmed", "name": "Confirmed", "count": confirmed_b, "color": "#0284c7"},
                {"label": "Pending", "name": "Pending", "count": pending_b, "color": "#eab308"},
                {"label": "Cancelled", "name": "Cancelled", "count": cancelled_b, "color": "#dc2626"},
                {"label": "No Show", "name": "No Show", "count": noshow_b, "color": "#64748b"},
            ],
            "trends": booking_trends,
            "peak_days": peak_days,
            "peak_hours": peak_hours,
        }

        # =====================================================================
        # 5. REVENUE ANALYTICS (PLATFORM SUBSCRIPTION REVENUE ONLY)
        # =====================================================================
        sub_payments_qs = SubscriptionPayment.objects.filter(
            status=SubscriptionPayment.Status.SUCCESS,
            created_at__gte=start,
            created_at__lte=end,
        )
        gross_sub_revenue = float(sub_payments_qs.aggregate(t=Sum("amount"))["t"] or 0.0)

        refunds_total = float(
            SuperAdminWalletTransaction.objects.filter(
                transaction_type__in=[
                    SuperAdminWalletTransaction.TransactionType.PAYOUT,
                    SuperAdminWalletTransaction.TransactionType.ADJUSTMENT,
                ],
                created_at__gte=start,
                created_at__lte=end,
            ).aggregate(t=Sum("amount"))["t"]
            or 0.0
        )
        net_sub_revenue = max(0.0, gross_sub_revenue - refunds_total)

        # Monthly subscription revenue trend
        sub_monthly_qs = (
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS,
                created_at__gte=now - datetime.timedelta(days=365),
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("amount"))
            .order_by("month")
        )
        monthly_revenue_trend = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "revenue": float(entry["revenue"] or 0.0),
            }
            for entry in sub_monthly_qs
        ]

        sub_yearly_qs = (
            SubscriptionPayment.objects.filter(status=SubscriptionPayment.Status.SUCCESS)
            .annotate(year=TruncYear("created_at"))
            .values("year")
            .annotate(revenue=Sum("amount"))
            .order_by("year")
        )
        yearly_revenue = [
            {
                "label": entry["year"].strftime("%Y") if entry["year"] else "",
                "year": entry["year"].strftime("%Y") if entry["year"] else "",
                "revenue": float(entry["revenue"] or 0.0),
            }
            for entry in sub_yearly_qs
        ]

        plan_rev_qs = (
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS,
                created_at__gte=start,
                created_at__lte=end,
            )
            .values("plan__name")
            .annotate(revenue=Sum("amount"), subscribers=Count("id"))
            .order_by("-revenue")
        )
        revenue_by_plan = [
            {
                "label": item["plan__name"] or "Standard Plan",
                "name": item["plan__name"] or "Standard Plan",
                "revenue": float(item["revenue"] or 0.0),
                "count": item["subscribers"],
            }
            for item in plan_rev_qs
        ]

        # Calculate monthly and yearly subscription figures
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        curr_month_rev = float(
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS, created_at__gte=month_start
            ).aggregate(t=Sum("amount"))["t"]
            or 0.0
        )
        year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        curr_year_rev = float(
            SubscriptionPayment.objects.filter(
                status=SubscriptionPayment.Status.SUCCESS, created_at__gte=year_start
            ).aggregate(t=Sum("amount"))["t"]
            or 0.0
        )

        revenue_analytics = {
            "total_subscription_revenue": gross_sub_revenue,
            "gross_subscription_revenue": gross_sub_revenue,
            "monthly_subscription_revenue": curr_month_rev,
            "yearly_subscription_revenue": curr_year_rev,
            "net_subscription_revenue": net_sub_revenue,
            "refund_amounts": refunds_total,
            "refund_amount": refunds_total,
            "revenue_growth": _calc_growth(curr_sub_rev, prev_sub_rev),
            "revenue_growth_pct": _calc_growth(curr_sub_rev, prev_sub_rev),
            "all_time_revenue": all_time_sub_rev,
            "monthly_trends": monthly_revenue_trend,
            "monthly_trend": monthly_revenue_trend,
            "yearly_revenue": yearly_revenue,
            "revenue_by_plan": revenue_by_plan,
        }

        # =====================================================================
        # 6. REVIEW ANALYTICS
        # =====================================================================
        reviews_in_period = SalonReview.objects.filter(created_at__gte=start, created_at__lte=end)
        avg_rating = float(SalonReview.objects.aggregate(a=Avg("rating"))["a"] or 0.0)
        visible_reviews = SalonReview.objects.filter(is_hidden=False).count()
        hidden_reviews = SalonReview.objects.filter(is_hidden=True).count()

        # Rating distribution (5 stars to 1 star)
        star_counts = {s: SalonReview.objects.filter(rating=s).count() for s in range(5, 0, -1)}
        rating_distribution = [
            {"label": "5 Stars", "name": "5 Stars", "count": star_counts[5], "color": "#16a34a"},
            {"label": "4 Stars", "name": "4 Stars", "count": star_counts[4], "color": "#52b788"},
            {"label": "3 Stars", "name": "3 Stars", "count": star_counts[3], "color": "#eab308"},
            {"label": "2 Stars", "name": "2 Stars", "count": star_counts[2], "color": "#f97316"},
            {"label": "1 Star", "name": "1 Star", "count": star_counts[1], "color": "#dc2626"},
        ]

        # Review trends
        rev_trend_qs = (
            SalonReview.objects.filter(created_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"), avg_rating=Avg("rating"))
            .order_by("month")
        )
        review_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
                "avg_rating": round(float(entry["avg_rating"] or 0.0), 1),
            }
            for entry in rev_trend_qs
        ]

        # Top-rated Salons (at least 1 review)
        top_rated_salons_qs = (
            Salon.objects.annotate(
                avg_rate=Avg("salon_reviews__rating"),
                rev_count=Count("salon_reviews"),
            )
            .filter(rev_count__gt=0)
            .order_by("-avg_rate", "-rev_count")[:5]
        )
        top_rated_salons = [
            {
                "id": s.id,
                "name": s.name,
                "city": s.city,
                "avg_rating": round(float(s.avg_rate or 0.0), 1),
                "review_count": s.rev_count,
            }
            for s in top_rated_salons_qs
        ]

        # Low-rated Salons (below 3.5 stars)
        low_rated_salons_qs = (
            Salon.objects.annotate(
                avg_rate=Avg("salon_reviews__rating"),
                rev_count=Count("salon_reviews"),
            )
            .filter(rev_count__gt=0, avg_rate__lt=3.5)
            .order_by("avg_rate")[:5]
        )
        low_rated_salons = [
            {
                "id": s.id,
                "name": s.name,
                "city": s.city,
                "avg_rating": round(float(s.avg_rate or 0.0), 1),
                "review_count": s.rev_count,
            }
            for s in low_rated_salons_qs
        ]

        # Recent Reviews (last 6)
        recent_reviews = [
            {
                "id": r.id,
                "customer_name": f"{r.customer.first_name} {r.customer.last_name}".strip() or r.customer.email.split("@")[0],
                "salon_name": r.salon.name if r.salon else "Salon",
                "rating": r.rating,
                "comment": r.comment[:100] if r.comment else "No comment provided",
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
                "is_hidden": r.is_hidden,
            }
            for r in SalonReview.objects.select_related("customer", "salon").order_by("-created_at")[:6]
        ]

        review_analytics = {
            "total_reviews": total_reviews,
            "period_reviews": reviews_in_period.count(),
            "avg_rating": round(avg_rating, 1),
            "visible_reviews": visible_reviews,
            "hidden_reviews": hidden_reviews,
            "rating_distribution": rating_distribution,
            "review_trends": review_trends,
            "top_rated_salons": top_rated_salons,
            "low_rated_salons": low_rated_salons,
            "recent_reviews": recent_reviews,
        }

        # =====================================================================
        # 7. OFFER ANALYTICS
        # =====================================================================
        today_date = timezone.localdate()
        active_offers_count = Offer.objects.filter(is_active=True, end_date__gte=today_date).count()
        expired_offers_count = Offer.objects.filter(Q(is_active=False) | Q(end_date__lt=today_date)).count()
        total_redemptions = OfferRedemption.objects.count()
        period_redemptions = OfferRedemption.objects.filter(redeemed_at__gte=start, redeemed_at__lte=end).count()

        # Offer type distribution
        offer_types = Offer.objects.values("offer_type").annotate(count=Count("id")).order_by("-count")
        offer_type_distribution = [
            {
                "label": item["offer_type"].replace("_", " ").title(),
                "name": item["offer_type"].replace("_", " ").title(),
                "count": item["count"],
                "color": "#216a3e" if idx == 0 else "#0284c7" if idx == 1 else "#9333ea" if idx == 2 else "#f59e0b",
            }
            for idx, item in enumerate(offer_types)
        ]

        # Offer usage trends (Monthly redemptions)
        usage_trend_qs = (
            OfferRedemption.objects.filter(redeemed_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("redeemed_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        offer_usage_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in usage_trend_qs
        ]

        # Most used offers (Top 6)
        most_used_qs = (
            Offer.objects.annotate(redemptions_count=Count("redemptions"))
            .order_by("-usage_count", "-redemptions_count")[:6]
        )
        most_used_offers = [
            {
                "id": o.id,
                "title": o.title,
                "salon_name": o.salon.name if o.salon else "Salon",
                "code": o.code or "—",
                "discount": f"{o.discount_value}%" if o.discount_type == Offer.DiscountType.PERCENTAGE else f"₹{o.discount_value}",
                "usage_count": max(o.usage_count, o.redemptions_count),
                "is_active": o.is_active,
            }
            for o in most_used_qs
        ]

        offer_analytics = {
            "total_offers": total_offers,
            "active_offers": active_offers_count,
            "expired_offers": expired_offers_count,
            "total_redemptions": total_redemptions,
            "period_redemptions": period_redemptions,
            "offer_type_distribution": offer_type_distribution,
            "usage_trends": offer_usage_trends,
            "most_used_offers": most_used_offers,
        }

        # =====================================================================
        # 8. SUBSCRIPTION ANALYTICS
        # =====================================================================
        active_subs_count = SalonSubscription.objects.filter(
            status__in=[SalonSubscription.Status.ACTIVE, SalonSubscription.Status.TRIAL],
            end_date__gte=now,
        ).count()

        monthly_subscribers = SalonSubscription.objects.filter(
            status=SalonSubscription.Status.ACTIVE,
            plan__duration_months=1,
            end_date__gte=now,
        ).count()

        quarterly_subscribers = SalonSubscription.objects.filter(
            status=SalonSubscription.Status.ACTIVE,
            plan__duration_months=3,
            end_date__gte=now,
        ).count()

        yearly_subscribers = SalonSubscription.objects.filter(
            status=SalonSubscription.Status.ACTIVE,
            plan__duration_months=12,
            end_date__gte=now,
        ).count()

        custom_subscribers = (
            SalonSubscription.objects.filter(
                status=SalonSubscription.Status.ACTIVE,
                end_date__gte=now,
            )
            .exclude(plan__duration_months__in=[1, 3, 12])
            .count()
        )

        free_trial_subs = SalonSubscription.objects.filter(
            status=SalonSubscription.Status.TRIAL,
            end_date__gte=now,
        ).count()

        expired_subs = SalonSubscription.objects.filter(status=SalonSubscription.Status.EXPIRED).count()
        cancelled_subs = SalonSubscription.objects.filter(status=SalonSubscription.Status.CANCELLED).count()

        upcoming_renewals_count = SalonSubscription.objects.filter(
            status__in=[SalonSubscription.Status.ACTIVE, SalonSubscription.Status.TRIAL],
            end_date__gt=now,
            end_date__lte=now + datetime.timedelta(days=14),
        ).count()

        renewed_salons_count = (
            SubscriptionHistory.objects.filter(
                action__in=[
                    SubscriptionHistory.Action.RENEWED,
                    SubscriptionHistory.Action.PAID_ACTIVATED,
                ]
            )
            .values("salon")
            .distinct()
            .count()
        )
        total_ever_salons = SalonSubscription.objects.count()
        renewal_rate = (
            round((renewed_salons_count / total_ever_salons) * 100, 1)
            if total_ever_salons > 0
            else 0.0
        )

        subscription_analytics = {
            "total_active_subscriptions": active_subs_count,
            "total_active": active_subs_count,
            "active_subscriptions": active_subs_count,
            "monthly_subscribers": monthly_subscribers,
            "quarterly_subscribers": quarterly_subscribers,
            "yearly_subscribers": yearly_subscribers,
            "custom_subscribers": custom_subscribers,
            "free_trial_subscriptions": free_trial_subs,
            "free_trials": free_trial_subs,
            "expired_subscriptions": expired_subs,
            "cancelled_subscriptions": cancelled_subs,
            "upcoming_renewals": upcoming_renewals_count,
            "upcoming_renewals_count": upcoming_renewals_count,
            "renewal_rate": renewal_rate,
            "renewal_rate_pct": renewal_rate,
            "plan_distribution": [
                {"label": "Monthly (1 Mo)", "name": "Monthly (1 Mo)", "count": monthly_subscribers, "color": "#234d34"},
                {"label": "Quarterly (3 Mos)", "name": "Quarterly (3 Mos)", "count": quarterly_subscribers, "color": "#40916c"},
                {"label": "Yearly (12 Mos)", "name": "Yearly (12 Mos)", "count": yearly_subscribers, "color": "#52b788"},
                {"label": "Free Trial (30d)", "name": "Free Trial (30d)", "count": free_trial_subs, "color": "#eab308"},
                {"label": "Custom / Other", "name": "Custom / Other", "count": custom_subscribers, "color": "#64748b"},
            ],
        }

        # =====================================================================
        # 9. SUPPORT TICKET ANALYTICS
        # =====================================================================
        tickets_in_period = SupportTicket.objects.filter(created_at__gte=start, created_at__lte=end)
        open_tickets = SupportTicket.objects.filter(status=SupportTicket.Status.OPEN).count()
        in_progress_tickets = SupportTicket.objects.filter(status=SupportTicket.Status.IN_PROGRESS).count()
        resolved_tickets = SupportTicket.objects.filter(status=SupportTicket.Status.RESOLVED).count()
        closed_tickets = SupportTicket.objects.filter(status=SupportTicket.Status.CLOSED).count()
        waiting_tickets = SupportTicket.objects.filter(status=SupportTicket.Status.WAITING_FOR_CUSTOMER).count()

        urgent_tickets = SupportTicket.objects.filter(
            priority=SupportTicket.Priority.URGENT,
            status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.IN_PROGRESS],
        ).count()

        # Priority distribution
        p_urgent = SupportTicket.objects.filter(priority=SupportTicket.Priority.URGENT).count()
        p_high = SupportTicket.objects.filter(priority=SupportTicket.Priority.HIGH).count()
        p_medium = SupportTicket.objects.filter(priority=SupportTicket.Priority.MEDIUM).count()
        p_low = SupportTicket.objects.filter(priority=SupportTicket.Priority.LOW).count()

        priority_distribution = [
            {"label": "Urgent", "name": "Urgent", "count": p_urgent, "color": "#dc2626"},
            {"label": "High", "name": "High", "count": p_high, "color": "#f97316"},
            {"label": "Medium", "name": "Medium", "count": p_medium, "color": "#eab308"},
            {"label": "Low", "name": "Low", "count": p_low, "color": "#16a34a"},
        ]

        # Monthly ticket creation trends
        ticket_trend_qs = (
            SupportTicket.objects.filter(created_at__gte=now - datetime.timedelta(days=365))
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        ticket_trends = [
            {
                "label": entry["month"].strftime("%b %Y") if entry["month"] else "",
                "count": entry["count"],
            }
            for entry in ticket_trend_qs
        ]

        recent_tickets = [
            {
                "id": t.id,
                "ticket_number": t.ticket_number or f"TKT-{t.id}",
                "salon_name": t.salon.name if t.salon else "General Salon",
                "created_by": f"{t.created_by.first_name} {t.created_by.last_name}".strip() or t.created_by.email.split("@")[0],
                "subject": t.subject,
                "category": t.get_category_display(),
                "priority": t.get_priority_display(),
                "status": t.get_status_display(),
                "created_at": t.created_at.strftime("%Y-%m-%d %H:%M"),
            }
            for t in SupportTicket.objects.select_related("salon", "created_by").order_by("-created_at")[:6]
        ]

        support_analytics = {
            "total_tickets": total_tickets,
            "period_tickets": tickets_in_period.count(),
            "open_tickets": open_tickets,
            "in_progress_tickets": in_progress_tickets,
            "pending_tickets": open_tickets + in_progress_tickets + waiting_tickets,
            "resolved_tickets": resolved_tickets,
            "closed_tickets": closed_tickets,
            "urgent_tickets": urgent_tickets,
            "priority_distribution": priority_distribution,
            "status_distribution": overview_ticket_distribution,
            "ticket_trends": ticket_trends,
            "recent_tickets": recent_tickets,
        }

        # Legacy platform_activity payload
        platform_activity = {
            "total_tickets": total_tickets,
            "open_tickets": open_tickets,
            "resolved_tickets": resolved_tickets,
            "urgent_tickets": urgent_tickets,
            "recent_salons": [
                {
                    "id": s.id,
                    "name": s.name,
                    "city": s.city,
                    "owner_email": s.owner.email if s.owner else "",
                    "approval_status": s.approval_status,
                    "created_at": s.created_at.strftime("%Y-%m-%d %H:%M"),
                }
                for s in Salon.objects.select_related("owner").order_by("-created_at")[:5]
            ],
            "recent_users": [
                {
                    "id": u.id,
                    "name": f"{u.first_name} {u.last_name}".strip() or u.email.split("@")[0],
                    "email": u.email,
                    "role": u.role,
                    "is_active": u.is_active,
                    "date_joined": u.date_joined.strftime("%Y-%m-%d %H:%M"),
                }
                for u in User.objects.order_by("-date_joined")[:5]
            ],
            "recent_payments": [
                {
                    "payment_id": p.payment_id,
                    "salon_name": p.salon.name if p.salon else "Unknown Salon",
                    "plan_name": p.plan.name if p.plan else "Custom Subscription",
                    "amount": float(p.amount),
                    "status": p.status,
                    "created_at": p.created_at.strftime("%Y-%m-%d %H:%M"),
                }
                for p in SubscriptionPayment.objects.select_related("salon", "plan").order_by("-created_at")[:5]
            ],
            "recent_actions": [
                {
                    "id": h.id,
                    "salon_name": h.salon.name if h.salon else "",
                    "action": h.get_action_display(),
                    "amount": float(h.amount_paid or 0.0),
                    "notes": h.notes,
                    "created_at": h.created_at.strftime("%Y-%m-%d %H:%M"),
                }
                for h in SubscriptionHistory.objects.select_related("salon").order_by("-created_at")[:5]
            ],
        }

        # =====================================================================
        # RETURN COMPLETE STRUCTURED JSON PAYLOAD
        # =====================================================================
        return Response(
            {
                "timeframe": {
                    "selected": tf["timeframe"],
                    "start_date": start.strftime("%Y-%m-%d"),
                    "end_date": end.strftime("%Y-%m-%d"),
                    "period_label": period_label,
                },
                "overview": overview,
                "overview_charts": overview_charts,
                "user_analytics": user_analytics,
                "salon_analytics": salon_analytics,
                "booking_analytics": booking_analytics,
                "revenue_analytics": revenue_analytics,
                "review_analytics": review_analytics,
                "offer_analytics": offer_analytics,
                "subscription_analytics": subscription_analytics,
                "support_analytics": support_analytics,
                "platform_activity": platform_activity,
            },
            status=status.HTTP_200_OK,
        )

