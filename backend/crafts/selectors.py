from django.db.models import Exists, OuterRef, Prefetch, Q, Value

from core.exceptions import NotFoundError

from .models import Category, Craft, CraftMedia, CraftType, Culture, Material, Region, Tool

CRAFT_NOT_FOUND = "Craft not found."
MEDIA_NOT_FOUND = "Media not found."


def _with_photos(crafts):
    photos = CraftMedia.objects.filter(media_type=CraftMedia.MediaType.PHOTO)
    return crafts.prefetch_related(Prefetch("media", queryset=photos, to_attr="photos"))


def list_categories():
    return Category.objects.filter(is_hidden=False)


def list_craft_types(*, category=None):
    craft_types = CraftType.objects.filter(is_hidden=False, category__is_hidden=False)
    if category is not None:
        craft_types = craft_types.filter(category_id=category)
    return craft_types


def _typical_first(model, craft_type):
    """Visible items, with the ones linked to `craft_type` marked `typical` and listed first."""
    items = model.objects.filter(is_hidden=False)
    if craft_type is None:
        return items.annotate(typical=Value(False))
    links = model.craft_types.through.objects.filter(
        **{f"{model._meta.model_name}_id": OuterRef("pk")}, crafttype_id=craft_type
    )
    return items.annotate(typical=Exists(links)).order_by("-typical", "name")


def list_tools(*, craft_type=None):
    return _typical_first(Tool, craft_type)


def list_materials(*, craft_type=None):
    return _typical_first(Material, craft_type)


def list_cultures():
    return Culture.objects.filter(is_hidden=False)


def list_regions(*, country=None):
    regions = Region.objects.all()
    if country:
        regions = regions.filter(country__iexact=country)
    return regions


def visible_crafts(viewer=None):
    """Crafts a viewer may see: not deleted, and published or their own. Admins see hidden too."""
    crafts = Craft.objects.all()
    if viewer is not None and viewer.is_authenticated:
        if viewer.is_admin:
            return crafts
        return crafts.filter(Q(status=Craft.Status.PUBLISHED) | Q(author=viewer))
    return crafts.filter(status=Craft.Status.PUBLISHED)


def _apply_filters(crafts, *, category=None, region=None, country=None, search=None):
    if category:
        crafts = crafts.filter(category__slug=category)
    if region:
        crafts = crafts.filter(region_id=region)
    if country:
        crafts = crafts.filter(region__country__iexact=country)
    if search:
        crafts = crafts.filter(
            Q(name__icontains=search)
            | Q(craft_type__icontains=search)
            | Q(description__icontains=search)
            | Q(category__name__icontains=search)
            | Q(region__name__icontains=search)
        )
    return crafts


def browse_crafts(viewer=None, *, author_id=None, **filters):
    crafts = visible_crafts(viewer).select_related("category", "region", "author__profile")
    if author_id is not None:
        crafts = crafts.filter(author_id=author_id)
    return _with_photos(_apply_filters(crafts, **filters))


def map_pins(viewer=None, *, bbox=None, **filters):
    crafts = _apply_filters(visible_crafts(viewer), **filters)
    if bbox:
        west, south, east, north = bbox
        crafts = crafts.filter(latitude__gte=south, latitude__lte=north)
        if west <= east:
            crafts = crafts.filter(longitude__gte=west, longitude__lte=east)
        else:
            crafts = crafts.filter(Q(longitude__gte=west) | Q(longitude__lte=east))
    return crafts.values("id", "name", "category__slug", "latitude", "longitude")


def get_visible_craft(craft_id, viewer=None):
    craft = (
        visible_crafts(viewer)
        .select_related("category", "region", "author__profile")
        .prefetch_related("media")
        .filter(pk=craft_id)
        .first()
    )
    if craft is None:
        raise NotFoundError(CRAFT_NOT_FOUND)
    return craft


def get_media(craft, media_id):
    media = craft.media.filter(pk=media_id).first()
    if media is None:
        raise NotFoundError(MEDIA_NOT_FOUND)
    return media
