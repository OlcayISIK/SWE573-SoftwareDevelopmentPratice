"""
Keeps uploaded files, such as craft photos and avatars, in the database.

Free hosting such as Render's has no persistent disk: files saved to the server's disk are gone
after every redeploy and whenever the service sleeps and wakes up, while the database is kept.
The files are served by core.views.StoredFileView at MEDIA_URL.
"""

import mimetypes
from urllib.parse import urljoin

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible
from django.utils.encoding import filepath_to_uri

from .models import StoredFile


def _clean(name):
    """Names use forward slashes, like URLs, whatever the operating system."""
    return name.replace("\\", "/")


@deconstructible
class DatabaseStorage(Storage):
    def get_available_name(self, name, max_length=None):
        return _clean(super().get_available_name(_clean(name), max_length=max_length))

    def _open(self, name, mode="rb"):
        stored = StoredFile.objects.filter(name=name).only("content").first()
        if stored is None:
            raise FileNotFoundError(name)
        file = ContentFile(bytes(stored.content), name=name)
        return file

    def _save(self, name, content):
        content.seek(0)
        data = content.read()
        name = _clean(name)
        StoredFile.objects.update_or_create(
            name=name, defaults={"content": data, "size": len(data)}
        )
        return name

    def exists(self, name):
        return StoredFile.objects.filter(name=name).exists()

    def delete(self, name):
        StoredFile.objects.filter(name=name).delete()

    def size(self, name):
        size = StoredFile.objects.filter(name=name).values_list("size", flat=True).first()
        if size is None:
            raise FileNotFoundError(name)
        return size

    def url(self, name):
        return urljoin(settings.MEDIA_URL, filepath_to_uri(name))

    def listdir(self, path):
        prefix = f"{path.rstrip('/')}/" if path else ""
        names = StoredFile.objects.filter(name__startswith=prefix).values_list("name", flat=True)
        directories, files = set(), []
        for name in names:
            rest = name[len(prefix) :]
            if "/" in rest:
                directories.add(rest.split("/", 1)[0])
            else:
                files.append(rest)
        return sorted(directories), sorted(files)

    def get_created_time(self, name):
        stored = StoredFile.objects.filter(name=name).only("created_at").first()
        if stored is None:
            raise FileNotFoundError(name)
        return stored.created_at

    get_modified_time = get_created_time


def content_type(name):
    return mimetypes.guess_type(name)[0] or "application/octet-stream"
