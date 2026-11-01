from rest_framework import permissions
from salons.views import get_owner_salon


class IsSuperAdmin(permissions.BasePermission):
    """
    Grants access only to Super Admins (is_superuser, is_staff, or role == 'ADMIN').
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = str(getattr(user, "role", "")).upper()
        return bool(user.is_superuser or user.is_staff or role == "ADMIN")


class IsSalonOwner(permissions.BasePermission):
    """
    Grants access to authenticated users who own an approved/registered salon.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = str(getattr(user, "role", "")).upper()
        if user.is_superuser or role == "ADMIN":
            return True
        if role in ["OWNER", "SALON_OWNER"]:
            salon = get_owner_salon(user)
            return salon is not None
        return False

