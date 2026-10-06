from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.validators import MB, validate_image_upload

from .models import User

AVATAR_MAX_BYTES = 2 * MB


def validate_avatar(file):
    validate_image_upload(file, AVATAR_MAX_BYTES)


class OwnProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="profile.display_name")
    bio = serializers.CharField(source="profile.bio")
    city = serializers.CharField(source="profile.city")
    country = serializers.CharField(source="profile.country")
    avatar = serializers.ImageField(source="profile.avatar")
    show_email = serializers.BooleanField(source="profile.show_email")

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "is_email_verified",
            "display_name",
            "bio",
            "city",
            "country",
            "avatar",
            "show_email",
            "date_joined",
        ]
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=80, required=False)
    bio = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, allow_blank=True)
    avatar = serializers.ImageField(required=False, allow_null=True, validators=[validate_avatar])
    show_email = serializers.BooleanField(required=False)


class PublicProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="profile.display_name", read_only=True)
    bio = serializers.CharField(source="profile.bio", read_only=True)
    city = serializers.CharField(source="profile.city", read_only=True)
    country = serializers.CharField(source="profile.country", read_only=True)
    avatar = serializers.ImageField(source="profile.avatar", read_only=True)
    email = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "display_name", "bio", "city", "country", "avatar", "email", "date_joined"]

    def get_email(self, user) -> str | None:
        return user.email if user.profile.show_email else None


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
