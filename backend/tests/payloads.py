from crafts.models import Category, CraftType, Culture, Material, Tool


def craft_data(**overrides):
    """Valid craft fields as model instances, built from the seeded lookup lists."""
    textiles = Category.objects.get(slug="textiles")
    data = {
        "name": "Uşak Halısı",
        "category": textiles,
        "craft_type": CraftType.objects.get(category=textiles, name="Carpet"),
        "tools": [Tool.objects.get(name="Loom"), Tool.objects.get(name="Knotting knife")],
        "materials": [Material.objects.get(name="Wool"), Material.objects.get(name="Madder")],
        "culture": Culture.objects.get(name="Turkish"),
        "places": [
            {
                "address": "Uşak, Türkiye",
                "city": "Uşak",
                "country": "Türkiye",
                "latitude": 38.68,
                "longitude": 29.41,
            }
        ],
        "description": "Hand-knotted wool carpet with medallion layouts, exported since the 1500s.",
    }
    data.update(overrides)
    return data


def craft_payload(**overrides):
    """The same craft as an API request body, with ids instead of instances."""
    payload = {}
    for field, value in craft_data(**overrides).items():
        if isinstance(value, list):
            payload[field] = [getattr(item, "pk", item) for item in value]
        elif hasattr(value, "pk"):
            payload[field] = value.pk
        else:
            payload[field] = value
    return payload
