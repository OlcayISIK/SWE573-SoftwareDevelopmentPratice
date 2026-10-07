import pytest

from crafts import signals
from crafts.models import Category, Craft, CraftType, Culture, Material, Tool
from tests.factories import CraftFactory, UserFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"


def craft_url(craft):
    return f"{CRAFTS_URL}{craft.id}/"


@pytest.fixture
def payload():
    return craft_payload(
        latitude=38.6812345,
        longitude=29.4083471,
        attributes={
            "dimensions": [
                {"type": "length", "value": 300, "unit": "cm"},
                {"type": "width", "value": 2, "unit": "m"},
            ],
            "colors": ["madder red", "indigo"],
            "distinguishing_features": "Central medallion with a floral border",
        },
    )


@pytest.fixture
def captured_signals():
    received = []

    def on_published(sender, craft, **kwargs):
        received.append(("published", craft.id, None))

    def on_updated(sender, craft, actor, **kwargs):
        received.append(("updated", craft.id, actor.id))

    signals.craft_published.connect(on_published)
    signals.craft_updated.connect(on_updated)
    yield received
    signals.craft_published.disconnect(on_published)
    signals.craft_updated.disconnect(on_updated)


def test_verified_user_publishes_craft_without_approval(client_for, user, payload):
    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    data = response.json()["data"]
    assert response.status_code == 201
    assert data["status"] == "published"
    assert data["author"] == {"id": user.id, "display_name": user.profile.display_name}
    assert data["category"]["slug"] == "textiles"
    assert data["craft_type"] == {
        "id": payload["craft_type"],
        "name": "Carpet",
        "user_added": False,
    }
    assert [tool["name"] for tool in data["tools"]] == ["Knotting knife", "Loom"]
    assert [material["name"] for material in data["materials"]] == ["Madder", "Wool"]
    assert data["culture"]["name"] == "Turkish"
    assert (data["address"], data["city"], data["country"]) == ("Uşak, Türkiye", "Uşak", "Türkiye")
    assert data["description"] == payload["description"]
    assert data["attributes"]["dimensions"][1] == {"type": "width", "value": 2.0, "unit": "m"}


def test_coordinates_are_rounded_to_six_decimals(client_for, user, payload):
    data = client_for(user).post(CRAFTS_URL, payload, format="json").json()["data"]

    assert data["latitude"] == 38.681235
    assert data["longitude"] == 29.408347


def test_unverified_user_cannot_publish(client_for, unverified_user, payload):
    response = client_for(unverified_user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 403
    assert "Verify your email" in response.json()["message"]
    assert not Craft.objects.exists()


def test_guest_cannot_publish(api_client, payload):
    assert api_client.post(CRAFTS_URL, payload, format="json").status_code == 401


@pytest.mark.parametrize(
    "field", ["name", "category", "craft_type", "culture", "address", "latitude", "description"]
)
def test_required_fields(client_for, user, payload, field):
    payload.pop(field)

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert field in response.json()["errors"]


@pytest.mark.parametrize(("field", "value"), [("latitude", 91), ("longitude", -180.5)])
def test_coordinates_must_be_on_the_map(client_for, user, payload, field, value):
    payload[field] = value

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert field in response.json()["errors"]


def test_unknown_category_is_rejected(client_for, user, payload):
    payload["category"] = 999999

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert "category" in response.json()["errors"]


@pytest.mark.parametrize(
    "attributes",
    [
        {"price": 10},
        {"materials": ["wool"]},
        {"dimensions": [{"type": "height", "value": -1, "unit": "cm"}]},
        {"dimensions": [{"type": "volume", "value": 3, "unit": "cm"}]},
        {"dimensions": [{"type": "height", "value": 3, "unit": "inch"}]},
        {"dimensions": [{"type": "height", "value": 3}]},
        {"dimensions": [{"type": "height", "value": 3, "unit": "cm", "note": "x"}]},
        {
            "dimensions": [
                {"type": "height", "value": 3, "unit": "cm"},
                {"type": "height", "value": 4, "unit": "cm"},
            ]
        },
        {"colors": "blue"},
        {"weight_g": 0},
    ],
)
def test_invalid_attributes_are_rejected(client_for, user, payload, attributes):
    payload["attributes"] = attributes

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert "attributes" in response.json()["errors"]


def test_attributes_are_optional(client_for, user, payload):
    payload.pop("attributes")

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 201
    assert response.json()["data"]["attributes"] == {}


def test_guest_can_view_published_craft(api_client):
    craft = CraftFactory()

    response = api_client.get(craft_url(craft))

    assert response.status_code == 200
    assert response.json()["data"]["name"] == craft.name


def test_author_edits_own_craft(client_for):
    craft = CraftFactory()

    response = client_for(craft.author).patch(
        craft_url(craft), {"name": "New name", "attributes": {"colors": ["red"]}}, format="json"
    )

    assert response.status_code == 200
    craft.refresh_from_db()
    assert craft.name == "New name"
    assert craft.attributes == {"colors": ["red"]}


def test_other_user_cannot_edit(client_for, user):
    craft = CraftFactory()

    response = client_for(user).patch(craft_url(craft), {"name": "Hacked"}, format="json")

    assert response.status_code == 403
    craft.refresh_from_db()
    assert craft.name != "Hacked"


def test_admin_can_edit_any_craft(client_for, admin_user):
    craft = CraftFactory()

    response = client_for(admin_user).patch(craft_url(craft), {"name": "Fixed"}, format="json")

    assert response.status_code == 200


def test_status_and_author_cannot_be_changed_through_edit(client_for, user):
    craft = CraftFactory()

    client_for(craft.author).patch(
        craft_url(craft), {"status": "hidden", "author": user.id}, format="json"
    )

    craft.refresh_from_db()
    assert craft.status == Craft.Status.PUBLISHED
    assert craft.author_id != user.id


def test_author_soft_deletes_craft(api_client, client_for):
    craft = CraftFactory()

    response = client_for(craft.author).delete(craft_url(craft))

    assert response.status_code == 204
    assert api_client.get(craft_url(craft)).status_code == 404
    assert client_for(craft.author).get(craft_url(craft)).status_code == 404
    assert Craft.all_objects.get(pk=craft.pk).is_deleted is True


def test_other_user_cannot_delete(client_for, user):
    craft = CraftFactory()

    assert client_for(user).delete(craft_url(craft)).status_code == 403
    assert Craft.objects.filter(pk=craft.pk).exists()


def test_hidden_craft_visibility(api_client, client_for, admin_user):
    craft = CraftFactory(status=Craft.Status.HIDDEN)
    stranger = UserFactory()

    assert api_client.get(craft_url(craft)).status_code == 404
    assert client_for(stranger).get(craft_url(craft)).status_code == 404
    assert client_for(craft.author).get(craft_url(craft)).status_code == 200
    assert client_for(admin_user).get(craft_url(craft)).status_code == 200


def test_publish_and_update_send_signals(client_for, user, payload, captured_signals):
    client = client_for(user)
    craft_id = client.post(CRAFTS_URL, payload, format="json").json()["data"]["id"]
    client.patch(f"{CRAFTS_URL}{craft_id}/", {"name": "Updated"}, format="json")

    assert captured_signals == [("published", craft_id, None), ("updated", craft_id, user.id)]


def test_unknown_craft_returns_404(api_client):
    assert api_client.get(f"{CRAFTS_URL}999999/").status_code == 404


def test_tools_materials_and_dimensions_are_optional(client_for, user, payload):
    payload.update(tools=[], materials=[], attributes={"dimensions": []})

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 201
    assert response.json()["data"]["tools"] == []


def test_craft_type_must_belong_to_the_category(client_for, user, payload):
    payload["category"] = Category.objects.get(slug="ceramics").id

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert "craft_type" in response.json()["errors"]


def test_changing_only_the_craft_type_is_checked_against_the_category(client_for):
    craft = CraftFactory(category=Category.objects.get(slug="ceramics"))
    carpet = CraftType.objects.get(name="Carpet")

    response = client_for(craft.author).patch(
        craft_url(craft), {"craft_type": carpet.id}, format="json"
    )

    assert response.status_code == 400
    assert "craft_type" in response.json()["errors"]


@pytest.mark.parametrize(
    ("field", "model"), [("craft_type", CraftType), ("tools", Tool), ("culture", Culture)]
)
def test_hidden_items_cannot_be_chosen(client_for, user, payload, field, model):
    ids = payload[field] if isinstance(payload[field], list) else [payload[field]]
    model.objects.filter(pk__in=ids).update(is_hidden=True)

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert field in response.json()["errors"]


def test_too_many_tools_are_rejected(client_for, user, payload):
    payload["tools"] = list(Tool.objects.values_list("pk", flat=True)[:21])

    response = client_for(user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 400
    assert "tools" in response.json()["errors"]


def test_editing_replaces_tools_and_materials(client_for, payload, user):
    client = client_for(user)
    craft_id = client.post(CRAFTS_URL, payload, format="json").json()["data"]["id"]
    shears = Tool.objects.get(name="Shears")
    silk = Material.objects.get(name="Silk")

    response = client.patch(
        f"{CRAFTS_URL}{craft_id}/",
        {"tools": [shears.id], "materials": [silk.id]},
        format="json",
    )

    data = response.json()["data"]
    assert [tool["name"] for tool in data["tools"]] == ["Shears"]
    assert [material["name"] for material in data["materials"]] == ["Silk"]


def test_items_hidden_later_still_show_on_the_craft(api_client, client_for, user, payload):
    craft_id = client_for(user).post(CRAFTS_URL, payload, format="json").json()["data"]["id"]
    Tool.objects.filter(name="Loom").update(is_hidden=True)

    data = api_client.get(f"{CRAFTS_URL}{craft_id}/").json()["data"]

    assert "Loom" in [tool["name"] for tool in data["tools"]]


def test_detail_query_count_is_fixed(api_client, django_assert_max_num_queries, payload):
    craft = CraftFactory()

    with django_assert_max_num_queries(5):
        api_client.get(craft_url(craft))
