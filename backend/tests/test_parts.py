"""A craft can list parts made of their own materials, such as an iron blade and a wooden
handle, beside the materials of the whole craft."""

import pytest

from crafts import services
from crafts.models import CraftPart, Material
from tests.factories import AdminFactory, CraftFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"


def material(name):
    return Material.objects.get(name=name)


def part(name, *materials):
    return {"name": name, "materials": [material(item).id for item in materials]}


def shown(data):
    return [(row["name"], [item["name"] for item in row["materials"]]) for row in data["parts"]]


def test_a_craft_is_published_with_its_parts(client_for, user):
    payload = craft_payload(
        materials=[],
        parts=[part("Blade", "Iron"), part("Handle", "Walnut wood", "Bone")],
    )

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["materials"] == []
    assert shown(data) == [("Blade", ["Iron"]), ("Handle", ["Bone", "Walnut wood"])]
    assert data["parts"][0]["materials"][0]["user_added"] is False


def test_parts_are_optional(api_client, client_for, user):
    craft_id = client_for(user).post(CRAFTS_URL, craft_payload(), format="json").json()["data"]
    response = api_client.get(f"{CRAFTS_URL}{craft_id['id']}/")

    assert response.json()["data"]["parts"] == []


def test_the_detail_page_shows_the_parts_in_order(api_client):
    knife = CraftFactory(name="Yatağan")
    handle = CraftPart.objects.create(craft=knife, name="Handle", order=1)
    handle.materials.add(material("Bone"))
    blade = CraftPart.objects.create(craft=knife, name="Blade", order=0)
    blade.materials.add(material("Iron"))

    data = api_client.get(f"{CRAFTS_URL}{knife.id}/").json()["data"]

    assert shown(data) == [("Blade", ["Iron"]), ("Handle", ["Bone"])]


def test_editing_replaces_the_parts(client_for, user):
    client = client_for(user)
    payload = craft_payload(parts=[part("Blade", "Iron"), part("Handle", "Oak wood")])
    craft_id = client.post(CRAFTS_URL, payload, format="json").json()["data"]["id"]
    url = f"{CRAFTS_URL}{craft_id}/"

    # Changing other fields keeps the parts.
    data = client.patch(url, {"name": "Yatağan"}, format="json").json()["data"]
    assert shown(data) == [("Blade", ["Iron"]), ("Handle", ["Oak wood"])]

    data = client.patch(url, {"parts": [part("Handle", "Bone")]}, format="json").json()["data"]
    assert shown(data) == [("Handle", ["Bone"])]

    data = client.patch(url, {"parts": []}, format="json").json()["data"]
    assert data["parts"] == []
    assert not CraftPart.objects.filter(craft_id=craft_id).exists()


@pytest.mark.parametrize(
    "parts",
    [
        [{"name": "Blade", "materials": []}],
        [{"name": "", "materials": ["Iron"]}],
        [{"name": "x" * 81, "materials": ["Iron"]}],
        [{"name": "Blade"}],
        [{"name": "Blade", "materials": ["Iron"], "color": "grey"}],
        [{"name": "Blade", "materials": ["Iron"]}, {"name": "blade", "materials": ["Bone"]}],
        [{"name": f"Part {index}", "materials": ["Iron"]} for index in range(11)],
    ],
)
def test_invalid_parts_are_rejected(client_for, user, parts):
    for row in parts:
        if "materials" in row:
            row["materials"] = [material(name).id for name in row["materials"]]

    response = client_for(user).post(CRAFTS_URL, craft_payload(parts=parts), format="json")

    assert response.status_code == 400
    assert "parts" in response.json()["errors"]


def test_a_part_cannot_use_a_hidden_material(client_for, user):
    Material.objects.filter(name="Iron").update(is_hidden=True)

    response = client_for(user).post(
        CRAFTS_URL, craft_payload(parts=[part("Blade", "Iron")]), format="json"
    )

    assert response.status_code == 400
    assert "parts" in response.json()["errors"]


def search(api_client, text):
    rows = api_client.get(CRAFTS_URL, {"search": text}).json()["data"]["items"]
    return {row["name"] for row in rows}


def test_search_looks_in_parts_and_their_materials(api_client):
    knife = CraftFactory(name="Yatağan")
    blade = CraftPart.objects.create(craft=knife, name="Blade")
    blade.materials.add(material("Iron"), material("Bone"))
    handle = CraftPart.objects.create(craft=knife, name="Handle", order=1)
    handle.materials.add(material("Bone"), material("Walnut wood"))
    CraftFactory(name="Other")

    assert search(api_client, "handle") == {"Yatağan"}
    assert search(api_client, "iron") == {"Yatağan"}
    assert search(api_client, "walnut blade") == {"Yatağan"}
    # A craft with several matching parts is listed once.
    assert api_client.get(CRAFTS_URL, {"search": "bone"}).json()["data"]["total"] == 1


def test_merging_a_material_moves_the_parts_that_use_it():
    duplicate = Material.objects.create(name="Wrought iron")
    knife = CraftFactory(name="Yatağan")
    blade = CraftPart.objects.create(craft=knife, name="Blade")
    blade.materials.add(duplicate)

    services.merge_lookup(item=duplicate, into=material("Iron"), actor=AdminFactory())

    assert list(blade.materials.values_list("name", flat=True)) == ["Iron"]
