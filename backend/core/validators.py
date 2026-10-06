from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MB = 1024 * 1024


def validate_image_upload(file, max_bytes):
    if file.size > max_bytes:
        raise ValidationError(f"Images must be {max_bytes // MB} MB or smaller.")
    try:
        with Image.open(file) as image:
            image_format = image.format
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ValidationError("Upload a valid image file.") from exc
    finally:
        file.seek(0)
    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("Only JPEG, PNG, and WebP images are allowed.")
