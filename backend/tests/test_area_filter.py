import pytest

from tests.factories import CraftFactory

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"
KADIKOY = "29.01,40.95,29.11,41.01"


def place(address, latitude, longitude):
    city, country = address.split(", ")
    return {
        "address": address,
        "city": city,
        "country": country,
        "latitude": latitude,
        "longitude": longitude,
    }


@pytest.fixture
def crafts():
    CraftFactory(name="Kadıköy ebru", places=[place("Kadıköy, Türkiye", 40.99, 29.03)])
    CraftFactory(name="Kütahya tile", places=[place("Kütahya, Türkiye", 39.42, 29.98)])
    # One place in the area is enough.
    CraftFactory(
        name="Two city kilim",
        places=[place("Konya, Türkiye", 37.87, 32.49), place("Moda, Türkiye", 40.98, 29.03)],
    )


def names(response):
    return {item["name"] for item in response.json()["data"]["items"]}


def test_only_crafts_with_a_place_in_the_area_are_listed(api_client, crafts):
    response = api_client.get(CRAFTS_URL, {"area": KADIKOY})

    assert names(response) == {"Kadıköy ebru", "Two city kilim"}


def test_the_map_pins_only_the_places_in_the_area(api_client, crafts):
    pins = api_client.get(f"{CRAFTS_URL}map/", {"area": KADIKOY}).json()["data"]

    assert sorted(pin["latitude"] for pin in pins) == [40.98, 40.99]


def test_filter_counts_follow_the_area(api_client, crafts):
    facets = api_client.get(f"{CRAFTS_URL}facets/", {"area": KADIKOY}).json()["data"]

    assert {item["name"]: item["count"] for item in facets["countries"]} == {"Türkiye": 2}


def test_an_invalid_area_is_rejected(api_client):
    response = api_client.get(CRAFTS_URL, {"area": "far away"})

    assert response.status_code == 400
    assert "area" in response.json()["errors"]
