from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.validators import MB, validate_image_upload

from .colors import HEX_COLOR
from .models import Category, Craft, CraftMedia, CraftType, Culture, Material, Tool

PHOTO_MAX_BYTES = 5 * MB
DOCUMENT_MAX_BYTES = 10 * MB
MAX_TOOLS = 20
MAX_MATERIALS = 20
MAX_COLORS = 10
DIMENSION_TYPES = ["height", "width", "depth", "length", "diameter", "thickness"]
DIMENSION_UNITS = ["mm", "cm", "m"]


class CategorySerializer(serializers.ModelSerializer):
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "user_added"]


class CraftTypeSerializer(serializers.ModelSerializer):
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        model = CraftType
        fields = ["id", "name", "category", "user_added"]


class LinkedItemSerializer(serializers.ModelSerializer):
    typical = serializers.SerializerMethodField(
        help_text="Typical for the craft type given in the request."
    )
    user_added = serializers.BooleanField(read_only=True)

    class Meta:
        fields = ["id", "name", "typical", "user_added"]

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
        fields = ["id", "name", "homeland", "user_added"]


def clean_lookup_name(value):
    """Tidies a lookup item name: single spaces, a capital first letter, and some letters."""
    name = " ".join(value.split())
    if len(name) < 2 or not any(char.isalpha() for char in name):
        raise serializers.ValidationError("Enter a name of at least 2 characters.")
    return name[0].upper() + name[1:]


class AddItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)

    def validate_name(self, value):
        return clean_lookup_name(value)


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
    unit = serializers.ChoiceField(choices=DIMENSION_UNITS)


class CraftAttributesSerializer(StrictSerializer):
    dimensions = DimensionSerializer(many=True, required=False, max_length=len(DIMENSION_TYPES))
    weight_g = serializers.FloatField(min_value=0.01, required=False)
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


class CraftWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=_visible(Category))
    craft_type = serializers.PrimaryKeyRelatedField(queryset=_visible(CraftType))
    tools = serializers.PrimaryKeyRelatedField(queryset=_visible(Tool), many=True, required=False)
    materials = serializers.PrimaryKeyRelatedField(
        queryset=_visible(Material), many=True, required=False
    )
    culture = serializers.PrimaryKeyRelatedField(queryset=_visible(Culture))
    address = serializers.CharField(max_length=255)
    colors = serializers.ListField(
        child=ColorField(),
        required=False,
        max_length=MAX_COLORS,
        help_text='Colors as "#rrggbb", or "#rrggbbaa" when see-through.',
    )
    latitude = CoordinateField(min_value=-90, max_value=90)
    longitude = CoordinateField(min_value=-180, max_value=180)
    attributes = CraftAttributesSerializer(required=False)

    class Meta:
        model = Craft
        fields = [
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


class FacetsSerializer(serializers.Serializer):
    categories = CategoryFacetSerializer(many=True)
    craft_types = CraftTypeFacetSerializer(many=True)
    cultures = CultureFacetSerializer(many=True)
    countries = CountryFacetSerializer(many=True)


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
    id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.CharField(source="category__slug")
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
    media = MediaSerializer(many=True, read_only=True)

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
            "media",
            "description",
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
