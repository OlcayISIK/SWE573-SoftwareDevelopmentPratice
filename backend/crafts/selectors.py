import re

from django.db.models import Count, Exists, OuterRef, Prefetch, Q, Value

from core.exceptions import NotFoundError

from .models import (
    Category,
    Craft,
    CraftMedia,
    CraftPlace,
    CraftType,
    Culture,
    Material,
    Tool,
)

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


def visible_crafts(viewer=None):
    """Crafts a viewer may see: not deleted, and published or their own. Admins see hidden too."""
    crafts = Craft.objects.all()
    if viewer is not None and viewer.is_authenticated:
        if viewer.is_admin:
            return crafts
        return crafts.filter(Q(status=Craft.Status.PUBLISHED) | Q(author=viewer))
    return crafts.filter(status=Craft.Status.PUBLISHED)


# Craft fields a search looks in. Tools and materials are searched too, see _matches.
SEARCHED_FIELDS = [
    "name",
    "description",
    "story",
    "craft_type__name",
    "category__name",
    "culture__name",
]
# Place fields a search looks in; a craft matches when any of its places does.
SEARCHED_PLACE_FIELDS = ["address", "city", "country"]
MAX_SEARCH_WORDS = 6


def _matches(word):
    """
    Crafts where some searched field has a word starting with `word`, so "tile" finds tiles
    but not textiles. `\\m` is the start of a word in PostgreSQL regular expressions.
    """
    pattern = r"\m" + re.escape(word)
    condition = Q()
    for field in SEARCHED_FIELDS:
        condition |= Q(**{f"{field}__iregex": pattern})
    for model in (Tool, Material):
        condition |= Exists(model.objects.filter(crafts=OuterRef("pk"), name__iregex=pattern))
    in_place = Q()
    for field in SEARCHED_PLACE_FIELDS:
        in_place |= Q(**{f"{field}__iregex": pattern})
    condition |= Exists(CraftPlace.objects.filter(in_place, craft=OuterRef("pk")))
    return condition


def _apply_filters(
    crafts,
    *,
    category=None,
    craft_type=None,
    culture=None,
    country=None,
    search=None,
):
    if category:
        crafts = crafts.filter(category__slug=category)
    if craft_type:
        crafts = crafts.filter(craft_type_id=craft_type)
    if culture:
        crafts = crafts.filter(culture_id=culture)
    if country:
        # Any of the craft's places can be in the country.
        crafts = crafts.filter(
            Exists(CraftPlace.objects.filter(craft=OuterRef("pk"), country__iexact=country))
        )
    if search:
        # Every word must match, so adding words narrows the results.
        for word in search.split()[:MAX_SEARCH_WORDS]:
            crafts = crafts.filter(_matches(word))
    return crafts


def craft_facets(viewer=None, **filters):
    """
    The values each filter can take among the crafts the other filters find, with counts, so
    a filter list only offers values that lead to crafts. A list ignores its own filter, so
    another value in the same list can still be picked.
    """

    def found(without):
        others = {key: value for key, value in filters.items() if key != without}
        return _apply_filters(visible_crafts(viewer), **others)

    def counted(rows, counting="id", **fields):
        """Counts crafts per value, as {output name: field path} plus "count", by name."""
        paths = list(fields.values())
        rows = (
            rows.values(*paths)
            .annotate(count=Count(counting, distinct=True))
            .order_by(fields["name"])
        )
        return [
            {**{key: row[path] for key, path in fields.items()}, "count": row["count"]}
            for row in rows
        ]

    return {
        "categories": counted(found("category"), slug="category__slug", name="category__name"),
        "craft_types": counted(
            found("craft_type"),
            id="craft_type_id",
            name="craft_type__name",
            category="craft_type__category_id",
        ),
        "cultures": counted(
            found("culture").exclude(culture=None), id="culture_id", name="culture__name"
        ),
        # A craft counts once in each country it has a place in.
        "countries": counted(
            CraftPlace.objects.filter(craft__in=found("country")).exclude(country=""),
            counting="craft",
            name="country",
        ),
    }


def browse_crafts(viewer=None, *, author_id=None, **filters):
    crafts = visible_crafts(viewer).select_related(
        "category", "craft_type", "culture", "author__profile"
    )
    if author_id is not None:
        crafts = crafts.filter(author_id=author_id)
    return _with_photos(_apply_filters(crafts, **filters))


def map_pins(viewer=None, *, bbox=None, **filters):
    """A pin for every place of the crafts the filters find."""
    crafts = _apply_filters(visible_crafts(viewer), **filters)
    places = CraftPlace.objects.filter(craft__in=crafts)
    if bbox:
        west, south, east, north = bbox
        places = places.filter(latitude__gte=south, latitude__lte=north)
        if west <= east:
            places = places.filter(longitude__gte=west, longitude__lte=east)
        else:
            places = places.filter(Q(longitude__gte=west) | Q(longitude__lte=east))
    return places.order_by("-craft__created_at", "-craft_id", "order").values(
        "id", "craft_id", "craft__name", "craft__category__slug", "latitude", "longitude"
    )


def get_visible_craft(craft_id, viewer=None):
    craft = (
        visible_crafts(viewer)
        .select_related("category", "craft_type", "culture", "author__profile")
        .prefetch_related("media", "tools", "materials", "colors", "places")
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
