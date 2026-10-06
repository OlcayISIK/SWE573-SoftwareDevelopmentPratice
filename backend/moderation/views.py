from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import ValidationError
from core.permissions import IsAdmin
from crafts.serializers import CraftWriteSerializer

from . import selectors, services
from .models import ReviewAction
from .serializers import (
    ReportCreateSerializer,
    ReportReviewSerializer,
    ReportSerializer,
    ReviewActionCreateSerializer,
    ReviewQueueFilterSerializer,
)


class ReportCraftView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "report"

    @extend_schema(
        request=ReportCreateSerializer, responses={201: ReportSerializer}, tags=["moderation"]
    )
    def post(self, request, craft_id):
        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = services.report_craft(
            reporter=request.user, craft_id=craft_id, **serializer.validated_data
        )
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["moderation"],
    parameters=[
        OpenApiParameter(
            "status",
            OpenApiTypes.STR,
            enum=["open", "resolved", "dismissed", "all"],
            description="Defaults to open",
        )
    ],
)
class ReviewQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ReportReviewSerializer

    def get_queryset(self):
        filters = ReviewQueueFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return selectors.review_queue(**filters.validated_data)


class ReportDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(responses=ReportReviewSerializer, tags=["moderation"])
    def get(self, request, report_id):
        return Response(ReportReviewSerializer(selectors.get_report(report_id)).data)


class ReviewActionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        request=ReviewActionCreateSerializer, responses=ReportReviewSerializer, tags=["moderation"]
    )
    def post(self, request, report_id):
        serializer = ReviewActionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        changes = None
        if data["action"] == ReviewAction.Action.EDIT and data.get("changes"):
            report = selectors.get_report(report_id)
            craft_changes = CraftWriteSerializer(report.craft, data=data["changes"], partial=True)
            if not craft_changes.is_valid():
                raise ValidationError(errors={"changes": craft_changes.errors})
            changes = craft_changes.validated_data

        services.review_report(
            admin=request.user,
            report_id=report_id,
            action=data["action"],
            reason=data["reason"],
            changes=changes,
        )
        return Response(ReportReviewSerializer(selectors.get_report(report_id)).data)
