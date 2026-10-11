from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth import get_user_model
from salons.models import Salon

User = get_user_model()


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that validates on EVERY authenticated request:
    1. User active status (is_active=True). If blocked, rejects with 'USER_BLOCKED'.
    2. Salon status for OWNER and WORKER. If salon is 'BLOCKED', rejects with 'SALON_BLOCKED'.
    Super Admins are exempt from salon block checks.
    """

    def get_user(self, validated_token):
        try:
            user = super().get_user(validated_token)
        except exceptions.AuthenticationFailed as e:
            err_str = str(e.detail).lower()
            if "inactive" in err_str or getattr(e, "code", "") == "user_inactive":
                raise exceptions.AuthenticationFailed(
                    detail={
                        "code": "USER_BLOCKED",
                        "message": "Your account has been deactivated or blocked by administration.",
                    },
                    code="user_blocked",
                )
            raise e

        if not user:
            raise exceptions.AuthenticationFailed(
                detail={"code": "USER_NOT_FOUND", "message": "User not found."},
                code="user_not_found",
            )

        if not user.is_active:
            raise exceptions.AuthenticationFailed(
                detail={
                    "code": "USER_BLOCKED",
                    "message": "Your account has been deactivated or blocked by administration.",
                },
                code="user_blocked",
            )

        # Super admin accounts bypass salon block checks
        if getattr(user, "is_superuser", False) or getattr(user, "role", None) == User.Role.ADMIN:
            return user

        user_role = getattr(user, "role", None)

        
        if user_role == User.Role.OWNER:
            salon = Salon.objects.filter(owner=user).first()
            if salon and salon.approval_status == Salon.ApprovalStatus.BLOCKED:
                raise exceptions.AuthenticationFailed(
                    detail={
                        "code": "SALON_BLOCKED",
                        "message": f"Your salon '{salon.name}' has been suspended by platform administration.",
                    },
                    code="salon_blocked",
                )

        
        elif user_role == User.Role.WORKER:
            worker_profile = getattr(user, "worker_profile", None)
            if (
                worker_profile
                and worker_profile.salon
                and worker_profile.salon.approval_status == Salon.ApprovalStatus.BLOCKED
            ):
                raise exceptions.AuthenticationFailed(
                    detail={
                        "code": "SALON_BLOCKED",
                        "message": f"Your affiliated salon '{worker_profile.salon.name}' has been suspended by platform administration.",
                    },
                    code="salon_blocked",
                )

        return user
