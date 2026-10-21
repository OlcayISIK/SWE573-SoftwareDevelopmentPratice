from django.db import IntegrityError, transaction
from django.utils.text import slugify

from core.exceptions import ConflictError, PermissionDeniedError, ValidationError

from . import signals
from .models import (
    DEFAULT_CATEGORY_ICON,
    Category,
    Craft,
    CraftColor,
    CraftMedia,
    CraftPlace,
    CraftType,
    Culture,
    Material,
    Tool,
)

MAX_MEDIA_PER_CRAFT = 20

EDITABLE_FIELDS = {
    "name",
    "category",
    "craft_type",
    "tools",
    "materials",
    "culture",
    "places",
    "description",
    "story",
    "colors",
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
NAME_TAKEN = "{name} already exists. Merge into it instead."
MERGE_SAME_KIND = "Choose another item of the same kind to merge into."
MERGE_INTO_VISIBLE = "Choose an item that is not hidden to merge into."
MERGE_SAME_CATEGORY = "Choose a craft type of the same category to merge into."


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


def _set_colors(craft, colors):
    """Replaces the craft's colors, keeping the order they were given in."""
    craft.colors.all().delete()
    CraftColor.objects.bulk_create(
        CraftColor(craft=craft, value=color, order=index) for index, color in enumerate(colors)
    )


PLACE_FIELDS = ("address", "city", "country", "latitude", "longitude")


def _main_place(places):
    """The origin, or the first place when all are equal, as craft fields."""
    main = next((place for place in places if place.get("is_origin")), places[0])
    return {field: main.get(field, "") for field in PLACE_FIELDS}


def _set_places(craft, places):
    """Replaces the craft's places, keeping the order they were given in."""
    craft.places.all().delete()
    CraftPlace.objects.bulk_create(
        CraftPlace(craft=craft, order=index, **place) for index, place in enumerate(places)
    )


@transaction.atomic
def publish_craft(*, author, data):
    if not author.is_email_verified:
        raise PermissionDeniedError(VERIFY_BEFORE_PUBLISHING)
    _ensure_editable(data)

    fields = dict(data)
    related = {field: fields.pop(field, []) for field in MANY_TO_MANY_FIELDS}
    colors = fields.pop("colors", [])
    places = fields.pop("places")
    craft = Craft.objects.create(author=author, **fields, **_main_place(places))
    for field, items in related.items():
        getattr(craft, field).set(items)
    _set_colors(craft, colors)
    _set_places(craft, places)
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
        elif field == "colors":
            _set_colors(craft, value)
        elif field == "places":
            _set_places(craft, value)
            for name, main in _main_place(value).items():
                setattr(craft, name, main)
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


def add_category(*, user, name, description="", icon=DEFAULT_CATEGORY_ICON):
    if Category.objects.filter(name__iexact=name).exists():
        return _add_lookup(Category, user=user, name=name)
    return _add_lookup(
        Category,
        user=user,
        name=name,
        slug=_unique_slug(name),
        description=description,
        icon=icon,
    )


def add_craft_type(*, user, name, category, description=""):
    return _add_lookup(
        CraftType, user=user, name=name, scope={"category": category}, description=description
    )


def _add_linked(model, *, user, name, craft_type=None, description=""):
    item, created = _add_lookup(model, user=user, name=name, description=description)
    if craft_type is not None:
        # The user picked it for this craft type, so suggest it there from now on.
        item.craft_types.add(craft_type)
    item.typical = craft_type is not None
    return item, created


def add_tool(*, user, name, craft_type=None, description=""):
    return _add_linked(Tool, user=user, name=name, craft_type=craft_type, description=description)


def add_material(*, user, name, craft_type=None, description=""):
    return _add_linked(
        Material, user=user, name=name, craft_type=craft_type, description=description
    )


def add_culture(*, user, name, homeland="", description=""):
    return _add_lookup(Culture, user=user, name=name, homeland=homeland, description=description)


def _same_name(item, name):
    others = type(item).objects.filter(name__iexact=name).exclude(pk=item.pk)
    if isinstance(item, CraftType):
        others = others.filter(category_id=item.category_id)
    return others.first()


@transaction.atomic
def edit_lookup(*, item, actor, name=None, description=None):
    """Changes the item's name, its description, or both. None leaves a field as it is."""
    _ensure_admin(actor)
    if name is not None:
        taken = _same_name(item, name)
        if taken is not None:
            raise ConflictError(NAME_TAKEN.format(name=taken.name))
        item.name = name
    if description is not None:
        item.description = description
    item.save(update_fields=["name", "description", "updated_at"])
    return item


@transaction.atomic
def hide_lookup(*, item, actor):
    """Removes the item from the lists. Crafts that use it keep showing it."""
    _ensure_admin(actor)
    item.is_hidden = True
    item.save(update_fields=["is_hidden", "updated_at"])
    return item


def _move_crafts(item, into):
    crafts = Craft.all_objects
    if isinstance(item, (Tool, Material)):
        field = "tools" if isinstance(item, Tool) else "materials"
        for craft in crafts.filter(**{field: item}):
            getattr(craft, field).add(into)
        into.craft_types.add(*item.craft_types.all())
        return
    field = {Category: "category", CraftType: "craft_type", Culture: "culture"}[type(item)]
    crafts.filter(**{field: item}).update(**{field: into})


def _merge(item, into):
    if isinstance(item, Category):
        # The craft types move along; one with the same name in the target is merged too.
        for craft_type in item.craft_types.all():
            twin = into.craft_types.filter(name__iexact=craft_type.name).first()
            if twin is None:
                craft_type.category = into
                craft_type.save(update_fields=["category", "updated_at"])
            else:
                _merge(craft_type, twin)
    _move_crafts(item, into)
    item.delete()


@transaction.atomic
def merge_lookup(*, item, into, actor):
    """
    Merges a duplicate into another item of the same kind: every craft that used it uses the
    other item instead, and the duplicate is deleted.
    """
    _ensure_admin(actor)
    if type(into) is not type(item) or into.pk == item.pk:
        raise ValidationError(MERGE_SAME_KIND, errors={"merge_into": [MERGE_SAME_KIND]})
    if into.is_hidden:
        raise ValidationError(MERGE_INTO_VISIBLE, errors={"merge_into": [MERGE_INTO_VISIBLE]})
    if isinstance(item, CraftType) and into.category_id != item.category_id:
        raise ValidationError(MERGE_SAME_CATEGORY, errors={"merge_into": [MERGE_SAME_CATEGORY]})
    _merge(item, into)
    return into
