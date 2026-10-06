import pytest

from crafts import signals
from crafts.models import Category, Craft, Region
from tests.factories import CraftFactory, UserFactory

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"


def craft_url(craft):
    return f"{CRAFTS_URL}{craft.id}/"


@pytest.fixture
def payload():
    return {
        "name": "Kütahya Çinisi",
        "craft_type": "Tile",
        "category": Category.objects.get(slug="ceramics").id,
        "region": Region.objects.get(name="Kütahya").id,
        "latitude": 39.4192345,
        "longitude": 29.9833471,
        "description": "Hand-painted glazed tiles and ceramics.",
        "production_process": "Clay is shaped, painted with underglaze, glazed, and fired.",
        "how_to_understand": "Floral motifs and cobalt blue are typical.",
        "cultural_relevance": "A living tradition of Anatolian ceramic art.",
        "attributes": {
            "dimensions_cm": {"height": 20, "width": 20},
            "colors": ["cobalt blue", "turquoise"],
            "distinguishing_features": "Hand-painted floral motifs under a clear glaze",
        },
    }


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
    assert data["category"]["slug"] == "ceramics"
    assert data["region"]["name"] == "Kütahya"
    assert data["attributes"]["colors"] == ["cobalt blue", "turquoise"]
    assert data["how_to_understand"] == payload["how_to_understand"]


def test_coordinates_are_rounded_to_six_decimals(client_for, user, payload):
    data = client_for(user).post(CRAFTS_URL, payload, format="json").json()["data"]

    assert data["latitude"] == 39.419235
    assert data["longitude"] == 29.983347


def test_unverified_user_cannot_publish(client_for, unverified_user, payload):
    response = client_for(unverified_user).post(CRAFTS_URL, payload, format="json")

    assert response.status_code == 403
    assert "Verify your email" in response.json()["message"]
    assert not Craft.objects.exists()


def test_guest_cannot_publish(api_client, payload):
    assert api_client.post(CRAFTS_URL, payload, format="json").status_code == 401


@pytest.mark.parametrize(
    "field", ["name", "category", "region", "latitude", "description", "cultural_relevance"]
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
        {"dimensions_cm": {"height": -1}},
        {"dimensions_cm": {"volume": 3}},
        {"dimensions_cm": {}},
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
