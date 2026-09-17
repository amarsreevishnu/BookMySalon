import logging
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def on_authentication_error(
        self, request, provider, error=None, exception=None, extra_context=None
    ):
        logger.error(
            "Social authentication error: provider=%s, error=%s, exception=%s, extra_context=%s",
            provider,
            error,
            exception,
            extra_context,
        )
        print(
            f"!!! GOOGLE AUTH ERROR: provider={provider}, error={error}, exception={exception}"
        )
        super().on_authentication_error(
            request,
            provider,
            error=error,
            exception=exception,
            extra_context=extra_context,
        )

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        if not getattr(user, "role", None):
            user.role = User.Role.CUSTOMER
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)
        if not getattr(user, "role", None):
            user.role = User.Role.CUSTOMER
            user.save(update_fields=["role"])
        return user

