from importlib import import_module

import pytest
from django.apps import apps
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from crafts.colors import main_color
from crafts.models import Craft, CraftColor
from tests.factories import CraftFactory, UserFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"

COBALT = "#1e40af"
TURQUOISE = "#40e0d0"


def publish(client, colors):
    return client.post(CRAFTS_URL, craft_payload(colors=colors), format="json")


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


def check_constraints_now():
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")


def test_old_text_colors_are_dropped_by_the_migration():
    craft = CraftFactory(attributes={"colors": ["cobalt blue"], "weight_g": 450})
    # Data changes leave deferred checks pending, which block the next ALTER TABLE.
    check_constraints_now()
    executor = MigrationExecutor(connection)
    executor.migrate([("crafts", "0009_remove_old_craft_fields")])
    try:
        check_constraints_now()
        MigrationExecutor(connection).migrate([("crafts", "0010_craft_colors")])
        # Only this column: the model's later fields are not in the table yet.
        attributes = Craft.objects.values_list("attributes", flat=True).get(pk=craft.pk)
        assert attributes == {"weight_g": 450}
    finally:
        check_constraints_now()
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())


def test_a_user_can_still_publish_after_colors(client_for):
    # A second author, to be sure colors do not leak between crafts.
    first = publish(client_for(UserFactory()), [COBALT]).json()["data"]
    second = publish(client_for(UserFactory()), []).json()["data"]

    assert first["colors"] == [COBALT]
    assert second["colors"] == []


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("#b91c1c", "red"),
        ("#e8a33d", "orange"),
        ("#f1c40f", "yellow"),
        ("#2f7d32", "green"),
        ("#0e9aa7", "turquoise"),
        ("#1e3a8a", "blue"),
        ("#7e3fb5", "purple"),
        ("#ffc0cb", "pink"),
        ("#6b4a2b", "brown"),
        ("#111111", "black"),
        ("#f8f5ee", "white"),
        ("#c0c0c0", "grey"),
        # See-through colors are judged by their color, not their opacity.
        ("#40e0d080", "turquoise"),
    ],
)
def test_each_color_has_a_main_color(value, expected):
    assert main_color(value) == expected


def test_crafts_are_found_by_a_main_color_close_to_theirs(client_for, user, api_client):
    client = client_for(user)
    client.post(CRAFTS_URL, craft_payload(name="Madder rug", colors=["#9e2a2b"]), format="json")
    client.post(CRAFTS_URL, craft_payload(name="Indigo rug", colors=["#1f2a4d"]), format="json")

    found = api_client.get(CRAFTS_URL, {"color": "red"}).json()["data"]["items"]
    colors = api_client.get(f"{CRAFTS_URL}facets/").json()["data"]["colors"]

    assert [item["name"] for item in found] == ["Madder rug"]
    # Main colors come in the order the filter shows them.
    assert colors == [{"name": "red", "count": 1}, {"name": "blue", "count": 1}]


def test_only_main_colors_can_be_filtered_by(api_client):
    response = api_client.get(CRAFTS_URL, {"color": "#ff0000"})

    assert response.status_code == 400
    assert "color" in response.json()["errors"]


def test_the_migration_gives_existing_colors_their_main_color():
    craft = CraftFactory()
    color = CraftColor.objects.create(craft=craft, value="#1e3a8a", main_color="grey")

    import_module("crafts.migrations.0017_craftcolor_main_color").set_main_colors(apps, None)

    color.refresh_from_db()
    assert color.main_color == "blue"
