import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from crafts.models import Craft, CraftMedia
from tests.factories import CraftFactory, UserFactory
from tests.utils import make_image

pytestmark = pytest.mark.django_db

PDF_BYTES = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"


def media_url(craft):
    return f"/api/v1/crafts/{craft.id}/media/"


def photo(**overrides):
    return {"media_type": "photo", "file": make_image(), "alt_text": "Blue tile", **overrides}


def pdf(name="source.pdf", content=PDF_BYTES):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@pytest.fixture
def craft():
    return CraftFactory()


@pytest.fixture
def author_client(client_for, craft):
    return client_for(craft.author)


def test_author_uploads_photo_shown_on_craft(author_client, api_client, craft):
    response = author_client.post(media_url(craft), photo(caption="Front"), format="multipart")

    data = response.json()["data"]
    assert response.status_code == 201
    assert data["media_type"] == "photo"
    assert data["file"].startswith(f"http://testserver/media/crafts/{craft.id}/")
    assert data["alt_text"] == "Blue tile"
    detail = api_client.get(f"/api/v1/crafts/{craft.id}/").json()["data"]
    assert [item["id"] for item in detail["media"]] == [data["id"]]


def test_first_photo_is_the_cover_in_lists(author_client, api_client, craft):
    author_client.post(media_url(craft), photo(order=1, alt_text="Second"), format="multipart")
    author_client.post(media_url(craft), photo(order=0, alt_text="First"), format="multipart")

    item = api_client.get("/api/v1/crafts/").json()["data"]["items"][0]

    assert item["cover_photo"]["alt_text"] == "First"
    assert item["cover_photo"]["url"].startswith("http://testserver/media/")


def test_craft_without_photos_has_no_cover(api_client, craft):
    item = api_client.get("/api/v1/crafts/").json()["data"]["items"][0]

    assert item["cover_photo"] is None


def test_photo_requires_alt_text(author_client, craft):
    response = author_client.post(media_url(craft), photo(alt_text=" "), format="multipart")

    assert response.status_code == 400
    assert "alt_text" in response.json()["errors"]


@pytest.mark.parametrize(
    "upload",
    [
        SimpleUploadedFile("fake.png", b"not an image", content_type="image/png"),
        make_image("anim.gif", image_format="GIF"),
    ],
)
def test_photo_must_be_an_allowed_image(author_client, craft, upload):
    response = author_client.post(media_url(craft), photo(file=upload), format="multipart")

    assert response.status_code == 400
    assert "file" in response.json()["errors"]


def test_photo_size_is_limited(author_client, craft, monkeypatch):
    monkeypatch.setattr("crafts.serializers.PHOTO_MAX_BYTES", 10)

    response = author_client.post(media_url(craft), photo(), format="multipart")

    assert response.status_code == 400
    assert "file" in response.json()["errors"]


def test_author_uploads_pdf_document(author_client, craft):
    response = author_client.post(
        media_url(craft), {"media_type": "document", "file": pdf()}, format="multipart"
    )

    assert response.status_code == 201
    assert response.json()["data"]["file"].endswith(".pdf")


@pytest.mark.parametrize(
    "upload", [pdf(name="notes.txt"), pdf(content=b"plain text pretending to be a pdf")]
)
def test_document_must_be_a_pdf(author_client, craft, upload):
    response = author_client.post(
        media_url(craft), {"media_type": "document", "file": upload}, format="multipart"
    )

    assert response.status_code == 400
    assert "file" in response.json()["errors"]


def test_document_size_is_limited(author_client, craft, monkeypatch):
    monkeypatch.setattr("crafts.serializers.DOCUMENT_MAX_BYTES", 10)

    response = author_client.post(
        media_url(craft), {"media_type": "document", "file": pdf()}, format="multipart"
    )

    assert response.status_code == 400


def test_video_is_stored_as_link(author_client, craft):
    response = author_client.post(
        media_url(craft),
        {"media_type": "video", "url": "https://www.youtube.com/watch?v=abc123"},
        format="json",
    )

    data = response.json()["data"]
    assert response.status_code == 201
    assert data["url"] == "https://www.youtube.com/watch?v=abc123"
    assert data["file"] is None


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"media_type": "video"}, "url"),
        ({"media_type": "video", "url": "ftp://example.com/video"}, "url"),
        ({"media_type": "photo", "url": "https://example.com/a.png"}, "url"),
        ({"media_type": "photo"}, "file"),
        ({"media_type": "audio", "url": "https://example.com/a.mp3"}, "media_type"),
    ],
)
def test_invalid_media_payloads(author_client, craft, payload, field):
    response = author_client.post(media_url(craft), payload, format="json")

    assert response.status_code == 400
    assert field in response.json()["errors"]


def test_only_the_author_adds_media(client_for, api_client, admin_user, craft):
    stranger = UserFactory()

    assert api_client.post(media_url(craft), photo(), format="multipart").status_code == 401
    assert (
        client_for(stranger).post(media_url(craft), photo(), format="multipart").status_code == 403
    )
    assert (
        client_for(admin_user).post(media_url(craft), photo(), format="multipart").status_code
        == 403
    )


def test_media_on_hidden_craft_is_not_found_for_others(client_for):
    hidden = CraftFactory(status=Craft.Status.HIDDEN)

    response = client_for(UserFactory()).post(media_url(hidden), photo(), format="multipart")

    assert response.status_code == 404


def test_media_count_is_limited(author_client, craft, monkeypatch):
    monkeypatch.setattr("crafts.services.MAX_MEDIA_PER_CRAFT", 1)
    author_client.post(media_url(craft), photo(), format="multipart")

    response = author_client.post(media_url(craft), photo(), format="multipart")

    assert response.status_code == 400


def test_author_and_admin_remove_media(author_client, client_for, admin_user, craft):
    first = author_client.post(media_url(craft), photo(), format="multipart").json()["data"]
    second = author_client.post(media_url(craft), photo(), format="multipart").json()["data"]

    by_author = author_client.delete(f"{media_url(craft)}{first['id']}/")
    by_admin = client_for(admin_user).delete(f"{media_url(craft)}{second['id']}/")

    assert by_author.status_code == by_admin.status_code == 204
    assert not CraftMedia.objects.filter(craft=craft).exists()
    assert CraftMedia.all_objects.filter(craft=craft, is_deleted=True).count() == 2


def test_other_user_cannot_remove_media(author_client, client_for, craft):
    media = author_client.post(media_url(craft), photo(), format="multipart").json()["data"]

    response = client_for(UserFactory()).delete(f"{media_url(craft)}{media['id']}/")

    assert response.status_code == 403
    assert CraftMedia.objects.filter(pk=media["id"]).exists()


def test_deleting_craft_soft_deletes_its_media(author_client, craft):
    author_client.post(media_url(craft), photo(), format="multipart")

    author_client.delete(f"/api/v1/crafts/{craft.id}/")

    assert CraftMedia.all_objects.get(craft=craft).is_deleted is True
