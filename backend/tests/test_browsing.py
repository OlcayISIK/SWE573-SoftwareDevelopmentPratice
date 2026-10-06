import pytest

from crafts.models import Category, Craft, Region
from tests.factories import CraftFactory, UserFactory

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"
MAP_URL = "/api/v1/crafts/map/"


def names(response):
    data = response.json()["data"]
    items = data["items"] if isinstance(data, dict) else data
    return {item["name"] for item in items}


@pytest.fixture
def ceramics():
    return Category.objects.get(slug="ceramics")


@pytest.fixture
def textiles():
    return Category.objects.get(slug="textiles")


@pytest.fixture
def kutahya():
    return Region.objects.get(name="Kütahya")


@pytest.fixture
def oaxaca():
    return Region.objects.get(name="Oaxaca")


def test_list_is_paginated_and_newest_first(api_client):
    first = CraftFactory(name="Older")
    second = CraftFactory(name="Newer")

    data = api_client.get(CRAFTS_URL).json()["data"]

    assert data["total"] == 2
    assert [item["id"] for item in data["items"]] == [second.id, first.id]
    assert set(data["items"][0]) >= {"id", "name", "category", "region", "author", "latitude"}


def test_list_includes_crafts_from_all_users(api_client):
    CraftFactory(name="From Ayşe")
    CraftFactory(name="From Mehmet")

    assert names(api_client.get(CRAFTS_URL)) == {"From Ayşe", "From Mehmet"}


def test_list_hides_hidden_and_deleted_crafts(api_client, client_for):
    CraftFactory(name="Visible")
    hidden = CraftFactory(name="Hidden", status=Craft.Status.HIDDEN)
    CraftFactory(name="Deleted", is_deleted=True)

    assert names(api_client.get(CRAFTS_URL)) == {"Visible"}
    assert names(client_for(hidden.author).get(CRAFTS_URL)) == {"Visible", "Hidden"}


def test_filter_by_category(api_client, ceramics, textiles):
    CraftFactory(name="Tile", category=ceramics)
    CraftFactory(name="Carpet", category=textiles)

    assert names(api_client.get(CRAFTS_URL, {"category": "ceramics"})) == {"Tile"}


def test_filter_by_region_and_country(api_client, kutahya, oaxaca):
    CraftFactory(name="Tile", region=kutahya)
    CraftFactory(name="Barro negro", region=oaxaca)

    assert names(api_client.get(CRAFTS_URL, {"region": oaxaca.id})) == {"Barro negro"}
    assert names(api_client.get(CRAFTS_URL, {"country": "türkiye"})) == {"Tile"}


def test_search_matches_name_type_and_region(api_client, kutahya):
    CraftFactory(name="Kütahya Çinisi", region=kutahya)
    CraftFactory(name="Kilim", craft_type="Flat-woven rug")
    CraftFactory(name="Unrelated", craft_type="Basket")

    assert names(api_client.get(CRAFTS_URL, {"search": "çini"})) == {"Kütahya Çinisi"}
    assert names(api_client.get(CRAFTS_URL, {"search": "rug"})) == {"Kilim"}
    assert names(api_client.get(CRAFTS_URL, {"search": "Kütahya"})) == {"Kütahya Çinisi"}


def test_invalid_filter_is_rejected(api_client):
    response = api_client.get(CRAFTS_URL, {"region": "abc"})

    assert response.status_code == 400
    assert "region" in response.json()["errors"]


def test_list_query_count_does_not_grow_with_results(api_client, django_assert_max_num_queries):
    CraftFactory.create_batch(15)

    with django_assert_max_num_queries(3):
        api_client.get(CRAFTS_URL)


def test_crafts_added_by_a_user(api_client):
    author = UserFactory()
    CraftFactory(name="Mine", author=author)
    CraftFactory(name="Someone else's")

    response = api_client.get(f"/api/v1/users/{author.id}/crafts/")

    assert response.status_code == 200
    assert names(response) == {"Mine"}


def test_crafts_of_unavailable_user_return_404(api_client):
    inactive = UserFactory(is_active=False)

    assert api_client.get(f"/api/v1/users/{inactive.id}/crafts/").status_code == 404


def test_map_pins_are_lightweight_and_unpaginated(api_client, ceramics):
    craft = CraftFactory(category=ceramics, latitude="39.419200", longitude="29.983300")

    data = api_client.get(MAP_URL).json()["data"]

    assert data == [
        {
            "id": craft.id,
            "name": craft.name,
            "category": "ceramics",
            "latitude": 39.4192,
            "longitude": 29.9833,
        }
    ]


def test_map_pins_respect_filters_and_visibility(api_client, ceramics, textiles):
    CraftFactory(name="Tile", category=ceramics)
    CraftFactory(name="Carpet", category=textiles)
    CraftFactory(name="Hidden tile", category=ceramics, status=Craft.Status.HIDDEN)

    assert names(api_client.get(MAP_URL, {"category": "ceramics"})) == {"Tile"}


def test_map_pins_inside_bounding_box(api_client):
    CraftFactory(name="Türkiye", latitude="39.4", longitude="29.9")
    CraftFactory(name="Mexico", latitude="17.0", longitude="-96.7")

    response = api_client.get(MAP_URL, {"bbox": "25,35,45,43"})

    assert names(response) == {"Türkiye"}


def test_bounding_box_across_the_antimeridian(api_client):
    CraftFactory(name="Fiji", latitude="-17.7", longitude="178.0")
    CraftFactory(name="Samoa", latitude="-13.8", longitude="-172.1")
    CraftFactory(name="Türkiye", latitude="39.4", longitude="29.9")

    response = api_client.get(MAP_URL, {"bbox": "170,-30,-160,0"})

    assert names(response) == {"Fiji", "Samoa"}


@pytest.mark.parametrize("bbox", ["1,2,3", "a,b,c,d", "0,50,10,40", "0,-95,10,10"])
def test_invalid_bounding_box_is_rejected(api_client, bbox):
    response = api_client.get(MAP_URL, {"bbox": bbox})

    assert response.status_code == 400
    assert "bbox" in response.json()["errors"]
