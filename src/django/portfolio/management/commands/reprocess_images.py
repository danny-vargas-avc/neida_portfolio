"""
Re-prepares pictures that were uploaded before images were processed on save.

Those files are the phone's originals: full resolution, several megabytes, and
carrying the GPS coordinates of wherever they were taken. Running this replaces
each one with the resized, metadata-free versions and deletes the original.

    python manage.py reprocess_images          # report what would change
    python manage.py reprocess_images --apply  # do it
"""

from pathlib import Path

from django.core.management.base import BaseCommand

from portfolio.imaging import prepare
from portfolio.models import Piece


class Command(BaseCommand):
    help = "Resize and strip metadata from pictures uploaded before that was automatic."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually rewrite the files. Without it, only reports.",
        )

    def handle(self, *args, **options):
        apply = options["apply"]
        # A processed picture is WebP and has a thumbnail; anything else predates
        # this and still needs doing.
        pending = [
            p
            for p in Piece.objects.all()
            if p.image and (not p.thumbnail or not p.image.name.endswith(".webp"))
        ]

        if not pending:
            self.stdout.write("Nothing to do — every picture is already prepared.")
            return

        for piece in pending:
            old_name = piece.image.name
            before = piece.image.size

            if not apply:
                self.stdout.write(f"  would reprocess  {old_name}  ({before / 1e6:.1f}MB)")
                continue

            with piece.image.open("rb") as fh:
                full, thumb = prepare(fh)

            stem = Path(old_name).stem
            piece.image.save(f"{stem}.webp", full, save=False)
            piece.thumbnail.save(f"{stem}-thumb.webp", thumb, save=False)
            # save() would otherwise see a changed filename and prepare it a
            # second time, from the already-processed file.
            super(Piece, piece).save()

            # Only once the row points at the new file, so a failure above
            # leaves the original in place.
            piece.image.storage.delete(old_name)

            after = piece.image.size + piece.thumbnail.size
            self.stdout.write(
                f"  {old_name}  {before / 1e6:.1f}MB -> {after / 1e6:.2f}MB "
                f"({100 - after / before * 100:.0f}% smaller)"
            )

        if not apply:
            self.stdout.write(self.style.WARNING("\nDry run. Add --apply to rewrite."))
        else:
            self.stdout.write(self.style.SUCCESS(f"\nDone. {len(pending)} rewritten."))
