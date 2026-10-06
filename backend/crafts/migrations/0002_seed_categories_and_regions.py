from django.db import migrations

CATEGORIES = [
    ("Ceramics", "ceramics"),
    ("Textiles", "textiles"),
    ("Woodwork", "woodwork"),
    ("Metalwork", "metalwork"),
    ("Glass", "glass"),
    ("Jewelry", "jewelry"),
    ("Basketry", "basketry"),
    ("Leatherwork", "leatherwork"),
    ("Paper and Calligraphy", "paper-and-calligraphy"),
    ("Stone Carving", "stone-carving"),
]

REGIONS = [
    (
        "Kütahya",
        "Türkiye",
        "Western Anatolian province known for centuries of glazed tile and ceramic production.",
    ),
    (
        "İznik",
        "Türkiye",
        "Town in northwestern Anatolia, the center of Ottoman fritware ceramics in the "
        "15th to 17th centuries.",
    ),
    (
        "Uşak",
        "Türkiye",
        "Western Anatolian province historically known for hand-knotted carpets.",
    ),
    (
        "Oaxaca",
        "Mexico",
        "State in southern Mexico known for black pottery, textiles, and wood carving.",
    ),
    (
        "Navajo Nation",
        "United States",
        "Indigenous territory in the southwestern United States known for weaving and "
        "silversmithing.",
    ),
    (
        "Cusco",
        "Peru",
        "Andean region of Peru with long traditions of textile weaving.",
    ),
    (
        "Rajasthan",
        "India",
        "State in northwestern India known for block printing, textiles, and pottery.",
    ),
    (
        "Kyoto",
        "Japan",
        "Former imperial capital with traditions in ceramics, textiles, and lacquerware.",
    ),
    (
        "Ashanti",
        "Ghana",
        "Region in southern Ghana known for kente cloth weaving and wood carving.",
    ),
    (
        "Sápmi",
        "Norway",
        "Homeland of the Sámi people, known for duodji handicrafts in wood, bone, and leather.",
    ),
    (
        "Aotearoa",
        "New Zealand",
        "Homeland of the Māori people, known for wood carving, weaving, and pounamu carving.",
    ),
    (
        "Bukhara",
        "Uzbekistan",
        "Central Asian city known for suzani embroidery and carpets.",
    ),
]


def seed(apps, schema_editor):
    Category = apps.get_model("crafts", "Category")
    Region = apps.get_model("crafts", "Region")
    for name, slug in CATEGORIES:
        Category.objects.get_or_create(slug=slug, defaults={"name": name})
    for name, country, description in REGIONS:
        Region.objects.get_or_create(
            name=name, country=country, defaults={"description": description}
        )


def unseed(apps, schema_editor):
    Category = apps.get_model("crafts", "Category")
    Region = apps.get_model("crafts", "Region")
    Category.objects.filter(slug__in=[slug for _, slug in CATEGORIES]).delete()
    for name, country, _ in REGIONS:
        Region.objects.filter(name=name, country=country).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
