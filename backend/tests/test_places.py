from importlib import import_module

import pytest
from django.apps import apps

from crafts.models import CraftPlace
from tests.factories import CraftFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"
MAP_URL = f"{CRAFTS_URL}map/"
FACETS_URL = f"{CRAFTS_URL}facets/"

USAK = {
    "address": "Uşak, Türkiye",
    "city": "Uşak",
    "country": "Türkiye",
    "latitude": 38.68,
    "longitude": 29.41,
}
KONYA = {
    "address": "Konya, Türkiye",
    "city": "Konya",
    "country": "Türkiye",
    "latitude": 37.87,
    "longitude": 32.49,
}
TABRIZ = {
    "address": "Tabriz, Iran",
    "city": "Tabriz",
    "country": "Iran",
    "latitude": 38.08,
    "longitude": 46.29,
}


def publish(client, places):
    return client.post(CRAFTS_URL, craft_payload(places=places), format="json")


def kilim_in(*places):
    """A craft with the given places, as dicts of place fields."""
    return CraftFactory(
        name="Kilim",
        places=list(places),
        **{key: places[0][key] for key in ("address", "city", "country", "latitude", "longitude")},
    )


def test_a_craft_can_have_several_equal_places(client_for, user):
    data = publish(client_for(user), [USAK, TABRIZ]).json()["data"]

    assert [place["city"] for place in data["places"]] == ["Uşak", "Tabriz"]
    assert not any(place["is_origin"] for place in data["places"])
    # With all places equal, the first is the main place shown on cards.
    assert (data["city"], data["latitude"]) == ("Uşak", 38.68)


def test_the_origin_is_the_main_place(client_for, user):
    data = publish(client_for(user), [USAK, {**TABRIZ, "is_origin": True}]).json()["data"]

    assert [place["is_origin"] for place in data["places"]] == [False, True]
    assert (data["city"], data["country"]) == ("Tabriz", "Iran")


@pytest.mark.parametrize(
    "places",
    [
        [{**USAK, "is_origin": True}, {**TABRIZ, "is_origin": True}],
        [USAK, {**USAK, "address": "Same point"}],
        [{**USAK, "latitude": 30 + n / 100} for n in range(11)],
        [],
    ],
    ids=["two origins", "same place twice", "too many", "none"],
)
def test_invalid_places_are_rejected(client_for, user, places):
    response = publish(client_for(user), places)

    assert response.status_code == 400
    assert "places" in response.json()["errors"]


def test_editing_replaces_the_places(client_for, user):
    client = client_for(user)
    craft_id = publish(client, [USAK, TABRIZ]).json()["data"]["id"]

    response = client.patch(f"{CRAFTS_URL}{craft_id}/", {"places": [KONYA]}, format="json")

    data = response.json()["data"]
    assert [place["city"] for place in data["places"]] == ["Konya"]
    assert data["city"] == "Konya"
    assert CraftPlace.objects.filter(craft_id=craft_id).count() == 1


def test_the_country_filter_matches_any_place(api_client):
    kilim_in(USAK, TABRIZ)
    CraftFactory(name="Tile")

    items = api_client.get(CRAFTS_URL, {"country": "Iran"}).json()["data"]["items"]

    assert [item["name"] for item in items] == ["Kilim"]


def test_search_looks_in_every_place(api_client):
    kilim_in(USAK, TABRIZ)

    items = api_client.get(CRAFTS_URL, {"search": "tabriz"}).json()["data"]["items"]

    assert [item["name"] for item in items] == ["Kilim"]


def test_the_map_has_a_pin_for_each_place(api_client):
    craft = kilim_in(USAK, TABRIZ)

    pins = api_client.get(MAP_URL).json()["data"]

    assert [(pin["id"], pin["latitude"]) for pin in pins] == [
        (craft.id, 38.68),
        (craft.id, 38.08),
    ]
    assert len({pin["place"] for pin in pins}) == 2
    # Only the places inside the visible area are pinned.
    tabriz_area = api_client.get(MAP_URL, {"bbox": "45,37,47,39"}).json()["data"]
    assert [pin["latitude"] for pin in tabriz_area] == [38.08]


def test_countries_count_each_craft_once(api_client):
    kilim_in(USAK, KONYA, TABRIZ)

    countries = api_client.get(FACETS_URL).json()["data"]["countries"]

    assert {"name": "Türkiye", "count": 1} in countries
    assert {"name": "Iran", "count": 1} in countries


def test_the_migration_gives_each_craft_its_place():
    craft = CraftFactory(city="Kütahya")
    craft.places.all().delete()

    import_module("crafts.migrations.0015_craft_places").copy_places(apps, None)

    place = craft.places.get()
    assert (place.city, str(place.latitude), place.is_origin) == ("Kütahya", "39.419200", False)
