from rest_framework import permissions
from salons.views import get_owner_salon


class IsSuperAdmin(permissions.BasePermission):
   
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = str(getattr(user, "role", "")).upper()
        return bool(user.is_superuser or user.is_staff or role == "ADMIN")


class IsSalonOwner(permissions.BasePermission):
    
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

