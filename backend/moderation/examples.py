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


# Proposing a craft's practice status and reviewing the proposal

PROPOSAL_REQUEST = {
    "practice_status": "endangered",
    "source": (
        "UNESCO List of Intangible Cultural Heritage in Need of Urgent Safeguarding: "
        "https://ich.unesco.org/en/lists"
    ),
    "note": "Only a few workshops still weave in the traditional way.",
}
PROPOSAL_CREATED = {
    "id": 4,
    "craft": 33,
    **PROPOSAL_REQUEST,
    "status": "open",
    "created_at": "2026-12-02T09:14:27.380115Z",
}
PROPOSAL_REVIEW_REQUEST = {
    "action": "approved",
    "reason": "The UNESCO list names this craft as in need of urgent safeguarding.",
}
PROPOSAL_REVIEWED = {
    "id": 4,
    "craft": {
        "id": 33,
        "name": "Shirvan kilim",
        "status": "published",
        "is_deleted": False,
        "practice_status": "endangered",
        "practice_status_source": PROPOSAL_REQUEST["source"],
    },
    "proposer": {"id": 9, "display_name": "Mehmet"},
    **PROPOSAL_REQUEST,
    "status": "approved",
    "created_at": "2026-12-02T09:14:27.380115Z",
    "reviewed_by": {"id": 2, "display_name": "Moderator"},
    "review_reason": PROPOSAL_REVIEW_REQUEST["reason"],
    "reviewed_at": "2026-12-02T10:41:03.552871Z",
}

propose = [
    OpenApiExample(
        "Propose a practice status",
        summary="Propose that a craft is endangered, with the source it is based on",
        description=(
            "`practice_status` is `living`, `endangered`, or `no_longer_practiced`. The source "
            "is required; the note is optional."
        ),
        value=PROPOSAL_REQUEST,
        request_only=True,
    ),
    OpenApiExample(
        "Open proposal", value=PROPOSAL_CREATED, response_only=True, status_codes=["201"]
    ),
]
proposal_errors = {
    "no_source": error_example(
        "No source",
        "Validation failed.",
        {"source": ["Give the source the practice status is based on."]},
        summary="A proposal needs a source",
    ),
    "unverified": error_example(
        "Email not verified", "Verify your email address before proposing a practice status."
    ),
    "twice": error_example(
        "Already proposed",
        "You have already proposed a practice status for this craft. It is under review.",
        summary="One open proposal per user per craft",
    ),
    "reviewed": error_example("Already reviewed", "This proposal has already been reviewed."),
}

review_proposal = [
    OpenApiExample(
        "Approve a proposal",
        summary="Approve a proposal, which sets the craft's practice status and source",
        description=(
            "`action` is `approved` or `rejected`. Approving notifies the users who favorited "
            "the craft; the proposer is notified either way."
        ),
        value=PROPOSAL_REVIEW_REQUEST,
        request_only=True,
    ),
    OpenApiExample(
        "Approved proposal",
        summary="The proposal, approved, with who reviewed it and why",
        value=PROPOSAL_REVIEWED,
        response_only=True,
    ),
]
