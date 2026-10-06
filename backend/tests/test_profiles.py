import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from tests.factories import UserFactory
from tests.utils import make_image

pytestmark = pytest.mark.django_db

ME_URL = "/api/v1/me/"


def profile_url(user):
    return f"/api/v1/users/{user.id}/"


def test_me_requires_authentication(api_client):
    assert api_client.get(ME_URL).status_code == 401


def test_me_returns_own_profile_with_email(client_for, user):
    response = client_for(user).get(ME_URL)

    data = response.json()["data"]
    assert response.status_code == 200
    assert data["id"] == user.id
    assert data["email"] == user.email
    assert data["role"] == "user"
    assert data["show_email"] is False
    assert data["display_name"] == user.email.split("@")[0]


def test_update_profile_fields(client_for, user):
    response = client_for(user).patch(
        ME_URL,
        {"display_name": "Ayşe", "bio": "Ceramics lover", "city": "İstanbul", "country": "Türkiye"},
        format="json",
    )

    data = response.json()["data"]
    assert response.status_code == 200
    assert (data["display_name"], data["city"], data["country"]) == ("Ayşe", "İstanbul", "Türkiye")
    user.profile.refresh_from_db()
    assert user.profile.bio == "Ceramics lover"


def test_email_and_role_cannot_be_changed_through_profile(client_for, user):
    client_for(user).patch(ME_URL, {"email": "other@example.com", "role": "admin"}, format="json")

    user.refresh_from_db()
    assert user.email != "other@example.com"
    assert user.role == "user"


def test_display_name_cannot_be_blank(client_for, user):
    response = client_for(user).patch(ME_URL, {"display_name": ""}, format="json")

    assert response.status_code == 400
    assert "display_name" in response.json()["errors"]


def test_public_profile_hides_email_by_default(api_client, user):
    response = api_client.get(profile_url(user))

    data = response.json()["data"]
    assert response.status_code == 200
    assert data["email"] is None
    assert set(data) == {
        "id",
        "display_name",
        "bio",
        "city",
        "country",
        "avatar",
        "email",
        "date_joined",
    }


def test_public_profile_shows_email_when_user_allows_it(api_client, client_for, user):
    client_for(user).patch(ME_URL, {"show_email": True}, format="json")

    assert api_client.get(profile_url(user)).json()["data"]["email"] == user.email


def test_public_profile_shows_only_general_location(api_client, client_for, user):
    client_for(user).patch(ME_URL, {"city": "İstanbul", "country": "Türkiye"}, format="json")

    data = api_client.get(profile_url(user)).json()["data"]
    assert (data["city"], data["country"]) == ("İstanbul", "Türkiye")


def test_deactivated_profile_is_unavailable(api_client):
    inactive = UserFactory(is_active=False)

    response = api_client.get(profile_url(inactive))

    assert response.status_code == 404
    assert response.json()["message"] == "This profile is unavailable."


def test_unknown_profile_returns_404(api_client):
    assert api_client.get("/api/v1/users/999999/").status_code == 404


def test_avatar_upload_and_removal(client_for, user):
    client = client_for(user)

    uploaded = client.patch(ME_URL, {"avatar": make_image()}, format="multipart")
    removed = client.patch(ME_URL, {"avatar": None}, format="json")

    assert uploaded.status_code == 200
    assert uploaded.json()["data"]["avatar"].startswith("http://testserver/media/avatars/")
    assert removed.json()["data"]["avatar"] is None


def test_avatar_must_be_an_allowed_image(client_for, user):
    client = client_for(user)
    not_image = SimpleUploadedFile("notes.png", b"plain text", content_type="image/png")

    bad_file = client.patch(ME_URL, {"avatar": not_image}, format="multipart")
    gif = client.patch(
        ME_URL, {"avatar": make_image("anim.gif", image_format="GIF")}, format="multipart"
    )

    assert bad_file.status_code == 400
    assert gif.status_code == 400
    assert "avatar" in gif.json()["errors"]


def test_avatar_size_is_limited(client_for, user, monkeypatch):
    monkeypatch.setattr("accounts.serializers.AVATAR_MAX_BYTES", 10)

    response = client_for(user).patch(ME_URL, {"avatar": make_image()}, format="multipart")

    assert response.status_code == 400
    assert "avatar" in response.json()["errors"]
