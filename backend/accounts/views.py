from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import services
from .serializers import (
    AccountSerializer,
    DetailSerializer,
    EmailSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    RefreshTokenSerializer,
    RegisterSerializer,
    VerifyEmailSerializer,
)

RESEND_MESSAGE = (
    "If the account exists and is not verified yet, a new verification email has been sent."
)
RESET_REQUEST_MESSAGE = "If the account exists, a password reset email has been sent."
RESET_DONE_MESSAGE = "Your password has been reset. Please log in with your new password."


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


@extend_schema(tags=["auth"])
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_scope = "login"


@extend_schema(tags=["auth"])
class RefreshView(TokenRefreshView):
    throttle_scope = "token_refresh"


class LogoutView(APIView):
    @extend_schema(request=RefreshTokenSerializer, responses={204: None}, tags=["auth"])
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.logout(**serializer.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    throttle_scope = "password_reset"

    @extend_schema(request=EmailSerializer, responses=DetailSerializer, tags=["auth"])
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(**serializer.validated_data)
        return Response({"detail": RESET_REQUEST_MESSAGE})


class PasswordResetConfirmView(APIView):
    throttle_scope = "password_reset"

    @extend_schema(
        request=PasswordResetConfirmSerializer, responses=DetailSerializer, tags=["auth"]
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reset_password(**serializer.validated_data)
        return Response({"detail": RESET_DONE_MESSAGE})
