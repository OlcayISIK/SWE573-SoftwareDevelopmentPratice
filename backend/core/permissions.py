from rest_framework.permissions import BasePermission


def _is_admin(user):
    return bool(user and user.is_authenticated and getattr(user, "is_admin", False))


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _is_admin(request.user)


class IsAuthorOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return obj.author_id == user.id or _is_admin(user)
