"""Example requests and responses for logging in and reading a public profile.

tests/test_api_examples.py sends every request example to the API and checks the response
against the documented one.
"""

from drf_spectacular.utils import OpenApiExample

from core.schema import error_example

LOGIN_REQUEST = {"email": "ayse@example.com", "password": "tulip-kiln-cobalt-1575"}
TOKENS = {
    "refresh": (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsInVzZXJfaWQiOjd9.c2lnbmF0dXJl"
    ),
    "access": (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwidXNlcl9pZCI6Nywicm9sZSI6InVzZXIifQ.c2lnbmF0dXJl"
    ),
}

# From the live API: GET /api/v1/users/1/.
PROFILE = {
    "id": 1,
    "display_name": "Sample Contributor (Anatolia)",
    "bio": "",
    "city": "Kütahya",
    "country": "Türkiye",
    "avatar": None,
    "email": None,
    "date_joined": "2026-10-24T20:40:06.133714Z",
}

login = [
    OpenApiExample(
        "Log in",
        summary="Email and password",
        value=LOGIN_REQUEST,
        request_only=True,
    ),
    OpenApiExample(
        "Tokens",
        summary="A 15-minute access token and a 7-day refresh token",
        description=(
            "Send the access token as `Authorization: Bearer <access>`. Exchange the refresh "
            "token at `/auth/token/refresh/`; each refresh token works once."
        ),
        value=TOKENS,
        response_only=True,
    ),
]
login_errors = {
    "wrong": error_example(
        "Wrong email or password", "No active account found with the given credentials"
    ),
}
profile = [
    OpenApiExample(
        "A public profile",
        summary="GET /api/v1/users/1/",
        description="`email` is `null` unless the user chose to show it.",
        value=PROFILE,
        response_only=True,
    )
]
profile_errors = {
    "unavailable": error_example("Unknown or deactivated user", "This profile is unavailable."),
}
