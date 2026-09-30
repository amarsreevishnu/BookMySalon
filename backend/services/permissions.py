from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to Super Admins (is_superuser or role == 'ADMIN').
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(user.is_superuser or getattr(user, "role", "") == "ADMIN")


class IsSuperAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read permissions to any request, but write permissions only to Super Admins.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(user.is_superuser or getattr(user, "role", "") == "ADMIN")


class IsSalonOwner(permissions.BasePermission):
    """
    Allows access only to authenticated users with role SALON_OWNER or ADMIN.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, "role", "")
        return bool(user.is_superuser or role in ["SALON_OWNER", "ADMIN"])


class IsSalonOwnerOfOffering(permissions.BasePermission):
    """
    Allows object-level access only to the owner of the salon offering or superadmin.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "role", "") == "ADMIN":
            return True
        return hasattr(obj, "salon") and obj.salon.owner == user

