import re

import pytest
from django.core import mail

from accounts.models import User
from accounts.tokens import email_verification_token, encode_uid
from tests.factories import DEFAULT_PASSWORD

pytestmark = pytest.mark.django_db

REGISTER_URL = "/api/v1/auth/register/"
VERIFY_URL = "/api/v1/auth/verify-email/"
RESEND_URL = "/api/v1/auth/verify-email/resend/"


def register(client, **overrides):
    payload = {"email": "Ayse@Example.com", "password": DEFAULT_PASSWORD, **overrides}
    return client.post(REGISTER_URL, payload, format="json")


def link_params(message):
    match = re.search(r"/verify-email\?uid=([\w-]+)&token=([\w-]+)", message.body)
    return {"uid": match.group(1), "token": match.group(2)}


def test_register_creates_unverified_user_with_profile(
    api_client, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        response = register(api_client, display_name="Ayşe")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "ayse@example.com"
    assert data["is_email_verified"] is False
    user = User.objects.get(email="ayse@example.com")
    assert user.profile.display_name == "Ayşe"
    assert user.role == User.Role.USER
    assert user.check_password(DEFAULT_PASSWORD)


def test_register_sends_verification_email_after_commit(
    api_client, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        register(api_client)

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["ayse@example.com"]
    assert "http://localhost:5173/verify-email?uid=" in mail.outbox[0].body


def test_default_display_name_comes_from_email(api_client):
    register(api_client)

    assert User.objects.get(email="ayse@example.com").profile.display_name == "ayse"


def test_failed_email_does_not_fail_registration(
    api_client, django_capture_on_commit_callbacks, monkeypatch, caplog
):
    def broken_send(*args, **kwargs):
        raise ConnectionRefusedError("SMTP down")

    monkeypatch.setattr("accounts.services.send_mail", broken_send)
    with django_capture_on_commit_callbacks(execute=True):
        response = register(api_client)

    assert response.status_code == 201
    assert User.objects.filter(email="ayse@example.com").exists()
    assert "Could not send verification email" in caplog.text


def test_duplicate_email_is_rejected_case_insensitively(api_client, user):
    response = register(api_client, email=user.email.upper())

    assert response.status_code == 409
    assert "email" in response.json()["errors"]


@pytest.mark.parametrize("password", ["short", "password123", "12345678901"])
def test_weak_password_is_rejected(api_client, password):
    response = register(api_client, password=password)

    assert response.status_code == 400
    assert "password" in response.json()["errors"]
    assert not User.objects.filter(email="ayse@example.com").exists()


def test_invalid_email_is_rejected(api_client):
    response = register(api_client, email="not-an-email")

    assert response.status_code == 400
    assert "email" in response.json()["errors"]


def test_verify_email_from_link(api_client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        register(api_client)

    response = api_client.post(VERIFY_URL, link_params(mail.outbox[0]), format="json")

    assert response.status_code == 200
    assert response.json()["data"]["is_email_verified"] is True
    assert User.objects.get(email="ayse@example.com").is_email_verified


def test_verify_email_twice_is_harmless(api_client, unverified_user):
    params = {
        "uid": encode_uid(unverified_user),
        "token": email_verification_token.make_token(unverified_user),
    }
    api_client.post(VERIFY_URL, params, format="json")

    response = api_client.post(VERIFY_URL, params, format="json")

    assert response.status_code == 200


@pytest.mark.parametrize(
    "params",
    [
        {"uid": "bad", "token": "bad"},
        {"uid": "MQ", "token": "1-abc"},
    ],
)
def test_invalid_verification_link_is_rejected(api_client, unverified_user, params):
    response = api_client.post(VERIFY_URL, params, format="json")

    assert response.status_code == 400
    unverified_user.refresh_from_db()
    assert unverified_user.is_email_verified is False


def test_token_for_another_user_is_rejected(api_client, unverified_user):
    from tests.factories import UserFactory

    other = UserFactory(is_email_verified=False)
    params = {
        "uid": encode_uid(unverified_user),
        "token": email_verification_token.make_token(other),
    }

    response = api_client.post(VERIFY_URL, params, format="json")

    assert response.status_code == 400


def test_resend_sends_new_email_to_unverified_user(api_client, unverified_user):
    response = api_client.post(RESEND_URL, {"email": unverified_user.email}, format="json")

    assert response.status_code == 200
    assert len(mail.outbox) == 1


@pytest.mark.parametrize("email", ["nobody@example.com", None])
def test_resend_response_does_not_reveal_accounts(api_client, user, unverified_user, email):
    unknown = api_client.post(RESEND_URL, {"email": email or user.email}, format="json")
    known = api_client.post(RESEND_URL, {"email": unverified_user.email}, format="json")

    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()
    assert len(mail.outbox) == 1


def test_registration_is_rate_limited(api_client):
    codes = [register(api_client, email=f"person{i}@example.com").status_code for i in range(6)]

    assert codes[:5] == [201] * 5
    assert codes[5] == 429


def test_auto_verify_skips_the_verification_email(
    api_client, settings, django_capture_on_commit_callbacks
):
    settings.AUTO_VERIFY_EMAIL = True

    with django_capture_on_commit_callbacks(execute=True):
        response = register(api_client)

    assert response.status_code == 201
    assert response.json()["data"]["is_email_verified"] is True
    assert User.objects.get(email="ayse@example.com").is_email_verified is True
    assert mail.outbox == []


def test_auto_verified_users_can_publish_right_away(api_client, settings):
    from tests.payloads import craft_payload

    settings.AUTO_VERIFY_EMAIL = True
    register(api_client)
    tokens = api_client.post(
        "/api/v1/auth/token/",
        {"email": "ayse@example.com", "password": DEFAULT_PASSWORD},
        format="json",
    ).json()["data"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    response = api_client.post("/api/v1/crafts/", craft_payload(), format="json")

    assert response.status_code == 201
