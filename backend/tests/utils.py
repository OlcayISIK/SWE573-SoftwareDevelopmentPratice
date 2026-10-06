from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

CONTENT_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp", "GIF": "image/gif"}


def make_image(name="photo.png", image_format="PNG", size=(20, 20)):
    buffer = BytesIO()
    Image.new("RGB", size, color=(180, 60, 40)).save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=CONTENT_TYPES[image_format])
