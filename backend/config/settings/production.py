from .base import *  # noqa: F403
from .base import env

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
SIMPLE_JWT = {**SIMPLE_JWT, "SIGNING_KEY": env("JWT_SIGNING_KEY")}  # noqa: F405

# The host has no persistent disk, so uploads are kept in the database unless set otherwise.
MEDIA_STORAGE = env("MEDIA_STORAGE", default="database")
STORAGES = {
    "default": {"BACKEND": MEDIA_BACKENDS[MEDIA_STORAGE]},  # noqa: F405
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = env.bool("DJANGO_SECURE_COOKIES", default=True)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# Production logs go to a log service, which reads one JSON object per line.
LOGGING["handlers"]["console"]["formatter"] = env("LOG_FORMAT", default="json")  # noqa: F405
