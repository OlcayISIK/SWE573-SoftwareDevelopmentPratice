from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import ReportCreateSerializer, ReportSerializer


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
