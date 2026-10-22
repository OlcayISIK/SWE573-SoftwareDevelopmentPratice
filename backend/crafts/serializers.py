from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.validators import MB, validate_image_upload

from .colors import HEX_COLOR, MAIN_COLORS
from .models import (
    CATEGORY_ICONS,
    DEFAULT_CATEGORY_ICON,
    Category,
    Craft,
    CraftMedia,
    CraftPlace,
    CraftType,
    Culture,
    Material,
    Tool,
)

PHOTO_MAX_BYTES = 5 * MB
DOCUMENT_MAX_BYTES = 10 * MB
MAX_TOOLS = 20
MAX_MATERIALS = 20
MAX_COLORS = 10
MAX_PLACES = 10
LENGTH_UNITS = ["mm", "cm", "m", "in", "ft"]
WEIGHT_UNITS = ["g", "kg", "oz", "lb"]
VOLUME_UNITS = ["ml", "l", "fl oz"]
# Each kind of dimension and the units it can be given in.
DIMENSION_UNITS = {
    **dict.fromkeys(
        ["height", "width", "depth", "length", "diameter", "circumference", "thickness"],
        LENGTH_UNITS,
    ),
    "weight": WEIGHT_UNITS,
    "volume": VOLUME_UNITS,
}
DIMENSION_TYPES = list(DIMENSION_UNITS)


class CategorySerializer(serializers.ModelSerializer):
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "icon", "description", "user_added"]
        read_only_fields = fields


class CraftTypeSerializer(serializers.ModelSerializer):
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        model = CraftType
        fields = ["id", "name", "category", "description", "user_added"]
        read_only_fields = fields


class LinkedItemSerializer(serializers.ModelSerializer):
    typical = serializers.SerializerMethodField(
        help_text="Typical for the craft type given in the request."
    )
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        fields = ["id", "name", "description", "typical", "user_added"]
        read_only_fields = fields

    def get_typical(self, item) -> bool:
        return getattr(item, "typical", False)


class ToolSerializer(LinkedItemSerializer):
    class Meta(LinkedItemSerializer.Meta):
        model = Tool


class MaterialSerializer(LinkedItemSerializer):
    class Meta(LinkedItemSerializer.Meta):
        model = Material


class CultureSerializer(serializers.ModelSerializer):
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        model = Culture
        fields = ["id", "name", "homeland", "description", "user_added"]
        read_only_fields = fields


def clean_lookup_name(value):
    """Tidies a lookup item name: single spaces, a capital first letter, and some letters."""
    name = " ".join(value.split())
    if len(name) < 2 or not any(char.isalpha() for char in name):
        raise serializers.ValidationError("Enter a name of at least 2 characters.")
    return name[0].upper() + name[1:]


def clean_description(value):
    """Tidies an item description: single spaces, no space at either end."""
    return " ".join(value.split())


class AddItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    description = serializers.CharField(max_length=300, required=False, allow_blank=True)

    def validate_name(self, value):
        return clean_lookup_name(value)

    def validate_description(self, value):
        return clean_description(value)


class AddCategorySerializer(AddItemSerializer):
    icon = serializers.ChoiceField(
        choices=CATEGORY_ICONS, required=False, default=DEFAULT_CATEGORY_ICON
    )


class AddCraftTypeSerializer(AddItemSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.filter(is_hidden=False))


class AddLinkedItemSerializer(AddItemSerializer):
    craft_type = serializers.PrimaryKeyRelatedField(
        queryset=CraftType.objects.filter(is_hidden=False),
        required=False,
        help_text="Craft type the item is typical for.",
    )


class AddCultureSerializer(AddItemSerializer):
    homeland = serializers.CharField(max_length=120, required=False, allow_blank=True)


class CraftTypeFilterSerializer(serializers.Serializer):
    category = serializers.IntegerField(required=False, min_value=1)


class LinkedItemFilterSerializer(serializers.Serializer):
    craft_type = serializers.IntegerField(required=False, min_value=1)


class NamedItemSerializer(serializers.Serializer):
    """A lookup item as shown on a craft."""

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)
    user_added = serializers.BooleanField(read_only=True)


class StrictSerializer(serializers.Serializer):
    """Rejects keys that are not declared, so stored JSON stays predictable."""

    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError(
                    {key: ["Unknown attribute."] for key in sorted(unknown)}
                )
        return super().to_internal_value(data)


class DimensionSerializer(StrictSerializer):
    type = serializers.ChoiceField(choices=DIMENSION_TYPES)
    value = serializers.FloatField(min_value=0.01, max_value=100000)
    unit = serializers.ChoiceField(choices=LENGTH_UNITS + WEIGHT_UNITS + VOLUME_UNITS)

    def validate(self, data):
        units = DIMENSION_UNITS[data["type"]]
        if data["unit"] not in units:
            raise serializers.ValidationError(
                {"unit": [f"Give the {data['type']} in {', '.join(units)}."]}
            )
        return data


class CraftAttributesSerializer(StrictSerializer):
    dimensions = DimensionSerializer(many=True, required=False, max_length=len(DIMENSION_TYPES))
    distinguishing_features = serializers.CharField(
        max_length=1000, required=False, allow_blank=True
    )

    def validate_dimensions(self, dimensions):
        types = [dimension["type"] for dimension in dimensions]
        if len(types) != len(set(types)):
            raise serializers.ValidationError("Enter each dimension once.")
        return dimensions

    def to_internal_value(self, data):
        return _plain(super().to_internal_value(data))


def _plain(value):
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


class CoordinateField(serializers.FloatField):
    """Accepts any float precision and stores it rounded to 6 decimal places (about 10 cm)."""

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        return Decimal(str(value)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def to_representation(self, value):
        return float(value)


class ColorField(serializers.CharField):
    """A color as "#rrggbb", or "#rrggbbaa" when see-through."""

    def __init__(self, **kwargs):
        super().__init__(max_length=9, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data).strip().lower()
        if not HEX_COLOR.match(value):
            raise serializers.ValidationError('Use a hex color such as "#1e40af".')
        return value


def _visible(model):
    return model.objects.filter(is_hidden=False)


class PlaceInputSerializer(StrictSerializer):
    address = serializers.CharField(max_length=255)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    country = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    latitude = CoordinateField(min_value=-90, max_value=90)
    longitude = CoordinateField(min_value=-180, max_value=180)
    is_origin = serializers.BooleanField(required=False, default=False)


class CraftPlaceSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)

    class Meta:
        model = CraftPlace
        fields = ["id", "address", "city", "country", "latitude", "longitude", "is_origin"]
        read_only_fields = fields


EARLIEST_YEAR = -10000


class CraftDateSerializer(StrictSerializer):
    """
    When the craft was made: {"kind": "unknown"}, {"kind": "year", "year": -500, "circa": true}
    for about 500 BC, or {"kind": "day", "day": "1923-03-12"}. Years before the common era are
    negative, and there is no year 0.
    """

    kind = serializers.ChoiceField(choices=Craft.DateKind.choices)
    year = serializers.IntegerField(required=False, allow_null=True, min_value=EARLIEST_YEAR)
    day = serializers.DateField(required=False, allow_null=True)
    circa = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        # A partial update does not enforce required nested fields, so the kind is checked here.
        kind = attrs.get("kind")
        if kind is None:
            raise serializers.ValidationError({"kind": ["Choose the kind of date."]})
        today = timezone.localdate()
        if kind == Craft.DateKind.YEAR:
            year = attrs.get("year")
            if year is None:
                raise serializers.ValidationError({"year": ["Enter the year."]})
            if year == 0:
                raise serializers.ValidationError(
                    {"year": ["There is no year 0: use 1 BC or AD 1."]}
                )
            if year > today.year:
                raise serializers.ValidationError({"year": ["The year cannot be in the future."]})
            return {
                "date_kind": kind,
                "date_year": year,
                "date_day": None,
                "date_circa": attrs.get("circa", False),
            }
        if kind == Craft.DateKind.DAY:
            day = attrs.get("day")
            if day is None:
                raise serializers.ValidationError({"day": ["Enter the date."]})
            if day > today:
                raise serializers.ValidationError({"day": ["The date cannot be in the future."]})
            return {"date_kind": kind, "date_year": day.year, "date_day": day, "date_circa": False}
        return {"date_kind": kind, "date_year": None, "date_day": None, "date_circa": False}


@extend_schema_field(CraftDateSerializer)
class CraftDateField(serializers.Field):
    """Reads a craft's date fields as one date object."""

    def __init__(self, **kwargs):
        super().__init__(source="*", read_only=True, **kwargs)

    def to_representation(self, craft):
        return {
            "kind": craft.date_kind,
            "year": craft.date_year,
            "day": craft.date_day.isoformat() if craft.date_day else None,
            "circa": craft.date_circa,
        }


class CraftWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=_visible(Category))
    craft_type = serializers.PrimaryKeyRelatedField(queryset=_visible(CraftType))
    tools = serializers.PrimaryKeyRelatedField(queryset=_visible(Tool), many=True, required=False)
    materials = serializers.PrimaryKeyRelatedField(
        queryset=_visible(Material), many=True, required=False
    )
    culture = serializers.PrimaryKeyRelatedField(queryset=_visible(Culture))
    places = PlaceInputSerializer(
        many=True,
        min_length=1,
        max_length=MAX_PLACES,
        help_text="Where the craft is made or belongs. Mark at most one as the origin.",
    )
    colors = serializers.ListField(
        child=ColorField(),
        required=False,
        max_length=MAX_COLORS,
        help_text='Colors as "#rrggbb", or "#rrggbbaa" when see-through.',
    )
    attributes = CraftAttributesSerializer(required=False)
    date = CraftDateSerializer(required=False, help_text="When the craft was made.")

    class Meta:
        model = Craft
        fields = [
            "name",
            "category",
            "craft_type",
            "tools",
            "materials",
            "culture",
            "places",
            "description",
            "story",
            "date",
            "colors",
            "attributes",
        ]

    def validate_tools(self, tools):
        if len(tools) > MAX_TOOLS:
            raise serializers.ValidationError(f"Choose at most {MAX_TOOLS} tools.")
        return list(dict.fromkeys(tools))

    def validate_materials(self, materials):
        if len(materials) > MAX_MATERIALS:
            raise serializers.ValidationError(f"Choose at most {MAX_MATERIALS} materials.")
        return list(dict.fromkeys(materials))

    def validate_places(self, places):
        # A partial update skips the defaults of nested fields, so they are filled in here.
        places = [{"city": "", "country": "", "is_origin": False, **place} for place in places]
        if sum(place["is_origin"] for place in places) > 1:
            raise serializers.ValidationError("Mark at most one place as the origin.")
        points = [(place["latitude"], place["longitude"]) for place in places]
        if len(points) != len(set(points)):
            raise serializers.ValidationError("Enter each place once.")
        return places

    def validate_colors(self, colors):
        # The same color with another opacity counts as the same color.
        values = [color[:7] for color in colors]
        if len(values) != len(set(values)):
            raise serializers.ValidationError("Enter each color once.")
        return colors

    def validate(self, attrs):
        if "category" in attrs or "craft_type" in attrs:
            category = attrs.get("category") or self.instance.category
            craft_type = attrs.get("craft_type") or self.instance.craft_type
            if craft_type.category_id != category.id:
                raise serializers.ValidationError(
                    {"craft_type": ["Choose a craft type from the selected category."]}
                )
        return attrs


class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CraftMedia
        fields = ["id", "media_type", "file", "url", "caption", "alt_text", "order"]
        read_only_fields = fields


class MediaUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(required=False)
    url = serializers.URLField(
        required=False,
        allow_blank=True,
        validators=[URLValidator(schemes=["http", "https"])],
    )

    class Meta:
        model = CraftMedia
        fields = ["media_type", "file", "url", "caption", "alt_text", "order"]

    def validate(self, attrs):
        media_type = attrs["media_type"]
        file, url = attrs.get("file"), attrs.get("url", "")
        if media_type == CraftMedia.MediaType.VIDEO:
            if file:
                raise serializers.ValidationError({"file": ["Videos are added as links."]})
            if not url:
                raise serializers.ValidationError({"url": ["A video link is required."]})
            return attrs

        if url:
            raise serializers.ValidationError({"url": ["Only videos are added as links."]})
        if not file:
            raise serializers.ValidationError({"file": ["A file is required."]})
        if media_type == CraftMedia.MediaType.PHOTO:
            self._validate_photo(file, attrs.get("alt_text", ""))
        else:
            self._validate_document(file)
        return attrs

    def _validate_photo(self, file, alt_text):
        try:
            validate_image_upload(file, PHOTO_MAX_BYTES)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"file": exc.messages}) from exc
        if not alt_text.strip():
            raise serializers.ValidationError(
                {"alt_text": ["Describe the photo for people who cannot see it."]}
            )

    def _validate_document(self, file):
        if file.size > DOCUMENT_MAX_BYTES:
            raise serializers.ValidationError(
                {"file": [f"Documents must be {DOCUMENT_MAX_BYTES // MB} MB or smaller."]}
            )
        header = file.read(5)
        file.seek(0)
        if Path(file.name).suffix.lower() != ".pdf" or header != b"%PDF-":
            raise serializers.ValidationError({"file": ["Only PDF documents are allowed."]})


class CoverPhotoSerializer(serializers.Serializer):
    url = serializers.CharField()
    alt_text = serializers.CharField()


class AuthorSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(source="profile.display_name", read_only=True)


class CraftFilterSerializer(serializers.Serializer):
    category = serializers.SlugField(required=False)
    craft_type = serializers.IntegerField(required=False, min_value=1)
    culture = serializers.IntegerField(required=False, min_value=1)
    country = serializers.CharField(required=False, max_length=100)
    color = serializers.ChoiceField(
        choices=MAIN_COLORS, required=False, help_text="A main color, such as red."
    )
    search = serializers.CharField(required=False, max_length=100)


class MapFilterSerializer(CraftFilterSerializer):
    bbox = serializers.CharField(
        required=False,
        help_text="Visible map area as west,south,east,north in degrees.",
    )

    def validate_bbox(self, value):
        try:
            west, south, east, north = (float(part) for part in value.split(","))
        except ValueError as exc:
            raise serializers.ValidationError("Use four numbers: west,south,east,north.") from exc
        if not (-90 <= south <= north <= 90 and -180 <= west <= 180 and -180 <= east <= 180):
            raise serializers.ValidationError("The bounding box is outside the map.")
        return west, south, east, north


class CategoryFacetSerializer(serializers.Serializer):
    slug = serializers.CharField()
    name = serializers.CharField()
    icon = serializers.CharField()
    count = serializers.IntegerField()


class CraftTypeFacetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.IntegerField()
    count = serializers.IntegerField()


class CultureFacetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    count = serializers.IntegerField()


class CountryFacetSerializer(serializers.Serializer):
    name = serializers.CharField()
    count = serializers.IntegerField()


class ColorFacetSerializer(serializers.Serializer):
    name = serializers.ChoiceField(choices=MAIN_COLORS)
    count = serializers.IntegerField()


class FacetsSerializer(serializers.Serializer):
    categories = CategoryFacetSerializer(many=True)
    craft_types = CraftTypeFacetSerializer(many=True)
    cultures = CultureFacetSerializer(many=True)
    countries = CountryFacetSerializer(many=True)
    colors = ColorFacetSerializer(many=True)


class CraftListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    craft_type = NamedItemSerializer(read_only=True)
    culture = CultureSerializer(read_only=True, allow_null=True)
    author = AuthorSerializer(read_only=True)
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    cover_photo = serializers.SerializerMethodField()

    class Meta:
        model = Craft
        fields = [
            "id",
            "name",
            "category",
            "craft_type",
            "culture",
            "city",
            "country",
            "latitude",
            "longitude",
            "cover_photo",
            "status",
            "author",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(CoverPhotoSerializer(allow_null=True))
    def get_cover_photo(self, craft):
        photos = getattr(craft, "photos", None)
        if not photos:
            return None
        photo = photos[0]
        request = self.context.get("request")
        url = photo.file.url
        return {
            "url": request.build_absolute_uri(url) if request else url,
            "alt_text": photo.alt_text,
        }


class CraftPinSerializer(serializers.Serializer):
    """A pin for one place of a craft; a craft in several places has several pins."""

    id = serializers.IntegerField(source="craft_id", help_text="The craft.")
    place = serializers.IntegerField(source="id", help_text="The place of this pin.")
    name = serializers.CharField(source="craft__name")
    category = serializers.CharField(source="craft__category__slug")
    category_icon = serializers.CharField(source="craft__category__icon")
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class CraftDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    craft_type = NamedItemSerializer(read_only=True)
    tools = NamedItemSerializer(many=True, read_only=True)
    materials = NamedItemSerializer(many=True, read_only=True)
    culture = CultureSerializer(read_only=True, allow_null=True)
    colors = serializers.SlugRelatedField(slug_field="value", many=True, read_only=True)
    author = AuthorSerializer(read_only=True)
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    places = CraftPlaceSerializer(many=True, read_only=True)
    media = MediaSerializer(many=True, read_only=True)
    date = CraftDateField()

    class Meta:
        model = Craft
        fields = [
            "id",
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
            "places",
            "media",
            "description",
            "story",
            "date",
            "colors",
            "attributes",
            "status",
            "author",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class GeocodeSearchSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=3, max_length=255, help_text="The address to look up.")


class GeocodeReverseSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


class PlaceSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    address = serializers.CharField()
    city = serializers.CharField(allow_blank=True)
    country = serializers.CharField(allow_blank=True)
