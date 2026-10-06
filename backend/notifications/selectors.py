from crafts.selectors import visible_crafts

from .models import Notification


def notifications_for(user, *, unread_only=False):
    notifications = Notification.objects.filter(recipient=user).select_related(
        "actor__profile", "craft"
    )
    if unread_only:
        notifications = notifications.filter(is_read=False)
    return notifications


def unread_count(user):
    return Notification.objects.filter(recipient=user, is_read=False).count()


def visible_craft_ids(user, notifications):
    """Crafts the user can still see; notifications about hidden or removed ones drop the link."""
    craft_ids = {item.craft_id for item in notifications if item.craft_id}
    if not craft_ids:
        return set()
    return set(visible_crafts(user).filter(pk__in=craft_ids).values_list("pk", flat=True))
