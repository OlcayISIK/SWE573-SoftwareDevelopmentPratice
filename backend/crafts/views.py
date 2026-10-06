from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics

from . import selectors
from .serializers import CategorySerializer, RegionSerializer


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
