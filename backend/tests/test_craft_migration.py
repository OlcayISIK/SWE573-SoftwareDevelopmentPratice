import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

BEFORE = [("crafts", "0007_structured_craft_fields")]
AFTER = [("crafts", "0009_remove_old_craft_fields")]


def migrate(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    return MigrationExecutor(connection).loader.project_state(targets).apps


@pytest.fixture
def old_apps():
    apps = migrate(BEFORE)
    yield apps
    migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


def test_existing_crafts_are_converted(old_apps):
    author = UserFactory()
    Craft = old_apps.get_model("crafts", "Craft")
    Category = old_apps.get_model("crafts", "Category")
    # Going back recreates the region table empty, so the regions are added again here.
    Region = old_apps.get_model("crafts", "Region")
    old = dict(
        latitude="39.4192",
        longitude="29.9833",
        author_id=author.id,
        description="Hand-painted glazed tile.",
        production_process="Shaped, painted, and fired.",
        how_to_understand="",
        cultural_relevance="A centuries-old tradition.",
    )
    tile = Craft.objects.create(
        name="Kütahya Çinisi",
        craft_type_name="tile",
        category=Category.objects.get(slug="ceramics"),
        region=Region.objects.create(name="Kütahya", country="Türkiye"),
        attributes={
            "dimensions_cm": {"height": 20, "width": 20},
            "materials": ["clay", "gold   thread"],
            "colors": ["cobalt blue"],
        },
        **old,
    )
    basket = Craft.objects.create(
        name="Removed basket",
        craft_type_name="rope basket",
        category=Category.objects.get(slug="basketry"),
        region=Region.objects.create(name="Oaxaca", country="Mexico"),
        is_deleted=True,
        **old,
    )
    # Inserted rows leave deferred constraint checks pending, which block the ALTER TABLEs.
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

    new_apps = migrate(AFTER)

    Craft = new_apps.get_model("crafts", "Craft")
    tile = Craft.objects.get(pk=tile.pk)
    assert tile.craft_type.name == "Tile"
    assert tile.craft_type.created_by_id is None  # matched to the seeded type
    assert (tile.address, tile.country, tile.city) == ("Kütahya, Türkiye", "Türkiye", "")
    assert tile.culture.name == "Turkish"
    assert tile.description == (
        "Hand-painted glazed tile.\n\n"
        "How it is made\nShaped, painted, and fired.\n\n"
        "Cultural relevance\nA centuries-old tradition."
    )
    assert tile.attributes == {
        "dimensions": [
            {"type": "height", "value": 20, "unit": "cm"},
            {"type": "width", "value": 20, "unit": "cm"},
        ],
        "colors": ["cobalt blue"],
    }
    materials = {material.name: material.created_by_id for material in tile.materials.all()}
    assert materials == {"Clay": None, "Gold thread": author.id}

    basket = Craft.objects.get(pk=basket.pk)
    assert basket.craft_type.name == "Rope basket"
    assert basket.craft_type.category.slug == "basketry"
    assert basket.craft_type.created_by_id == author.id
    assert basket.culture.name == "Zapotec"
