import math

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from crafts.colors import SIMILAR_DISTANCE, to_lab
from crafts.models import CraftColor
from tests.factories import CraftFactory, UserFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"
MAP_URL = "/api/v1/crafts/map/"

COBALT = "#1e40af"
TURQUOISE = "#40e0d0"


def publish(client, colors):
    return client.post(CRAFTS_URL, craft_payload(colors=colors), format="json")


def names(response):
    data = response.json()["data"]
    items = data["items"] if isinstance(data, dict) else data
    return {item["name"] for item in items}


def craft_with(*values, name):
    craft = CraftFactory(name=name)
    for order, value in enumerate(values):
        CraftColor.objects.create(
            craft=craft,
            value=value,
            order=order,
            **dict(zip(("lab_l", "lab_a", "lab_b"), to_lab(value), strict=True)),
        )
    return craft


def test_colors_are_saved_in_order(client_for, user):
    response = publish(client_for(user), [COBALT, " #40E0D0 "])

    assert response.status_code == 201
    assert response.json()["data"]["colors"] == [COBALT, TURQUOISE]


def test_see_through_colors_keep_their_alpha(client_for, user):
    response = publish(client_for(user), ["#1e40af80"])

    assert response.json()["data"]["colors"] == ["#1e40af80"]


def test_colors_are_optional(client_for, user):
    response = publish(client_for(user), [])

    assert response.status_code == 201
    assert response.json()["data"]["colors"] == []


@pytest.mark.parametrize(
    "colors",
    [
        ["blue"],
        ["#12345"],
        ["rgb(1, 2, 3)"],
        [{"value": "#1e40af"}],
        "#1e40af",
        # The same color twice, even with different opacity.
        [COBALT, "#1E40AF80"],
        [f"#0000{n:02x}" for n in range(11)],
    ],
)
def test_invalid_colors_are_rejected(client_for, user, colors):
    response = publish(client_for(user), colors)

    assert response.status_code == 400
    assert "colors" in response.json()["errors"]


def test_editing_replaces_the_colors(client_for, user):
    client = client_for(user)
    craft_id = publish(client, [COBALT, TURQUOISE]).json()["data"]["id"]

    response = client.patch(f"{CRAFTS_URL}{craft_id}/", {"colors": ["#b91c1c"]}, format="json")

    assert response.json()["data"]["colors"] == ["#b91c1c"]
    assert CraftColor.objects.filter(craft_id=craft_id).count() == 1


def test_lab_values_are_stored_for_searching(client_for, user):
    publish(client_for(user), [COBALT])

    color = CraftColor.objects.get()
    assert (color.lab_l, color.lab_a, color.lab_b) == pytest.approx(to_lab("#1e40af"))


def test_crafts_with_a_similar_color_are_found(api_client):
    craft_with("#1e40af", "#dc2626", name="Blue and red")
    craft_with("#1d4ed8", name="Brighter blue")
    craft_with("#7e22ce", name="Purple")

    response = api_client.get(CRAFTS_URL, {"color": "1e40af"})

    assert names(response) == {"Blue and red", "Brighter blue"}
    # The map uses the same filter.
    assert names(api_client.get(MAP_URL, {"color": "#1E40AF"})) == {"Blue and red", "Brighter blue"}


def test_similar_means_within_the_set_distance():
    close = math.dist(to_lab("#1e40af"), to_lab("#1d4ed8"))
    far = math.dist(to_lab("#1e40af"), to_lab("#7e22ce"))

    assert close < SIMILAR_DISTANCE < far


def test_a_craft_with_several_matching_colors_is_listed_once(api_client):
    craft_with("#1e40af", "#1d4ed8", name="Two blues")

    data = api_client.get(CRAFTS_URL, {"color": "1e40af"}).json()["data"]

    assert data["total"] == 1


@pytest.mark.parametrize("color", ["blue", "#12345", "1e40af80"])
def test_invalid_color_filter_is_rejected(api_client, color):
    response = api_client.get(CRAFTS_URL, {"color": color})

    assert response.status_code == 400
    assert "color" in response.json()["errors"]


def test_old_text_colors_are_dropped_by_the_migration():
    craft = CraftFactory(attributes={"colors": ["cobalt blue"], "weight_g": 450})
    executor = MigrationExecutor(connection)
    executor.migrate([("crafts", "0009_remove_old_craft_fields")])
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
        MigrationExecutor(connection).migrate([("crafts", "0010_craft_colors")])
        craft.refresh_from_db()
        assert craft.attributes == {"weight_g": 450}
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())


def test_a_user_can_still_publish_after_colors(client_for):
    # A second author, to be sure colors do not leak between crafts.
    first = publish(client_for(UserFactory()), [COBALT]).json()["data"]
    second = publish(client_for(UserFactory()), []).json()["data"]

    assert first["colors"] == [COBALT]
    assert second["colors"] == []
