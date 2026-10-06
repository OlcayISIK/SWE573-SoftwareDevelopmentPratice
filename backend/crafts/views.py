from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsAuthorOrAdmin

from . import selectors, services
from .serializers import (
    CategorySerializer,
    CraftDetailSerializer,
    CraftWriteSerializer,
    RegionSerializer,
)


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
class CraftViewSet(viewsets.ViewSet):
    lookup_value_regex = r"\d+"

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        if self.action in ("partial_update", "destroy"):
            return [IsAuthenticated(), IsAuthorOrAdmin()]
        return [AllowAny()]

    def _detail(self, craft_id):
        craft = selectors.get_visible_craft(craft_id, self.request.user)
        return CraftDetailSerializer(craft, context={"request": self.request}).data

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
