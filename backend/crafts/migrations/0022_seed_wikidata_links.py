"""
Links the seeded categories, craft types, and materials to their Wikidata items, with the
names and broader kinds fetched when this migration was written (wikidata_links.json), so it
needs no network. `python manage.py refresh_wikidata_names` fetches newer names later.

The names only widen searches, so if the file cannot be read the items stay unlinked and the
migration still succeeds; searches then work as before.
"""

import json
import logging
import unicodedata
from pathlib import Path

from django.db import migrations

logger = logging.getLogger(__name__)

LINKS = Path(__file__).with_name("wikidata_links.json")
MODELS = {"category": "Category", "craft_type": "CraftType", "material": "Material"}
FOLDED = str.maketrans({"ı": "i", "İ": "I", "ş": "s", "Ş": "S", "ğ": "g", "Ğ": "G"})


def fold(text):
    decomposed = unicodedata.normalize("NFKD", text.translate(FOLDED))
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def unique_names(names, skip=""):
    seen = {skip.casefold()}
    result = []
    for name in names:
        if name and name.casefold() not in seen:
            seen.add(name.casefold())
            result.append(name)
    return result


def link(apps, schema_editor):
    try:
        links = json.loads(LINKS.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        logger.warning("Seeded items are left unlinked; %s could not be read: %s", LINKS, exc)
        return
    for kind, model_name in MODELS.items():
        model = apps.get_model("crafts", model_name)
        for name, fields in links.get(kind, {}).items():
            # Only the seeded item, not one a user added with the same name.
            for item in model.objects.filter(name=name, created_by=None, wikidata_id=""):
                item.wikidata_id = fields["wikidata_id"]
                item.wikidata_names = fields["wikidata_names"]
                item.broader = fields["broader"]
                item.other_names = unique_names([*item.other_names, *fields["other_names"]])
                names = unique_names([*item.other_names, *item.wikidata_names], skip=item.name)
                item.search_names = "\n".join(unique_names([*names, *map(fold, names)]))
                item.save()


def unlink(apps, schema_editor):
    for model_name in MODELS.values():
        apps.get_model("crafts", model_name).objects.filter(created_by=None).update(
            wikidata_id="", wikidata_names=[], broader=[], other_names=[], search_names=""
        )


class Migration(migrations.Migration):
    dependencies = [("crafts", "0021_lookup_wikidata_names")]

    operations = [migrations.RunPython(link, unlink)]
