import pytest
from django.contrib import admin
from rest_framework.throttling import ScopedRateThrottle

from crafts.models import Category, CraftType, Culture, Material, Tool
from tests.factories import CraftFactory

pytestmark = pytest.mark.django_db

LISTS = ["categories", "craft-types", "tools", "materials", "cultures"]


def names(response):
    return [item["name"] for item in response.json()["data"]]


def textiles():
    return Category.objects.get(slug="textiles")


def carpet():
    return CraftType.objects.get(category=textiles(), name="Carpet")


# Seed data


def test_every_seeded_craft_type_has_typical_tools_and_materials():
    assert CraftType.objects.count() >= 50
    assert not CraftType.objects.filter(tools=None).exists()
    assert not CraftType.objects.filter(materials=None).exists()


def test_seeded_items_are_not_user_added(api_client):
    for name in LISTS:
        items = api_client.get(f"/api/v1/{name}/").json()["data"]
        assert items, name
        assert not any(item["user_added"] for item in items), name


def test_cultures_are_seeded_with_their_homeland(api_client):
    cultures = {item["name"]: item for item in api_client.get("/api/v1/cultures/").json()["data"]}

    assert cultures["Diné (Navajo)"]["homeland"] == "Southwestern United States"
    assert {"Māori", "Sámi", "Zapotec", "Yörük"} <= set(cultures)


def test_every_seeded_item_has_a_description(api_client):
    for name in LISTS:
        items = api_client.get(f"/api/v1/{name}/").json()["data"]
        missing = [item["name"] for item in items if not item["description"]]
        assert missing == [], name


def test_crafts_show_the_descriptions_of_their_items(api_client):
    craft = CraftFactory(category=textiles(), craft_type=carpet())
    craft.tools.add(Tool.objects.get(name="Loom"))

    data = api_client.get(f"/api/v1/crafts/{craft.id}/").json()["data"]

    assert data["tools"][0]["description"].startswith("A frame that holds warp threads")
    assert data["craft_type"]["description"]
    assert data["category"]["description"]


# Listing


def test_craft_types_are_listed_per_category(api_client):
    response = api_client.get("/api/v1/craft-types/", {"category": textiles().id})

    assert response.status_code == 200
    assert {"Carpet", "Kilim", "Felt"} <= set(names(response))
    assert {item["category"] for item in response.json()["data"]} == {textiles().id}


def test_tools_typical_for_a_craft_type_come_first(api_client):
    response = api_client.get("/api/v1/tools/", {"craft_type": carpet().id})

    items = response.json()["data"]
    typical = [item["name"] for item in items if item["typical"]]
    assert {"Loom", "Knotting knife"} <= set(typical)
    # Every typical tool is listed before the others, which are still offered.
    assert [item["typical"] for item in items] == sorted(
        (item["typical"] for item in items), reverse=True
    )
    assert len(items) > len(typical)


def test_materials_typical_for_a_craft_type_come_first(api_client):
    response = api_client.get("/api/v1/materials/", {"craft_type": carpet().id})

    items = response.json()["data"]
    assert items[0]["typical"] is True
    assert "Wool" in [item["name"] for item in items if item["typical"]]


def test_without_a_craft_type_nothing_is_marked_typical(api_client):
    items = api_client.get("/api/v1/tools/").json()["data"]

    assert not any(item["typical"] for item in items)
    assert names_sorted(items)


def names_sorted(items):
    listed = [item["name"] for item in items]
    return listed == sorted(listed)


def test_hidden_items_are_left_out(api_client):
    Tool.objects.filter(name="Loom").update(is_hidden=True)
    CraftType.objects.filter(name="Carpet").update(is_hidden=True)
    Category.objects.filter(slug="glass").update(is_hidden=True)

    assert "Loom" not in names(api_client.get("/api/v1/tools/"))
    assert "Carpet" not in names(api_client.get("/api/v1/craft-types/"))
    assert "Glass" not in names(api_client.get("/api/v1/categories/"))
    # The craft types of a hidden category go with it.
    assert "Blown glass" not in names(api_client.get("/api/v1/craft-types/"))


def test_invalid_filters_are_rejected(api_client):
    assert api_client.get("/api/v1/tools/", {"craft_type": "x"}).status_code == 400
    assert api_client.get("/api/v1/craft-types/", {"category": 0}).status_code == 400


# Adding


def test_registered_users_add_items_that_everyone_sees(client_for, user, api_client):
    response = client_for(user).post("/api/v1/tools/", {"name": "Spinning wheel"}, format="json")

    assert response.status_code == 201
    assert response.json()["data"]["user_added"] is True
    assert Tool.objects.get(name="Spinning wheel").created_by == user
    assert "Spinning wheel" in names(api_client.get("/api/v1/tools/"))


def test_adding_an_existing_name_reuses_it(client_for, user):
    response = client_for(user).post("/api/v1/tools/", {"name": "  loom "}, format="json")

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Loom"
    assert Tool.objects.filter(name__iexact="loom").count() == 1


def test_users_describe_the_items_they_add(client_for, user):
    response = client_for(user).post(
        "/api/v1/tools/",
        {"name": "Spinning wheel", "description": " A wheel that  spins fibre into yarn. "},
        format="json",
    )

    assert response.json()["data"]["description"] == "A wheel that spins fibre into yarn."


def test_adding_an_existing_name_keeps_its_description(client_for, user):
    loom = Tool.objects.get(name="Loom")

    response = client_for(user).post(
        "/api/v1/tools/", {"name": "loom", "description": "Something else."}, format="json"
    )

    assert response.json()["data"]["description"] == loom.description


def test_descriptions_have_a_length_limit(client_for, user):
    response = client_for(user).post(
        "/api/v1/materials/", {"name": "Yak wool", "description": "x" * 301}, format="json"
    )

    assert response.status_code == 400
    assert "description" in response.json()["errors"]


def test_new_names_are_tidied(client_for, user):
    response = client_for(user).post("/api/v1/materials/", {"name": "  yak   wool "}, format="json")

    assert response.json()["data"]["name"] == "Yak wool"


def test_a_tool_added_for_a_craft_type_is_suggested_for_it(client_for, user, api_client):
    response = client_for(user).post(
        "/api/v1/tools/", {"name": "Spinning wheel", "craft_type": carpet().id}, format="json"
    )

    assert response.json()["data"]["typical"] is True
    listed = api_client.get("/api/v1/tools/", {"craft_type": carpet().id}).json()["data"]
    assert {"name": "Spinning wheel", "typical": True} in [
        {"name": item["name"], "typical": item["typical"]} for item in listed
    ]


def test_craft_types_are_added_to_a_category(client_for, user):
    response = client_for(user).post(
        "/api/v1/craft-types/", {"name": "Prayer rug", "category": textiles().id}, format="json"
    )

    assert response.status_code == 201
    assert CraftType.objects.get(name="Prayer rug").category == textiles()


def test_the_same_craft_type_name_can_exist_in_another_category(client_for, user):
    response = client_for(user).post(
        "/api/v1/craft-types/",
        {"name": "Carpet", "category": Category.objects.get(slug="woodwork").id},
        format="json",
    )

    assert response.status_code == 201
    assert CraftType.objects.filter(name="Carpet").count() == 2


def test_every_seeded_category_has_its_own_icon(api_client):
    categories = api_client.get("/api/v1/categories/").json()["data"]

    icons = {item["slug"]: item["icon"] for item in categories}
    assert icons["textiles"] == "spool"
    assert icons["ceramics"] == "amphora"
    assert "sparkles" not in icons.values()


def test_users_choose_an_icon_for_the_categories_they_add(client_for, user):
    client = client_for(user)

    chosen = client.post(
        "/api/v1/categories/", {"name": "Fish skin", "icon": "fish"}, format="json"
    )
    default = client.post("/api/v1/categories/", {"name": "Featherwork"}, format="json")

    assert chosen.json()["data"]["icon"] == "fish"
    assert default.json()["data"]["icon"] == "sparkles"


def test_only_known_icons_can_be_chosen(client_for, user):
    response = client_for(user).post(
        "/api/v1/categories/", {"name": "Fish skin", "icon": "rocket"}, format="json"
    )

    assert response.status_code == 400
    assert "icon" in response.json()["errors"]


def test_adding_an_existing_category_keeps_its_icon(client_for, user):
    response = client_for(user).post(
        "/api/v1/categories/", {"name": "textiles", "icon": "fish"}, format="json"
    )

    assert response.json()["data"]["icon"] == "spool"


def test_new_categories_get_a_unique_slug(client_for, user):
    client = client_for(user)
    Category.objects.create(name="Other", slug="feather-work")

    response = client.post("/api/v1/categories/", {"name": "Feather work"}, format="json")

    assert response.status_code == 201
    assert response.json()["data"]["slug"] == "feather-work-2"


def test_cultures_are_added_with_an_optional_homeland(client_for, user):
    response = client_for(user).post(
        "/api/v1/cultures/", {"name": "Tlingit", "homeland": "Southeast Alaska"}, format="json"
    )

    assert response.status_code == 201
    assert Culture.objects.get(name="Tlingit").homeland == "Southeast Alaska"


def test_a_name_hidden_by_an_admin_cannot_be_added_again(client_for, user):
    Material.objects.filter(name="Wool").update(is_hidden=True)

    response = client_for(user).post("/api/v1/materials/", {"name": "wool"}, format="json")

    assert response.status_code == 409
    assert "removed by an admin" in response.json()["message"]


@pytest.mark.parametrize("name", ["", " ", "x", "123", "!!"])
def test_names_need_letters(client_for, user, name):
    response = client_for(user).post("/api/v1/tools/", {"name": name}, format="json")

    assert response.status_code == 400
    assert "name" in response.json()["errors"]


def test_a_craft_type_needs_a_visible_category(client_for, user):
    Category.objects.filter(slug="glass").update(is_hidden=True)
    glass = Category.objects.get(slug="glass")

    response = client_for(user).post(
        "/api/v1/craft-types/", {"name": "Lampwork", "category": glass.id}, format="json"
    )

    assert response.status_code == 400
    assert "category" in response.json()["errors"]


def test_guests_cannot_add(api_client):
    for name in LISTS:
        assert (
            api_client.post(f"/api/v1/{name}/", {"name": "New"}, format="json").status_code == 401
        )


def test_unverified_users_cannot_add(client_for, unverified_user):
    response = client_for(unverified_user).post("/api/v1/tools/", {"name": "Adze"}, format="json")

    assert response.status_code == 403


def test_adding_is_rate_limited(client_for, user, monkeypatch):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "lookup_add", "2/hour")
    client = client_for(user)

    statuses = [
        client.post("/api/v1/tools/", {"name": f"Tool {letter}"}, format="json").status_code
        for letter in "abc"
    ]

    assert statuses == [201, 201, 429]
    # Reading the lists is not limited by the add rate.
    assert client.get("/api/v1/tools/").status_code == 200


def test_admins_manage_lookup_lists_in_django_admin():
    for model in (Category, CraftType, Tool, Material, Culture):
        assert admin.site.is_registered(model)
