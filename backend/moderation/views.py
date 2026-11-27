from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import ValidationError
from core.permissions import IsAdmin
from core.schema import error_response
from crafts import services as craft_services
from crafts.examples import CRAFT_NOT_FOUND, NOT_SIGNED_IN
from crafts.selectors import get_visible_craft
from crafts.serializers import CraftDetailSerializer, CraftWriteSerializer

from . import examples, selectors, services
from .models import ReviewAction
from .serializers import (
    ItemReportCreateSerializer,
    ItemReportReviewSerializer,
    ItemReportSerializer,
    ItemReviewActionCreateSerializer,
    PracticeStatusSetSerializer,
    ReportCreateSerializer,
    ReportReviewSerializer,
    ReportSerializer,
    ReviewActionCreateSerializer,
    ReviewQueueFilterSerializer,
    StatusProposalActionSerializer,
    StatusProposalCreateSerializer,
    StatusProposalQueueFilterSerializer,
    StatusProposalReviewSerializer,
    StatusProposalSerializer,
    StoryReportCreateSerializer,
    StoryReportReviewSerializer,
    StoryReportSerializer,
    StoryReviewActionCreateSerializer,
)


class ReportCraftView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "report"

    @extend_schema(
        request=ReportCreateSerializer,
        responses={
            201: ReportSerializer,
            401: error_response("Not signed in", NOT_SIGNED_IN),
            404: error_response("No craft the user may see", CRAFT_NOT_FOUND),
            409: error_response(
                "The user's earlier report on this craft is still open",
                examples.report_create_errors["twice"],
            ),
        },
        examples=examples.report_create,
        tags=["moderation"],
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
        request=ReviewActionCreateSerializer,
        responses={
            200: ReportReviewSerializer,
            403: error_response("The user is not an admin", examples.review_errors["not_admin"]),
            409: error_response("The report was already reviewed", examples.review_errors["twice"]),
        },
        examples=examples.review,
        tags=["moderation"],
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


# The lookup lists by their URL name.
ITEM_LISTS = {
    "categories": "category",
    "craft-types": "craft_type",
    "tools": "tool",
    "materials": "material",
    "cultures": "culture",
}


class ReportItemView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "report"

    @extend_schema(
        request=ItemReportCreateSerializer,
        responses={201: ItemReportSerializer},
        tags=["moderation"],
    )
    def post(self, request, items, item_id):
        """Reports a category, craft type, tool, material, or culture added by another user."""
        serializer = ItemReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = services.report_item(
            reporter=request.user,
            item_type=ITEM_LISTS[items],
            item_id=item_id,
            **serializer.validated_data,
        )
        return Response(ItemReportSerializer(report).data, status=status.HTTP_201_CREATED)


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
class ItemReviewQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ItemReportReviewSerializer

    def get_queryset(self):
        filters = ReviewQueueFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return selectors.item_review_queue(**filters.validated_data)

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        return selectors.attach_items(page) if page is not None else None


class ItemReportDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(responses=ItemReportReviewSerializer, tags=["moderation"])
    def get(self, request, report_id):
        return Response(ItemReportReviewSerializer(selectors.get_item_report(report_id)).data)


class ItemReviewActionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        request=ItemReviewActionCreateSerializer,
        responses=ItemReportReviewSerializer,
        tags=["moderation"],
    )
    def post(self, request, report_id):
        """Edits, hides, or merges the reported item, or dismisses the report."""
        serializer = ItemReviewActionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.review_item_report(
            admin=request.user, report_id=report_id, **serializer.validated_data
        )
        return Response(ItemReportReviewSerializer(selectors.get_item_report(report_id)).data)


class ReportStoryView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "report"

    @extend_schema(
        request=StoryReportCreateSerializer,
        responses={201: StoryReportSerializer},
        tags=["moderation"],
    )
    def post(self, request, story_id):
        """Reports a story another user shared about a craft."""
        serializer = StoryReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = services.report_story(
            reporter=request.user, story_id=story_id, **serializer.validated_data
        )
        return Response(StoryReportSerializer(report).data, status=status.HTTP_201_CREATED)


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
class StoryReviewQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = StoryReportReviewSerializer

    def get_queryset(self):
        filters = ReviewQueueFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return selectors.story_review_queue(**filters.validated_data)


class StoryReportDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(responses=StoryReportReviewSerializer, tags=["moderation"])
    def get(self, request, report_id):
        return Response(StoryReportReviewSerializer(selectors.get_story_report(report_id)).data)


class StoryReviewActionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        request=StoryReviewActionCreateSerializer,
        responses=StoryReportReviewSerializer,
        tags=["moderation"],
    )
    def post(self, request, report_id):
        """Hides or removes the reported story, or dismisses the report."""
        serializer = StoryReviewActionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.review_story_report(
            admin=request.user, report_id=report_id, **serializer.validated_data
        )
        return Response(StoryReportReviewSerializer(selectors.get_story_report(report_id)).data)


class ProposePracticeStatusView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "status_proposal"

    @extend_schema(
        request=StatusProposalCreateSerializer,
        responses={
            201: StatusProposalSerializer,
            400: error_response("A field is invalid", examples.proposal_errors["no_source"]),
            401: error_response("Not signed in", NOT_SIGNED_IN),
            403: error_response(
                "The email is not verified", examples.proposal_errors["unverified"]
            ),
            404: error_response("No craft the user may see", CRAFT_NOT_FOUND),
            409: error_response(
                "The user's earlier proposal for this craft is still open",
                examples.proposal_errors["twice"],
            ),
        },
        examples=examples.propose,
        tags=["moderation"],
    )
    def post(self, request, craft_id):
        """
        Proposes whether the craft is still practiced, with the source it is based on. Admins
        review the proposal; a user has one open proposal per craft.
        """
        serializer = StatusProposalCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = services.propose_practice_status(
            proposer=request.user, craft_id=craft_id, **serializer.validated_data
        )
        return Response(StatusProposalSerializer(proposal).data, status=status.HTTP_201_CREATED)


class SetPracticeStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        request=PracticeStatusSetSerializer,
        responses={200: CraftDetailSerializer},
        tags=["moderation"],
    )
    def post(self, request, craft_id):
        """Sets whether the craft is still practiced, with a source and the reason. Admins only."""
        serializer = PracticeStatusSetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        craft = get_visible_craft(craft_id, request.user)
        craft_services.set_practice_status(
            craft=craft, actor=request.user, **serializer.validated_data
        )
        craft = get_visible_craft(craft_id, request.user)
        return Response(CraftDetailSerializer(craft, context={"request": request}).data)


@extend_schema(
    tags=["moderation"],
    parameters=[
        OpenApiParameter(
            "status",
            OpenApiTypes.STR,
            enum=["open", "approved", "rejected", "all"],
            description="Defaults to all, open proposals first",
        )
    ],
)
class StatusProposalQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = StatusProposalReviewSerializer

    def get_queryset(self):
        filters = StatusProposalQueueFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return selectors.status_proposal_queue(**filters.validated_data)


class StatusProposalDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(responses=StatusProposalReviewSerializer, tags=["moderation"])
    def get(self, request, proposal_id):
        proposal = selectors.get_status_proposal(proposal_id)
        return Response(StatusProposalReviewSerializer(proposal).data)


class StatusProposalActionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        request=StatusProposalActionSerializer,
        responses={
            200: StatusProposalReviewSerializer,
            403: error_response("The user is not an admin", examples.review_errors["not_admin"]),
            409: error_response(
                "The proposal was already reviewed", examples.proposal_errors["reviewed"]
            ),
        },
        examples=examples.review_proposal,
        tags=["moderation"],
    )
    def post(self, request, proposal_id):
        """
        Approves the proposal, which sets the craft's practice status and source and notifies
        the users who favorited the craft, or rejects it. The proposer is notified either way.
        """
        serializer = StatusProposalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.review_status_proposal(
            admin=request.user, proposal_id=proposal_id, **serializer.validated_data
        )
        proposal = selectors.get_status_proposal(proposal_id)
        return Response(StatusProposalReviewSerializer(proposal).data)
