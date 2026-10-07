import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0006_seed_lookup_lists"),
    ]

    operations = [
        # Keep the old text until 0008 has matched it to a craft type.
        migrations.RenameField(model_name="craft", old_name="craft_type", new_name="craft_type_name"),
        migrations.AddField(
            model_name="craft",
            name="craft_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="crafts",
                to="crafts.crafttype",
            ),
        ),
        migrations.AddField(
            model_name="craft",
            name="tools",
            field=models.ManyToManyField(blank=True, related_name="crafts", to="crafts.tool"),
        ),
        migrations.AddField(
            model_name="craft",
            name="materials",
            field=models.ManyToManyField(blank=True, related_name="crafts", to="crafts.material"),
        ),
        migrations.AddField(
            model_name="craft",
            name="culture",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="crafts",
                to="crafts.culture",
            ),
        ),
        migrations.AddField(
            model_name="craft",
            name="address",
            field=models.CharField(default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="craft",
            name="city",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="craft",
            name="country",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
