from importlib import import_module

import pytest
from django.apps import apps

from tests.factories import CraftFactory

pytestmark = pytest.mark.django_db

migration = import_module("crafts.migrations.0013_weight_as_dimension")


def test_the_weight_becomes_a_dimension_row():
    craft = CraftFactory(
        attributes={
            "dimensions": [{"type": "height", "value": 20, "unit": "cm"}],
            "weight_g": 450,
            "distinguishing_features": "Blue glaze",
        }
    )
    plain = CraftFactory(attributes={"distinguishing_features": "No weight"})

    migration.weight_to_dimension(apps, None)

    craft.refresh_from_db()
    plain.refresh_from_db()
    assert craft.attributes == {
        "dimensions": [
            {"type": "height", "value": 20, "unit": "cm"},
            {"type": "weight", "value": 450, "unit": "g"},
        ],
        "distinguishing_features": "Blue glaze",
    }
    assert plain.attributes == {"distinguishing_features": "No weight"}


def test_going_back_restores_the_weight_in_grams():
    craft = CraftFactory(
        attributes={
            "dimensions": [
                {"type": "height", "value": 20, "unit": "cm"},
                {"type": "width", "value": 8, "unit": "in"},
                {"type": "weight", "value": 2, "unit": "lb"},
                {"type": "volume", "value": 1, "unit": "l"},
            ]
        }
    )

    migration.dimension_to_weight(apps, None)

    craft.refresh_from_db()
    assert craft.attributes == {
        "dimensions": [{"type": "height", "value": 20, "unit": "cm"}],
        "weight_g": 907.18,
    }
