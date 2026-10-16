from importlib import import_module

import pytest

from tests.factories import CraftFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"

split_story = import_module("crafts.migrations.0012_craft_story").split_story


def test_the_story_is_optional(client_for, user):
    response = client_for(user).post(CRAFTS_URL, craft_payload(), format="json")

    assert response.status_code == 201
    assert response.json()["data"]["story"] == ""


def test_the_story_is_saved_apart_from_the_description(client_for, user):
    payload = craft_payload(story="Woven as a dowry piece; each motif wishes the bride well.")

    data = client_for(user).post(CRAFTS_URL, payload, format="json").json()["data"]

    assert data["description"] == payload["description"]
    assert data["story"] == payload["story"]


def test_the_author_can_edit_the_story(client_for, user):
    client = client_for(user)
    craft_id = client.post(CRAFTS_URL, craft_payload(), format="json").json()["data"]["id"]

    response = client.patch(f"{CRAFTS_URL}{craft_id}/", {"story": "Told by the weavers."})

    assert response.json()["data"]["story"] == "Told by the weavers."


def test_search_looks_in_the_story(api_client):
    CraftFactory(name="Carpet", story="Given as a dowry.")
    CraftFactory(name="Other")

    items = api_client.get(CRAFTS_URL, {"search": "dowry"}).json()["data"]["items"]

    assert [item["name"] for item in items] == ["Carpet"]


def test_the_migration_moves_story_sections_out_of_the_description():
    text = (
        "Overview\nA wool carpet.\n\n"
        "How to understand it\nRead the border first.\n\n"
        "How it is made\nHand knotted.\n\n"
        "Cultural relevance\nA dowry piece."
    )

    description, story = split_story(text)

    assert description == "Overview\nA wool carpet.\n\nHow it is made\nHand knotted."
    assert story == (
        "How to understand it\nRead the border first.\n\nCultural relevance\nA dowry piece."
    )


def test_the_migration_leaves_plain_descriptions_alone():
    assert split_story("A wool carpet.") == ("A wool carpet.", "")
