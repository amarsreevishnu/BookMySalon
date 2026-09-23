from django.core.exceptions import RequestDataTooBig
from django.http import JsonResponse


class HandleDataUploadLimitMiddleware:
    """
    Middleware that intercepts RequestDataTooBig exceptions and returns
    a clean HTTP 413 JSON response instead of an unhandled 500 HTML debug page.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except RequestDataTooBig:
            return JsonResponse(
                {
                    "error": "The uploaded images or request payload is too large. Please select smaller photos (under 10MB each)."
                },
                status=413,
            )

