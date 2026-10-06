from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.selectors import get_public_user
from core.permissions import IsAuthorOrAdmin

from . import selectors, services
from .serializers import (
    CategorySerializer,
    CraftDetailSerializer,
    CraftFilterSerializer,
    CraftListSerializer,
    CraftPinSerializer,
    CraftWriteSerializer,
    MapFilterSerializer,
    MediaSerializer,
    MediaUploadSerializer,
    RegionSerializer,
)

FILTER_PARAMETERS = [
    OpenApiParameter("category", OpenApiTypes.STR, description="Category slug"),
    OpenApiParameter("region", OpenApiTypes.INT, description="Region id"),
    OpenApiParameter("country", OpenApiTypes.STR, description="Country of the region"),
    OpenApiParameter("search", OpenApiTypes.STR, description="Text search"),
]


def _filters(request, serializer_class=CraftFilterSerializer):
    serializer = serializer_class(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


@extend_schema(tags=["reference data"])
class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return selectors.list_categories()


@extend_schema(
    tags=["reference data"],
    parameters=[OpenApiParameter("country", OpenApiTypes.STR, description="Filter by country")],
)
class RegionListView(generics.ListAPIView):
    serializer_class = RegionSerializer
    pagination_class = None

    def get_queryset(self):
        return selectors.list_regions(country=self.request.query_params.get("country"))


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
