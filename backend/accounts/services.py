import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction

from core.exceptions import ConflictError, ValidationError

from . import selectors
from .models import User, normalize_email
from .tokens import email_verification_token, encode_uid

logger = logging.getLogger(__name__)

DUPLICATE_EMAIL = "An account with this email already exists."
INVALID_VERIFICATION_LINK = "This verification link is invalid or has expired."


def _check_password_strength(password, user):
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError(errors={"password": list(exc.messages)}) from exc


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

    try:
        with transaction.atomic():
            user = User.objects.create_user(email=email, password=password)
            if display_name:
                user.profile.display_name = display_name
                user.profile.save(update_fields=["display_name", "updated_at"])
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
