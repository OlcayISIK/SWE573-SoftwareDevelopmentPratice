import uuid
from pathlib import Path

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from core.models import BaseModel, SoftDeleteModel


class LookupItem(BaseModel):
    """
    A value picked from a list on the craft form. Seeded items have no `created_by`; items added
    by users can be used by everyone right away and reported to admins, who can hide them.
    """

    name = models.CharField(max_length=80)
    is_hidden = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        abstract = True
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def user_added(self):
        return self.created_by_id is not None


def _unique_name(model_name, *fields):
    return models.UniqueConstraint(*fields, Lower("name"), name=f"unique_{model_name}_name_ci")


class Category(LookupItem):
    slug = models.SlugField(max_length=90, unique=True)

    class Meta(LookupItem.Meta):
        verbose_name_plural = "categories"
        constraints = [_unique_name("category")]


class CraftType(LookupItem):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="craft_types")

    class Meta(LookupItem.Meta):
        constraints = [_unique_name("craft_type", "category")]


class Tool(LookupItem):
    craft_types = models.ManyToManyField(CraftType, related_name="tools", blank=True)

    class Meta(LookupItem.Meta):
        constraints = [_unique_name("tool")]


class Material(LookupItem):
    craft_types = models.ManyToManyField(CraftType, related_name="materials", blank=True)

    class Meta(LookupItem.Meta):
        constraints = [_unique_name("material")]


class Culture(LookupItem):
    homeland = models.CharField(max_length=120, blank=True)

    class Meta(LookupItem.Meta):
        constraints = [_unique_name("culture")]


# Lookup lists by the name other modules and the API use for them.
LOOKUP_MODELS = {
    "category": Category,
    "craft_type": CraftType,
    "tool": Tool,
    "material": Material,
    "culture": Culture,
}


class Craft(SoftDeleteModel):
    class Status(models.TextChoices):
        PUBLISHED = "published", "Published"
        HIDDEN = "hidden", "Hidden"

    name = models.CharField(max_length=150)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="crafts")
    craft_type = models.ForeignKey(CraftType, on_delete=models.PROTECT, related_name="crafts")
    tools = models.ManyToManyField(Tool, related_name="crafts", blank=True)
    materials = models.ManyToManyField(Material, related_name="crafts", blank=True)
    # Required for new crafts; crafts added before cultures existed may have none.
    culture = models.ForeignKey(
        Culture, on_delete=models.PROTECT, related_name="crafts", null=True, blank=True
    )
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    description = models.TextField()
    attributes = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PUBLISHED)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="crafts"
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="craft_location_idx"),
            models.Index(fields=["status", "is_deleted"], name="craft_visibility_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(latitude__gte=-90, latitude__lte=90),
                name="craft_latitude_range",
            ),
            models.CheckConstraint(
                condition=models.Q(longitude__gte=-180, longitude__lte=180),
                name="craft_longitude_range",
            ),
        ]

    def __str__(self):
        return self.name


class CraftColor(BaseModel):
    """A color of a craft, in the order the author listed them."""

    craft = models.ForeignKey(Craft, on_delete=models.CASCADE, related_name="colors")
    # "#rrggbb", or "#rrggbbaa" when the color is see-through.
    value = models.CharField(max_length=9)
    order = models.PositiveSmallIntegerField(default=0)
    # CIELAB values, for finding crafts with a similar color.
    lab_l = models.FloatField()
    lab_a = models.FloatField()
    lab_b = models.FloatField()

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(value__regex=r"^#[0-9a-f]{6}([0-9a-f]{2})?$"),
                name="craft_color_hex_value",
            ),
        ]

    def __str__(self):
        return self.value


def craft_media_path(instance, filename):
    return f"crafts/{instance.craft_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class CraftMedia(SoftDeleteModel):
    class MediaType(models.TextChoices):
        PHOTO = "photo", "Photo"
        VIDEO = "video", "Video link"
        DOCUMENT = "document", "Document"

    craft = models.ForeignKey(Craft, on_delete=models.CASCADE, related_name="media")
    media_type = models.CharField(max_length=10, choices=MediaType.choices)
    file = models.FileField(upload_to=craft_media_path, blank=True)
    url = models.URLField(blank=True)
    caption = models.CharField(max_length=200, blank=True)
    alt_text = models.CharField(max_length=250, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name_plural = "craft media"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (models.Q(media_type="video", file="") & ~models.Q(url=""))
                    | (models.Q(media_type__in=["photo", "document"], url="") & ~models.Q(file=""))
                ),
                name="craft_media_has_file_or_link",
            ),
            models.CheckConstraint(
                condition=~models.Q(media_type="photo") | ~models.Q(alt_text=""),
                name="craft_photo_has_alt_text",
            ),
        ]

    def __str__(self):
        return f"{self.get_media_type_display()} for {self.craft}"
