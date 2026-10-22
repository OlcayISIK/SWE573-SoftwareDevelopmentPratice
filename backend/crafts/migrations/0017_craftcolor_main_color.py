from django.db import migrations, models

from crafts.colors import MAIN_COLORS, main_color


def set_main_colors(apps, schema_editor):
    """Matches every stored color to the main color it is closest to."""
    CraftColor = apps.get_model("crafts", "CraftColor")
    colors = list(CraftColor.objects.all())
    for color in colors:
        color.main_color = main_color(color.value)
    CraftColor.objects.bulk_update(colors, ["main_color"])


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0016_category_icon"),
    ]

    operations = [
        migrations.AddField(
            model_name="craftcolor",
            name="main_color",
            field=models.CharField(
                choices=[(name, name) for name in MAIN_COLORS], default="grey", max_length=10
            ),
            preserve_default=False,
        ),
        migrations.RunPython(set_main_colors, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="craftcolor",
            index=models.Index(fields=["main_color"], name="craft_color_main_color_idx"),
        ),
    ]
