"""
Creates the eight sections that match the leaves on the vine.

The front end measures each leaf's position by slug, so these eight and only
these eight can exist. Running this gives Neida a ready structure to fill in
rather than an empty admin and no clue what to make.

Safe to re-run: it updates the fixed fields (which must agree with the artwork)
and leaves anything she has written alone.
"""

from django.core.management.base import BaseCommand

from portfolio.models import SectionKind, SiteInfo, Section

SECTIONS = [
    ("clay", "clay", "Thrown, pinched, and glazed.", SectionKind.GALLERY, "#b5674a", 1),
    ("florals", "florals", "Arrangements, installations, and standing weekly work.", SectionKind.GALLERY, "#b8607f", 2),
    ("film", "film", "Shot on film, mostly of people and plants.", SectionKind.GALLERY, "#4a6b8c", 3),
    ("education", "education", "Workshops and classes, for beginners and the already-obsessed.", SectionKind.TEACHING, "#4a7a5c", 4),
    ("cake", "cake", "Cakes, breads, and things that only work at the right temperature.", SectionKind.GALLERY, "#98763f", 5),
    ("research", "research", "Published work, talks, and things still in progress.", SectionKind.RESEARCH, "#34706c", 6),
    ("drawings", "drawings", "Ink and graphite, mostly at the kitchen table.", SectionKind.GALLERY, "#6a5d8f", 7),
    ("textiles", "textiles", "Dyed, stitched, and woven by hand.", SectionKind.GALLERY, "#6f7a4b", 8),
]


class Command(BaseCommand):
    help = "Create the eight sections matching the leaves on the vine."

    def handle(self, *args, **options):
        if not SiteInfo.objects.exists():
            SiteInfo.objects.create(intro="I work with flowers, dough, ink and evidence.")
            self.stdout.write("Created your details.")

        for slug, title, tagline, kind, accent, order in SECTIONS:
            section, created = Section.objects.get_or_create(
                slug=slug,
                defaults={"title": title, "tagline": tagline, "kind": kind,
                          "accent": accent, "order": order},
            )
            if created:
                self.stdout.write(f"Created section: {title}")
            else:
                # Only the fields that must agree with the artwork and the
                # layout. Her words are never overwritten.
                section.kind = kind
                section.accent = accent
                section.order = order
                section.save(update_fields=["kind", "accent", "order"])
                self.stdout.write(f"Checked section: {title}")

        self.stdout.write(self.style.SUCCESS("Done."))
