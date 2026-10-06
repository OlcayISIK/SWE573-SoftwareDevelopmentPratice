from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        return token


class RefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True)


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "is_email_verified"]


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()
