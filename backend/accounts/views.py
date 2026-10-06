from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import (
    AccountSerializer,
    DetailSerializer,
    EmailSerializer,
    RegisterSerializer,
    VerifyEmailSerializer,
)

RESEND_MESSAGE = (
    "If the account exists and is not verified yet, a new verification email has been sent."
)


class RegisterView(APIView):
    throttle_scope = "register"

    @extend_schema(request=RegisterSerializer, responses={201: AccountSerializer}, tags=["auth"])
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_user(**serializer.validated_data)
        return Response(AccountSerializer(user).data, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    @extend_schema(request=VerifyEmailSerializer, responses=AccountSerializer, tags=["auth"])
    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.verify_email(**serializer.validated_data)
        return Response(AccountSerializer(user).data)


class ResendVerificationView(APIView):
    throttle_scope = "verify_resend"

    @extend_schema(request=EmailSerializer, responses=DetailSerializer, tags=["auth"])
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_verification_email(**serializer.validated_data)
        return Response({"detail": RESEND_MESSAGE})
