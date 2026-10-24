import json
import logging
import sys

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.logs import JsonFormatter

pytestmark = pytest.mark.urls("tests.core_urls")


@pytest.fixture
def request_logs(caplog):
    caplog.set_level(logging.INFO, logger="api.requests")

    def records():
        return [record for record in caplog.records if record.name == "api.requests"]

    return records


def test_every_request_is_logged_with_its_timing(api_client, request_logs):
    response = api_client.get("/ok/?page=2", HTTP_USER_AGENT="pytest")

    [record] = request_logs()
    assert record.levelno == logging.INFO
    assert record.getMessage().startswith("GET /ok/ 200 ")
    assert record.method == "GET"
    assert record.path == "/ok/"
    assert record.query == "page=2"
    assert record.status == 200
    assert record.duration_ms >= 0
    assert record.user_id is None
    assert record.user_agent == "pytest"
    assert record.client_ip == "127.0.0.1"
    assert record.request_body is None
    assert json.loads(record.response_body) == {
        "success": True,
        "data": {"value": 1},
        "message": "OK",
    }
    assert record.response_size == len(response.content)
    assert response["X-Request-ID"] == record.request_id


def test_request_and_response_bodies_are_logged_with_secrets_masked(api_client, request_logs):
    api_client.post(
        "/echo/",
        {"name": "Kilim", "password": "s3cret", "nested": {"refresh": "abc"}},
        format="json",
    )

    [record] = request_logs()
    assert json.loads(record.request_body) == {
        "name": "Kilim",
        "password": "***",
        "nested": {"refresh": "***"},
    }
    assert json.loads(record.response_body)["data"] == {
        "name": "Kilim",
        "password": "***",
        "nested": {"refresh": "***"},
    }
    assert "s3cret" not in record.request_body + record.response_body
    assert record.request_size > 0


def test_form_bodies_are_masked_too(api_client, request_logs):
    api_client.post(
        "/echo/",
        "username=ayse&password=s3cret",
        content_type="application/x-www-form-urlencoded",
    )

    [record] = request_logs()
    assert json.loads(record.request_body) == {"username": "ayse", "password": "***"}


def test_uploads_are_logged_by_name_and_size(api_client, request_logs):
    photo = SimpleUploadedFile("tile.png", b"\x89PNG" + b"0" * 96, content_type="image/png")

    api_client.post("/echo/", {"caption": "Blue tile", "file": photo}, format="multipart")

    [record] = request_logs()
    assert json.loads(record.request_body) == {
        "caption": "Blue tile",
        "files": [{"field": "file", "name": "tile.png", "size": 100}],
    }


def test_long_bodies_are_cut_to_the_limit(api_client, request_logs, settings):
    settings.REQUEST_LOG_BODY_LIMIT = 50

    api_client.post("/echo/", {"name": "x" * 200}, format="json")

    [record] = request_logs()
    assert record.request_body.startswith('{"name": "xxx')
    assert record.request_body.endswith("more characters)")
    assert len(record.request_body) < 100


def test_the_signed_in_user_is_logged(client_for, user, request_logs):
    client_for(user).get("/ok/")

    [record] = request_logs()
    assert record.user_id == user.pk


def test_client_errors_are_warnings_and_server_errors_are_errors(api_client, request_logs):
    api_client.get("/not-found/")
    api_client.get("/crash/")

    not_found, crash = request_logs()
    assert (not_found.levelno, not_found.status) == (logging.WARNING, 404)
    assert json.loads(not_found.response_body)["message"] == "Thing not found."
    assert (crash.levelno, crash.status) == (logging.ERROR, 500)


def test_a_valid_request_id_from_the_client_is_kept(api_client, request_logs):
    kept = api_client.get("/ok/", HTTP_X_REQUEST_ID="abc-123")
    replaced = api_client.get("/ok/", HTTP_X_REQUEST_ID="bad id with spaces")

    first, second = request_logs()
    assert kept["X-Request-ID"] == first.request_id == "abc-123"
    assert replaced["X-Request-ID"] == second.request_id
    assert len(second.request_id) == 32


def test_the_client_address_comes_from_the_proxy_header(api_client, request_logs):
    api_client.get("/ok/", HTTP_X_FORWARDED_FOR="203.0.113.7, 10.0.0.1")

    [record] = request_logs()
    assert record.client_ip == "203.0.113.7"


def test_json_formatter_writes_extra_fields_and_errors():
    try:
        raise ValueError("boom")
    except ValueError:
        exc_info = sys.exc_info()
    record = logging.LogRecord(
        "api.requests", logging.ERROR, __file__, 1, "GET %s", ("/x/",), exc_info
    )
    record.status = 500

    line = json.loads(JsonFormatter().format(record))

    assert line["level"] == "ERROR"
    assert line["logger"] == "api.requests"
    assert line["message"] == "GET /x/"
    assert line["status"] == 500
    assert "ValueError: boom" in line["exception"]
    assert line["time"].endswith("+00:00")
