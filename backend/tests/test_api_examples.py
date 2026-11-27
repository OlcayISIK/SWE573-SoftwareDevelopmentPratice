"""The examples in the API documentation are real: each request example is sent to the API, and the
response must have the documented shape. Error examples must match the response exactly.

The examples are read from the published schema, so what readers see is what is tested.
"""

from pathlib import Path

import pytest
from django.conf import settings
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.renderers import OpenApiYamlRenderer

from tests.factories import AdminFactory, CraftFactory, ReportFactory, UserFactory

pytestmark = pytest.mark.django_db

CRAFTS = "/api/v1/crafts/"
LOGIN = "/api/v1/auth/token/"
CRAFT_DETAIL = "/api/v1/crafts/{id}/"
STORIES = "/api/v1/crafts/{id}/stories/"
REPORT = "/api/v1/crafts/{craft_id}/report/"
REVIEW = "/api/v1/moderation/reports/{report_id}/actions/"
PROFILE = "/api/v1/users/{user_id}/"
PROPOSE = "/api/v1/crafts/{craft_id}/practice-status/proposals/"
REVIEW_PROPOSAL = "/api/v1/moderation/status-proposals/{proposal_id}/actions/"

# Free-form JSON whose keys differ from craft to craft.
FREE_FORM = {"attributes"}


@pytest.fixture
def schema(api_client):
    response = api_client.get("/api/schema/", {"format": "json"})
    assert response.status_code == 200
    return response.json()


def request_example(schema, path, method="post"):
    examples = schema["paths"][path][method]["requestBody"]["content"]["application/json"]
    return next(iter(examples["examples"].values()))["value"]


def documented(schema, path, method, status):
    content = schema["paths"][path][method]["responses"][str(status)]["content"]
    return next(iter(content["application/json"]["examples"].values()))["value"]


def assert_same_shape(expected, actual, where="body"):
    """Same keys at every level; lists are compared by their first item; null matches anything."""
    if expected is None or actual is None:
        return
    if isinstance(expected, dict):
        assert isinstance(actual, dict), where
        assert set(actual) == set(expected), f"{where}: {sorted(set(actual) ^ set(expected))}"
        for key, value in expected.items():
            if key not in FREE_FORM:
                assert_same_shape(value, actual[key], f"{where}.{key}")
    elif isinstance(expected, list):
        assert isinstance(actual, list), where
        if expected and actual:
            assert_same_shape(expected[0], actual[0], f"{where}[0]")


def without_ids(rows):
    return [{key: value for key, value in row.items() if key != "id"} for row in rows]


DOCUMENTED = {
    (LOGIN, "post"): ["200", "401"],
    (CRAFTS, "get"): ["200", "400"],
    (CRAFTS, "post"): ["201", "400", "401", "403"],
    (CRAFT_DETAIL, "get"): ["200", "404"],
    (STORIES, "post"): ["201", "401", "403", "404", "409"],
    (REPORT, "post"): ["201", "401", "404", "409"],
    (REVIEW, "post"): ["200", "403", "409"],
    (PROFILE, "get"): ["200", "404"],
    (PROPOSE, "post"): ["201", "400", "401", "403", "404", "409"],
    (REVIEW_PROPOSAL, "post"): ["200", "403", "409"],
}


@pytest.mark.parametrize(("path", "method"), list(DOCUMENTED))
def test_main_endpoints_have_request_and_response_examples(schema, path, method):
    operation = schema["paths"][path][method]
    if method == "post":
        assert operation["requestBody"]["content"]["application/json"]["examples"]
    for status in DOCUMENTED[(path, method)]:
        assert operation["responses"][status]["content"]["application/json"]["examples"], status


def test_the_committed_schema_is_up_to_date():
    """docs/openapi.yaml is the API documentation kept in the repository; it must match the code.

    Regenerate it from backend/ with DJANGO_SETTINGS_MODULE=config.settings.test:
    python manage.py spectacular --file ../docs/openapi.yaml
    """
    schema = SchemaGenerator().get_schema(request=None, public=True)
    generated = OpenApiYamlRenderer().render(schema, renderer_context={}).decode()
    committed = (Path(settings.BASE_DIR).parent / "docs" / "openapi.yaml").read_text("utf-8")

    assert committed.replace("\r\n", "\n") == generated.replace("\r\n", "\n")


def test_examples_show_the_response_envelope(schema):
    listing = documented(schema, CRAFTS, "get", 200)
    assert listing["success"] is True
    assert listing["message"] == "OK"
    assert set(listing["data"]) == {"items", "total", "page", "pageSize", "totalPages"}
    assert len(listing["data"]["items"]) == listing["data"]["total"] == 1

    error = documented(schema, CRAFTS, "post", 400)
    assert error["success"] is False
    assert error["data"] is None


def test_the_login_example_works(api_client, schema):
    body = request_example(schema, LOGIN)
    UserFactory(email=body["email"], password=body["password"])

    response = api_client.post(LOGIN, body, format="json")

    assert response.status_code == 200
    assert_same_shape(documented(schema, LOGIN, "post", 200), response.json())
    wrong = api_client.post(LOGIN, {**body, "password": "not-the-password"}, format="json")
    assert wrong.status_code == 401
    assert wrong.json() == documented(schema, LOGIN, "post", 401)


def test_the_publish_example_publishes_the_documented_craft(api_client, client_for, schema):
    body = request_example(schema, CRAFTS)

    response = client_for(UserFactory()).post(CRAFTS, body, format="json")

    assert response.status_code == 201, response.json()
    expected = documented(schema, CRAFTS, "post", 201)
    assert_same_shape(expected, response.json())
    craft, documented_craft = response.json()["data"], expected["data"]
    # The documented lookup items, values, and main place are the ones the API returns.
    for field in (
        "name",
        "category",
        "craft_type",
        "tools",
        "materials",
        "culture",
        "address",
        "city",
        "country",
        "latitude",
        "longitude",
        "description",
        "story",
        "date",
        "colors",
        "attributes",
        "status",
    ):
        assert craft[field] == documented_craft[field], field
    assert without_ids(craft["places"]) == without_ids(documented_craft["places"])


def test_the_publish_error_examples_are_real(api_client, client_for, schema):
    body = request_example(schema, CRAFTS)
    without_places = {key: value for key, value in body.items() if key != "places"}

    invalid = client_for(UserFactory()).post(CRAFTS, without_places, format="json")
    guest = api_client.post(CRAFTS, body, format="json")
    unverified = client_for(UserFactory(is_email_verified=False)).post(CRAFTS, body, format="json")

    assert invalid.status_code == 400
    assert invalid.json() == documented(schema, CRAFTS, "post", 400)
    assert guest.status_code == 401
    assert guest.json() == documented(schema, CRAFTS, "post", 401)
    assert unverified.status_code == 403
    assert unverified.json() == documented(schema, CRAFTS, "post", 403)


def test_the_list_and_detail_examples_match_real_crafts(api_client, client_for, schema):
    created = client_for(UserFactory()).post(CRAFTS, request_example(schema, CRAFTS), format="json")
    craft_id = created.json()["data"]["id"]

    listing = api_client.get(CRAFTS, {"search": "tile"})
    detail = api_client.get(f"{CRAFTS}{craft_id}/")
    bad_filter = api_client.get(CRAFTS, {"color": "violet"})
    missing = api_client.get(f"{CRAFTS}999999/")

    assert listing.json()["data"]["total"] >= 1
    assert_same_shape(documented(schema, CRAFTS, "get", 200), listing.json())
    assert_same_shape(documented(schema, CRAFT_DETAIL, "get", 200), detail.json())
    assert bad_filter.status_code == 400
    assert bad_filter.json() == documented(schema, CRAFTS, "get", 400)
    assert missing.status_code == 404
    assert missing.json() == documented(schema, CRAFT_DETAIL, "get", 404)


def test_the_story_example_and_its_errors(api_client, client_for, schema):
    craft = CraftFactory()
    url = f"{CRAFTS}{craft.pk}/stories/"
    body = request_example(schema, STORIES)
    writer = client_for(UserFactory())

    shared = writer.post(url, body, format="json")
    again = writer.post(url, body, format="json")
    by_author = client_for(craft.author).post(url, body, format="json")
    guest = api_client.post(url, body, format="json")
    unknown = writer.post(f"{CRAFTS}999999/stories/", body, format="json")

    assert shared.status_code == 201, shared.json()
    assert_same_shape(documented(schema, STORIES, "post", 201), shared.json())
    assert shared.json()["data"]["text"] == body["text"]
    assert (again.status_code, again.json()) == (409, documented(schema, STORIES, "post", 409))
    assert (by_author.status_code, by_author.json()) == (
        403,
        documented(schema, STORIES, "post", 403),
    )
    assert (guest.status_code, guest.json()) == (401, documented(schema, STORIES, "post", 401))
    assert (unknown.status_code, unknown.json()) == (404, documented(schema, STORIES, "post", 404))


def test_the_report_example_and_its_errors(api_client, client_for, schema):
    craft = CraftFactory()
    url = f"{CRAFTS}{craft.pk}/report/"
    body = request_example(schema, REPORT)
    reporter = client_for(UserFactory())

    reported = reporter.post(url, body, format="json")
    again = reporter.post(url, body, format="json")
    guest = api_client.post(url, body, format="json")
    unknown = reporter.post(f"{CRAFTS}999999/report/", body, format="json")

    assert reported.status_code == 201, reported.json()
    assert_same_shape(documented(schema, REPORT, "post", 201), reported.json())
    data = reported.json()["data"]
    assert (data["reason"], data["note"], data["status"]) == (body["reason"], body["note"], "open")
    assert (again.status_code, again.json()) == (409, documented(schema, REPORT, "post", 409))
    assert (guest.status_code, guest.json()) == (401, documented(schema, REPORT, "post", 401))
    assert (unknown.status_code, unknown.json()) == (404, documented(schema, REPORT, "post", 404))


def test_the_review_example_and_its_errors(client_for, schema):
    report = ReportFactory()
    url = f"/api/v1/moderation/reports/{report.pk}/actions/"
    body = request_example(schema, REVIEW)
    admin = client_for(AdminFactory())

    reviewed = admin.post(url, body, format="json")
    again = admin.post(url, body, format="json")
    not_admin = client_for(UserFactory()).post(url, body, format="json")

    assert reviewed.status_code == 200, reviewed.json()
    assert_same_shape(documented(schema, REVIEW, "post", 200), reviewed.json())
    data = reviewed.json()["data"]
    assert (data["status"], data["craft"]["status"]) == ("resolved", "hidden")
    assert data["actions"][0]["reason"] == body["reason"]
    assert (again.status_code, again.json()) == (409, documented(schema, REVIEW, "post", 409))
    assert (not_admin.status_code, not_admin.json()) == (
        403,
        documented(schema, REVIEW, "post", 403),
    )


def test_the_profile_example_and_its_error(api_client, schema):
    user = UserFactory()

    profile = api_client.get(f"/api/v1/users/{user.pk}/")
    missing = api_client.get("/api/v1/users/999999/")

    assert profile.status_code == 200
    assert_same_shape(documented(schema, PROFILE, "get", 200), profile.json())
    assert profile.json()["data"]["email"] is None
    assert (missing.status_code, missing.json()) == (404, documented(schema, PROFILE, "get", 404))


def test_the_practice_status_examples_and_their_errors(api_client, client_for, schema):
    craft = CraftFactory()
    url = f"{CRAFTS}{craft.pk}/practice-status/proposals/"
    body = request_example(schema, PROPOSE)
    proposer = client_for(UserFactory())

    proposed = proposer.post(url, body, format="json")
    again = proposer.post(url, body, format="json")
    no_source = client_for(UserFactory()).post(
        url, {"practice_status": body["practice_status"]}, format="json"
    )
    guest = api_client.post(url, body, format="json")
    unverified = client_for(UserFactory(is_email_verified=False)).post(url, body, format="json")
    unknown = proposer.post(f"{CRAFTS}999999/practice-status/proposals/", body, format="json")

    assert proposed.status_code == 201, proposed.json()
    assert_same_shape(documented(schema, PROPOSE, "post", 201), proposed.json())
    for status, response in [
        (409, again),
        (400, no_source),
        (401, guest),
        (403, unverified),
        (404, unknown),
    ]:
        assert (response.status_code, response.json()) == (
            status,
            documented(schema, PROPOSE, "post", status),
        )

    review_url = f"/api/v1/moderation/status-proposals/{proposed.json()['data']['id']}/actions/"
    review = request_example(schema, REVIEW_PROPOSAL)
    admin = client_for(AdminFactory())
    not_admin = client_for(UserFactory()).post(review_url, review, format="json")
    reviewed = admin.post(review_url, review, format="json")
    twice = admin.post(review_url, review, format="json")

    assert reviewed.status_code == 200, reviewed.json()
    assert_same_shape(documented(schema, REVIEW_PROPOSAL, "post", 200), reviewed.json())
    data = reviewed.json()["data"]
    assert (data["status"], data["craft"]["practice_status"]) == (
        "approved",
        body["practice_status"],
    )
    assert (not_admin.status_code, not_admin.json()) == (
        403,
        documented(schema, REVIEW_PROPOSAL, "post", 403),
    )
    assert (twice.status_code, twice.json()) == (
        409,
        documented(schema, REVIEW_PROPOSAL, "post", 409),
    )
