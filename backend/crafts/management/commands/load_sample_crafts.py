from django.core.management.base import BaseCommand, CommandError
from django.db.models import ProtectedError

from crafts.samples import SampleDataError, load_samples, remove_samples


class Command(BaseCommand):
    help = (
        "Loads sample crafts from real places with freely licensed photos. Running it again adds "
        "nothing; --remove takes them out."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--remove",
            action="store_true",
            help="Remove the sample crafts, their photos, and the sample contributors.",
        )

    def handle(self, *args, remove=False, **options):
        try:
            if remove:
                removed = remove_samples()
                self.stdout.write(self.style.SUCCESS(f"Removed {removed} sample crafts."))
                return
            added, existing = load_samples()
        except SampleDataError as exc:
            raise CommandError(f"{exc}. Run the migrations first.") from exc
        except ProtectedError as exc:
            raise CommandError(
                "Some sample crafts have reports. Review them in the admin before removing."
            ) from exc
        self.stdout.write(
            self.style.SUCCESS(f"Loaded {added} sample crafts ({existing} were already there).")
        )
