"""Example requests and responses for reporting a craft and reviewing the report.

tests/test_api_examples.py sends every request example to the API and checks the response
against the documented one.
"""

from drf_spectacular.utils import OpenApiExample

from core.schema import error_example

REPORT_REQUEST = {
    "reason": "inaccurate",
    "note": "The photo shows an İznik tile, not one from Kütahya.",
}
REPORT_CREATED = {
    "id": 5,
    "craft": 1,
    **REPORT_REQUEST,
    "status": "open",
    "created_at": "2026-11-23T10:30:12.904417Z",
}

REVIEW_REQUEST = {
    "action": "hide",
    "reason": "The photo shows a different craft. Hidden until the author replaces it.",
}
REVIEWED = {
    "id": 5,
    "craft": {
        "id": 1,
        "name": "Kütahya Çinisi",
        "status": "hidden",
        "is_deleted": False,
        "author": {"id": 1, "display_name": "Sample Contributor (Anatolia)"},
    },
    "reporter": {"id": 9, "display_name": "Mehmet"},
    **REPORT_REQUEST,
    "status": "resolved",
    "created_at": "2026-11-23T10:30:12.904417Z",
    "actions": [
        {
            "id": 3,
            "action": "hide",
            "reason": REVIEW_REQUEST["reason"],
            "admin": {"id": 2, "display_name": "Moderator"},
            "created_at": "2026-11-23T11:02:48.117093Z",
        }
    ],
}

report_create = [
    OpenApiExample(
        "Report a craft",
        summary="Report another user's craft as inaccurate, with an optional note",
        description="`reason` is `inaccurate`, `inappropriate`, or `disrespectful`.",
        value=REPORT_REQUEST,
        request_only=True,
    ),
    OpenApiExample("Open report", value=REPORT_CREATED, response_only=True, status_codes=["201"]),
]
report_create_errors = {
    "twice": error_example(
        "Already reported",
        "You have already reported this craft. It is under review.",
        summary="One open report per user per craft",
    ),
}

review = [
    OpenApiExample(
        "Hide the craft",
        summary="Hide a reported craft, with the reason for the record",
        description=(
            "`action` is `edit` (with `changes`), `hide`, `remove`, or `dismiss`. Hiding or "
            "removing also closes the other open reports on the craft."
        ),
        value=REVIEW_REQUEST,
        request_only=True,
    ),
    OpenApiExample(
        "Reviewed report",
        summary="The report, now resolved, with its review history",
        value=REVIEWED,
        response_only=True,
    ),
]
review_errors = {
    "not_admin": error_example(
        "Not an admin", "You do not have permission to perform this action."
    ),
    "twice": error_example("Already reviewed", "This report has already been reviewed."),
}
