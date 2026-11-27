from django.core.management.base import BaseCommand

from crafts.services import refresh_wikidata_names


class Command(BaseCommand):
    help = (
        "Fetches the English and Turkish names, and the broader kinds, of every category, craft "
        "type, tool, material, and culture linked to a Wikidata item, so searches use the latest "
        "names. Items Wikidata does not answer for keep their names. Run it now and then; it "
        "makes a few requests per linked item."
    )

    def handle(self, *args, **options):
        refreshed, failed, _ = refresh_wikidata_names()
        self.stdout.write(self.style.SUCCESS(f"Refreshed the names of {refreshed} items."))
        if failed:
            self.stdout.write(
                self.style.WARNING(
                    f"{failed} items kept their names because Wikidata did not answer for them. "
                    "Run the command again later."
                )
            )
