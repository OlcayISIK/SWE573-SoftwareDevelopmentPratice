from django.db import migrations

GRAMS_PER_UNIT = {"g": 1, "kg": 1000, "oz": 28.349523125, "lb": 453.59237}


def weight_to_dimension(apps, schema_editor):
    """Moves `weight_g` into the dimensions as a weight row, in grams."""
    Craft = apps.get_model("crafts", "Craft")
    for craft in Craft.objects.filter(attributes__has_key="weight_g"):
        attributes = dict(craft.attributes)
        weight = attributes.pop("weight_g")
        dimensions = attributes.get("dimensions", [])
        attributes["dimensions"] = [*dimensions, {"type": "weight", "value": weight, "unit": "g"}]
        craft.attributes = attributes
        craft.save(update_fields=["attributes"])


def dimension_to_weight(apps, schema_editor):
    """Moves a weight row back to `weight_g` and drops the rows the older form did not allow."""
    Craft = apps.get_model("crafts", "Craft")
    for craft in Craft.objects.filter(attributes__has_key="dimensions"):
        attributes = dict(craft.attributes)
        dimensions = []
        for row in attributes["dimensions"]:
            if row["type"] == "weight":
                attributes["weight_g"] = round(row["value"] * GRAMS_PER_UNIT[row["unit"]], 2)
            elif row["type"] != "volume" and row["unit"] in ("mm", "cm", "m"):
                dimensions.append(row)
        attributes["dimensions"] = dimensions
        craft.attributes = attributes
        craft.save(update_fields=["attributes"])


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0012_craft_story"),
    ]

    operations = [
        migrations.RunPython(weight_to_dimension, dimension_to_weight),
    ]
