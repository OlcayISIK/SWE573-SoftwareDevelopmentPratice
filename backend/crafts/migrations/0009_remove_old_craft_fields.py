import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0008_convert_crafts"),
    ]

    operations = [
        migrations.RemoveField(model_name="craft", name="craft_type_name"),
        migrations.RemoveField(model_name="craft", name="region"),
        migrations.RemoveField(model_name="craft", name="production_process"),
        migrations.RemoveField(model_name="craft", name="how_to_understand"),
        migrations.RemoveField(model_name="craft", name="cultural_relevance"),
        migrations.AlterField(
            model_name="craft",
            name="craft_type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="crafts",
                to="crafts.crafttype",
            ),
        ),
        migrations.DeleteModel(name="Region"),
    ]
