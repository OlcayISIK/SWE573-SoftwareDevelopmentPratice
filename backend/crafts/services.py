from django.db import transaction

from core.exceptions import PermissionDeniedError, ValidationError

from . import signals
from .models import Craft, CraftMedia

MAX_MEDIA_PER_CRAFT = 20

EDITABLE_FIELDS = {
    "name",
    "craft_type",
    "category",
    "region",
    "latitude",
    "longitude",
    "description",
    "production_process",
    "how_to_understand",
    "cultural_relevance",
    "attributes",
}

VERIFY_BEFORE_PUBLISHING = "Verify your email address before publishing crafts."
NOT_ALLOWED_TO_EDIT = "Only the author or an admin can change this craft."
ADMIN_ONLY = "Only admins can perform this action."
AUTHOR_ONLY = "Only the author can add media to this craft."
TOO_MANY_MEDIA = f"A craft can have at most {MAX_MEDIA_PER_CRAFT} media items."


def _ensure_can_edit(craft, actor):
    if craft.author_id != actor.id and not actor.is_admin:
        raise PermissionDeniedError(NOT_ALLOWED_TO_EDIT)


def _ensure_admin(actor):
    if not actor.is_admin:
        raise PermissionDeniedError(ADMIN_ONLY)


def _ensure_editable(data):
    unknown = set(data) - EDITABLE_FIELDS
    if unknown:
        raise ValidationError(
            errors={field: ["This field cannot be changed."] for field in unknown}
        )


@transaction.atomic
def publish_craft(*, author, data):
    if not author.is_email_verified:
        raise PermissionDeniedError(VERIFY_BEFORE_PUBLISHING)
    _ensure_editable(data)

    craft = Craft.objects.create(author=author, **data)
    signals.craft_published.send(sender=Craft, craft=craft)
    return craft


@transaction.atomic
def update_craft(*, craft, actor, data):
    _ensure_can_edit(craft, actor)
    _ensure_editable(data)
    if not data:
        return craft

    for field, value in data.items():
        setattr(craft, field, value)
    craft.save()
    signals.craft_updated.send(sender=Craft, craft=craft, actor=actor)
    return craft


def _soft_delete(craft):
    craft.media.all().delete()
    craft.delete()


@transaction.atomic
def delete_craft(*, craft, actor):
    _ensure_can_edit(craft, actor)
    _soft_delete(craft)


@transaction.atomic
def hide_craft(*, craft, actor):
    _ensure_admin(actor)
    craft.status = Craft.Status.HIDDEN
    craft.save(update_fields=["status", "updated_at"])
    return craft


@transaction.atomic
def remove_craft(*, craft, actor):
    _ensure_admin(actor)
    _soft_delete(craft)


@transaction.atomic
def add_media(*, craft, actor, data):
    if craft.author_id != actor.id:
        raise PermissionDeniedError(AUTHOR_ONLY)
    # Lock the craft row so concurrent uploads cannot push it past the limit.
    Craft.objects.select_for_update().filter(pk=craft.pk).first()
    if craft.media.count() >= MAX_MEDIA_PER_CRAFT:
        raise ValidationError(TOO_MANY_MEDIA)
    return CraftMedia.objects.create(craft=craft, **data)


@transaction.atomic
def remove_media(*, media, actor):
    _ensure_can_edit(media.craft, actor)
    media.delete()
