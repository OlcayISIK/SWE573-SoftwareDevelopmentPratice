from django.db.models import Q

from core.exceptions import NotFoundError

from .models import Category, Craft, Region

CRAFT_NOT_FOUND = "Craft not found."


def list_categories():
    return Category.objects.all()


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


def get_visible_craft(craft_id, viewer=None):
    craft = (
        visible_crafts(viewer)
        .select_related("category", "region", "author__profile")
        .filter(pk=craft_id)
        .first()
    )
    if craft is None:
        raise NotFoundError(CRAFT_NOT_FOUND)
    return craft
