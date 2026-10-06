from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import selectors, services
from .serializers import (
    MarkReadResultSerializer,
    MarkReadSerializer,
    NotificationFilterSerializer,
    NotificationSerializer,
    UnreadCountSerializer,
)


@extend_schema(
    tags=["notifications"],
    parameters=[OpenApiParameter("unread", OpenApiTypes.BOOL, description="Only unread")],
)
class MyNotificationsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def list(self, request, *args, **kwargs):
        filters = NotificationFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        notifications = selectors.notifications_for(
            request.user, unread_only=filters.validated_data["unread"]
        )
        page = self.paginate_queryset(notifications)
        serializer = NotificationSerializer(
            page,
            many=True,
            context={"visible_craft_ids": selectors.visible_craft_ids(request.user, page)},
        )
        return self.get_paginated_response(serializer.data)


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UnreadCountSerializer, tags=["notifications"])
    def get(self, request):
        return Response({"count": selectors.unread_count(request.user)})


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=MarkReadSerializer, responses=MarkReadResultSerializer, tags=["notifications"]
    )
    def post(self, request):
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = services.mark_read(user=request.user, ids=serializer.validated_data.get("ids"))
        return Response({"updated": updated})
