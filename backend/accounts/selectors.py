from core.exceptions import NotFoundError

from .models import User, normalize_email
from .tokens import decode_uid

PROFILE_UNAVAILABLE = "This profile is unavailable."


def get_public_user(user_id):
    user = User.objects.select_related("profile").filter(pk=user_id, is_active=True).first()
    if user is None:
        raise NotFoundError(PROFILE_UNAVAILABLE)
    return user


def get_active_user_by_email(email):
    return User.objects.filter(email=normalize_email(email), is_active=True).first()


def get_active_user_by_uid(uid):
    user_id = decode_uid(uid)
    if user_id is None:
        return None
    return User.objects.filter(pk=user_id, is_active=True).first()
