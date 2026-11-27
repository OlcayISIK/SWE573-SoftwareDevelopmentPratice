import logging
import time

from django.db import IntegrityError, transaction
from django.utils.text import slugify

from core.exceptions import ConflictError, PermissionDeniedError, ValidationError

from . import signals, wikidata
from .colors import main_color
from .models import (
    DEFAULT_CATEGORY_ICON,
    LOOKUP_MODELS,
    Category,
    Craft,
    CraftColor,
    CraftMedia,
    CraftPart,
    CraftPlace,
    CraftStory,
    CraftType,
    Culture,
    Material,
    PracticeStatusChange,
    Tool,
    unique_names,
)

logger = logging.getLogger(__name__)

MAX_MEDIA_PER_CRAFT = 20

EDITABLE_FIELDS = {
    "name",
    "category",
    "craft_type",
    "tools",
    "materials",
    "parts",
    "culture",
    "places",
    "description",
    "story",
    "date",
    "colors",
    "attributes",
    "practice_status",
    "practice_status_source",
}
MANY_TO_MANY_FIELDS = ("tools", "materials")

VERIFY_BEFORE_PUBLISHING = "Verify your email address before publishing crafts."
NOT_ALLOWED_TO_EDIT = "Only the author or an admin can change this craft."
ADMIN_ONLY = "Only admins can perform this action."
AUTHOR_ONLY = "Only the author can add media to this craft."
TOO_MANY_MEDIA = f"A craft can have at most {MAX_MEDIA_PER_CRAFT} media items."
VERIFY_BEFORE_ADDING = "Verify your email address before adding new items."
VERIFY_BEFORE_SHARING = "Verify your email address before sharing stories."
AUTHOR_HAS_STORY_FIELD = "As the craft's author, tell your story in the craft's Story field."
ONE_STORY_PER_CRAFT = "You have already shared a story about this craft. Edit it instead."
STORY_HIDDEN = "Your story about this craft was hidden by an admin."
NOT_ALLOWED_TO_EDIT_STORY = "Only the writer or an admin can change this story."
REMOVED_BY_ADMIN = "{name} was removed by an admin. Choose another name."
NAME_TAKEN = "{name} already exists. Merge into it instead."
MERGE_SAME_KIND = "Choose another item of the same kind to merge into."
MERGE_INTO_VISIBLE = "Choose an item that is not hidden to merge into."
MERGE_SAME_CATEGORY = "Choose a craft type of the same category to merge into."
NOT_A_WIKIDATA_ITEM = "No Wikidata item has this id."


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
        CraftColor(craft=craft, value=color, main_color=main_color(color), order=index)
        for index, color in enumerate(colors)
    )


def set_parts(craft, parts):
    """Replaces the craft's parts, keeping the order they were given in."""
    craft.parts.all().delete()
    for index, part in enumerate(parts):
        CraftPart.objects.create(craft=craft, name=part["name"], order=index).materials.set(
            part["materials"]
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
    parts = fields.pop("parts", [])
    places = fields.pop("places")
    # The date arrives as craft fields already, see CraftDateSerializer.
    date = fields.pop("date", {})
    status = _status_fields(fields)
    craft = Craft.objects.create(author=author, **fields, **date, **_main_place(places))
    if status.get("practice_status", Craft.PracticeStatus.UNKNOWN) != Craft.PracticeStatus.UNKNOWN:
        _change_practice_status(craft, author, reason=AUTHOR_SET_STATUS, **status)
    for field, items in related.items():
        getattr(craft, field).set(items)
    _set_colors(craft, colors)
    set_parts(craft, parts)
    _set_places(craft, places)
    signals.craft_published.send(sender=Craft, craft=craft)
    return craft


@transaction.atomic
def update_craft(*, craft, actor, data):
    _ensure_can_edit(craft, actor)
    _ensure_editable(data)
    data = dict(data)
    status = _status_fields(data)
    if status:
        _change_practice_status(
            craft,
            actor,
            practice_status=status.get("practice_status", craft.practice_status),
            source=status.get("practice_status_source", craft.practice_status_source),
            reason=AUTHOR_CHANGED_STATUS,
        )
    if not data:
        return craft

    for field, value in data.items():
        if field in MANY_TO_MANY_FIELDS:
            getattr(craft, field).set(value)
        elif field == "colors":
            _set_colors(craft, value)
        elif field == "parts":
            set_parts(craft, value)
        elif field == "date":
            for name, part in value.items():
                setattr(craft, name, part)
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


AUTHOR_SET_STATUS = "Set by the author when publishing."
AUTHOR_CHANGED_STATUS = "Changed in the craft form."


def _status_fields(fields):
    """Takes the practice status fields out of the craft's fields."""
    return {
        field: fields.pop(field)
        for field in ("practice_status", "practice_status_source")
        if field in fields
    }


@transaction.atomic
def set_practice_status(*, craft, actor, practice_status, source, reason):
    """
    Sets whether the craft is still practiced, with the source it is based on, and records the
    change. Admins set it here, directly or by accepting a user's report; authors set it in the
    craft form.
    """
    _ensure_admin(actor)
    return _change_practice_status(
        craft, actor, practice_status=practice_status, source=source, reason=reason
    )


def _change_practice_status(craft, actor, *, practice_status, source=None, reason, **fields):
    """Records a change of the practice status and notifies people if the status changed."""
    if source is None:
        source = fields.get("practice_status_source", "")
    # An unknown status has nothing to cite.
    source = "" if practice_status == Craft.PracticeStatus.UNKNOWN else source.strip()
    old_status = craft.practice_status
    if (old_status, craft.practice_status_source) == (practice_status, source):
        return craft
    PracticeStatusChange.objects.create(
        craft=craft,
        changed_by=actor,
        old_status=old_status,
        new_status=practice_status,
        source=source,
        reason=reason,
    )
    craft.practice_status = practice_status
    craft.practice_status_source = source
    craft.save(update_fields=["practice_status", "practice_status_source", "updated_at"])
    if practice_status != old_status:
        signals.practice_status_changed.send(
            sender=Craft,
            craft=craft,
            actor=actor,
            old_status=old_status,
            new_status=practice_status,
        )
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


@transaction.atomic
def share_story(*, craft, author, text):
    if not author.is_email_verified:
        raise PermissionDeniedError(VERIFY_BEFORE_SHARING)
    if craft.author_id == author.id:
        raise PermissionDeniedError(AUTHOR_HAS_STORY_FIELD)
    existing = CraftStory.objects.filter(craft=craft, author=author).first()
    if existing is not None:
        hidden = existing.status == CraftStory.Status.HIDDEN
        raise ConflictError(STORY_HIDDEN if hidden else ONE_STORY_PER_CRAFT)
    try:
        with transaction.atomic():
            story = CraftStory.objects.create(craft=craft, author=author, text=text)
    except IntegrityError as exc:
        # Another request from the same user shared a story first.
        raise ConflictError(ONE_STORY_PER_CRAFT) from exc
    signals.story_shared.send(sender=CraftStory, story=story)
    return story


def _ensure_can_edit_story(story, actor):
    if story.author_id != actor.id and not actor.is_admin:
        raise PermissionDeniedError(NOT_ALLOWED_TO_EDIT_STORY)


@transaction.atomic
def edit_story(*, story, actor, text):
    _ensure_can_edit_story(story, actor)
    story.text = text
    story.save(update_fields=["text", "updated_at"])
    return story


@transaction.atomic
def delete_story(*, story, actor):
    _ensure_can_edit_story(story, actor)
    story.delete()


@transaction.atomic
def hide_story(*, story, actor):
    _ensure_admin(actor)
    story.status = CraftStory.Status.HIDDEN
    story.save(update_fields=["status", "updated_at"])


@transaction.atomic
def remove_story(*, story, actor):
    _ensure_admin(actor)
    story.delete()


def link_wikidata(item, wikidata_id):
    """
    Links the item to a Wikidata item and stores its names and broader kinds, so searches find
    the item by its names in other languages. An empty id removes the link.

    Returns what Wikidata says the linked item is (see wikidata.describe), or None when the link
    was removed.
    """
    if not wikidata_id:
        _store_wikidata(item, "", {"names": [], "broader": []})
        return None
    try:
        found = wikidata.describe(wikidata_id)
    except LookupError as exc:
        raise ValidationError(
            NOT_A_WIKIDATA_ITEM, errors={"wikidata_id": [NOT_A_WIKIDATA_ITEM]}
        ) from exc
    _store_wikidata(item, wikidata_id, found)
    return found


def _store_wikidata(item, wikidata_id, found):
    item.wikidata_id = wikidata_id
    item.wikidata_names = found["names"]
    item.broader = found["broader"]
    item.save(update_fields=["wikidata_id", "wikidata_names", "broader", "updated_at"])


def _link_new(item, wikidata_id):
    """Links an item a user added or picked. It stays usable when Wikidata cannot be reached."""
    if not wikidata_id or item.wikidata_id:
        return
    try:
        link_wikidata(item, wikidata_id)
    except (wikidata.WikidataUnavailable, ValidationError) as exc:
        logger.warning("Could not link %s to %s: %s", item, wikidata_id, exc)


def _add_lookup(model, *, user, name, scope=None, wikidata_id="", **extra):
    """
    Adds a lookup item, or returns the existing one with the same name (ignoring case), so
    "carpet" and "Carpet" stay one item. Returns the item and whether it was created. The
    Wikidata item the user picked is linked when the item has no link yet.
    """
    if not user.is_email_verified:
        raise PermissionDeniedError(VERIFY_BEFORE_ADDING)
    scope = scope or {}
    existing = model.objects.filter(name__iexact=name, **scope).first()
    if existing is None:
        try:
            with transaction.atomic():
                item = model.objects.create(name=name, created_by=user, **scope, **extra)
        except IntegrityError:
            # Someone added the same name at the same moment.
            existing = model.objects.filter(name__iexact=name, **scope).first()
            if existing is None:
                raise
        else:
            _link_new(item, wikidata_id)
            return item, True
    if existing.is_hidden:
        raise ConflictError(REMOVED_BY_ADMIN.format(name=existing.name))
    _link_new(existing, wikidata_id)
    return existing, False


def _unique_slug(name):
    base = slugify(name)[:80] or "category"
    slug, suffix = base, 2
    while Category.objects.filter(slug=slug).exists():
        slug, suffix = f"{base}-{suffix}", suffix + 1
    return slug


def add_category(*, user, name, description="", icon=DEFAULT_CATEGORY_ICON, wikidata_id=""):
    if Category.objects.filter(name__iexact=name).exists():
        return _add_lookup(Category, user=user, name=name, wikidata_id=wikidata_id)
    return _add_lookup(
        Category,
        user=user,
        name=name,
        slug=_unique_slug(name),
        description=description,
        icon=icon,
        wikidata_id=wikidata_id,
    )


def add_craft_type(*, user, name, category, description="", wikidata_id=""):
    return _add_lookup(
        CraftType,
        user=user,
        name=name,
        scope={"category": category},
        description=description,
        wikidata_id=wikidata_id,
    )


def _add_linked(model, *, user, name, craft_type=None, description="", wikidata_id=""):
    item, created = _add_lookup(
        model, user=user, name=name, description=description, wikidata_id=wikidata_id
    )
    if craft_type is not None:
        # The user picked it for this craft type, so suggest it there from now on.
        item.craft_types.add(craft_type)
    item.typical = craft_type is not None
    return item, created


def add_tool(*, user, name, craft_type=None, description="", wikidata_id=""):
    return _add_linked(
        Tool,
        user=user,
        name=name,
        craft_type=craft_type,
        description=description,
        wikidata_id=wikidata_id,
    )


def add_material(*, user, name, craft_type=None, description="", wikidata_id=""):
    return _add_linked(
        Material,
        user=user,
        name=name,
        craft_type=craft_type,
        description=description,
        wikidata_id=wikidata_id,
    )


def add_culture(*, user, name, homeland="", description="", wikidata_id=""):
    return _add_lookup(
        Culture,
        user=user,
        name=name,
        homeland=homeland,
        description=description,
        wikidata_id=wikidata_id,
    )


def _same_name(item, name):
    others = type(item).objects.filter(name__iexact=name).exclude(pk=item.pk)
    if isinstance(item, CraftType):
        others = others.filter(category_id=item.category_id)
    return others.first()


@transaction.atomic
def edit_lookup(*, item, actor, name=None, description=None, wikidata_id=None, other_names=None):
    """
    Changes the item's name, description, Wikidata link, or other names. None leaves a field as
    it is; an empty Wikidata id removes the link.
    """
    _ensure_admin(actor)
    if name is not None:
        taken = _same_name(item, name)
        if taken is not None:
            raise ConflictError(NAME_TAKEN.format(name=taken.name))
        item.name = name
    if description is not None:
        item.description = description
    if other_names is not None:
        item.other_names = unique_names(other_names, skip=item.name)
    item.save(update_fields=["name", "description", "other_names", "updated_at"])
    if wikidata_id is not None and wikidata_id != item.wikidata_id:
        link_wikidata(item, wikidata_id)
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
        if isinstance(item, Material):
            for part in CraftPart.objects.filter(materials=item):
                part.materials.add(into)
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
    # The duplicate's names still find its crafts, now through the item it was merged into.
    into.other_names = unique_names([*into.other_names, item.name, *item.other_names], into.name)
    into.save(update_fields=["other_names", "updated_at"])
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


# Items are refreshed this many at a time; Wikidata failing affects only that many.
REFRESH_BATCH = 50
# The admin panel stops starting new batches after this many seconds, so the page answers
# before the web server's time limit.
ADMIN_REFRESH_SECONDS = 15


def _refresh(items, seconds=None):
    """
    Fetches the names and broader kinds of the linked items again, those refreshed longest ago
    first. Items Wikidata does not answer for keep the names they have, and the others are still
    refreshed. With `seconds`, no new batch is started after that long.

    Returns (refreshed, kept, not reached).
    """
    items = sorted((item for item in items if item.wikidata_id), key=lambda item: item.updated_at)
    deadline = None if seconds is None else time.monotonic() + seconds
    parents = {}
    refreshed = kept = 0
    for start in range(0, len(items), REFRESH_BATCH):
        if deadline is not None and time.monotonic() > deadline:
            return refreshed, kept, len(items) - start
        batch = items[start : start + REFRESH_BATCH]
        try:
            found = wikidata.describe_many((item.wikidata_id for item in batch), parents)
        except wikidata.WikidataUnavailable as exc:
            logger.warning("Kept the names of %s items: %s", len(batch), exc)
            kept += len(batch)
            continue
        for item in batch:
            if item.wikidata_id not in found:
                logger.warning("%s is linked to %s, which is gone", item, item.wikidata_id)
                kept += 1
                continue
            _store_wikidata(item, item.wikidata_id, found[item.wikidata_id])
            refreshed += 1
    return refreshed, kept, 0


def refresh_wikidata_names():
    """Refreshes the names of every linked item, as the refresh_wikidata_names command does."""
    items = [
        item for model in LOOKUP_MODELS.values() for item in model.objects.exclude(wikidata_id="")
    ]
    return _refresh(items)


def refresh_names_of(*, items, actor):
    """
    Refreshes the names of the chosen items for an admin, within the admin panel's time. Returns
    (refreshed, kept, not reached); running it again goes on with the items not reached.
    """
    _ensure_admin(actor)
    return _refresh(items, seconds=ADMIN_REFRESH_SECONDS)
