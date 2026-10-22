import json
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse

import pytest

from crafts import geocoding

pytestmark = pytest.mark.django_db

SEARCH_URL = "/api/v1/geocode/search/"
REVERSE_URL = "/api/v1/geocode/reverse/"

KUTAHYA = {
    "lat": "39.4199231",
    "lon": "29.9857431",
    "display_name": "Kütahya, Kütahya Merkez, Kütahya, Aegean Region, Türkiye",
    "address": {"city": "Kütahya", "province": "Kütahya", "country": "Türkiye"},
}


class FakeNominatim:
    """Stands in for urlopen and records the requests the backend sends."""

    def __init__(self, body=None, error=None):
        self.body, self.error, self.requests = body, error, []

    def __call__(self, request, timeout):
        self.requests.append(request)
        if self.error:
            raise self.error
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.body).encode("utf-8")

    def params(self, index=-1):
        return {
            key: values[0]
            for key, values in parse_qs(urlparse(self.requests[index].full_url).query).items()
        }


@pytest.fixture
def nominatim(monkeypatch):
    def install(body=None, error=None):
        fake = FakeNominatim(body, error)
        monkeypatch.setattr(geocoding, "urlopen", fake)
        return fake

    return install


@pytest.fixture
def client(client_for, user):
    return client_for(user)


def test_an_address_is_found(client, nominatim):
    fake = nominatim([KUTAHYA])

    response = client.get(SEARCH_URL, {"q": "Kütahya, Türkiye"})

    assert response.status_code == 200
    assert response.json()["data"] == {
        "latitude": 39.419923,
        "longitude": 29.985743,
        "address": "Kütahya, Kütahya Merkez, Kütahya, Aegean Region, Türkiye",
        "city": "Kütahya",
        "country": "Türkiye",
    }
    assert fake.params()["q"] == "kütahya, türkiye"
    assert fake.params()["limit"] == "1"


def test_requests_identify_the_application(client, nominatim, settings):
    fake = nominatim([KUTAHYA])

    client.get(SEARCH_URL, {"q": "Kütahya"})

    assert fake.requests[0].get_header("User-agent") == settings.GEOCODER_USER_AGENT
    assert fake.requests[0].full_url.startswith(f"{settings.GEOCODER_URL}/search?")


def test_an_unknown_address_is_not_found(client, nominatim):
    nominatim([])

    response = client.get(SEARCH_URL, {"q": "nowhere at all"})

    assert response.status_code == 404
    assert response.json()["message"] == "Address not found."


def test_results_are_cached(client, nominatim):
    fake = nominatim([KUTAHYA])

    client.get(SEARCH_URL, {"q": "Kütahya"})
    response = client.get(SEARCH_URL, {"q": "  KÜTAHYA "})

    assert response.status_code == 200
    assert len(fake.requests) == 1


def test_not_found_is_cached_too(client, nominatim):
    fake = nominatim([])

    client.get(SEARCH_URL, {"q": "nowhere at all"})
    response = client.get(SEARCH_URL, {"q": "nowhere at all"})

    assert response.status_code == 404
    assert len(fake.requests) == 1


def test_turkey_is_named_turkiye(client, nominatim):
    nominatim(
        [{**KUTAHYA, "address": {"city": "Kütahya", "country": "Turkey", "country_code": "tr"}}]
    )

    response = client.get(SEARCH_URL, {"q": "Kütahya"})

    assert response.json()["data"]["country"] == "Türkiye"


def test_the_city_falls_back_to_a_town_or_village(client, nominatim):
    nominatim([{**KUTAHYA, "address": {"village": "Avanos", "country": "Türkiye"}}])

    response = client.get(SEARCH_URL, {"q": "Avanos"})

    assert response.json()["data"]["city"] == "Avanos"


@pytest.mark.parametrize("error", [URLError("down"), TimeoutError()])
def test_an_unreachable_service_returns_503(client, nominatim, error):
    nominatim(error=error)

    response = client.get(SEARCH_URL, {"q": "Kütahya"})

    assert response.status_code == 503
    assert "not available" in response.json()["message"]


def test_requests_wait_for_the_one_per_second_slot(client, nominatim, monkeypatch):
    fake = nominatim([KUTAHYA])
    monkeypatch.setattr(geocoding, "MAX_WAIT_SECONDS", 0)
    geocoding.cache.add(geocoding.SLOT_KEY, True, timeout=1)

    response = client.get(SEARCH_URL, {"q": "Kütahya"})

    assert response.status_code == 503
    assert fake.requests == []


def test_the_address_at_a_point_is_found(client, nominatim):
    fake = nominatim(KUTAHYA)

    response = client.get(REVERSE_URL, {"lat": 39.4199231, "lng": 29.9857431})

    assert response.status_code == 200
    assert response.json()["data"]["address"].startswith("Kütahya")
    assert fake.params()["lat"] == "39.41992"
    assert fake.params()["lon"] == "29.98574"


def test_a_point_without_an_address(client, nominatim):
    nominatim({"error": "Unable to geocode"})

    response = client.get(REVERSE_URL, {"lat": 0, "lng": -30})

    assert response.status_code == 404
    assert response.json()["message"] == "No address found for this point."


@pytest.mark.parametrize(
    ("url", "params", "field"),
    [
        (SEARCH_URL, {}, "q"),
        (SEARCH_URL, {"q": "ab"}, "q"),
        (REVERSE_URL, {"lat": 91, "lng": 0}, "lat"),
        (REVERSE_URL, {"lat": 0}, "lng"),
    ],
)
def test_invalid_requests_are_rejected(client, nominatim, url, params, field):
    fake = nominatim([KUTAHYA])

    response = client.get(url, params)

    assert response.status_code == 400
    assert field in response.json()["errors"]
    assert fake.requests == []


def test_guests_look_up_places_but_not_points(api_client, nominatim):
    nominatim([KUTAHYA])

    # Anyone can search crafts near a place; only authors place pins.
    assert api_client.get(SEARCH_URL, {"q": "Kütahya"}).status_code == 200
    assert api_client.get(REVERSE_URL, {"lat": 1, "lng": 1}).status_code == 401


def test_a_place_comes_with_its_area(client, nominatim):
    kadikoy = {
        **KUTAHYA,
        "lat": "40.9903",
        "lon": "29.0290",
        "boundingbox": ["40.9500", "41.0100", "29.0100", "29.1100"],
    }
    nominatim([kadikoy])

    data = client.get(SEARCH_URL, {"q": "Kadıköy"}).json()["data"]

    assert data["area"] == [29.01, 40.95, 29.11, 41.01]


def test_a_very_small_area_is_widened(client, nominatim):
    building = {**KUTAHYA, "boundingbox": ["39.4199", "39.4200", "29.9857", "29.9858"]}
    nominatim([building])

    west, south, east, north = client.get(SEARCH_URL, {"q": "Ulu Cami"}).json()["data"]["area"]

    assert round(east - west, 4) == round(north - south, 4) == 0.02
