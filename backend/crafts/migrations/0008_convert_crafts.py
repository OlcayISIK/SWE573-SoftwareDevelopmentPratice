from django.db import migrations

# The culture behind the crafts of each seeded region.
REGION_CULTURES = {
    "Kütahya": "Turkish",
    "İznik": "Turkish",
    "Uşak": "Turkish",
    "Oaxaca": "Zapotec",
    "Navajo Nation": "Diné (Navajo)",
    "Cusco": "Quechua",
    "Rajasthan": "Rajasthani",
    "Kyoto": "Japanese",
    "Ashanti": "Asante",
    "Sápmi": "Sámi",
    "Aotearoa": "Māori",
    "Bukhara": "Uzbek",
}

DIMENSION_ORDER = ["height", "width", "depth", "length", "diameter"]

# The separate texts are joined into one description, each under its old label.
SECTIONS = [
    ("description", None),
    ("production_process", "How it is made"),
    ("how_to_understand", "How to understand it"),
    ("cultural_relevance", "Cultural relevance"),
]


def _capitalized(name):
    name = " ".join(name.split())[:80]
    return name[:1].upper() + name[1:]


def _find_or_add(model, name, author_id, **scope):
    item = model.objects.filter(name__iexact=name, **scope).first()
    if item is None:
        item = model.objects.create(name=name, created_by_id=author_id, **scope)
    return item


def _description(craft):
    parts = []
    for field, label in SECTIONS:
        text = getattr(craft, field).strip()
        if text:
            parts.append(f"{label}\n{text}" if label else text)
    return "\n\n".join(parts)


def _attributes(attributes):
    attributes = dict(attributes or {})
    materials = attributes.pop("materials", [])
    dimensions = attributes.pop("dimensions_cm", None)
    if dimensions:
        # The stored JSON does not keep key order, so the rows follow the old form's order.
        attributes["dimensions"] = [
            {"type": key, "value": dimensions[key], "unit": "cm"}
            for key in DIMENSION_ORDER
            if key in dimensions
        ]
    return attributes, materials


def convert(apps, schema_editor):
    Craft = apps.get_model("crafts", "Craft")
    CraftType = apps.get_model("crafts", "CraftType")
    Material = apps.get_model("crafts", "Material")
    Culture = apps.get_model("crafts", "Culture")
    cultures = {culture.name: culture for culture in Culture.objects.all()}

    # The historical model's manager includes soft-deleted crafts, so they are converted too.
    for craft in Craft.objects.select_related("region"):
        type_name = _capitalized(craft.craft_type_name) or "Other"
        craft.craft_type = _find_or_add(
            CraftType, type_name, craft.author_id, category_id=craft.category_id
        )
        craft.address = f"{craft.region.name}, {craft.region.country}"
        craft.country = craft.region.country
        craft.culture = cultures.get(REGION_CULTURES.get(craft.region.name))
        craft.description = _description(craft)
        craft.attributes, materials = _attributes(craft.attributes)
        # Leave updated_at alone: converting is not an edit.
        craft.save(
            update_fields=[
                "craft_type",
                "address",
                "country",
                "culture",
                "description",
                "attributes",
            ]
        )
        for name in materials:
            name = _capitalized(name)
            if name:
                craft.materials.add(_find_or_add(Material, name, craft.author_id))


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0007_structured_craft_fields"),
    ]

    operations = [
        # Going back keeps the converted values; the region and the separate texts, removed
        # in 0009, cannot be restored.
        migrations.RunPython(convert, migrations.RunPython.noop),
    ]
