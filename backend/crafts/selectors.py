from .models import Category, Region


def list_categories():
    return Category.objects.all()


def list_regions(*, country=None):
    regions = Region.objects.all()
    if country:
        regions = regions.filter(country__iexact=country)
    return regions
