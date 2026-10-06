import re

import pytest
from django.core import mail
from rest_framework_simplejwt.tokens import AccessToken

from tests.factories import DEFAULT_PASSWORD, UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.urls("tests.auth_urls")]

LOGIN_URL = "/api/v1/auth/token/"
REFRESH_URL = "/api/v1/auth/token/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
RESET_URL = "/api/v1/auth/password-reset/"
RESET_CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"
NEW_PASSWORD = "An0ther-Str0ng-Pass!"


def login(client, email, password=DEFAULT_PASSWORD):
    return client.post(LOGIN_URL, {"email": email, "password": password}, format="json")


def tokens_for(client, user):
    return login(client, user.email).json()["data"]


def whoami(client, access):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = client.get("/whoami/")
    client.credentials()
    return response


def reset_params(message):
    match = re.search(r"/password-reset\?uid=([\w-]+)&token=([\w-]+)", message.body)
    return {"uid": match.group(1), "token": match.group(2)}


def test_login_returns_tokens_with_role_claim(api_client, user):
    response = login(api_client, user.email)

    assert response.status_code == 200
    data = response.json()["data"]
    claims = AccessToken(data["access"])
    assert claims["user_id"] == str(user.id)
    assert claims["role"] == "user"
    assert data["refresh"]


def test_admin_role_is_in_token(api_client, admin_user):
    claims = AccessToken(tokens_for(api_client, admin_user)["access"])

    assert claims["role"] == "admin"


def test_login_email_is_case_insensitive(api_client, user):
    assert login(api_client, user.email.upper()).status_code == 200


def test_unverified_user_can_log_in(api_client, unverified_user):
    assert login(api_client, unverified_user.email).status_code == 200


def test_wrong_password_is_rejected(api_client, user):
    response = login(api_client, user.email, "wrong-password")

    assert response.status_code == 401
    assert response.json()["success"] is False


def test_inactive_user_cannot_log_in(api_client):
    inactive = UserFactory(is_active=False)

    assert login(api_client, inactive.email).status_code == 401


def test_access_token_authenticates_requests(api_client, user):
    response = whoami(api_client, tokens_for(api_client, user)["access"])

    assert response.status_code == 200
    assert response.json()["data"]["id"] == user.id


def test_missing_or_bad_token_is_rejected(api_client):
    assert api_client.get("/whoami/").status_code == 401
    assert whoami(api_client, "not-a-token").status_code == 401


def test_refresh_rotates_and_blacklists_the_old_token(api_client, user):
    old_refresh = tokens_for(api_client, user)["refresh"]

    first = api_client.post(REFRESH_URL, {"refresh": old_refresh}, format="json")
    reuse = api_client.post(REFRESH_URL, {"refresh": old_refresh}, format="json")

    assert first.status_code == 200
    assert first.json()["data"]["refresh"] != old_refresh
    assert reuse.status_code == 401


def test_rotated_refresh_token_keeps_working(api_client, user):
    refresh = tokens_for(api_client, user)["refresh"]
    for _ in range(3):
        response = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")
        assert response.status_code == 200
        refresh = response.json()["data"]["refresh"]


def test_deactivated_user_cannot_refresh(api_client, user):
    refresh = tokens_for(api_client, user)["refresh"]
    user.is_active = False
    user.save()

    response = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")

    assert response.status_code == 401


def test_logout_blacklists_the_refresh_token(api_client, user):
    refresh = tokens_for(api_client, user)["refresh"]

    logout = api_client.post(LOGOUT_URL, {"refresh": refresh}, format="json")
    after = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")

    assert logout.status_code == 204
    assert after.status_code == 401


def test_logout_with_invalid_token_is_rejected(api_client):
    response = api_client.post(LOGOUT_URL, {"refresh": "garbage"}, format="json")

    assert response.status_code == 400
    assert "refresh" in response.json()["errors"]


def test_password_reset_request_sends_email(api_client, user):
    response = api_client.post(RESET_URL, {"email": user.email}, format="json")

    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert "http://localhost:5173/password-reset?uid=" in mail.outbox[0].body


def test_password_reset_request_does_not_reveal_accounts(api_client, user):
    known = api_client.post(RESET_URL, {"email": user.email}, format="json")
    unknown = api_client.post(RESET_URL, {"email": "nobody@example.com"}, format="json")

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(mail.outbox) == 1


def test_password_reset_changes_password_and_ends_sessions(api_client, user):
    old_tokens = tokens_for(api_client, user)
    api_client.post(RESET_URL, {"email": user.email}, format="json")

    response = api_client.post(
        RESET_CONFIRM_URL,
        {**reset_params(mail.outbox[0]), "new_password": NEW_PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert login(api_client, user.email, NEW_PASSWORD).status_code == 200
    assert login(api_client, user.email).status_code == 401
    old_refresh = api_client.post(REFRESH_URL, {"refresh": old_tokens["refresh"]}, format="json")
    assert old_refresh.status_code == 401
    assert whoami(api_client, old_tokens["access"]).status_code == 401


def test_password_reset_link_works_only_once(api_client, user):
    api_client.post(RESET_URL, {"email": user.email}, format="json")
    params = {**reset_params(mail.outbox[0]), "new_password": NEW_PASSWORD}

    api_client.post(RESET_CONFIRM_URL, params, format="json")
    second = api_client.post(
        RESET_CONFIRM_URL, {**params, "new_password": "Yet-An0ther-Pass!"}, format="json"
    )

    assert second.status_code == 400


def test_password_reset_rejects_weak_password(api_client, user):
    api_client.post(RESET_URL, {"email": user.email}, format="json")

    response = api_client.post(
        RESET_CONFIRM_URL, {**reset_params(mail.outbox[0]), "new_password": "123"}, format="json"
    )

    assert response.status_code == 400
    assert "new_password" in response.json()["errors"]
    user.refresh_from_db()
    assert user.check_password(DEFAULT_PASSWORD)


def test_password_reset_rejects_bad_token(api_client, user):
    response = api_client.post(
        RESET_CONFIRM_URL,
        {"uid": "MQ", "token": "abc-def", "new_password": NEW_PASSWORD},
        format="json",
    )

    assert response.status_code == 400


def test_login_is_rate_limited(api_client, user):
    codes = [login(api_client, user.email, "wrong").status_code for _ in range(11)]

    assert codes[:10] == [401] * 10
    assert codes[10] == 429
