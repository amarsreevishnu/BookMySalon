from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = str(getattr(user, "role", "")).upper()
        return bool(user.is_superuser or user.is_staff or role == "ADMIN")


class IsSuperAdminOrReadOnly(permissions.BasePermission):
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
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
        role = getattr(user, "role", "")
        return bool(user.is_superuser or role in ["SALON_OWNER", "OWNER", "ADMIN"])


class IsSalonOwnerOfOffering(permissions.BasePermission):
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "role", "") == "ADMIN":
            return True
        return hasattr(obj, "salon") and obj.salon.owner == user


