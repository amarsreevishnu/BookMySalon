from django.conf import settings


def frontend_context(request):
    """
    Exposes frontend environment settings to Django templates.
    """
    return {
        "FRONTEND_URL": getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/"),
    }
