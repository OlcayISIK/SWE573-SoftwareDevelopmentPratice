import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import ConflictError, ValidationError

from . import selectors
from .models import User, normalize_email
from .tokens import email_verification_token, encode_uid

logger = logging.getLogger(__name__)

DUPLICATE_EMAIL = "An account with this email already exists."
INVALID_VERIFICATION_LINK = "This verification link is invalid or has expired."
INVALID_RESET_LINK = "This password reset link is invalid or has expired."
INVALID_REFRESH_TOKEN = "The refresh token is invalid or has already been used."


def _check_password_strength(password, user, field="password"):
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError(errors={field: list(exc.messages)}) from exc


def send_verification_email(user):
    link = (
        f"{settings.FRONTEND_URL}/verify-email"
        f"?uid={encode_uid(user)}&token={email_verification_token.make_token(user)}"
    )
    try:
        send_mail(
            subject="Verify your Indigenous Crafts account",
            message=(
                "Welcome to Indigenous Crafts!\n\n"
                f"Confirm your email address by opening this link:\n{link}\n\n"
                "If you did not create an account, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except Exception:
        logger.exception("Could not send verification email to user %s", user.pk)
        return False
    return True


def register_user(*, email, password, display_name=""):
    email = normalize_email(email)
    if User.objects.filter(email=email).exists():
        raise ConflictError(DUPLICATE_EMAIL, errors={"email": [DUPLICATE_EMAIL]})
    _check_password_strength(password, User(email=email))

    auto_verify = settings.AUTO_VERIFY_EMAIL
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email, password=password, is_email_verified=auto_verify
            )
            if display_name:
                user.profile.display_name = display_name
                user.profile.save(update_fields=["display_name", "updated_at"])
            if not auto_verify:
                transaction.on_commit(lambda: send_verification_email(user))
    except IntegrityError as exc:
        raise ConflictError(DUPLICATE_EMAIL, errors={"email": [DUPLICATE_EMAIL]}) from exc
    return user


def verify_email(*, uid, token):
    user = selectors.get_active_user_by_uid(uid)
    if user is None:
        raise ValidationError(INVALID_VERIFICATION_LINK)
    if user.is_email_verified:
        return user
    if not email_verification_token.check_token(user, token):
        raise ValidationError(INVALID_VERIFICATION_LINK)
    user.is_email_verified = True
    user.save(update_fields=["is_email_verified", "updated_at"])
    return user


def resend_verification_email(*, email):
    user = selectors.get_active_user_by_email(email)
    if user is not None and not user.is_email_verified:
        send_verification_email(user)


PROFILE_FIELDS = {"display_name", "bio", "city", "country", "avatar", "show_email"}


def update_profile(*, user, **changes):
    unknown = set(changes) - PROFILE_FIELDS
    if unknown:
        raise ValidationError(
            errors={field: ["This field cannot be changed."] for field in unknown}
        )

    profile = user.profile
    for field, value in changes.items():
        setattr(profile, field, value if value is not None else "")
    profile.save()
    return user


def logout(*, refresh):
    try:
        RefreshToken(refresh).blacklist()
    except TokenError as exc:
        raise ValidationError(
            INVALID_REFRESH_TOKEN, errors={"refresh": [INVALID_REFRESH_TOKEN]}
        ) from exc


def revoke_all_sessions(user):
    active_tokens = OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True)
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in active_tokens], ignore_conflicts=True
    )


def send_password_reset_email(user):
    link = (
        f"{settings.FRONTEND_URL}/password-reset"
        f"?uid={encode_uid(user)}&token={default_token_generator.make_token(user)}"
    )
    try:
        send_mail(
            subject="Reset your Indigenous Crafts password",
            message=(
                "We received a request to reset your password.\n\n"
                f"Choose a new password by opening this link:\n{link}\n\n"
                "If you did not ask for this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except Exception:
        logger.exception("Could not send password reset email to user %s", user.pk)


def request_password_reset(*, email):
    user = selectors.get_active_user_by_email(email)
    if user is not None and user.has_usable_password():
        send_password_reset_email(user)


def reset_password(*, uid, token, new_password):
    user = selectors.get_active_user_by_uid(uid)
    if user is None or not default_token_generator.check_token(user, token):
        raise ValidationError(INVALID_RESET_LINK)
    _check_password_strength(new_password, user, field="new_password")

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        revoke_all_sessions(user)
    return user
