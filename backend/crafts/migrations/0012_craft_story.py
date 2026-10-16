from django.db import migrations, models

# Sections of the old single description that belong to the story, by their first line.
STORY_HEADINGS = ("How to understand it\n", "Cultural relevance\n")


def split_story(text):
    """Splits a description into (description, story) at its story sections."""
    parts = text.split("\n\n")
    story = [part for part in parts if part.startswith(STORY_HEADINGS)]
    rest = [part for part in parts if not part.startswith(STORY_HEADINGS)]
    return "\n\n".join(rest), "\n\n".join(story)


def move_story(apps, schema_editor):
    Craft = apps.get_model("crafts", "Craft")
    for craft in Craft.objects.all():
        description, story = split_story(craft.description)
        if story and description:
            craft.description, craft.story = description, story
            craft.save(update_fields=["description", "story"])


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0011_remove_color_lab_values"),
    ]

    operations = [
        migrations.AddField(
            model_name="craft",
            name="story",
            field=models.TextField(blank=True),
        ),
        # Going back keeps the story in its own field; nothing is lost.
        migrations.RunPython(move_story, migrations.RunPython.noop),
    ]
