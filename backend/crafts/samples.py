"""
Sample crafts for trying the site: real crafts at their real towns, with freely licensed photos
from Wikimedia Commons (credited in each caption and in sample_data/CREDITS.md).

They belong to sample contributor accounts that cannot log in, so they are easy to find and
remove again. Loading twice adds nothing.
"""

import json
from decimal import Decimal
from pathlib import Path

from django.core.files import File
from django.db import transaction

from accounts.models import User

from . import services
from .models import Category, Craft, CraftMedia, CraftType, Culture, Material, Tool

SAMPLE_DATA = Path(__file__).resolve().parent / "sample_data"


class SampleDataError(Exception):
    """The sample data refers to something the database does not have."""


def read_samples():
    return json.loads((SAMPLE_DATA / "crafts.json").read_text(encoding="utf-8"))


def sample_email(key):
    # example.org is reserved for examples, so these addresses can never reach anyone.
    return f"sample-{key}@example.org"


def _contributor(key, info):
    user = User.objects.filter(email=sample_email(key)).first()
    if user is None:
        # No password, so nobody can sign in as a sample contributor.
        user = User.objects.create_user(
            email=sample_email(key), password=None, is_email_verified=True
        )
    profile = user.profile
    profile.display_name = info["display_name"]
    profile.city = info["city"]
    profile.country = info["country"]
    profile.save()
    return user


def _lookup(model, **filters):
    item = model.objects.filter(**filters).first()
    if item is None:
        described = ", ".join(f"{key}={value}" for key, value in filters.items())
        raise SampleDataError(f"{model.__name__} not found: {described}")
    return item


def _place(item):
    return {
        "address": item["address"],
        "city": item["city"],
        "country": item["country"],
        "latitude": Decimal(str(item["latitude"])),
        "longitude": Decimal(str(item["longitude"])),
        "is_origin": item.get("is_origin", False),
    }


def _craft_fields(item):
    category = _lookup(Category, slug=item["category"])
    return {
        "name": item["name"],
        "category": category,
        "craft_type": _lookup(CraftType, category=category, name=item["craft_type"]),
        "culture": _lookup(Culture, name=item["culture"]),
        "tools": [_lookup(Tool, name=name) for name in item["tools"]],
        "materials": [_lookup(Material, name=name) for name in item["materials"]],
        # A sample in several places lists them; otherwise its own place is the only one.
        "places": [_place(place) for place in item.get("places", [item])],
        "description": item["description"],
        "story": item.get("story", ""),
        "colors": item["colors"],
        "attributes": {"dimensions": item["dimensions"]} if item["dimensions"] else {},
    }


def _add_photos(craft, photos):
    for order, photo in enumerate(photos):
        with open(SAMPLE_DATA / "photos" / photo["file"], "rb") as file:
            CraftMedia.objects.create(
                craft=craft,
                media_type=CraftMedia.MediaType.PHOTO,
                file=File(file, name=photo["file"]),
                alt_text=photo["alt_text"],
                caption=photo["caption"],
                order=order,
            )


@transaction.atomic
def load_samples():
    """Adds the sample crafts that are not there yet. Returns (added, already there)."""
    data = read_samples()
    contributors = {key: _contributor(key, info) for key, info in data["authors"].items()}
    added = existing = 0
    for item in data["crafts"]:
        author = contributors[item["author"]]
        # Includes crafts deleted since, so removing a sample craft by hand keeps it removed.
        if Craft.all_objects.filter(author=author, name=item["name"]).exists():
            existing += 1
            continue
        craft = services.publish_craft(author=author, data=_craft_fields(item))
        _add_photos(craft, item["photos"])
        added += 1
    return added, existing


@transaction.atomic
def remove_samples():
    """Deletes the sample crafts, their photo files, and the sample contributors."""
    emails = [sample_email(key) for key in read_samples()["authors"]]
    contributors = User.objects.filter(email__in=emails)
    crafts = Craft.all_objects.filter(author__in=contributors)
    for media in CraftMedia.all_objects.filter(craft__in=crafts):
        media.file.delete(save=False)
    removed = crafts.count()
    CraftMedia.all_objects.filter(craft__in=crafts).hard_delete()
    crafts.hard_delete()
    contributors.delete()
    return removed
