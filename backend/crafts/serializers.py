from decimal import ROUND_HALF_UP, Decimal

from rest_framework import serializers

from .models import Category, Craft, Region


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["id", "name", "country", "description"]


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


class DimensionsSerializer(StrictSerializer):
    height = serializers.FloatField(min_value=0.01, required=False)
    width = serializers.FloatField(min_value=0.01, required=False)
    depth = serializers.FloatField(min_value=0.01, required=False)
    length = serializers.FloatField(min_value=0.01, required=False)
    diameter = serializers.FloatField(min_value=0.01, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide at least one dimension.")
        return attrs


class CraftAttributesSerializer(StrictSerializer):
    dimensions_cm = DimensionsSerializer(required=False)
    weight_g = serializers.FloatField(min_value=0.01, required=False)
    colors = serializers.ListField(
        child=serializers.CharField(max_length=40), max_length=10, required=False
    )
    materials = serializers.ListField(
        child=serializers.CharField(max_length=60), max_length=10, required=False
    )
    distinguishing_features = serializers.CharField(
        max_length=1000, required=False, allow_blank=True
    )

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


class CraftWriteSerializer(serializers.ModelSerializer):
    latitude = CoordinateField(min_value=-90, max_value=90)
    longitude = CoordinateField(min_value=-180, max_value=180)
    attributes = CraftAttributesSerializer(required=False)

    class Meta:
        model = Craft
        fields = [
            "name",
            "craft_type",
            "category",
            "region",
            "latitude",
            "longitude",
            "description",
            "production_process",
            "how_to_understand",
            "cultural_relevance",
            "attributes",
        ]


class AuthorSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(source="profile.display_name", read_only=True)


class CraftDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    region = RegionSerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)

    class Meta:
        model = Craft
        fields = [
            "id",
            "name",
            "craft_type",
            "category",
            "region",
            "latitude",
            "longitude",
            "description",
            "production_process",
            "how_to_understand",
            "cultural_relevance",
            "attributes",
            "status",
            "author",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
