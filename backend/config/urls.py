from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path(
        "api/v1/accounts/",
        include("accounts.urls"),
    ),
    path(
        "api/v1/salons/",
        include("salons.urls"),
    ),
    path(
        "api/v1/services/",
        include("services.urls"),
    ),
    path(
        "api/v1/bookings/",
        include("bookings.urls"),
    ),
    path(
        "api/v1/payments/",
        include("payments.urls"),
    ),
    path(
        "api/v1/reviews/",
        include("reviews.urls"),
    ),
    path(
        "api/v1/notifications/",
        include("notifications.urls"),
    ),

    # Allauth OAuth URLs
    path("accounts/", include("allauth.urls")),

    # Allauth headless API
    path("_allauth/", include("allauth.headless.urls")),
]

# Serve user uploaded media in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
