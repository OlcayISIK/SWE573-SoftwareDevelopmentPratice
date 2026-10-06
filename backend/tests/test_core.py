import pytest

pytestmark = pytest.mark.urls("tests.core_urls")


def test_success_response_is_wrapped_in_envelope(api_client):
    response = api_client.get("/ok/")

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"value": 1}, "message": "OK"}


def test_no_content_response_has_empty_body(api_client):
    response = api_client.delete("/ok/")

    assert response.status_code == 204
    assert response.content == b""


def test_domain_error_uses_its_status_and_message(api_client):
    response = api_client.get("/not-found/")

    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "data": None,
        "message": "Thing not found.",
        "errors": {},
    }


def test_domain_error_carries_field_errors(api_client):
    response = api_client.get("/conflict/")

    assert response.status_code == 409
    assert response.json()["errors"] == {"name": ["Already taken."]}


def test_serializer_errors_are_returned_per_field(api_client):
    response = api_client.post("/validation/", {}, format="json")

    body = response.json()
    assert response.status_code == 400
    assert body["success"] is False
    assert body["message"] == "Validation failed."
    assert "name" in body["errors"]


def test_method_not_allowed_uses_envelope(api_client):
    response = api_client.post("/ok/", {}, format="json")

    assert response.status_code == 405
    assert response.json()["success"] is False


def test_pagination_shape(api_client):
    response = api_client.get("/paginated/", {"page": 2, "pageSize": 10})

    data = response.json()["data"]
    assert data["items"] == list(range(10, 20))
    assert data["total"] == 45
    assert data["page"] == 2
    assert data["pageSize"] == 10
    assert data["totalPages"] == 5


def test_page_size_is_capped(api_client):
    response = api_client.get("/paginated/", {"pageSize": 1000})

    assert response.json()["data"]["pageSize"] == 100


def test_unhandled_error_returns_envelope(api_client):
    response = api_client.get("/crash/")

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "data": None,
        "message": "Internal server error.",
        "errors": {},
    }


@pytest.mark.urls("config.urls")
def test_openapi_schema_is_served(api_client):
    response = api_client.get("/api/schema/", {"format": "json"})

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Indigenous Crafts API"
