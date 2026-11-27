"""Uploaded files kept in the database, for hosting where files on the server's disk do not last."""

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import Http404
from django.test import RequestFactory, override_settings

from core.models import StoredFile
from core.storage import DatabaseStorage
from core.views import StoredFileView
from crafts import samples
from crafts.models import CraftMedia
from tests.factories import CraftFactory
from tests.utils import make_image

pytestmark = pytest.mark.django_db

IN_THE_DATABASE = override_settings(
    STORAGES={
        "default": {"BACKEND": "core.storage.DatabaseStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
)


def serve(path):
    request = RequestFactory().get(f"/media/{path}")
    return StoredFileView.as_view()(request, path=path)


def test_files_are_saved_read_and_deleted():
    storage = DatabaseStorage()

    name = storage.save("crafts/1/tile.png", ContentFile(b"png bytes"))
    again = storage.save("crafts/1/tile.png", ContentFile(b"other bytes"))

    assert name == "crafts/1/tile.png"
    # A taken name gets a new one, so a file is never replaced by another.
    assert again != name
    assert storage.exists(name)
    assert storage.size(name) == len(b"png bytes")
    with storage.open(name) as file:
        assert file.read() == b"png bytes"
    assert storage.url(name) == "/media/crafts/1/tile.png"
    assert storage.listdir("crafts") == (["1"], [])
    storage.delete(name)
    assert not storage.exists(name)
    with pytest.raises(FileNotFoundError):
        storage.open(name)


def test_files_are_served_with_their_type_and_cached():
    DatabaseStorage().save("avatars/ayse.png", ContentFile(b"png bytes"))

    response = serve("avatars/ayse.png")

    assert response.status_code == 200
    assert response.content == b"png bytes"
    assert response["Content-Type"] == "image/png"
    assert "immutable" in response["Cache-Control"]
    assert response["X-Content-Type-Options"] == "nosniff"
    with pytest.raises(Http404):
        serve("avatars/nobody.png")


@IN_THE_DATABASE
def test_an_uploaded_photo_is_kept_in_the_database(client_for):
    craft = CraftFactory()
    image = make_image()
    image_bytes = image.read()
    image.seek(0)

    response = client_for(craft.author).post(
        f"/api/v1/crafts/{craft.pk}/media/",
        {"media_type": "photo", "file": image, "alt_text": "Blue tile"},
        format="multipart",
    )

    assert response.status_code == 201, response.json()
    url = response.json()["data"]["file"]
    assert url.startswith(f"http://testserver/media/crafts/{craft.pk}/")
    name = url.removeprefix("http://testserver/media/")
    # The file is in the database, not on the disk, so it outlasts a redeploy.
    assert StoredFile.objects.get(name=name).size == len(image_bytes)
    assert serve(name).content == image_bytes


@IN_THE_DATABASE
def test_sample_photos_missing_from_storage_are_put_back(settings):
    samples.load_samples()
    photo = CraftMedia.objects.filter(media_type="photo").exclude(file="").first()
    default_storage.delete(photo.file.name)

    samples.load_samples()

    assert default_storage.exists(photo.file.name)
