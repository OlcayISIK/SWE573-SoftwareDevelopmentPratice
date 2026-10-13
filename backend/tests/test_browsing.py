import pytest

from crafts.models import Category, Craft, CraftType, Culture, Material, Tool
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
def zapotec():
    return Culture.objects.get(name="Zapotec")


def craft_type(category, name):
    return CraftType.objects.get_or_create(category=category, name=name)[0]


def test_list_is_paginated_and_newest_first(api_client):
    first = CraftFactory(name="Older")
    second = CraftFactory(name="Newer")

    data = api_client.get(CRAFTS_URL).json()["data"]

    assert data["total"] == 2
    assert [item["id"] for item in data["items"]] == [second.id, first.id]
    assert set(data["items"][0]) >= {
        "id",
        "name",
        "category",
        "craft_type",
        "culture",
        "city",
        "country",
        "author",
        "latitude",
    }


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


def test_filter_by_culture_and_country(api_client, zapotec):
    CraftFactory(name="Tile")
    CraftFactory(
        name="Barro negro", culture=zapotec, address="San Bartolo Coyotepec", country="Mexico"
    )

    assert names(api_client.get(CRAFTS_URL, {"culture": zapotec.id})) == {"Barro negro"}
    assert names(api_client.get(CRAFTS_URL, {"country": "türkiye"})) == {"Tile"}


def test_filter_by_craft_type(api_client, textiles):
    kilim = craft_type(textiles, "Kilim")
    CraftFactory(name="Kilim from Uşak", category=textiles, craft_type=kilim)
    CraftFactory(name="Carpet", category=textiles, craft_type=craft_type(textiles, "Carpet"))

    assert names(api_client.get(CRAFTS_URL, {"craft_type": kilim.id})) == {"Kilim from Uşak"}


def test_search_matches_name_type_culture_and_place(api_client, textiles, zapotec):
    CraftFactory(name="Kütahya Çinisi")
    CraftFactory(name="Rug", category=textiles, craft_type=craft_type(textiles, "Kilim"))
    CraftFactory(name="Black pottery", culture=zapotec, address="Oaxaca", country="Mexico")

    assert names(api_client.get(CRAFTS_URL, {"search": "çini"})) == {"Kütahya Çinisi"}
    assert names(api_client.get(CRAFTS_URL, {"search": "kilim"})) == {"Rug"}
    assert names(api_client.get(CRAFTS_URL, {"search": "zapotec"})) == {"Black pottery"}
    assert names(api_client.get(CRAFTS_URL, {"search": "oaxaca"})) == {"Black pottery"}


def test_invalid_filter_is_rejected(api_client):
    response = api_client.get(CRAFTS_URL, {"culture": "abc"})

    assert response.status_code == 400
    assert "culture" in response.json()["errors"]


def test_search_matches_the_start_of_words(api_client, ceramics, textiles):
    CraftFactory(name="Kütahya tiles", category=ceramics)
    CraftFactory(
        name="Felt rug",
        category=textiles,
        craft_type=craft_type(textiles, "Felt"),
        description="Pressed wool rug.",
    )

    # "tile" is inside "Textiles", but it does not start a word there.
    assert names(api_client.get(CRAFTS_URL, {"search": "tile"})) == {"Kütahya tiles"}
    assert names(api_client.get(CRAFTS_URL, {"search": "TEXT"})) == {"Felt rug"}


def test_every_search_word_must_match(api_client, textiles, zapotec):
    kilim = craft_type(textiles, "Kilim")
    CraftFactory(name="Anatolian kilim", category=textiles, craft_type=kilim)
    CraftFactory(
        name="Zapotec kilim", category=textiles, craft_type=kilim, culture=zapotec, country="Mexico"
    )

    assert names(api_client.get(CRAFTS_URL, {"search": "kilim mexico"})) == {"Zapotec kilim"}


def test_search_looks_in_tools_and_materials(api_client):
    craft = CraftFactory(name="Carpet")
    craft.tools.add(Tool.objects.get(name="Knotting knife"))
    craft.materials.add(Material.objects.get(name="Madder"))
    CraftFactory(name="Other")

    assert names(api_client.get(CRAFTS_URL, {"search": "knotting"})) == {"Carpet"}
    assert names(api_client.get(CRAFTS_URL, {"search": "madder"})) == {"Carpet"}
    # A craft with several matching tools is listed once.
    craft.tools.add(Tool.objects.get(name="Knife"))
    assert api_client.get(CRAFTS_URL, {"search": "kni"}).json()["data"]["total"] == 1


def test_search_treats_special_characters_as_text(api_client):
    CraftFactory(name="Tile (blue)")

    assert api_client.get(CRAFTS_URL, {"search": "(blue"}).status_code == 200
    assert names(api_client.get(CRAFTS_URL, {"search": "[*"})) == set()


FACETS_URL = f"{CRAFTS_URL}facets/"


def test_facets_only_offer_values_the_results_have(api_client, ceramics, textiles, zapotec):
    kilim = craft_type(textiles, "Kilim")
    CraftFactory(name="Uşak kilim", category=textiles, craft_type=kilim, country="Türkiye")
    CraftFactory(name="Konya kilim", category=textiles, craft_type=kilim, country="Türkiye")
    CraftFactory(
        name="Oaxaca kilim", category=textiles, craft_type=kilim, culture=zapotec, country="Mexico"
    )
    CraftFactory(name="Tile", category=ceramics, country="Japan")
    CraftFactory(
        name="Hidden kilim",
        category=textiles,
        craft_type=kilim,
        country="Peru",
        status=Craft.Status.HIDDEN,
    )

    data = api_client.get(FACETS_URL, {"search": "kilim"}).json()["data"]

    assert data["countries"] == [{"name": "Mexico", "count": 1}, {"name": "Türkiye", "count": 2}]
    assert data["categories"] == [{"slug": "textiles", "name": "Textiles", "count": 3}]
    assert data["craft_types"] == [
        {"id": kilim.id, "name": "Kilim", "category": textiles.id, "count": 3}
    ]
    assert {item["name"]: item["count"] for item in data["cultures"]} == {
        "Turkish": 2,
        "Zapotec": 1,
    }


def test_a_facet_ignores_its_own_filter(api_client):
    CraftFactory(country="Türkiye")
    CraftFactory(country="Mexico")

    data = api_client.get(FACETS_URL, {"country": "Mexico"}).json()["data"]

    # Picking Mexico still offers Türkiye in the country list, but narrows the others.
    assert [item["name"] for item in data["countries"]] == ["Mexico", "Türkiye"]
    assert sum(item["count"] for item in data["categories"]) == 1


def test_facets_with_no_results_are_empty(api_client):
    CraftFactory()

    data = api_client.get(FACETS_URL, {"search": "nothingmatches"}).json()["data"]

    assert data == {"categories": [], "craft_types": [], "cultures": [], "countries": []}


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
            "place": craft.places.get().id,
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
