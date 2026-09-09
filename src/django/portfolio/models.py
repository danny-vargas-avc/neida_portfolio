"""
Content for Neida's portfolio.

The shape mirrors what the front end renders. One important constraint: the
sections are the leaves on Neida's hand-drawn vine, and each leaf's position is
measured by hand in the front end (app/components/vine-leaves.ts). So a section's
slug is chosen from a fixed list rather than typed — inventing a new one would
produce a section with no leaf to click on. Adding a genuinely new discipline
means new artwork and a new measured leaf, which is a developer job.

Everything a non-developer needs to change — words, photos, ordering — is free
text or an upload. The fields that must line up with the drawing or the code
(slug, accent, kind) are kept together and out of the way in the admin.
"""

from django.core.validators import FileExtensionValidator, RegexValidator
from django.db import models


class LeafSlug(models.TextChoices):
    """The leaves that exist on the drawing. See app/components/vine-leaves.ts."""

    CLAY = "clay", "Clay"
    FLORALS = "florals", "Florals"
    FILM = "film", "Film"
    EDUCATION = "education", "Education"
    CAKE = "cake", "Cake"
    RESEARCH = "research", "Research"
    DRAWINGS = "drawings", "Drawings"
    TEXTILES = "textiles", "Textiles"


class SectionKind(models.TextChoices):
    """Which layout the section's contents are rendered with."""

    GALLERY = "gallery", "Gallery of pictures"
    RESEARCH = "research", "List of publications"
    TEACHING = "teaching", "Workshops and classes"
    WRITING = "writing", "Long-form writing"


HEX_COLOUR = RegexValidator(
    r"^#(?:[0-9a-fA-F]{3}){1,2}$",
    "Enter a hex colour such as #b5674a.",
)


class SiteInfo(models.Model):
    """
    Your name and introduction — the text at the top and bottom of the page.

    There is only ever one of these; the admin hides the "add" button once it
    exists so there is nothing to get wrong.
    """

    name = models.CharField(
        max_length=120,
        default="Neida Rodriguez",
        help_text="Shown in large type at the top of the page.",
    )
    role = models.CharField(
        max_length=200,
        blank=True,
        default="maker · artist · researcher",
        help_text="The small line under your name.",
    )
    intro = models.TextField(
        blank=True,
        help_text="A sentence or two under your name. Leave blank to hide it.",
    )
    about = models.TextField(
        blank=True,
        help_text=(
            "A longer introduction near the bottom of the page. Leave blank and "
            "the whole About section is hidden rather than showing an empty heading."
        ),
    )
    email = models.EmailField(
        blank=True,
        help_text="Add an address and it becomes a contact link in the footer.",
    )
    location = models.CharField(
        max_length=120,
        blank=True,
        help_text='For example "Brooklyn, NY". Leave blank to hide it.',
    )

    class Meta:
        verbose_name = "Your details"
        verbose_name_plural = "Your details"

    def __str__(self) -> str:
        return self.name


class SocialLink(models.Model):
    """A link in the footer — Instagram, Google Scholar, anything."""

    site = models.ForeignKey(SiteInfo, on_delete=models.CASCADE, related_name="links")
    label = models.CharField(max_length=60, help_text='What the link says, e.g. "Instagram".')
    url = models.URLField(help_text="The full address, including https://")
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers come first.")

    class Meta:
        ordering = ("order", "id")
        verbose_name = "Link"

    def __str__(self) -> str:
        return self.label


class Section(models.Model):
    """One leaf on the vine, and everything shown when it is chosen."""

    slug = models.CharField(
        max_length=32,
        choices=LeafSlug.choices,
        unique=True,
        verbose_name="Leaf",
        help_text="Which leaf on the drawing this section belongs to.",
    )
    title = models.CharField(
        max_length=80,
        help_text="The heading shown when this section is open, e.g. “clay”.",
    )
    tagline = models.CharField(
        max_length=200,
        blank=True,
        help_text="One line under the heading.",
    )
    intro = models.TextField(
        blank=True,
        help_text=(
            "An opening paragraph. Leave blank and the page skips it entirely, so "
            "an unfinished section still looks deliberate."
        ),
    )
    kind = models.CharField(
        max_length=20,
        choices=SectionKind.choices,
        default=SectionKind.GALLERY,
        verbose_name="Layout",
        help_text="What this section mainly contains.",
    )
    accent = models.CharField(
        max_length=7,
        validators=[HEX_COLOUR],
        default="#b5674a",
        verbose_name="Colour",
        help_text="The colour this leaf turns when hovered, and the heading colour.",
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Lower numbers come first when moving between leaves with the arrow keys.",
    )
    # PDF only, and not merely for tidiness: uploads are served from the site's
    # own domain, so a file the browser decides to treat as a web page could run
    # scripts as if the site had written them. An ImageField gets this for free
    # (Pillow rejects anything that is not really an image); a FileField accepts
    # whatever it is handed, so the restriction has to be explicit.
    cv = models.FileField(
        upload_to="cv/",
        blank=True,
        validators=[FileExtensionValidator(["pdf"])],
        verbose_name="CV",
        help_text="Research sections only. A PDF. Adds a download button.",
    )
    is_published = models.BooleanField(
        default=True,
        verbose_name="Visible on the site",
        help_text="Untick to hide this leaf while you work on it.",
    )

    class Meta:
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.title or self.slug


class Piece(models.Model):
    """A photograph or scan shown in a section's gallery."""

    class Orientation(models.TextChoices):
        PORTRAIT = "portrait", "Taller than wide"
        LANDSCAPE = "landscape", "Wider than tall"
        SQUARE = "square", "Square"

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="pieces")
    image = models.ImageField(upload_to="pieces/%Y/%m/", help_text="JPEG or PNG.")
    title = models.CharField(max_length=140, help_text="Shown when the picture is opened.")
    year = models.PositiveIntegerField(null=True, blank=True)
    note = models.TextField(blank=True, help_text="An optional caption, shown when opened.")
    alt = models.CharField(
        max_length=250,
        blank=True,
        verbose_name="Description for screen readers",
        help_text=(
            "Describe the picture for people who cannot see it. Worth filling in. "
            "Left blank, the title is used instead."
        ),
    )
    orientation = models.CharField(
        max_length=12,
        choices=Orientation.choices,
        default=Orientation.PORTRAIT,
        verbose_name="Shape",
        help_text="Sets the shape of its cell in the grid.",
    )
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers come first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.title


class Publication(models.Model):
    """A paper, talk or thesis, for the research section."""

    class Kind(models.TextChoices):
        ARTICLE = "article", "Article"
        CHAPTER = "chapter", "Chapter"
        TALK = "talk", "Talk"
        POSTER = "poster", "Poster"
        THESIS = "thesis", "Thesis"
        PREPRINT = "preprint", "Preprint"

    section = models.ForeignKey(
        Section, on_delete=models.CASCADE, related_name="publications"
    )
    title = models.CharField(max_length=300)
    authors = models.CharField(max_length=300, blank=True)
    venue = models.CharField(
        max_length=200, blank=True, help_text="The journal, conference or institution."
    )
    year = models.PositiveIntegerField(null=True, blank=True)
    url = models.URLField(blank=True, help_text="Links the title, if you have a link.")
    kind = models.CharField(
        max_length=20, choices=Kind.choices, blank=True, verbose_name="Type"
    )
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers come first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.title


class Offering(models.Model):
    """A workshop, class or session, for the teaching section."""

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="offerings")
    title = models.CharField(max_length=140)
    blurb = models.TextField(blank=True, help_text="A sentence about what it covers.")
    audience = models.CharField(
        max_length=120, blank=True, help_text='For example "Beginners".'
    )
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers come first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.title
