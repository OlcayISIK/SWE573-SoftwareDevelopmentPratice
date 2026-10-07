from django.db import IntegrityError, transaction
from django.utils.text import slugify

from core.exceptions import ConflictError, PermissionDeniedError, ValidationError

from . import signals
from .models import Category, Craft, CraftMedia, CraftType, Culture, Material, Tool

MAX_MEDIA_PER_CRAFT = 20

EDITABLE_FIELDS = {
    "name",
    "category",
    "craft_type",
    "tools",
    "materials",
    "culture",
    "address",
    "city",
    "country",
    "latitude",
    "longitude",
    "description",
    "attributes",
}
MANY_TO_MANY_FIELDS = ("tools", "materials")

VERIFY_BEFORE_PUBLISHING = "Verify your email address before publishing crafts."
NOT_ALLOWED_TO_EDIT = "Only the author or an admin can change this craft."
ADMIN_ONLY = "Only admins can perform this action."
AUTHOR_ONLY = "Only the author can add media to this craft."
TOO_MANY_MEDIA = f"A craft can have at most {MAX_MEDIA_PER_CRAFT} media items."
VERIFY_BEFORE_ADDING = "Verify your email address before adding new items."
REMOVED_BY_ADMIN = "{name} was removed by an admin. Choose another name."


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

    fields = dict(data)
    related = {field: fields.pop(field, []) for field in MANY_TO_MANY_FIELDS}
    craft = Craft.objects.create(author=author, **fields)
    for field, items in related.items():
        getattr(craft, field).set(items)
    signals.craft_published.send(sender=Craft, craft=craft)
    return craft


@transaction.atomic
def update_craft(*, craft, actor, data):
    _ensure_can_edit(craft, actor)
    _ensure_editable(data)
    if not data:
        return craft

    for field, value in data.items():
        if field in MANY_TO_MANY_FIELDS:
            getattr(craft, field).set(value)
        else:
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


def _add_lookup(model, *, user, name, scope=None, **extra):
    """
    Adds a lookup item, or returns the existing one with the same name (ignoring case), so
    "carpet" and "Carpet" stay one item. Returns the item and whether it was created.
    """
    if not user.is_email_verified:
        raise PermissionDeniedError(VERIFY_BEFORE_ADDING)
    scope = scope or {}
    existing = model.objects.filter(name__iexact=name, **scope).first()
    if existing is None:
        try:
            with transaction.atomic():
                item = model.objects.create(name=name, created_by=user, **scope, **extra)
            return item, True
        except IntegrityError:
            # Someone added the same name at the same moment.
            existing = model.objects.filter(name__iexact=name, **scope).first()
            if existing is None:
                raise
    if existing.is_hidden:
        raise ConflictError(REMOVED_BY_ADMIN.format(name=existing.name))
    return existing, False


def _unique_slug(name):
    base = slugify(name)[:80] or "category"
    slug, suffix = base, 2
    while Category.objects.filter(slug=slug).exists():
        slug, suffix = f"{base}-{suffix}", suffix + 1
    return slug


def add_category(*, user, name):
    if Category.objects.filter(name__iexact=name).exists():
        return _add_lookup(Category, user=user, name=name)
    return _add_lookup(Category, user=user, name=name, slug=_unique_slug(name))


def add_craft_type(*, user, name, category):
    return _add_lookup(CraftType, user=user, name=name, scope={"category": category})


def _add_linked(model, *, user, name, craft_type=None):
    item, created = _add_lookup(model, user=user, name=name)
    if craft_type is not None:
        # The user picked it for this craft type, so suggest it there from now on.
        item.craft_types.add(craft_type)
    item.typical = craft_type is not None
    return item, created


def add_tool(*, user, name, craft_type=None):
    return _add_linked(Tool, user=user, name=name, craft_type=craft_type)


def add_material(*, user, name, craft_type=None):
    return _add_linked(Material, user=user, name=name, craft_type=craft_type)


def add_culture(*, user, name, homeland=""):
    return _add_lookup(Culture, user=user, name=name, homeland=homeland)
