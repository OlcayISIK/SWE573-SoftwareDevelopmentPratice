from django.utils import timezone

from .models import Notification


def mark_read(*, user, ids=None):
    notifications = Notification.objects.filter(recipient=user, is_read=False)
    if ids is not None:
        notifications = notifications.filter(pk__in=ids)
    return notifications.update(is_read=True, updated_at=timezone.now())
