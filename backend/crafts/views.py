from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.selectors import get_public_user
from core.permissions import IsAuthorOrAdmin

from . import geocoding, selectors, services
from .serializers import (
    AddCraftTypeSerializer,
    AddCultureSerializer,
    AddItemSerializer,
    AddLinkedItemSerializer,
    CategorySerializer,
    CraftDetailSerializer,
    CraftFilterSerializer,
    CraftListSerializer,
    CraftPinSerializer,
    CraftTypeFilterSerializer,
    CraftTypeSerializer,
    CraftWriteSerializer,
    CultureSerializer,
    GeocodeReverseSerializer,
    GeocodeSearchSerializer,
    LinkedItemFilterSerializer,
    MapFilterSerializer,
    MaterialSerializer,
    MediaSerializer,
    MediaUploadSerializer,
    PlaceSerializer,
    ToolSerializer,
)

FILTER_PARAMETERS = [
    OpenApiParameter("category", OpenApiTypes.STR, description="Category slug"),
    OpenApiParameter("craft_type", OpenApiTypes.INT, description="Craft type id"),
    OpenApiParameter("culture", OpenApiTypes.INT, description="Culture id"),
    OpenApiParameter("country", OpenApiTypes.STR, description="Country of the craft"),
    OpenApiParameter(
        "color", OpenApiTypes.STR, description="Crafts with a similar color, as rrggbb"
    ),
    OpenApiParameter("search", OpenApiTypes.STR, description="Text search"),
]


def _filters(request, serializer_class=CraftFilterSerializer):
    serializer = serializer_class(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class LookupListView(generics.ListCreateAPIView):
    """
    A lookup list for the craft form. Anyone can read it; registered users can add to it, and
    adding a name that already exists returns the existing item with 200 instead of 201.
    """

    pagination_class = None
    add_serializer_class = None
    add = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    @property
    def throttle_scope(self):
        return "lookup_add" if self.request.method == "POST" else None

    def create(self, request):
        serializer = self.add_serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        item, created = self.add(user=request.user, **serializer.validated_data)
        return Response(
            self.get_serializer(item).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


def _lookup_schema(item_serializer, add_serializer, parameters=()):
    return extend_schema_view(
        get=extend_schema(tags=["reference data"], parameters=list(parameters)),
        post=extend_schema(
            tags=["reference data"],
            request=add_serializer,
            responses={201: item_serializer, 200: item_serializer},
        ),
    )


@_lookup_schema(CategorySerializer, AddItemSerializer)
class CategoryListView(LookupListView):
    serializer_class = CategorySerializer
    add_serializer_class = AddItemSerializer
    add = staticmethod(services.add_category)

    def get_queryset(self):
        return selectors.list_categories()


@_lookup_schema(
    CraftTypeSerializer,
    AddCraftTypeSerializer,
    [OpenApiParameter("category", OpenApiTypes.INT, description="Category id")],
)
class CraftTypeListView(LookupListView):
    serializer_class = CraftTypeSerializer
    add_serializer_class = AddCraftTypeSerializer
    add = staticmethod(services.add_craft_type)

    def get_queryset(self):
        return selectors.list_craft_types(**_filters(self.request, CraftTypeFilterSerializer))


TYPICAL_FOR = OpenApiParameter(
    "craft_type", OpenApiTypes.INT, description="List the items typical for this craft type first"
)


@_lookup_schema(ToolSerializer, AddLinkedItemSerializer, [TYPICAL_FOR])
class ToolListView(LookupListView):
    serializer_class = ToolSerializer
    add_serializer_class = AddLinkedItemSerializer
    add = staticmethod(services.add_tool)

    def get_queryset(self):
        return selectors.list_tools(**_filters(self.request, LinkedItemFilterSerializer))


@_lookup_schema(MaterialSerializer, AddLinkedItemSerializer, [TYPICAL_FOR])
class MaterialListView(LookupListView):
    serializer_class = MaterialSerializer
    add_serializer_class = AddLinkedItemSerializer
    add = staticmethod(services.add_material)

    def get_queryset(self):
        return selectors.list_materials(**_filters(self.request, LinkedItemFilterSerializer))


@_lookup_schema(CultureSerializer, AddCultureSerializer)
class CultureListView(LookupListView):
    serializer_class = CultureSerializer
    add_serializer_class = AddCultureSerializer
    add = staticmethod(services.add_culture)

    def get_queryset(self):
        return selectors.list_cultures()


@extend_schema(tags=["crafts"])
class CraftViewSet(viewsets.GenericViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = CraftDetailSerializer

    def get_permissions(self):
        if self.action in ("create", "upload_media", "delete_media"):
            return [IsAuthenticated()]
        if self.action in ("partial_update", "destroy"):
            return [IsAuthenticated(), IsAuthorOrAdmin()]
        return [AllowAny()]

    def _detail(self, craft_id):
        craft = selectors.get_visible_craft(craft_id, self.request.user)
        return CraftDetailSerializer(craft, context={"request": self.request}).data

    @extend_schema(parameters=FILTER_PARAMETERS, responses=CraftListSerializer(many=True))
    def list(self, request):
        crafts = selectors.browse_crafts(request.user, **_filters(request))
        page = self.paginate_queryset(crafts)
        serializer = CraftListSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        parameters=[
            *FILTER_PARAMETERS,
            OpenApiParameter(
                "bbox", OpenApiTypes.STR, description="Visible area: west,south,east,north"
            ),
        ],
        responses=CraftPinSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="map", pagination_class=None)
    def map(self, request):
        pins = selectors.map_pins(request.user, **_filters(request, MapFilterSerializer))
        return Response(CraftPinSerializer(pins, many=True).data)

    @extend_schema(responses=serializers.ListSerializer(child=serializers.CharField()))
    @action(detail=False, methods=["get"], url_path="countries", pagination_class=None)
    def countries(self, request):
        """Countries that have crafts, for the country filter."""
        return Response(list(selectors.craft_countries(request.user)))

    @extend_schema(request=CraftWriteSerializer, responses={201: CraftDetailSerializer})
    def create(self, request):
        serializer = CraftWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        craft = services.publish_craft(author=request.user, data=serializer.validated_data)
        return Response(self._detail(craft.pk), status=status.HTTP_201_CREATED)

    @extend_schema(responses=CraftDetailSerializer)
    def retrieve(self, request, pk):
        return Response(self._detail(pk))

    @extend_schema(request=CraftWriteSerializer, responses=CraftDetailSerializer)
    def partial_update(self, request, pk):
        craft = selectors.get_visible_craft(pk, request.user)
        self.check_object_permissions(request, craft)
        serializer = CraftWriteSerializer(craft, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update_craft(craft=craft, actor=request.user, data=serializer.validated_data)
        return Response(self._detail(craft.pk))

    @extend_schema(responses={204: None})
    def destroy(self, request, pk):
        craft = selectors.get_visible_craft(pk, request.user)
        self.check_object_permissions(request, craft)
        services.delete_craft(craft=craft, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        request={"multipart/form-data": MediaUploadSerializer},
        responses={201: MediaSerializer},
    )
    @action(detail=True, methods=["post"], url_path="media")
    def upload_media(self, request, pk):
        craft = selectors.get_visible_craft(pk, request.user)
        serializer = MediaUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        media = services.add_media(craft=craft, actor=request.user, data=serializer.validated_data)
        return Response(
            MediaSerializer(media, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(responses={204: None})
    @action(detail=True, methods=["delete"], url_path=r"media/(?P<media_id>\d+)")
    def delete_media(self, request, pk, media_id):
        craft = selectors.get_visible_craft(pk, request.user)
        media = selectors.get_media(craft, media_id)
        services.remove_media(media=media, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["crafts"], parameters=FILTER_PARAMETERS)
class UserCraftsView(generics.ListAPIView):
    serializer_class = CraftListSerializer

    def get_queryset(self):
        author = get_public_user(self.kwargs["user_id"])
        return selectors.browse_crafts(
            self.request.user, author_id=author.id, **_filters(self.request)
        )


class GeocodeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "geocode"


@extend_schema(tags=["address lookup"])
class GeocodeSearchView(GeocodeView):
    @extend_schema(parameters=[GeocodeSearchSerializer], responses=PlaceSerializer)
    def get(self, request):
        """Finds the coordinates of an address. Returns 404 when nothing matches."""
        params = _filters(request, GeocodeSearchSerializer)
        return Response(PlaceSerializer(geocoding.search(params["q"])).data)


@extend_schema(tags=["address lookup"])
class GeocodeReverseView(GeocodeView):
    @extend_schema(parameters=[GeocodeReverseSerializer], responses=PlaceSerializer)
    def get(self, request):
        """Finds the address at a point. Returns 404 when there is none, for example at sea."""
        params = _filters(request, GeocodeReverseSerializer)
        return Response(PlaceSerializer(geocoding.reverse(params["lat"], params["lng"])).data)
